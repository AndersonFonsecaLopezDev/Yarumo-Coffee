-- Actualización de categorías del menú real de Yarumo Coffee
alter table if exists public.menu_items drop constraint if exists menu_items_category_check;

alter table if exists public.menu_items add constraint menu_items_category_check check (
  category in (
    'Bebidas Calientes',
    'Bebidas Frías',
    'Gaseosas',
    'Cervezas',
    'Antojitos Panaderos',
    'Sándwiches',
    'Sánduches',
    'Tortas y Brownies',
    'Hojaldrados',
    'Pizzetas',
    'Café',
    'Frío',
    'Para comer',
    'Otros'
  )
);
