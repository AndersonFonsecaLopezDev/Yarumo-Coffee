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

## CRUD de usuarios y control de acceso

Los usuarios `owner` y `manager` pueden crear, editar roles, cambiar contraseña y eliminar usuarios desde la pestaña `Usuarios` del panel. La gestión usa rutas server-side y la `SUPABASE_SERVICE_ROLE_KEY`; la clave nunca se envía al cliente. El endpoint protege a los `owner` impidiendo que administradores con rol `manager` modifiquen o eliminen sus cuentas, así como evitando la autoeliminación accidental.

Para el inicio de sesión vía Google OAuth en `/staff`, la autoprovisión de perfiles `staff` está protegida por lista blanca: solo las cuentas cuyo correo coincida con los dominios o correos permitidos en la variable de entorno `STAFF_ALLOWED_EMAIL_DOMAIN` (ej. `yarumocoffee.com` o lista separada por comas) obtienen acceso. Si un correo no autorizado intenta ingresar, la sesión se cierra automáticamente y se redirige con error.

## Seguridad pendiente de configuración

- Activar MFA para las cuentas del equipo.
- Confirmar el dominio final y HTTPS en el proveedor de despliegue (hoy el dominio canónico es `https://yarumo-coffee.vercel.app`; ver más abajo).
- Copias de seguridad periódicas de Supabase.
- Revisar periódicamente las dependencias del proyecto (`npm audit`, Dependabot o similar).
- No subir `.env.local` ni ninguna service role key al repositorio.

Ya resuelto y auditado (se deja fuera de esta lista a propósito):
- Protección jerárquica de roles: un usuario `manager` no puede modificar, degradar ni eliminar cuentas con rol `owner` (`app/api/admin/users/route.ts`).
- Control de acceso y autoprovisión en OAuth: solo correos autorizados por `STAFF_ALLOWED_EMAIL_DOMAIN` pueden obtener perfil en `/staff` vía Google Auth.
- Redirección canónica estricta en el callback de autenticación hacia `SITE_URL` (`app/auth/callback/route.ts`).
- Hardening de RLS: eliminación de inserción pública directa en `order_request_items` (migración `202609180003_harden_order_request_items_rls.sql`), canalizando pedidos exclusivamente a través de la RPC `submit_order_request`.
- Protección anti-spam en reseñas (`/api/recommendations`): rate-limit de 2 solicitudes por minuto por IP/mesa y control temporal de envíos duplicados por mesa.
- Monitoreo de errores con Sentry y analítica con Vercel Analytics integrados en la aplicación.
- Límites de tamaño/tipo MIME para subida de imágenes en cliente y bucket de Storage.

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

## Monitoreo y analítica (Implementado)

La monitorización en producción y la analítica están completamente integradas:

- **Sentry**: Integrado mediante `@sentry/nextjs` con captura de excepciones en `app/error.tsx` y configuración en `sentry.client.config.ts`, `sentry.server.config.ts` y `sentry.edge.config.ts`. Si no hay DSN configurado, opera con fallback silencioso sin romper la ejecución local. En el panel de Vercel, agregar las variables de entorno `SENTRY_DSN` y `NEXT_PUBLIC_SENTRY_DSN` (así como `SENTRY_ORG` y `SENTRY_PROJECT` si se habilitan source maps en build).
- **Vercel Analytics**: Integrado en `app/layout.tsx` mediante `@vercel/analytics/next` y admitido en la Content Security Policy (CSP) en `next.config.ts`. Para activarlo en producción, simplemente habilita "Analytics" en el dashboard del proyecto en Vercel.

## Nuevas características y migraciones recientes

### Migraciones aplicadas (`supabase/migrations/`)
- `202609170001_menu_categories.sql`: Categorías dinámicas (`menu_categories`), vinculación con `menu_items.category_id`, preservación íntegra de datos existentes y políticas RLS públicas y de staff.
- `202609170002_promotions.sql`: Tabla de promociones del día y destacados (`promotions`) con filtros por vigencia temporal y producto vinculado opcional.
- `202609170003_order_requests.sql`: Tablas `order_requests` y `order_request_items`, función RPC transaccional `submit_order_request` con snapshots de precios, protección anti-spam por mesa y publicación en tiempo real (`supabase_realtime`).
- `202609170004_staff_orders_and_history.sql`: Toma manual de pedidos por staff (`staff_submit_order_request`), consulta segura de historial de pedidos de mesa en vivo (`get_table_orders`), columna `source` ('customer' | 'staff') y moderación de reseñas con estado `pending` por defecto.
- `202609180001_unify_menu_taxonomy.sql`: Unificación de taxonomía de categorías de menú, columna `slug` en `menu_categories` y mapeo inteligente sin pérdida de datos.
- `202609180002_site_settings_hero_image.sql`: Tabla `site_settings` con políticas RLS y soporte para editar la foto de portada del homepage desde el panel `/staff`.
- `202609180003_harden_order_request_items_rls.sql`: Eliminación de política permisiva pública en `order_request_items`, forzando inserción segura vía RPC `submit_order_request` o rol staff.

### Personalización de portada del Homepage
- **Foto de Portada**: Los administradores (`owner` / `manager`) pueden cambiar la foto principal del hero desde la pestaña **Portada** en `/staff`, subiendo una imagen desde su dispositivo o introduciendo una URL pública, con previsualización en tiempo real del encuadre y opción de restaurar la imagen original.

### Pedidos desde la carta y toma manual en mesa
- **Cliente**: Al escanear el QR (`/?mesa=TOKEN`), cada ítem de la carta muestra la opción de agregar al pedido. Un carrito flotante permite ajustar cantidades, agregar notas por ítem (ej. "sin azúcar"), nota general a la mesa y enviar la comanda. La sección **"Todo lo que has pedido"** se sincroniza en vivo por WebSockets mostrando el estado real de preparación y el consumo total acumulado de la mesa.
- **Equipo (`/staff`)**:
  - **Vista unificada por mesa**: Consolidación de comandas y solicitudes de mesero/cuenta agrupadas por mesa con filtros rápidos y acciones inmediatas.
  - **Toma manual de pedidos**: Botón `+ Tomar pedido` para que el mesero anote pedidos verbales directo a la comanda desde el panel.
  - **Alertas emergentes (Toasts)**: Sistema flotante de alertas visuales y sonoras en tiempo real que se descartan automáticamente por tiempo (14s con pausa al hover/pestaña oculta) o por resolución cuando la solicitud es atendida.
  - **Moderación de reseñas**: Aprobación previa de opiniones antes de publicarse en el sitio público.


### Categorías Dinámicas y Promociones
- **Categorías (`menu_categories`)**: Los administradores pueden crear, editar iconos/emojis, ordenar y activar/desactivar categorías desde el panel `/staff`. La carta pública organiza automáticamente las pestañas según este orden.
- **Promociones (`promotions`)**: Carrusel de promociones especiales ("2x1", "Promo del día") debajo del Hero que permite resaltar el producto en la carta con un toque.

### Reseñas directas de Google
- Constante centralizada `GOOGLE_REVIEWS_URL` en `lib/site-url.ts` con el identificador de lugar (CID) para abrir directamente la ficha y opiniones de Yarumo Coffee en Google Maps / Search.

## Nuevas Funcionalidades y Mejoras Operativas (Versión 2.0)

### 1. Impresión Aislada de Carta de Menú Física (`/staff`)
- Botón **Imprimir Carta** con renderizado aislado mediante React Portal en `#print-root`.
- Maquetación de alta fidelidad: tipografía serif editorial, paleta de colores de marca, separación automática por categorías, control de salto de página (`break-inside: avoid; page-break-after: always`) y eliminación total de sidebars, botones y elementos web durante la impresión (`@media print`).

### 2. Filtros Unificados y Búsqueda Avanzada en Panel de Staff
- Sistema modular en `lib/filters.ts` con normalización de caracteres, diacríticos y tildes.
- Búsqueda en tiempo real con debounce y sincronización bidireccional con URL query parameters (`/staff?tab=menu&q=cappuccino&category=...`).
- Filtros por categoría, estado (activo/inactivo) y fecha.
- Acciones en lote en la pestaña Menú: activación y desactivación masiva de productos seleccionados.

### 3. Rendimiento y Robustez en Tiempo Real
- Sincronización incremental debounced para canales Supabase Realtime, reduciendo re-renders y peticiones redundantes.
- Notificaciones sonoras sintéticas para nuevas comandas mediante **Web Audio API** (sin depender de archivos de audio externos) con vibración háptica para dispositivos móviles y toggle de silencio accesible.
- Aislamiento estricto del Service Worker (`/public/sw.js`): bypass de `/staff`, `/api/*`, `/auth/*` y llamadas directas a Supabase REST para evitar desincronizaciones de caché en el panel operativo.
- Optimización de imágenes Hero con atributo `sizes` adaptativo para maximizar el Largest Contentful Paint (LCP).

### 4. Sistema de Diseño, Marca y Accesibilidad
- Tokens de diseño refinados para la paleta Yarumo (naranja tostado, verde bosque, crema y carbón).
- Iconografía SVG de especialidad en `components/icons/CategoryIcons.tsx` (V60, Chemex, espresso, repostería).
- Arte vectorial de marca `ProductPlaceholder` para productos sin fotografía comercial cargada.
- Sistema de modales de confirmación accesibles (`components/ConfirmModal.tsx`, hook `useConfirm()`) con foco atrapado, navegación con teclado (ESC/Enter) y cumplimiento WCAG AA, reemplazando `confirm()` y `alert()` nativos del navegador.

### 5. Experiencia del Cliente y Pedidos
- **Internacionalización (i18n)**: Soporte bilingüe Español / Inglés con selector en el encabezado (`#btn-language-toggle`), autodetección de idioma del navegador y persistencia en `localStorage`.
- **Personalización de Bebidas**: Selector de variantes en modal de producto (tipo de leche entera/deslactosada/avena/almendras, temperatura caliente/fría, tamaño estándar/doble) y notas especiales para el barista, calculando precios adicionales y reflejándolos en el carrito, comanda de barra y WhatsApp.
- **Aviso de Mesa**: Badge indicador de mesa activa y aviso visual amigable cuando el QR escaneado no existe o ha expirado, permitiendo continuar en barra o para llevar.
- **Protección Antispam Honeypot**: Campo invisible trampa en `/recomendaciones` y límite de caracteres visible (0 / 500).

### 6. Curaduría de Datos y Seguridad Reforzada
- Script SQL de curaduría de catálogo y auditoría de fotografías pendientes en `supabase/migrations/20261011_curacion_catalogo.sql`.
- Validación estricta con **Zod** y paginación (`page`, `perPage`) en `/api/admin/users`.
- Rate limiting reforzado con función segura `extractClientIp` contra spoofing de cabeceras y política de fallback.
- Cabeceras **Content Security Policy (CSP)** reforzadas en `next.config.ts`.
- Guía de configuración de **Autenticación Multifactor (MFA / TOTP)** en `docs/supabase-mfa-guide.md`.

## Pruebas End-to-End (Playwright)

El repositorio cuenta con una suite integral de pruebas automatizadas en `e2e/`:

- `e2e/print-menu.spec.ts`: Verifica la apertura del modal de impresión, aislamiento en `#print-root` y reglas `@media print`.
- `e2e/staff-filters.spec.ts`: Verifica búsqueda, filtros, sincronización de query params en URL y acciones en lote.
- `e2e/staff-realtime-controls.spec.ts`: Verifica el indicador de conexión realtime, botón de refresco y toggle sonoro.
- `e2e/design-system.spec.ts`: Verifica iconos SVG, placeholders de marca para productos sin foto y modales accesibles con ESC.
- `e2e/customer-experience.spec.ts`: Verifica selector de idioma ES/EN, badge de mesa y honeypot antispam.
- `e2e/usability-features.spec.ts`: Verifica persistencia del carrito, búsqueda insensible a tildes y navegación por teclado en pestañas.

Para ejecutar todas las pruebas:
```bash
npm run test:e2e
```

## Continuous Deployment

- Vercel: conecta este repositorio desde Vercel. Cada Pull Request tendrá un Preview Deployment y cada push a `main` generará producción.
- GitHub Actions: `.github/workflows/ci.yml` ejecuta instalación, lint, typecheck y build.
- Supabase: `.github/workflows/supabase-deploy.yml` aplica automáticamente las migraciones cuando cambia `supabase/` en `main`.

Variables de entorno requeridas en Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (solo servidor)
- `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` (opcionales para rate limiting distribuido)

## Rate Limiting y Arquitectura de Resiliencia (`lib/rate-limit.ts`)

El control de frecuencia para el envío de opiniones y solicitudes críticas opera bajo una estrategia por capas:

1. **Upstash Redis REST (Persistente distribuido)**: Si `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` están definidos, las peticiones se coordinan globalmente en Redis (2 peticiones por ventana de 60 segundos por IP/mesa).
2. **Sin Upstash (Comportamiento Serverless)**:
   - Si no hay variables de Upstash configuradas, el limitador conmuta a un modelo híbrido:
     - **Para mesas específicas**: Consulta en Supabase (`recommendations` creadas en los últimos 60s para esa mesa) para bloquear abusos persistentes.
     - **Para tráfico general / anónimo**: Utiliza una caché en memoria volátil de la instancia (`inMemoryCache`). En entornos serverless como Vercel, este límite aplica **por instancia de función**. Si hay múltiples lambdas concurrentes, una ráfaga podría repartirse entre ellas. Por esta razón, la política RLS en base de datos (`status = 'pending'`) actúa como la defensa en profundidad definitiva, impidiendo que cualquier opinión no autorizada se publique directamente.
3. **Política de fallo (`fail-open` vs `fail-closed`)**:
   - El endpoint de recomendaciones opera con `fail-open`. En caso de desconexión o fallo puntual de Upstash/red, no se rechaza a clientes legítimos en mesa con errores falsos de saturación; en su lugar, se inserta la recomendación como `pending` para que el personal de staff la modere.

## Gestión de Migraciones y `supabase migration repair`

El flujo de despliegue en `.github/workflows/supabase-deploy.yml` ejecuta `supabase db push` utilizando una versión fijada del CLI (`2.120.0`).

- **Regla de integridad**: Nunca se deben renombrar ni modificar archivos de migración ya aplicados en la base de datos remota (`supabase_migrations.schema_migrations`), ya que esto genera desincronización de checksums o errores de migración faltante.
- **Caso de nombres irregulares**: Si se requiere estandarizar el nombre de una migración que ya fue aplicada en producción (como `20261011_curacion_catalogo.sql` a formato numérico de 12 dígitos):
  1. Conectar al proyecto con `supabase link --project-ref <PROJECT_ID>`.
  2. Verificar estado con `supabase migration list`.
  3. Marcar la migración como aplicada o revertida según corresponda con:
     ```bash
     supabase migration repair --status applied <NUEVA_VERSION>
     ```
  4. Eliminar el registro de la versión antigua si fue renombrada:
     ```bash
     supabase migration repair --status reverted <VERSION_ANTERIOR>
     ```


