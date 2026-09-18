-- Migración: Toma manual de pedidos por staff, historial en tiempo real y moderación de reseñas (202609170004_staff_orders_and_history.sql)

-- 1. Agregar columna source a order_requests para distinguir pedidos de clientes y meseros
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_requests' and column_name = 'source'
  ) then
    alter table public.order_requests add column source text not null default 'customer' check (source in ('customer', 'staff'));
  end if;
end $$;

-- 2. Política para que el staff pueda insertar pedidos directamente
drop policy if exists "staff can insert orders" on public.order_requests;
create policy "staff can insert orders"
  on public.order_requests for insert
  to authenticated
  with check (public.is_staff());

-- 3. Función RPC para que el cliente consulte los pedidos de su mesa (últimas 6 horas) con sus ítems
create or replace function public.get_table_orders(
  p_table_id uuid,
  p_table_token text
)
returns table (
  id uuid,
  status text,
  notes text,
  source text,
  created_at timestamptz,
  acknowledged_at timestamptz,
  delivered_at timestamptz,
  items jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- Validar que la mesa existe, está activa y el token coincide
  if not exists (
    select 1 from public.cafe_tables
    where id = p_table_id and public_token = p_table_token and active = true
  ) then
    return;
  end if;

  return query
  select
    o.id,
    o.status,
    o.notes,
    o.source,
    o.created_at,
    o.acknowledged_at,
    o.delivered_at,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', i.id,
            'name_snapshot', i.name_snapshot,
            'price_cop_snapshot', i.price_cop_snapshot,
            'quantity', i.quantity,
            'item_notes', i.item_notes
          )
        )
        from public.order_request_items i
        where i.order_request_id = o.id
      ),
      '[]'::jsonb
    ) as items
  from public.order_requests o
  where o.table_id = p_table_id
    and o.created_at >= now() - interval '6 hours'
  order by o.created_at desc;
end;
$$;

revoke all on function public.get_table_orders(uuid, text) from public;
grant execute on function public.get_table_orders(uuid, text) to anon, authenticated;

-- 4. Función RPC para toma manual de pedidos por parte del mesero autenticado
create or replace function public.staff_submit_order_request(
  p_table_id uuid,
  p_notes text default '',
  p_items jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table_token text;
  v_order_id uuid;
  v_item jsonb;
  v_menu_id uuid;
  v_qty int;
  v_item_notes text;
  v_menu_name text;
  v_menu_price int;
  v_menu_avail boolean;
  v_created_at timestamptz;
begin
  -- 1. Validar que quien ejecuta es staff
  if not public.is_staff() then
    raise exception 'No autorizado. Solo el personal de staff puede usar esta función.';
  end if;

  -- 2. Validar que la mesa exista y esté activa
  select public_token into v_table_token
  from public.cafe_tables
  where id = p_table_id and active = true;

  if not found then
    raise exception 'La mesa seleccionada no está activa o no existe.';
  end if;

  -- 3. Validar que haya productos
  if jsonb_array_length(p_items) = 0 then
    raise exception 'Debes seleccionar al menos un producto para la comanda.';
  end if;

  -- 4. Crear cabecera de comanda con source = staff
  insert into public.order_requests (table_id, table_token, notes, status, source)
  values (p_table_id, v_table_token, coalesce(p_notes, ''), 'pending', 'staff')
  returning id, created_at into v_order_id, v_created_at;

  -- 5. Procesar items con snapshot de precio y disponibilidad
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_menu_id := (v_item->>'menu_item_id')::uuid;
    v_qty := coalesce((v_item->>'quantity')::int, 1);
    v_item_notes := coalesce(v_item->>'item_notes', '');

    if v_qty < 1 or v_qty > 20 then
      raise exception 'Cantidad inválida para uno de los productos (1 a 20).';
    end if;

    select name, price_cop, available
    into v_menu_name, v_menu_price, v_menu_avail
    from public.menu_items
    where id = v_menu_id;

    if not found then
      raise exception 'El producto seleccionado no existe en el catálogo.';
    end if;

    if not v_menu_avail then
      raise exception 'El producto "%" está marcado como no disponible.', v_menu_name;
    end if;

    insert into public.order_request_items (
      order_request_id,
      menu_item_id,
      name_snapshot,
      price_cop_snapshot,
      quantity,
      item_notes
    )
    values (
      v_order_id,
      v_menu_id,
      v_menu_name,
      v_menu_price,
      v_qty,
      v_item_notes
    );
  end loop;

  return jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'created_at', v_created_at
  );
end;
$$;

revoke all on function public.staff_submit_order_request(uuid, text, jsonb) from public;
grant execute on function public.staff_submit_order_request(uuid, text, jsonb) to authenticated;

-- 5. Moderación de Reseñas: permitir status 'pending' y fijarlo por defecto
alter table if exists public.recommendations drop constraint if exists recommendations_status_check;
alter table if exists public.recommendations add constraint recommendations_status_check check (status in ('published', 'pending', 'hidden'));
alter table if exists public.recommendations alter column status set default 'pending';
