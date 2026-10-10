'use client'

import { useState } from 'react'
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
