'use client'

import { useEffect, useState } from 'react'
import TableServiceSection from './TableServiceSection'
import PromotionsSection, { type Promotion } from './PromotionsSection'
import MenuCatalog, { type MenuItem, type MenuCategory } from './MenuCatalog'

type HomeClientSectionProps = {
  initialMenu: MenuItem[]
  initialCategories: MenuCategory[]
  initialPromotions: Promotion[]
  whatsappDeliveryNumber: string
}

export default function HomeClientSection({
  initialMenu,
  initialCategories,
  initialPromotions,
  whatsappDeliveryNumber,
}: HomeClientSectionProps) {
  const [table, setTable] = useState<{ id: string; label: string } | null>(null)
  const [mesaToken, setMesaToken] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string>('')

  // Si llega a la raíz un error o hash de autenticación OAuth de Supabase, redirigir inmediatamente a /staff
  useEffect(() => {
    if (typeof window === 'undefined') return
    const search = window.location.search
    const hash = window.location.hash
    const hasAuthError =
      search.includes('error=') ||
      search.includes('error_code=') ||
      hash.includes('error=') ||
      hash.includes('error_code=')

    if (hasAuthError) {
      window.location.replace('/staff' + search + hash)
    }
  }, [])

  return (
    <>
      <TableServiceSection
        onTableResolved={(resolvedTable, token) => {
          setTable(resolvedTable)
          setMesaToken(token)
        }}
        onToastNotice={(msg) => {
          setToastMessage(msg)
          setTimeout(() => setToastMessage(''), 3000)
        }}
      />

      <PromotionsSection promotions={initialPromotions} />

      <MenuCatalog
        initialMenu={initialMenu}
        initialCategories={initialCategories}
        table={table}
        mesaToken={mesaToken}
        whatsappDeliveryNumber={whatsappDeliveryNumber}
      />

      {toastMessage && (
        <div className="toast-notice" role="status" aria-live="polite">
          <span>{toastMessage}</span>
        </div>
      )}
    </>
  )
}
