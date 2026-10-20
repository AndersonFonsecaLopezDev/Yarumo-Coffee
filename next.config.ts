import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs/config'

const isDev = process.env.NODE_ENV !== 'production'

// TODO(security): Plan de migración de CSP para script-src de 'unsafe-inline' a nonces criptográficos por solicitud:
// 1. Generar un nonce criptográfico único por petición en `middleware.ts` usando `crypto.randomUUID()` en base64.
// 2. Adjuntar el nonce a los headers de solicitud entrantes (`x-nonce`) y a la cabecera `Content-Security-Policy` enviada al cliente:
//    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://va.vercel-scripts.com;`
// 3. En `app/layout.tsx`, leer el nonce vía `const nonce = (await headers()).get('x-nonce')`.
// 4. Inyectar el atributo `nonce={nonce}` en el script en línea `themeScript` y asegurar compatibilidad con scripts inyectados por Next.js.
// 5. Consideración de arquitectura: Invocar `headers()` en RootLayout desactiva la caché estática (ISR) convirtiendo las rutas en puramente dinámicas en tiempo de ejecución. Se deja anotado sin implementar hasta definir la estrategia con Partial Prerendering (PPR) de Next.js.
const scriptSrc = isDev
  ? // 'unsafe-eval' is required in development because Next.js Fast Refresh / HMR
    // evaluates updated modules via eval(). It is not required in a production build.
    "'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com"
  : "'self' 'unsafe-inline' https://va.vercel-scripts.com"

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/**',
      },
    ],
  },
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        { key: 'Content-Security-Policy', value: `default-src 'self'; font-src 'self' data:; object-src 'none'; worker-src 'self'; manifest-src 'self'; img-src 'self' data: https://*.supabase.co; style-src 'self' 'unsafe-inline'; script-src ${scriptSrc}; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://va.vercel-scripts.com https://*.vercel-insights.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` },
      ],
    }]
  },
}

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
})


