-- ==============================================================================
-- CURADURÍA DEL CATÁLOGO, AUDITORÍA DE FOTOGRAFÍA Y NORMALIZACIÓN DE PRECIOS
-- Archivo: supabase/migrations/20261011_curacion_catalogo.sql
-- Yarumo Coffee · Armenia, Quindío, Colombia
-- ==============================================================================
-- NOTA IMPORTANTE:
-- Este script ha sido diseñado para aplicarse de forma segura en Supabase SQL Editor.
-- NO realiza operaciones destructivas (DROP/TRUNCATE). Preserva la integridad referencial
-- con pedidos y comandas existentes en order_request_items.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- SECCIÓN 1: CONSULTAS DE AUDITORÍA (LISTAS PARA EJECUTAR EN SUPABASE SQL EDITOR)
-- ------------------------------------------------------------------------------

-- 1.1 AUDITORÍA DE FOTOGRAFÍAS: Productos disponibles que NO tienen foto cargada
--     Muestra exactamente al dueño qué productos requieren sesión de fotografía.
/*
SELECT 
    mc.name AS categoria,
    mi.id AS producto_id,
    mi.name AS nombre_producto,
    mi.price_cop AS precio_cop,
    mi.available AS esta_disponible,
    CASE 
        WHEN mi.image_url IS NULL OR trim(mi.image_url) = '' THEN 'Sin foto principal'
        ELSE 'Foto ok'
    END AS estado_foto,
    coalesce(array_length(mi.gallery_urls, 1), 0) AS fotos_galeria_adicionales
FROM public.menu_items mi
LEFT JOIN public.menu_categories mc ON mi.category_id = mc.id
WHERE mi.available = true 
  AND (mi.image_url IS NULL OR trim(mi.image_url) = '')
ORDER BY mc.sort_order ASC, mi.name ASC;
*/

-- 1.2 AUDITORÍA DE PRECIOS: Productos con precios sospechosos o de prueba
--     Detecta valores 0, precios irrisorios (< $1.500 COP) o excesivos (> $80.000 COP)
/*
SELECT 
    mi.id,
    mi.name,
    mi.category,
    mi.price_cop,
    mi.available
FROM public.menu_items mi
WHERE mi.price_cop < 1500 OR mi.price_cop > 80000
ORDER BY mi.price_cop ASC;
*/

-- 1.3 AUDITORÍA DE PRODUCTOS DE PRUEBA O GENÉRICOS
/*
SELECT 
    mi.id,
    mi.name,
    mi.category,
    mi.price_cop,
    mi.available
FROM public.menu_items mi
WHERE lower(mi.name) LIKE '%test%'
   OR lower(mi.name) LIKE '%prueba%'
   OR lower(mi.name) LIKE '%asdf%'
   OR char_length(trim(mi.name)) <= 2;
*/


-- ------------------------------------------------------------------------------
-- SECCIÓN 2: PROTECCIÓN Y RESTRICCIONES DE INTEGRIDAD EN PRECIOS
-- ------------------------------------------------------------------------------

-- Asegurar que ningún producto nuevo o editado tenga precios ilógicos en COP.
-- Un café de especialidad en Armenia suele oscilar entre $3.000 y $45.000 COP.
-- Permitimos un rango holgado y seguro entre $1.000 y $150.000 COP para evitar errores tipográficos.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_menu_items_price_realistic'
  ) THEN
    ALTER TABLE public.menu_items
    ADD CONSTRAINT check_menu_items_price_realistic
    CHECK (price_cop >= 1000 AND price_cop <= 150000);
  END IF;
END $$;


-- ------------------------------------------------------------------------------
-- SECCIÓN 3: SANEAMIENTO DE PRODUCTOS DE PRUEBA Y CATEGORIZACIÓN
-- ------------------------------------------------------------------------------

-- Deshabilitar disponibilidad (sin eliminar) de productos con nombres de prueba para no corromper comandas pasadas
UPDATE public.menu_items
SET available = false
WHERE available = true
  AND (
    lower(name) LIKE '%test%'
    OR lower(name) LIKE '%prueba%'
    OR lower(name) LIKE '%asdf%'
    OR char_length(trim(name)) <= 2
  );

-- Reclasificar productos huérfanos o en 'Otros' que pertenecen claramente a una categoría
-- Ejemplo: Bebidas de café ubicadas por error en 'Otros'
UPDATE public.menu_items
SET category_id = (SELECT id FROM public.menu_categories WHERE slug = 'bebidas-calientes' LIMIT 1),
    category = 'Bebidas Calientes'
WHERE category = 'Otros'
  AND (
    lower(name) LIKE '%espresso%'
    OR lower(name) LIKE '%cappuccino%'
    OR lower(name) LIKE '%latte%'
    OR lower(name) LIKE '%mocaccino%'
    OR lower(name) LIKE '%americano%'
    OR lower(name) LIKE '%tinto%'
    OR lower(name) LIKE '%prensa%'
    OR lower(name) LIKE '%v60%'
    OR lower(name) LIKE '%chemex%'
  );

-- Bebidas frías de café o jugos ubicados por error en 'Otros'
UPDATE public.menu_items
SET category_id = (SELECT id FROM public.menu_categories WHERE slug = 'bebidas-frias' LIMIT 1),
    category = 'Bebidas Frías'
WHERE category = 'Otros'
  AND (
    lower(name) LIKE '%frapp%'
    OR lower(name) LIKE '%granizado%'
    OR lower(name) LIKE '%nevado%'
    OR lower(name) LIKE '%cold brew%'
    OR lower(name) LIKE '%jugo%'
    OR lower(name) LIKE '%limonada%'
  );


-- ------------------------------------------------------------------------------
-- SECCIÓN 4: PROPUESTA DE DESCRIPCIONES DE ESPECIALIDAD (HISTORIA Y NOTAS DE CATA)
-- ------------------------------------------------------------------------------
-- Enriquece el catálogo con valor agronómico y gastronómico propio del Paisaje Cultural Cafetero.

-- 4.1 Espresso Yarumo / Espresso Sencillo
UPDATE public.menu_items
SET description = 'Extracción precisa de café 100% arábica cultivado en la cordillera del Quindío (1.550 msnm). Perfil balanceado con crema densa y avellanada, notas a chocolate amargo, panela y sutil acidez cítrica.'
WHERE lower(name) in ('espresso', 'espresso sencillo', 'expreso', 'espresso yarumo')
  AND (description IS NULL OR char_length(trim(description)) < 25);

-- 4.2 Cappuccino Tradicional
UPDATE public.menu_items
SET description = 'Espresso doble armonizado con leche cremada a temperatura óptima (65°C), logrando una microespuma sedosa y dulce natural sin azúcares añadidos. Decorado con arte latte.'
WHERE lower(name) in ('cappuccino', 'capuchino', 'cappuccino tradicional')
  AND (description IS NULL OR char_length(trim(description)) < 25);

-- 4.3 Métodos Filtrados (V60 / Prensa Francesa / Aeropress)
UPDATE public.menu_items
SET description = 'Filtrado artesanal en mesa. Destaca la pureza del grano quindiano con taza limpia, cuerpo ligero a medio, fragancia floral y notas dulces a caña de azúcar y frutas amarillas.'
WHERE (lower(name) LIKE '%v60%' OR lower(name) LIKE '%prensa francesa%' OR lower(name) LIKE '%aeropress%' OR lower(name) LIKE '%chemex%')
  AND (description IS NULL OR char_length(trim(description)) < 25);

-- 4.4 Granizado o Nevado Yarumo
UPDATE public.menu_items
SET description = 'Bebida fría refrescante a base de concentración de espresso de origen, leche seleccionada y hielo finamente frappé. Coronado con crema chantilly y canela molida.'
WHERE (lower(name) LIKE '%granizado%' OR lower(name) LIKE '%nevado%')
  AND (description IS NULL OR char_length(trim(description)) < 25);


-- ------------------------------------------------------------------------------
-- SECCIÓN 5: RESUMEN DE ESTADO TRAS APLICAR
-- ------------------------------------------------------------------------------
-- Muestra el total de productos disponibles por categoría y porcentaje con foto.
/*
SELECT 
    mc.name AS categoria,
    count(mi.id) AS total_productos,
    count(mi.id) FILTER (WHERE mi.image_url IS NOT NULL AND trim(mi.image_url) <> '') AS con_fotografia,
    count(mi.id) FILTER (WHERE mi.image_url IS NULL OR trim(mi.image_url) = '') AS pendientes_foto,
    round(
        (count(mi.id) FILTER (WHERE mi.image_url IS NOT NULL AND trim(mi.image_url) <> '')::numeric / NULLIF(count(mi.id), 0)) * 100, 
        1
    ) AS porcentaje_cobertura_fotos
FROM public.menu_categories mc
LEFT JOIN public.menu_items mi ON mc.id = mi.category_id AND mi.available = true
GROUP BY mc.id, mc.name, mc.sort_order
ORDER BY mc.sort_order ASC;
*/
