-- Migración: Unificación de taxonomía de categorías de menú (202609180001_unify_menu_taxonomy.sql)
-- Consolida taxonomías divergentes ('Café', 'Frío', 'Para comer', 'Sánduches' vs categorías normalizadas),
-- añade slug a menu_categories, sincroniza category_id y category en menu_items sin pérdida de datos.

-- 1. Asegurar tabla menu_categories con columna slug
create table if not exists public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 80),
  slug text,
  icon text not null default '✨' check (char_length(icon) <= 10),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Asegurar columna slug si la tabla ya existía sin ella
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'menu_categories' and column_name = 'slug'
  ) then
    alter table public.menu_categories add column slug text;
  end if;
end $$;

-- 2. Asegurar y actualizar las 10 categorías canónicas de Yarumo Coffee
insert into public.menu_categories (name, slug, icon, sort_order, active) values
  ('Bebidas Calientes', 'bebidas-calientes', '♨️', 1, true),
  ('Bebidas Frías', 'bebidas-frias', '🧊', 2, true),
  ('Gaseosas', 'gaseosas', '🥤', 3, true),
  ('Cervezas', 'cervezas', '🍺', 4, true),
  ('Antojitos Panaderos', 'antojitos-panaderos', '🥐', 5, true),
  ('Sándwiches', 'sandwiches', '🥪', 6, true),
  ('Tortas y Brownies', 'tortas-y-brownies', '🍰', 7, true),
  ('Hojaldrados', 'hojaldrados', '🥟', 8, true),
  ('Pizzetas', 'pizzetas', '🍕', 9, true),
  ('Otros', 'otros', '✨', 10, true)
on conflict (name) do update set
  slug = excluded.slug,
  icon = excluded.icon,
  sort_order = excluded.sort_order,
  active = excluded.active;

-- Asignar slug por defecto a cualquier otra categoría que exista sin slug
update public.menu_categories
set slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))
where slug is null or slug = '';

-- Asegurar restricción unique y check en slug
alter table public.menu_categories alter column slug set not null;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'menu_categories_slug_unique'
  ) then
    alter table public.menu_categories add constraint menu_categories_slug_unique unique (slug);
  end if;
end $$;

-- 3. Consolidar categorías solapadas en menu_items
-- A. 'Café' -> 'Bebidas Calientes'
update public.menu_items
set category = 'Bebidas Calientes'
where category in ('Café', 'Cafe', 'Cafes', 'Cafés');

-- B. 'Frío' -> 'Bebidas Frías'
update public.menu_items
set category = 'Bebidas Frías'
where category in ('Frío', 'Frio', 'Bebida Fría', 'Bebidas Frias');

-- C. 'Sánduches' -> 'Sándwiches'
update public.menu_items
set category = 'Sándwiches'
where category in ('Sánduches', 'Sanduches', 'Sandwich');

-- D. 'Para comer' -> mapeo inteligente por producto real
update public.menu_items
set category = 'Tortas y Brownies'
where category = 'Para comer'
  and (lower(name) like '%torta%' or lower(name) like '%brownie%' or lower(name) like '%cheesecake%');

update public.menu_items
set category = 'Hojaldrados'
where category = 'Para comer'
  and (lower(name) like '%hojaldre%' or lower(name) like '%hojaldrado%');

update public.menu_items
set category = 'Sándwiches'
where category = 'Para comer'
  and (lower(name) like '%sandwich%' or lower(name) like '%sándwich%' or lower(name) like '%sanduche%' or lower(name) like '%sánduche%');

update public.menu_items
set category = 'Pizzetas'
where category = 'Para comer'
  and (lower(name) like '%pizzeta%' or lower(name) like '%pizza%');

-- Resto de 'Para comer' -> 'Antojitos Panaderos'
update public.menu_items
set category = 'Antojitos Panaderos'
where category = 'Para comer';

-- 4. Asegurar columna category_id en menu_items
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'menu_items' and column_name = 'category_id'
  ) then
    alter table public.menu_items add column category_id uuid references public.menu_categories(id) on delete restrict;
  end if;
end $$;

-- 5. Sincronizar category_id en todos los menu_items
update public.menu_items m
set category_id = c.id
from public.menu_categories c
where m.category = c.name;

-- Si algún ítem quedó con category_id nulo por nombre no coincidente, asignar a 'Otros'
update public.menu_items m
set category_id = (select id from public.menu_categories where name = 'Otros' limit 1),
    category = 'Otros'
where m.category_id is null;

-- 6. Limpiar categorías obsoletas sin ítems vinculados
delete from public.menu_categories
where name in ('Café', 'Frío', 'Para comer', 'Sánduches')
  and not exists (
    select 1 from public.menu_items where category_id = menu_categories.id or category = menu_categories.name
  );

-- 7. Crear índice para optimizar consultas por categoría
create index if not exists menu_items_category_id_idx on public.menu_items(category_id);
create index if not exists menu_categories_sort_idx on public.menu_categories(sort_order, name);
