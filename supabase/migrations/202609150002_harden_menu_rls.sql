-- Ensure the menu policies are enforced in existing environments.
alter table if exists public.menu_items enable row level security;
