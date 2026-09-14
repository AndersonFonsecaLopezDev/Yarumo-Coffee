alter table if exists public.menu_items add column if not exists image_url text;

-- Permite que el catálogo cargue fotos alojadas en Supabase Storage cuando la URL
-- pública se guarda en menu_items.image_url. La carpeta/bucket puede crearse desde
-- Storage con nombre `menu-images` y visibilidad pública.
