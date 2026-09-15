import type { Metadata } from 'next'
import './globals.css'
import './staff.css'
import './visual.css'

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://yarumo-coffee.vercel.app'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Yarumo Coffee · Atención en mesa',
  description: 'Menú digital y atención en mesa de Yarumo Coffee Armenia.',
  icons: {
    icon: [{ url: '/icon-32.png', sizes: '32x32', type: 'image/png' }],
    shortcut: '/icon-32.png',
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: 'Yarumo Coffee · Atención en mesa',
    description: 'Menú digital y atención en mesa de Yarumo Coffee Armenia. Pide la cuenta o llama al mesero desde tu celular.',
    url: SITE_URL,
    siteName: 'Yarumo Coffee',
    images: [{ url: '/yarumo-cover-cafe.webp', width: 739, height: 1600, alt: 'Café de Yarumo Coffee servido en mesa' }],
    locale: 'es_CO',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Yarumo Coffee · Atención en mesa',
    description: 'Menú digital y atención en mesa de Yarumo Coffee Armenia.',
    images: ['/yarumo-cover-cafe.webp'],
  },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>
}
