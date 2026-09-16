create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text not null check (char_length(comment) between 5 and 1000),
  table_number text,
  status text not null default 'published' check (status in ('published', 'hidden')),
  created_at timestamptz not null default now()
);

alter table public.recommendations enable row level security;

create policy "public can read published recommendations"
  on public.recommendations for select
  to anon, authenticated
  using (status = 'published');

create policy "public can insert recommendations"
  on public.recommendations for insert
  to anon, authenticated
  with check (true);

create policy "staff can manage recommendations"
  on public.recommendations for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());
