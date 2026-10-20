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

import { getSiteBranding } from '@/lib/home-data'

export async function generateMetadata(): Promise<Metadata> {
  const { siteName, siteIcon } = await getSiteBranding()
  const pageTitle = `${siteName} · Menú Digital y Atención en Mesa`
  const pageDescription = `Menú digital y atención en mesa de ${siteName} en Armenia, Quindío. Pide a tu mesa o a domicilio con café especial de origen.`

  return {
    metadataBase: new URL(SITE_URL),
    alternates: {
      canonical: '/',
    },
    title: pageTitle,
    description: pageDescription,
    manifest: '/manifest.webmanifest',
    icons: {
      icon: [{ url: siteIcon['32'] || '/icon-32.png', sizes: '32x32', type: 'image/png' }],
      shortcut: siteIcon['32'] || '/icon-32.png',
      apple: [{ url: siteIcon['180'] || '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    },
    openGraph: {
      title: pageTitle,
      description: `Menú digital y atención en mesa de ${siteName} Armenia. Pide la cuenta o llama al mesero desde tu celular.`,
      url: SITE_URL,
      siteName,
      images: [{ url: '/yarumo-cover-cafe-og.webp', width: 1200, height: 630, alt: `Café de ${siteName} servido en mesa` }],
      locale: 'es_CO',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: pageTitle,
      description: `Menú digital y atención en mesa de ${siteName} Armenia.`,
      images: ['/yarumo-cover-cafe-og.webp'],
    },
  }
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
