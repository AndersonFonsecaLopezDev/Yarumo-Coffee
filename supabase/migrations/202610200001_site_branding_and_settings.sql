-- Migración: Semilla y valores por defecto para configuración del sitio (marca, ícono y tiempo de espera)
insert into public.site_settings (key, value)
values
  ('site_name', 'Yarumo Coffee'),
  ('site_icon', '{"512":"/icon-512.png","192":"/icon-192.png","180":"/apple-touch-icon.png","32":"/icon-32.png"}'),
  ('estimated_wait_time', '15-20 min')
on conflict (key) do nothing;
