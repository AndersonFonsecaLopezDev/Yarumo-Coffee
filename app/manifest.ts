import type { MetadataRoute } from 'next'
import { getSiteBranding } from '@/lib/home-data'

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { siteName, siteIcon } = await getSiteBranding()
  const cleanName = siteName || 'Yarumo Coffee'
  const shortName = cleanName.length <= 12 ? cleanName : cleanName.slice(0, 12).trim()

  return {
    name: `${cleanName} · Menú Digital`,
    short_name: shortName,
    description: `Menú digital y atención en mesa de ${cleanName} en Armenia, Quindío.`,
    start_url: '/?source=pwa',
    display: 'standalone',
    background_color: '#18362f',
    theme_color: '#18362f',
    orientation: 'portrait',
    icons: [
      {
        src: siteIcon['192'] || '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: siteIcon['512'] || '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
