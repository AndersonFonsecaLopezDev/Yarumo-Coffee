import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import './staff.css'
import './visual.css'

export const metadata: Metadata = {
  title: 'Yarumo Coffee · Atención en mesa',
  description: 'Menú digital y atención en mesa de Yarumo Coffee Armenia.',
  icons: {
    icon: [
      { url: '/yarumo-logo.png', type: 'image/png' },
    ],
    shortcut: '/yarumo-logo.png',
    apple: '/yarumo-logo.png',
  },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <head>
        <link rel="icon" href="/yarumo-logo.png" type="image/png" />
        <link rel="apple-touch-icon" href="/yarumo-logo.png" />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
