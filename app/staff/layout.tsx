import type { Metadata } from 'next'
import '../staff.css'

import { getSiteBranding } from '@/lib/home-data'

export async function generateMetadata(): Promise<Metadata> {
  const { siteName } = await getSiteBranding()
  const cleanName = siteName || 'Yarumo Coffee'
  return {
    title: `Panel Staff · ${cleanName}`,
    description: `Gestión de comandas, solicitudes, menú y mesas de ${cleanName}.`,
    robots: {
      index: false,
      follow: false,
    },
  }
}

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <div className="staff-layout-root">{children}</div>
}
