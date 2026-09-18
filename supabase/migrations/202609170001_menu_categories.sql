-- Migración: Categorías dinámicas de menú (202609170001_menu_categories.sql)
-- Crea la tabla public.menu_categories, puebla las categorías iniciales,
-- añade category_id a menu_items, vincula los productos existentes preservando datos,
-- y configura RLS.

create table if not exists public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 80),
  icon text not null default '✨' check (char_length(icon) <= 10),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.menu_categories enable row level security;

-- Seed inicial de categorías basado en la carta real de Yarumo Coffee
insert into public.menu_categories (name, icon, sort_order, active) values
  ('Bebidas Calientes', '♨️', 1, true),
  ('Bebidas Frías', '🧊', 2, true),
  ('Gaseosas', '🥤', 3, true),
  ('Cervezas', '🍺', 4, true),
  ('Antojitos Panaderos', '🥐', 5, true),
  ('Sándwiches', '🥪', 6, true),
  ('Tortas y Brownies', '🍰', 7, true),
  ('Hojaldrados', '🥟', 8, true),
  ('Pizzetas', '🍕', 9, true),
  ('Otros', '✨', 10, true)
on conflict (name) do update set
  icon = excluded.icon,
  sort_order = excluded.sort_order,
  active = excluded.active;

-- Agregar columna category_id a menu_items si no existe
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'menu_items' and column_name = 'category_id'
  ) then
    alter table public.menu_items add column category_id uuid references public.menu_categories(id) on delete restrict;
  end if;
end $$;

-- Mapear y poblar category_id en menu_items existentes según el texto de category
update public.menu_items m
set category_id = c.id
from public.menu_categories c
where (m.category = c.name or (m.category = 'Sánduches' and c.name = 'Sándwiches'))
  and m.category_id is null;

-- Si alguna categoría no mapeó por tener otro texto, asignarle la categoría correspondiente o crearla
insert into public.menu_categories (name, icon, sort_order, active)
select distinct category, '✨', 99, true
from public.menu_items
where category_id is null and category is not null and category != ''
on conflict (name) do nothing;

update public.menu_items m
set category_id = c.id
from public.menu_categories c
where m.category = c.name
  and m.category_id is null;

-- Relajar el check constraint estático de menu_items.category si existe
alter table if exists public.menu_items drop constraint if exists menu_items_category_check;

-- Políticas de RLS para menu_categories
drop policy if exists "public can read active categories" on public.menu_categories;
create policy "public can read active categories"
  on public.menu_categories for select
  to anon, authenticated
  using (active = true);

drop policy if exists "staff can read all categories" on public.menu_categories;
create policy "staff can read all categories"
  on public.menu_categories for select
  to authenticated
  using (public.is_staff());

drop policy if exists "admins can insert categories" on public.menu_categories;
create policy "admins can insert categories"
  on public.menu_categories for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "admins can update categories" on public.menu_categories;
create policy "admins can update categories"
  on public.menu_categories for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admins can delete categories" on public.menu_categories;
create policy "admins can delete categories"
  on public.menu_categories for delete
  to authenticated
  using (public.is_admin());
