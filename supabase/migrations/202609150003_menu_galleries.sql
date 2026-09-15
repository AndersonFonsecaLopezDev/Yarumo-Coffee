-- Store optional additional public image URLs for each menu item.
alter table if exists public.menu_items
  add column if not exists gallery_urls text[] not null default '{}';
