-- Migración 202610120002: Soporte para contenido en inglés (name_en, description_en) en catálogo y promociones

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS description_en text;

ALTER TABLE public.menu_categories
  ADD COLUMN IF NOT EXISTS name_en text;

ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS title_en text,
  ADD COLUMN IF NOT EXISTS description_en text;

COMMENT ON COLUMN public.menu_items.name_en IS 'Nombre del producto en inglés (opcional, fallback a name)';
COMMENT ON COLUMN public.menu_items.description_en IS 'Descripción del producto en inglés (opcional, fallback a description)';
COMMENT ON COLUMN public.menu_categories.name_en IS 'Nombre de categoría en inglés (opcional, fallback a name)';
COMMENT ON COLUMN public.promotions.title_en IS 'Título de promoción en inglés (opcional, fallback a title)';
COMMENT ON COLUMN public.promotions.description_en IS 'Descripción de promoción en inglés (opcional, fallback a description)';
