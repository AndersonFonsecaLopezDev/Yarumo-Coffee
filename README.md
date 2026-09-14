# Yarumo Coffee · aplicación operativa

Aplicación Next.js + TypeScript para menú QR y atención en mesa.

## Flujo

- Cliente: abre `/?mesa=TOKEN_PUBLICO`, consulta la carta, llama al mesero o pide la cuenta.
- Equipo: entra en `/staff` con Supabase Auth, recibe solicitudes en tiempo real y administra el menú con CRUD.
- Seguridad: las solicitudes se validan con RLS; el navegador nunca usa `service_role`.

## Puesta en marcha

1. Crea un proyecto en Supabase.
2. Ejecuta `supabase/schema.sql` y después `supabase/seed.sql`.
3. Crea usuarios del equipo en Supabase Auth y añade sus UUID a `staff_profiles`.
4. Copia `.env.example` a `.env.local` y completa la URL y la anon key.
5. Instala dependencias con `npm install` y ejecuta `npm run dev`.
6. Despliega en Vercel conectando este directorio a GitHub.
7. Genera un QR por mesa con el `public_token` de `cafe_tables`.

## CRUD del menú

Los usuarios con rol `owner` o `manager` pueden crear, editar, activar/desactivar y eliminar productos desde `/staff`. Los precios se introducen directamente en pesos colombianos. Los usuarios con rol `staff` solo ven y atienden solicitudes. Esta autorización se aplica en la interfaz y, principalmente, en las políticas RLS de Supabase.

## Seguridad pendiente de configuración

- Activar MFA para las cuentas del equipo.
- Configurar dominio final y HTTPS en el proveedor de despliegue.
- Revisar políticas RLS en Supabase antes de publicar.
- Añadir monitorización, copias de seguridad y límites anti-spam.
- Configurar un proveedor de correo seguro y MFA para el equipo.
- No subir `.env.local` ni ninguna service role key al repositorio.
