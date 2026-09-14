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
4. Copia `.env.example` a `.env.local` y completa la URL, la anon key y la `SUPABASE_SERVICE_ROLE_KEY` solo en el servidor/Vercel. Nunca expongas esta última al navegador.
5. Instala dependencias con `npm install` y ejecuta `npm run dev`.
6. Despliega en Vercel conectando este directorio a GitHub.
7. Genera un QR por mesa con el `public_token` de `cafe_tables`.

## Fotos del menú

El catálogo público lee `menu_items.image_url` y muestra la imagen automáticamente. Para cada producto, guarda una URL HTTPS pública, preferiblemente de Supabase Storage. Si el proyecto ya estaba desplegado, aplica `supabase/migrations/202609140002_menu_images.sql` y vuelve a desplegar Vercel. Si la foto sigue sin verse, comprueba que la URL abre en una ventana privada y que el bucket/objeto es público.

## CRUD del menú

Los usuarios con rol `owner` o `manager` pueden crear, editar, activar/desactivar y eliminar productos desde `/staff`. Los precios se introducen directamente en pesos colombianos. Los usuarios con rol `staff` solo ven y atienden solicitudes. Esta autorización se aplica en la interfaz y, principalmente, en las políticas RLS de Supabase.

## CRUD de usuarios

Los usuarios `owner` y `manager` pueden crear, editar roles, cambiar contraseña y eliminar usuarios desde la pestaña `Usuarios` del panel. La gestión usa rutas server-side y la `SUPABASE_SERVICE_ROLE_KEY`; la clave nunca se envía al cliente. El endpoint también impide que un administrador se elimine a sí mismo.

## Seguridad pendiente de configuración

- Activar MFA para las cuentas del equipo.
- Configurar dominio final y HTTPS en el proveedor de despliegue.
- Revisar políticas RLS en Supabase antes de publicar.
- Añadir monitorización, copias de seguridad y límites anti-spam.
- Configurar un proveedor de correo seguro y MFA para el equipo.
- No subir `.env.local` ni ninguna service role key al repositorio.

## Continuous Deployment

- Vercel: conecta este repositorio desde Vercel. Cada Pull Request tendrá un Preview Deployment y cada push/merge a `main` generará producción.
- GitHub Actions: `.github/workflows/ci.yml` ejecuta instalación, lint y build.
- Supabase: `.github/workflows/supabase-deploy.yml` aplica automáticamente las migraciones cuando cambia `supabase/` en `main`.

Configura estos GitHub Secrets:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_ID`
- `SUPABASE_DB_PASSWORD`

En Vercel configura además `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`. La service role key solo debe existir en Vercel/GitHub Secrets y nunca en el navegador.
