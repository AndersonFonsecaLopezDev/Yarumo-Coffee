import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs/config'

const isDev = process.env.NODE_ENV !== 'production'

// TODO(security): migrate script-src from 'unsafe-inline' to a per-request nonce.
// This requires generating a nonce in `middleware.ts` (crypto.randomUUID() or similar),
// forwarding it via a request header, reading it in `app/layout.tsx` with `headers()`,
// and passing it to every <script> tag Next.js renders (Next has native support for this
// via the `nonce` returned by `headers()` in the CSP header, see
// https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy).
// Left as 'unsafe-inline' for now: Next.js injects small inline bootstrap scripts and
// wiring a nonce through the App Router correctly (including error/loading boundaries)
// is a non-trivial change that deserves its own PR + manual QA pass.
const scriptSrc = isDev
  ? // 'unsafe-eval' is required in development because Next.js Fast Refresh / HMR
    // evaluates updated modules via eval(). It is not required in a production build.
    "'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com"
  : "'self' 'unsafe-inline' https://va.vercel-scripts.com"

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
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
        { key: 'Content-Security-Policy', value: `default-src 'self'; img-src 'self' data: https://*.supabase.co; style-src 'self' 'unsafe-inline'; script-src ${scriptSrc}; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://va.vercel-scripts.com https://*.vercel-insights.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` },
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


