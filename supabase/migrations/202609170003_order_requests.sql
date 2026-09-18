-- Migración: Pedidos a la mesa desde la carta (202609170003_order_requests.sql)
-- Crea las tablas order_requests y order_request_items, funciones de validación y anti-spam,
-- RPC transaccional submit_order_request y publicación en realtime.

create table if not exists public.order_requests (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.cafe_tables(id),
  table_token text not null,
  status text not null default 'pending' check (status in ('pending', 'acknowledged', 'preparing', 'delivered', 'cancelled')),
  notes text not null default '' check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  delivered_at timestamptz,
  handled_by uuid references auth.users(id)
);

create table if not exists public.order_request_items (
  id uuid primary key default gen_random_uuid(),
  order_request_id uuid not null references public.order_requests(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  name_snapshot text not null check (char_length(name_snapshot) >= 1),
  price_cop_snapshot integer not null check (price_cop_snapshot >= 0),
  quantity integer not null check (quantity between 1 and 20),
  item_notes text not null default '' check (char_length(item_notes) <= 200),
  created_at timestamptz not null default now()
);

alter table public.order_requests enable row level security;
alter table public.order_request_items enable row level security;

create index if not exists order_requests_status_created_idx on public.order_requests(status, created_at desc);
create index if not exists order_requests_table_created_idx on public.order_requests(table_id, created_at desc);
create index if not exists order_request_items_order_idx on public.order_request_items(order_request_id);

-- Función anti-spam y validación de mesa activa para pedidos
create or replace function public.can_create_order(request_table uuid, request_token text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.cafe_tables t
    where t.id = request_table
      and t.public_token = request_token
      and t.active = true
  )
  and not exists(
    select 1 from public.order_requests r
    where r.table_id = request_table
      and r.status in ('pending', 'acknowledged', 'preparing')
      and r.created_at > now() - interval '45 seconds'
  );
$$;

revoke all on function public.can_create_order(uuid, text) from public;
grant execute on function public.can_create_order(uuid, text) to anon, authenticated;

-- Políticas de RLS
drop policy if exists "public can create order for matching active table" on public.order_requests;
create policy "public can create order for matching active table"
  on public.order_requests for insert
  to anon, authenticated
  with check (public.can_create_order(table_id, table_token));

drop policy if exists "staff can read orders" on public.order_requests;
create policy "staff can read orders"
  on public.order_requests for select
  to authenticated
  using (public.is_staff());

drop policy if exists "staff can update orders" on public.order_requests;
create policy "staff can update orders"
  on public.order_requests for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "public can insert order items" on public.order_request_items;
create policy "public can insert order items"
  on public.order_request_items for insert
  to anon, authenticated
  with check (true);

drop policy if exists "staff can read order items" on public.order_request_items;
create policy "staff can read order items"
  on public.order_request_items for select
  to authenticated
  using (public.is_staff());

-- Función RPC transaccional y segura para procesar pedidos de clientes
create or replace function public.submit_order_request(
  p_table_id uuid,
  p_table_token text,
  p_notes text default '',
  p_items jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
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
  -- 1. Validar mesa y token activo con protección anti-spam
  if not public.can_create_order(p_table_id, p_table_token) then
    raise exception 'No es posible crear el pedido en este momento. Verifica tu mesa o espera unos segundos antes de reintentar.';
  end if;

  -- 2. Validar que la lista de items no esté vacía
  if jsonb_array_length(p_items) = 0 then
    raise exception 'El carrito está vacío. Agrega productos antes de enviar el pedido.';
  end if;

  -- 3. Crear cabecera de la orden
  insert into public.order_requests (table_id, table_token, notes, status)
  values (p_table_id, p_table_token, coalesce(p_notes, ''), 'pending')
  returning id, created_at into v_order_id, v_created_at;

  -- 4. Validar e insertar cada ítem tomando snapshot de precio y disponibilidad actual
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_menu_id := (v_item->>'menu_item_id')::uuid;
    v_qty := coalesce((v_item->>'quantity')::int, 1);
    v_item_notes := coalesce(v_item->>'item_notes', '');

    if v_qty < 1 or v_qty > 20 then
      raise exception 'Cantidad inválida para uno de los productos (debe ser entre 1 y 20).';
    end if;

    select name, price_cop, available
    into v_menu_name, v_menu_price, v_menu_avail
    from public.menu_items
    where id = v_menu_id;

    if not found then
      raise exception 'Uno de los productos seleccionados ya no existe en la carta.';
    end if;

    if not v_menu_avail then
      raise exception 'El producto "%" no está disponible en este momento.', v_menu_name;
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

revoke all on function public.submit_order_request(uuid, text, text, jsonb) from public;
grant execute on function public.submit_order_request(uuid, text, text, jsonb) to anon, authenticated;

-- Agregar a publicación Realtime de Supabase
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.order_requests;
    exception when duplicate_object then
      null;
    end;
    begin
      alter publication supabase_realtime add table public.order_request_items;
    exception when duplicate_object then
      null;
    end;
  end if;
end $$;
