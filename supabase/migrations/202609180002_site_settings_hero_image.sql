-- Migración: Tabla de configuración del sitio y foto de portada del homepage (202609180002_site_settings_hero_image.sql)
create table if not exists public.site_settings (
  key text primary key check (char_length(key) between 1 and 60),
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

drop policy if exists "public can read site settings" on public.site_settings;
create policy "public can read site settings"
  on public.site_settings for select
  to anon, authenticated
  using (true);

drop policy if exists "admins can insert site settings" on public.site_settings;
create policy "admins can insert site settings"
  on public.site_settings for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "admins can update site settings" on public.site_settings;
create policy "admins can update site settings"
  on public.site_settings for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Foto de portada inicial
insert into public.site_settings (key, value)
values ('hero_image_url', '/yarumo-cover-cafe.webp')
on conflict (key) do nothing;
