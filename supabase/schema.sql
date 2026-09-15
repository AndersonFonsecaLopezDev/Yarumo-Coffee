create extension if not exists pgcrypto;

create type public.request_type as enum ('waiter', 'bill');
create type public.request_status as enum ('pending', 'acknowledged', 'done', 'cancelled');

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  description text not null default '' check (char_length(description) <= 500),
  price_cop integer not null check (price_cop >= 0),
  category text not null check (category in ('Bebidas Calientes', 'Bebidas Frías', 'Gaseosas', 'Cervezas', 'Antojitos Panaderos', 'Sándwiches', 'Sánduches', 'Tortas y Brownies', 'Hojaldrados', 'Pizzetas', 'Café', 'Frío', 'Para comer', 'Otros')),
  image_url text,
  gallery_urls text[] not null default '{}',
  available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.staff_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'staff' check (role in ('owner', 'manager', 'staff')),
  created_at timestamptz not null default now()
);

create table public.cafe_tables (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  public_token text not null unique default encode(gen_random_bytes(18), 'hex'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.cafe_tables(id),
  table_token text not null,
  type public.request_type not null,
  status public.request_status not null default 'pending',
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  completed_at timestamptz,
  handled_by uuid references auth.users(id)
);

alter table public.staff_profiles enable row level security;
alter table public.cafe_tables enable row level security;
alter table public.service_requests enable row level security;
alter table public.menu_items enable row level security;

create or replace function public.is_staff() returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.staff_profiles where user_id = auth.uid());
$$;

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.staff_profiles where user_id = auth.uid() and role in ('owner', 'manager'));
$$;

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger menu_items_touch_updated_at before update on public.menu_items for each row execute function public.touch_updated_at();

create index service_requests_status_created_idx on public.service_requests(status, created_at desc);
create index service_requests_table_created_idx on public.service_requests(table_id, created_at desc);
create index menu_items_available_sort_idx on public.menu_items(available, sort_order, name);

create policy "staff can read own profile" on public.staff_profiles for select to authenticated using (user_id = auth.uid());
create policy "staff can read tables" on public.cafe_tables for select to authenticated using (public.is_staff());
create policy "public can read available menu" on public.menu_items for select to anon, authenticated using (available = true);
create policy "staff can read all menu" on public.menu_items for select to authenticated using (public.is_staff());
create policy "admins can create menu" on public.menu_items for insert to authenticated with check (public.is_admin());
create policy "admins can update menu" on public.menu_items for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins can delete menu" on public.menu_items for delete to authenticated using (public.is_admin());
create or replace function public.get_table_by_token(token text) returns table(id uuid, label text) language sql stable security definer set search_path = public as $$
  select id, label from public.cafe_tables where public_token = token and active = true limit 1;
$$;
revoke all on function public.get_table_by_token(text) from public;
grant execute on function public.get_table_by_token(text) to anon, authenticated;
create or replace function public.can_create_request(request_table uuid, request_token text, request_type public.request_type) returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.cafe_tables t where t.id = request_table and t.public_token = request_token and t.active = true)
    and not exists(select 1 from public.service_requests r where r.table_id = request_table and r.type = request_type and r.status in ('pending','acknowledged') and r.created_at > now() - interval '60 seconds');
$$;
revoke all on function public.can_create_request(uuid, text, public.request_type) from public;
grant execute on function public.can_create_request(uuid, text, public.request_type) to anon, authenticated;
create policy "public can create request for matching active table" on public.service_requests for insert to anon, authenticated with check (public.can_create_request(table_id, table_token, type));
create policy "staff can read requests" on public.service_requests for select to authenticated using (public.is_staff());
create policy "staff can update requests" on public.service_requests for update to authenticated using (public.is_staff()) with check (public.is_staff());

alter publication supabase_realtime add table public.service_requests;

-- Never expose the service_role key in Next.js or the browser.
-- After creating staff users in Supabase Auth, insert their user_id into staff_profiles.
