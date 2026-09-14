insert into public.cafe_tables (label) values ('1'), ('2'), ('3'), ('4') on conflict (label) do nothing;

insert into public.menu_items (name, slug, description, price_cents, category, sort_order) values
('Yarumo latte','yarumo-latte','Espresso, leche vaporizada y miel.',12000,'Café',1),
('Espresso doble','espresso-doble','Corto, intenso y servido con calma.',8000,'Café',2),
('Filtrado V60','filtrado-v60','Una taza para descubrir matices.',10000,'Café',3),
('Cappuccino','cappuccino','Espuma sedosa y cacao.',11000,'Café',4),
('Cold brew','cold-brew','Extracción en frío, suave y refrescante.',13000,'Frío',5),
('Tónica de café','tonica-de-cafe','Burbujeante, cítrica y despierta.',14000,'Frío',6),
('Pan de chocolate','pan-de-chocolate','Hojaldre tibio para acompañar.',9000,'Para comer',7),
('Tostada de la casa','tostada-de-la-casa','Pan artesanal, aguacate y semillas.',16000,'Para comer',8)
on conflict (slug) do nothing;
