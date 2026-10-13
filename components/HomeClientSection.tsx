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
  initialItemId?: string
}

export default function HomeClientSection({
  initialMenu,
  initialCategories,
  initialPromotions,
  whatsappDeliveryNumber,
  initialItemId,
}: HomeClientSectionProps) {
  const [table, setTable] = useState<{ id: string; label: string } | null>(null)
  const [mesaToken, setMesaToken] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string>('')

  // Si llega a la raíz un error, token o código de autenticación (correo, enlace o OAuth), redirigir
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
      return
    }

    const hasAuthCode = search.includes('code=') || search.includes('token_hash=')
    if (hasAuthCode) {
      window.location.replace('/auth/callback' + search)
      return
    }

    const hasAuthToken =
      hash.includes('access_token=') ||
      hash.includes('type=signup') ||
      hash.includes('type=recovery') ||
      hash.includes('type=invite') ||
      hash.includes('type=magiclink')

    if (hasAuthToken) {
      window.location.replace('/staff' + hash)
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
        initialItemId={initialItemId}
      />

      {toastMessage && (
        <div className="toast-notice" role="status" aria-live="polite">
          <span>{toastMessage}</span>
        </div>
      )}
    </>
  )
}
