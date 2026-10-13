'use client'

import { useState } from 'react'
import type { TableOrder } from '@/lib/types'
import { useI18n } from '@/lib/i18n'
import { formatCop } from '@/lib/format'

type CustomerOrderTrackerProps = {
  latestOrder: TableOrder | null
  onRefresh?: () => void
}

export default function CustomerOrderTracker({ latestOrder }: CustomerOrderTrackerProps) {
  const { t } = useI18n()
  const [showDetails, setShowDetails] = useState(false)

  if (!latestOrder || latestOrder.status === 'cancelled') return null

  function getOrderStepInfo(status: TableOrder['status']) {
    switch (status) {
      case 'pending':
        return { step: 1, label: t('tracker_step_pending'), icon: '⏳', desc: t('tracker_step_pending_desc') }
      case 'acknowledged':
        return { step: 2, label: t('tracker_step_ack'), icon: '👀', desc: t('tracker_step_ack_desc') }
      case 'preparing':
        return { step: 3, label: t('tracker_step_prep'), icon: '☕', desc: t('tracker_step_prep_desc') }
      case 'delivered':
        return { step: 4, label: t('tracker_step_deliv'), icon: '✓', desc: t('tracker_step_deliv_desc') }
      case 'cancelled':
        return { step: 0, label: t('tracker_step_cancel'), icon: '✕', desc: t('tracker_step_cancel_desc') }
      default:
        return { step: 1, label: status, icon: '☕', desc: '' }
    }
  }

  const stepInfo = getOrderStepInfo(latestOrder.status)

  return (
    <section
      className="customer-order-tracker-wrap"
      aria-label={t('tracker_aria')}
      style={{ maxWidth: 1080, margin: '24px auto', padding: '0 20px' }}
    >
      <div
        className={`customer-order-tracker-card status-${latestOrder.status}`}
        style={{
          background: 'var(--surface-card)',
          border: '1.5px solid var(--border)',
          borderRadius: 20,
          padding: '20px 24px',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <span className="eyebrow">
              {t('tracker_live_order_prefix')}{latestOrder.id.slice(0, 5).toUpperCase()}
            </span>
            <h3 style={{ margin: '4px 0 0', fontSize: '1.25rem' }}>
              {stepInfo.icon} {stepInfo.label}
            </h3>
          </div>
          <button
            type="button"
            className="service-btn"
            style={{ minHeight: 40, padding: '8px 16px', fontSize: '0.85rem' }}
            onClick={() => setShowDetails(!showDetails)}
            aria-expanded={showDetails}
          >
            {showDetails ? t('tracker_hide_items') : t('tracker_show_items')}
          </button>
        </div>

        <p style={{ margin: '12px 0 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          {stepInfo.desc}
        </p>

        {showDetails && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(latestOrder.items || []).map((it) => (
                <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span>
                    <strong>{it.quantity}x</strong> {it.name_snapshot}
                  </span>
                  <span>{formatCop((it.price_cop_snapshot || 0) * (it.quantity || 1))}</span>
                </div>
              ))}
            </div>
            {latestOrder.notes && (
              <p style={{ marginTop: 10, fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                {t('tracker_note_prefix')} {latestOrder.notes}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
