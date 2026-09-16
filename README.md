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
- Confirmar el dominio final y HTTPS en el proveedor de despliegue (hoy el dominio canónico es `https://yarumo-coffee.vercel.app`; ver más abajo).
- Configurar monitorización de errores (Sentry o similar) y copias de seguridad periódicas de Supabase — ver "Monitoreo y analítica" más abajo, sigue sin implementarse.
- Revisar periódicamente las dependencias del proyecto (`npm audit`, Dependabot o similar).
- No subir `.env.local` ni ninguna service role key al repositorio.

Ya resuelto en rondas anteriores (se deja fuera de esta lista a propósito): políticas RLS revisadas y con `enable row level security` reforzado por migración, `package-lock.json` versionado con CI usando `npm ci`, y límites de tamaño/tipo MIME para la subida de imágenes aplicados tanto en el cliente como en el bucket de Supabase Storage.

## Dominio canónico y `lib/site-url.ts`

El dominio canónico de producción es `https://yarumo-coffee.vercel.app`. Todo el código (metadatos OG/Twitter, el redirect de `app/auth/callback/route.ts`, los QR generados en `/staff`, `robots.txt` y `sitemap.xml`) usa `lib/site-url.ts` como única fuente de verdad:

```ts
export const CANONICAL_SITE_URL = 'https://yarumo-coffee.vercel.app'
export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || CANONICAL_SITE_URL
```

Si no hay `NEXT_PUBLIC_APP_URL` en el entorno (o alguien entra por un deployment de preview de Vercel), todo cae al dominio canónico fijo — el login de staff y los QR nunca rebotan a una URL de preview.

Si en el futuro se usa un dominio propio, hay que actualizar **ambos** valores: la variable de entorno `NEXT_PUBLIC_APP_URL` en Vercel y el fallback `CANONICAL_SITE_URL` en `lib/site-url.ts`.

## Modo oscuro

`app/globals.css` y `app/visual.css` respetan `prefers-color-scheme: dark` del sistema (sin toggle manual) a través de variables semánticas (`--surface`, `--surface-card`, `--text`, `--text-muted`, `--border`) que se redefinen en modo oscuro. Las franjas decorativas de marca (hero, tira de visita, notificaciones, footer, categoría activa) siguen siempre con el verde oscuro de marca, en ambos temas, por diseño. El panel `/staff` no está cubierto por este cambio.

## Monitoreo y analítica (pendiente)

No se implementó en esta ronda por no contar con las cuentas correspondientes. Queda documentado el cómo activarlo cuando se disponga de ellas:

- **Sentry** (o similar) para captura de errores en producción: crear un proyecto Next.js en Sentry, instalar `@sentry/nextjs`, correr `npx @sentry/wizard@latest -i nextjs` y agregar `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` a las variables de entorno de Vercel. Una vez instalado, conviene envolver `app/error.tsx` con `Sentry.captureException` en un `useEffect`.
- **Vercel Analytics** (o Plausible) para saber cuántas personas escanean el QR y qué categorías del menú se ven más: en Vercel, activa "Analytics" desde el dashboard del proyecto e instala `@vercel/analytics`, agregando `<Analytics />` en `app/layout.tsx`. Si se prefiere Plausible, basta con añadir su script (respetando la CSP de `next.config.ts`, que hoy solo permite scripts propios y de los CDNs ya declarados).

## Pruebas end-to-end

Se agregó una red de seguridad mínima con Playwright (`@playwright/test`), no cobertura exhaustiva:

- `e2e/customer-menu.spec.ts`: un cliente abre `/?mesa=TOKEN`, ve el menú y pide la cuenta.
- `e2e/staff-menu-crud.spec.ts`: un `owner`/`manager` inicia sesión en `/staff` y crea un producto de menú.

Ambos flujos dependen de datos reales en un proyecto Supabase de pruebas (nunca el de producción) y se saltan automáticamente si falta la configuración:

1. Instala los navegadores de Playwright una sola vez: `npx playwright install --with-deps chromium`.
2. Define las variables de entorno necesarias:
   - `E2E_TABLE_TOKEN`: `public_token` de una mesa activa de prueba (`cafe_tables`).
   - `E2E_STAFF_EMAIL` / `E2E_STAFF_PASSWORD`: credenciales de un usuario de prueba con rol `owner` o `manager` en `staff_profiles`.
   - Opcional: `E2E_BASE_URL` si quieres correr las pruebas contra un deployment ya activo (preview o local) en vez de que Playwright levante `npm run build && npm run start` automáticamente.
3. Corre `npm run test:e2e`.

## Continuous Deployment

- Vercel: conecta este repositorio desde Vercel. Cada Pull Request tendrá un Preview Deployment y cada push/merge a `main` generará producción.
- GitHub Actions: `.github/workflows/ci.yml` ejecuta instalación, lint y build.
- Supabase: `.github/workflows/supabase-deploy.yml` aplica automáticamente las migraciones cuando cambia `supabase/` en `main`.

Configura estos GitHub Secrets:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_ID`
- `SUPABASE_DB_PASSWORD`

En Vercel configura además `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`. La service role key solo debe existir en Vercel/GitHub Secrets y nunca en el navegador.

El repositorio ya versiona `package-lock.json`, y tanto `.github/workflows/ci.yml` como el build de Vercel usan `npm ci` con caché de npm activada, lo que da instalaciones reproducibles y más rápidas.
