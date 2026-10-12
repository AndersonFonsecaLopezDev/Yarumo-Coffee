-- ============================================================================
-- Migración: Opciones guiadas por datos y cálculo de deltas en submit_order_request
-- Tablas: menu_item_option_groups y menu_item_option_choices
-- RLS reforzada: lectura pública solo de opciones activas de productos disponibles;
-- escritura restringida exclusivamente a public.is_staff()
-- ============================================================================

-- 1. Tabla de Grupos de Opciones
create table if not exists public.menu_item_option_groups (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  name text not null,
  kind text not null default 'single' check (kind in ('single', 'multi')),
  required boolean not null default false,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Índices para búsqueda rápida
create index if not exists idx_menu_item_option_groups_item
  on public.menu_item_option_groups(menu_item_id)
  where active = true;

-- 2. Tabla de Opciones / Variantes individuales
create table if not exists public.menu_item_option_choices (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.menu_item_option_groups(id) on delete cascade,
  label text not null,
  price_delta_cop int not null default 0 check (price_delta_cop >= 0),
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_menu_item_option_choices_group
  on public.menu_item_option_choices(group_id)
  where active = true;

-- 3. Habilitar RLS estricta
alter table public.menu_item_option_groups enable row level security;
alter table public.menu_item_option_choices enable row level security;

-- Políticas de lectura para público y anon (solo activos de productos disponibles)
drop policy if exists "public can read active option groups of available items" on public.menu_item_option_groups;
create policy "public can read active option groups of available items"
  on public.menu_item_option_groups for select
  to anon, authenticated
  using (
    active = true and exists (
      select 1 from public.menu_items m
      where m.id = menu_item_option_groups.menu_item_id and m.available = true
    )
  );

drop policy if exists "public can read active option choices of available items" on public.menu_item_option_choices;
create policy "public can read active option choices of available items"
  on public.menu_item_option_choices for select
  to anon, authenticated
  using (
    active = true and exists (
      select 1 from public.menu_item_option_groups g
      join public.menu_items m on m.id = g.menu_item_id
      where g.id = menu_item_option_choices.group_id
        and g.active = true
        and m.available = true
    )
  );

-- Políticas de lectura completa para staff
drop policy if exists "staff can read all option groups" on public.menu_item_option_groups;
create policy "staff can read all option groups"
  on public.menu_item_option_groups for select
  to authenticated
  using (public.is_staff());

drop policy if exists "staff can read all option choices" on public.menu_item_option_choices;
create policy "staff can read all option choices"
  on public.menu_item_option_choices for select
  to authenticated
  using (public.is_staff());

-- Políticas de escritura para staff (prohibido using(true))
drop policy if exists "staff can insert option groups" on public.menu_item_option_groups;
create policy "staff can insert option groups"
  on public.menu_item_option_groups for insert
  to authenticated
  with check (public.is_staff());

drop policy if exists "staff can update option groups" on public.menu_item_option_groups;
create policy "staff can update option groups"
  on public.menu_item_option_groups for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "staff can delete option groups" on public.menu_item_option_groups;
create policy "staff can delete option groups"
  on public.menu_item_option_groups for delete
  to authenticated
  using (public.is_staff());

drop policy if exists "staff can insert option choices" on public.menu_item_option_choices;
create policy "staff can insert option choices"
  on public.menu_item_option_choices for insert
  to authenticated
  with check (public.is_staff());

drop policy if exists "staff can update option choices" on public.menu_item_option_choices;
create policy "staff can update option choices"
  on public.menu_item_option_choices for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "staff can delete option choices" on public.menu_item_option_choices;
create policy "staff can delete option choices"
  on public.menu_item_option_choices for delete
  to authenticated
  using (public.is_staff());

-- 4. Actualización de submit_order_request con cálculo de precio en el servidor
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
  v_menu_base_price int;
  v_effective_price int;
  v_menu_avail boolean;
  v_created_at timestamptz;
  v_choice_id text;
  v_choice_record record;
  v_choices_text text;
  v_final_notes text;
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
    into v_menu_name, v_menu_base_price, v_menu_avail
    from public.menu_items
    where id = v_menu_id;

    if not found then
      raise exception 'Uno de los productos seleccionados ya no existe en la carta.';
    end if;

    if not v_menu_avail then
      raise exception 'El producto "%" no está disponible en este momento.', v_menu_name;
    end if;

    v_effective_price := v_menu_base_price;
    v_choices_text := '';

    -- Validar y calcular opciones / variantes seleccionadas en el servidor
    if v_item ? 'option_choice_ids' and jsonb_typeof(v_item->'option_choice_ids') = 'array' then
      for v_choice_id in select jsonb_array_elements_text(v_item->'option_choice_ids')
      loop
        select c.id, c.label, c.price_delta_cop, g.name as group_name
        into v_choice_record
        from public.menu_item_option_choices c
        join public.menu_item_option_groups g on g.id = c.group_id
        where c.id = v_choice_id::uuid
          and c.active = true
          and g.active = true
          and g.menu_item_id = v_menu_id;

        if not found then
          raise exception 'Una de las opciones seleccionadas no es válida para el producto "%".', v_menu_name;
        end if;

        v_effective_price := v_effective_price + v_choice_record.price_delta_cop;
        
        if v_choices_text <> '' then
          v_choices_text := v_choices_text || ', ';
        end if;
        v_choices_text := v_choices_text || v_choice_record.label;
      end loop;
    end if;

    -- Construir notas finales con snapshot de opciones elegidas
    if v_choices_text <> '' then
      if v_item_notes <> '' then
        v_final_notes := v_choices_text || ' | ' || v_item_notes;
      else
        v_final_notes := v_choices_text;
      end if;
    else
      v_final_notes := v_item_notes;
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
      v_effective_price,
      v_qty,
      v_final_notes
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
