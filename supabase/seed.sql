-- Mesas de Yarumo Coffee
insert into public.cafe_tables (label) values ('1'), ('2'), ('3'), ('4'), ('5'), ('6'), ('7'), ('8')
on conflict (label) do nothing;

-- Menú completo extraído de la carta real de Yarumo Coffee
insert into public.menu_items (name, slug, description, price_cop, category, sort_order, available) values
-- BEBIDAS CALIENTES
('Espresso (sencillo 20 ml)', 'espresso-sencillo-20ml', 'Espresso sencillo (20 ml), extracción balanceada e intensa.', 3200, 'Bebidas Calientes', 1, true),
('Espresso (doble 40 ml)', 'espresso-doble-40ml', 'Espresso doble (40 ml), cuerpo intenso y notas concentradas.', 5000, 'Bebidas Calientes', 2, true),
('Americano', 'americano', 'Espresso con agua caliente, suave y aromático.', 5500, 'Bebidas Calientes', 3, true),
('Italiano', 'italiano', 'Café estilo italiano con sabor marcado y cuerpo equilibrado.', 5500, 'Bebidas Calientes', 4, true),
('Cappuccino', 'cappuccino', 'Espresso con leche texturizada y capa sedosa de espuma.', 8000, 'Bebidas Calientes', 5, true),
('Latte', 'latte', 'Espresso suave con abundante leche vaporizada.', 7500, 'Bebidas Calientes', 6, true),
('Flat white', 'flat-white', 'Doble shot de espresso con fina capa de microespuma aterciopelada.', 9000, 'Bebidas Calientes', 7, true),
('Chocolate caliente', 'chocolate-caliente', 'Delicioso chocolate caliente tradicional artesanal.', 8000, 'Bebidas Calientes', 8, true),
('Café bombón', 'cafe-bombon', 'Espresso servido sobre una base dulce de leche condensada.', 9000, 'Bebidas Calientes', 9, true),
('Dirty coffee', 'dirty-coffee', 'Espresso caliente vertido lentamente sobre leche fría.', 7500, 'Bebidas Calientes', 10, true),
('Café filtrado (2 tazas)', 'cafe-filtrado-2-tazas', 'Café de origen filtrado en mesa para compartir (2 tazas).', 13000, 'Bebidas Calientes', 11, true),
('Café campesino', 'cafe-campesino', 'Café tradicional infusionado con panela y toques de canela.', 8000, 'Bebidas Calientes', 12, true),
('Aromática', 'aromatica', 'Infusión aromática con hierbas frescas y frutas naturales.', 3500, 'Bebidas Calientes', 13, true),
('Milo caliente', 'milo-caliente', 'Clásico Milo caliente preparado con leche cremosa.', 8000, 'Bebidas Calientes', 14, true),

-- BEBIDAS FRÍAS
('Limonada de coco', 'limonada-de-coco', 'Refrescante limonada frappé batida con crema de coco natural.', 13000, 'Bebidas Frías', 15, true),
('Limonada de cereza', 'limonada-de-cereza', 'Limonada frappé con el toque dulce y frutal de la cereza.', 13500, 'Bebidas Frías', 16, true),
('Limonada natural', 'limonada-natural', 'Limonada natural clásica con zumo de limón recién exprimido.', 9000, 'Bebidas Frías', 17, true),
('Limonada de tamarindo', 'limonada-de-tamarindo', 'Limonada exótica preparada con pulpa natural de tamarindo.', 7500, 'Bebidas Frías', 18, true),
('Michelada', 'michelada', 'Adición de escarchado con zumo de limón fresco y sal marina.', 2000, 'Bebidas Frías', 19, true),
('Frappe (chocolate y café) 12 onz', 'frappe-chocolate-y-cafe-12-onz', 'Frappe helado de chocolate y café en vaso de 12 onz.', 12000, 'Bebidas Frías', 20, true),
('Frappe (chocolate y café) 16 onz', 'frappe-chocolate-y-cafe-16-onz', 'Frappe helado de chocolate y café en vaso de 16 onz.', 16000, 'Bebidas Frías', 21, true),
('Latte frío', 'latte-frio', 'Espresso servido con leche fría y hielo refrescante.', 8000, 'Bebidas Frías', 22, true),
('Latte frío strawberry', 'latte-frio-strawberry', 'Latte frío infusionado con toque de fresa natural.', 10000, 'Bebidas Frías', 23, true),
('Jugos con leche', 'jugos-con-leche', 'Jugo natural en leche. Elige: maracuyá, guanábana, mora, fresa o mango.', 9000, 'Bebidas Frías', 24, true),
('Jugos sin leche', 'jugos-sin-leche', 'Jugo natural en agua. Elige: maracuyá, guanábana, mora, fresa o mango.', 7000, 'Bebidas Frías', 25, true),
('Sodas de frutos rojos y amarillos', 'sodas-de-frutos-rojos-y-amarillos', 'Soda artesanal saborizada con frutos rojos y amarillos.', 11000, 'Bebidas Frías', 26, true),
('Agua', 'agua', 'Agua embotellada refrescante.', 3000, 'Bebidas Frías', 27, true),
('Milo frío', 'milo-frio', 'Bebida fría y refrescante de Milo con leche.', 9000, 'Bebidas Frías', 28, true),

-- GASEOSAS
('Colombiana', 'gaseosa-colombiana', 'Gaseosa Colombiana tradicional.', 4000, 'Gaseosas', 29, true),
('Manzana', 'gaseosa-manzana', 'Gaseosa Postobón Manzana.', 4000, 'Gaseosas', 30, true),
('Uva', 'gaseosa-uva', 'Gaseosa Postobón Uva.', 4000, 'Gaseosas', 31, true),
('Pepsi', 'gaseosa-pepsi', 'Gaseosa Pepsi refrescante.', 4000, 'Gaseosas', 32, true),
('Té Hatsu', 'te-hatsu', 'Té Hatsu disponible en variedades negro, rojo y blanco.', 7000, 'Gaseosas', 33, true),

-- CERVEZAS
('Stella Artois', 'cerveza-stella-artois', 'Cerveza premium tipo lager.', 7000, 'Cervezas', 34, true),
('Corona', 'cerveza-corona', 'Cerveza Corona servida bien fría.', 7000, 'Cervezas', 35, true),
('Heineken', 'cerveza-heineken', 'Cerveza premium importada tipo lager.', 7000, 'Cervezas', 36, true),
('Poker', 'cerveza-poker', 'Cerveza tradicional nacional.', 5000, 'Cervezas', 37, true),
('Club Colombia Dorado', 'cerveza-club-colombia-dorado', 'Cerveza premium dorada nacional.', 6000, 'Cervezas', 38, true),
('Tres Cordilleras Rosada', 'cerveza-tres-cordilleras-rosada', 'Cerveza artesanal rosada con notas frutales.', 9000, 'Cervezas', 39, true),

-- ANTOJITOS PANADEROS
('Croissant sencillo', 'croissant-sencillo', 'Croissant hojaldrado clásico de mantequilla.', 6000, 'Antojitos Panaderos', 40, true),
('Croissant de queso', 'croissant-de-queso', 'Croissant horneado relleno de queso fundido.', 6000, 'Antojitos Panaderos', 41, true),
('Croissant almendrado', 'croissant-almendrado', 'Croissant hojaldrado con cubierta de almendras tostadas.', 9000, 'Antojitos Panaderos', 42, true),
('Croissant de chocolate', 'croissant-de-chocolate', 'Croissant crocante relleno de delicioso chocolate.', 8000, 'Antojitos Panaderos', 43, true),
('Croissant de Nutella', 'croissant-de-nutella', 'Croissant relleno de cremosa Nutella.', 10000, 'Antojitos Panaderos', 44, true),
('Palitos de queso', 'palitos-de-queso', 'Dedos crocantes de hojaldre horneados con queso.', 6000, 'Antojitos Panaderos', 45, true),
('Chicharrón', 'chicharron', 'Chicharrón tradicional de hojaldre dulce con arequipe o guayaba.', 7000, 'Antojitos Panaderos', 46, true),
('Almojábana', 'almojabana', 'Almojábana tradicional suave recién horneada.', 7000, 'Antojitos Panaderos', 47, true),
('Panchocolate', 'panchocolate', 'Pan suave artesanal relleno con trozos de chocolate.', 8000, 'Antojitos Panaderos', 48, true),
('Focaccia', 'focaccia', 'Pan focaccia aromatizado con aceite de oliva y finas hierbas.', 10000, 'Antojitos Panaderos', 49, true),

-- SÁNDWICHES
('Sándwich Jamón y queso', 'sandwich-jamon-y-queso', 'Sándwich tostado con jamón y queso derretido.', 9000, 'Sándwiches', 50, true),
('Sándwich Huevo y tocineta', 'sandwich-huevo-y-tocineta', 'Sándwich con huevo y tocineta crujiente.', 12000, 'Sándwiches', 51, true),
('Sándwich Yarumo', 'sandwich-yarumo', 'Sándwich de la casa con jamón, queso, tocineta y huevo.', 13000, 'Sándwiches', 52, true),

-- TORTAS Y BROWNIES
('Torta de Almojábana', 'torta-de-almojabana', 'Porción de torta artesanal a base de almojábana.', 11000, 'Tortas y Brownies', 53, true),
('Torta de Naranja', 'torta-de-naranja', 'Suave y esponjosa torta casera de naranja.', 9000, 'Tortas y Brownies', 54, true),
('Torta de Chocolate', 'torta-de-chocolate', 'Torta húmeda de chocolate con suave cobertura.', 10500, 'Tortas y Brownies', 55, true),
('Cheesecake', 'cheesecake', 'Porción de cheesecake cremoso tradicional.', 13000, 'Tortas y Brownies', 56, true),
('Torta de Zanahoria', 'torta-de-zanahoria', 'Torta de zanahoria con especias y frutos secos.', 12000, 'Tortas y Brownies', 57, true),
('Torta Marmolada', 'torta-marmolada', 'Clásica torta marmoleada de vainilla y chocolate.', 11000, 'Tortas y Brownies', 58, true),
('Brownie clásico', 'brownie-clasico', 'Brownie tradicional melcochudo con rico chocolate.', 9000, 'Tortas y Brownies', 59, true),
('Brownie con Nutella', 'brownie-con-nutella', 'Brownie servido con topping de cremosa Nutella.', 10000, 'Tortas y Brownies', 60, true),
('Brownie con arequipe', 'brownie-con-arequipe', 'Brownie servido con generoso arequipe.', 10000, 'Tortas y Brownies', 61, true),
('Brownie de chocolate', 'brownie-de-chocolate', 'Brownie con extra cobertura y trozos de chocolate.', 9500, 'Tortas y Brownies', 62, true),

-- HOJALDRADOS
('Hojaldrado de Carne', 'hojaldrado-de-carne', 'Hojaldre crocante relleno de carne sazonada.', 8500, 'Hojaldrados', 63, true),
('Hojaldrado de Pollo', 'hojaldrado-de-pollo', 'Hojaldre dorado relleno de pollo desmechado.', 8200, 'Hojaldrados', 64, true),
('Hojaldrado de Arequipe', 'hojaldrado-de-arequipe', 'Pastel de hojaldre dulce relleno de arequipe.', 4300, 'Hojaldrados', 65, true),
('Hojaldrado de Jamón y queso', 'hojaldrado-de-jamon-y-queso', 'Hojaldre horneado con jamón y queso.', 5500, 'Hojaldrados', 66, true),
('Hojaldre de queso', 'hojaldre-de-queso', 'Hojaldre tradicional con queso fundido.', 5000, 'Hojaldrados', 67, true),
('Hojaldrado Ranchero', 'hojaldrado-ranchero', 'Hojaldre relleno de salchicha ranchera y queso.', 8000, 'Hojaldrados', 68, true),

-- PIZZETAS
('Pizzeta Pollo y Champiñones', 'pizzeta-pollo-y-champinones', 'Pollo desmechado, champiñones, queso mozzarella y salsa de tomate.', 19500, 'Pizzetas', 69, true),
('Pizzeta Pepperoni', 'pizzeta-pepperoni', 'Pepperoni, queso mozzarella y salsa de tomate.', 19500, 'Pizzetas', 70, true),
('Pizzeta Ranchera', 'pizzeta-ranchera', 'Ranchera, chorizo, maicitos, y queso doblecrema.', 19500, 'Pizzetas', 71, true),
('Pizzeta Napolitana', 'pizzeta-napolitana', 'Tomate fresco, albahaca, queso mozzarella, orégano y salsa de tomate.', 17500, 'Pizzetas', 72, true)

-- Categorías de menú
insert into public.menu_categories (name, slug, icon, sort_order, active) values
  ('Bebidas Calientes', 'bebidas-calientes', '♨️', 1, true),
  ('Bebidas Frías', 'bebidas-frias', '🧊', 2, true),
  ('Gaseosas', 'gaseosas', '🥤', 3, true),
  ('Cervezas', 'cervezas', '🍺', 4, true),
  ('Antojitos Panaderos', 'antojitos-panaderos', '🥐', 5, true),
  ('Sándwiches', 'sandwiches', '🥪', 6, true),
  ('Tortas y Brownies', 'tortas-y-brownies', '🍰', 7, true),
  ('Hojaldrados', 'hojaldrados', '🥟', 8, true),
  ('Pizzetas', 'pizzetas', '🍕', 9, true),
  ('Otros', 'otros', '✨', 10, true)
on conflict (name) do update set
  slug = excluded.slug,
  icon = excluded.icon,
  sort_order = excluded.sort_order,
  active = excluded.active;

-- Actualizar category_id en menu_items
update public.menu_items m
set category_id = c.id
from public.menu_categories c
where m.category = c.name
  and m.category_id is null;

