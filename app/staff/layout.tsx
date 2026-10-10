import type { Metadata } from 'next'
import '../staff.css'

export const metadata: Metadata = {
  title: 'Panel Staff · Yarumo Coffee',
  description: 'Gestión de comandas, solicitudes, menú y mesas de Yarumo Coffee.',
  robots: {
    index: false,
    follow: false,
  },
}

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <div className="staff-layout-root">{children}</div>
}
