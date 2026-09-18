-- Migración: Promociones del día y destacados (202609170002_promotions.sql)
-- Permite publicar promociones temporales o destacadas vinculadas opcionalmente a un producto del menú.

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 120),
  description text not null default '' check (char_length(description) <= 500),
  badge_text text check (char_length(badge_text) <= 30),
  image_url text,
  linked_menu_item_id uuid references public.menu_items(id) on delete set null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.promotions enable row level security;

-- Políticas de RLS para promociones
drop policy if exists "public can read active promotions" on public.promotions;
create policy "public can read active promotions"
  on public.promotions for select
  to anon, authenticated
  using (
    active = true
    and (starts_at <= now())
    and (ends_at is null or ends_at >= now())
  );

drop policy if exists "staff can read all promotions" on public.promotions;
create policy "staff can read all promotions"
  on public.promotions for select
  to authenticated
  using (public.is_staff());

drop policy if exists "admins can insert promotions" on public.promotions;
create policy "admins can insert promotions"
  on public.promotions for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "admins can update promotions" on public.promotions;
create policy "admins can update promotions"
  on public.promotions for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admins can delete promotions" on public.promotions;
create policy "admins can delete promotions"
  on public.promotions for delete
  to authenticated
  using (public.is_admin());
