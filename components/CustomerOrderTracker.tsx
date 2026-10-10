'use client'

import { useState } from 'react'
import type { TableOrder } from './OrderCart'

type CustomerOrderTrackerProps = {
  latestOrder: TableOrder | null
  onRefresh?: () => void
}

function formatCop(value?: number | null) {
  const safe = typeof value === 'number' && !Number.isNaN(value) ? value : 0
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(safe)
}

function getOrderStepInfo(status: TableOrder['status']) {
  switch (status) {
    case 'pending':
      return { step: 1, label: 'Enviado a barra', icon: '⏳', desc: 'Tu comanda está en fila' }
    case 'acknowledged':
      return { step: 2, label: 'Recibido', icon: '👀', desc: 'El barista confirmó tu pedido' }
    case 'preparing':
      return { step: 3, label: 'En preparación', icon: '☕', desc: 'Estamos preparando tus productos' }
    case 'delivered':
      return { step: 4, label: 'Entregado en mesa', icon: '✓', desc: '¡Buen provecho!' }
    case 'cancelled':
      return { step: 0, label: 'Comanda cancelada', icon: '✕', desc: 'Consulta con el equipo' }
    default:
      return { step: 1, label: status, icon: '☕', desc: '' }
  }
}

export default function CustomerOrderTracker({ latestOrder }: CustomerOrderTrackerProps) {
  const [showDetails, setShowDetails] = useState(false)

  if (!latestOrder || latestOrder.status === 'cancelled') return null

  const stepInfo = getOrderStepInfo(latestOrder.status)

  return (
    <section
      className="customer-order-tracker-wrap"
      aria-label="Seguimiento en vivo de tu pedido"
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
              Comanda en vivo #{latestOrder.id.slice(0, 5).toUpperCase()}
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
            {showDetails ? 'Ocultar productos ▲' : 'Ver productos ▼'}
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
                Nota: {latestOrder.notes}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
