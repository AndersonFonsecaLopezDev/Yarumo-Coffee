import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { fontSerif, fontSans } from '@/app/fonts'
import { SITE_URL } from '@/lib/site-url'

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f1e8' },
    { media: '(prefers-color-scheme: dark)', color: '#12211c' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: '/',
  },
  title: 'Yarumo Coffee · Menú Digital y Atención en Mesa',
  description: 'Menú digital y atención en mesa de Yarumo Coffee en Armenia, Quindío. Pide a tu mesa o a domicilio con café especial de origen.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/icon-32.png', sizes: '32x32', type: 'image/png' }],
    shortcut: '/icon-32.png',
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: 'Yarumo Coffee · Menú Digital y Atención en Mesa',
    description: 'Menú digital y atención en mesa de Yarumo Coffee Armenia. Pide la cuenta o llama al mesero desde tu celular.',
    url: SITE_URL,
    siteName: 'Yarumo Coffee',
    images: [{ url: '/yarumo-cover-cafe-og.webp', width: 1200, height: 630, alt: 'Café de Yarumo Coffee servido en mesa' }],
    locale: 'es_CO',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Yarumo Coffee · Menú Digital y Atención en Mesa',
    description: 'Menú digital y atención en mesa de Yarumo Coffee Armenia.',
    images: ['/yarumo-cover-cafe-og.webp'],
  },
}

const themeScript = `(function() {
  try {
    var stored = localStorage.getItem('yarumo-theme');
    if (stored === 'light' || stored === 'dark') {
      document.documentElement.setAttribute('data-theme', stored);
    } else {
      var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    }
  } catch (e) {}
})();`

import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'
import { I18nProvider, T } from '@/lib/i18n'

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${fontSerif.variable} ${fontSans.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <I18nProvider>
          <a href="#menu" className="skip-link"><T k="skip_link" /></a>
          {children}
          <Analytics />
          <ServiceWorkerRegister />
        </I18nProvider>
      </body>
    </html>
  )
}
