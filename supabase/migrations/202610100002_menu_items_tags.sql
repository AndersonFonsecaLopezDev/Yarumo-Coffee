-- ============================================================================
-- Migración opcional para etiquetas descriptivas de productos del menú
-- Añade la columna 'tags' como arreglo de texto para categorizar badges como
-- 'Nuevo', 'Recomendado del barista', 'Vegano', 'Sin azúcar añadida'.
-- No modifica las políticas RLS existentes.
-- ============================================================================

alter table public.menu_items
add column if not exists tags text[] default '{}'::text[];

-- Comentario informativo en el catálogo de PostgreSQL
comment on column public.menu_items.tags is 'Etiquetas visuales opcionales (ej: Nuevo, Vegano, Recomendado del barista)';
