'use client'

import { useState } from 'react'
import type { OrderRequest, Request } from '../types'
import { createClient } from '@/lib/supabase/client'

type ActivityTabProps = {
  orders: OrderRequest[]
  requests: Request[]
  onRefresh: () => void
}

function formatCop(value?: number | null) {
  const safe = typeof value === 'number' && !Number.isNaN(value) ? value : 0
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(safe)
}

export default function ActivityTab({
  orders,
  requests,
  onRefresh,
}: ActivityTabProps) {
  const [supabase] = useState(() => createClient())
  const [filter, setFilter] = useState<'all' | 'orders' | 'requests'>('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  // Actualizar comanda de pedido
  async function updateOrderStatus(
    id: string,
    newStatus: 'acknowledged' | 'preparing' | 'delivered' | 'cancelled',
  ) {
    setUpdatingId(id)
    const updates: Record<string, unknown> = { status: newStatus }
    if (newStatus === 'acknowledged') updates.acknowledged_at = new Date().toISOString()
    if (newStatus === 'delivered') updates.delivered_at = new Date().toISOString()

    await supabase.from('order_requests').update(updates).eq('id', id)
    setUpdatingId(null)
    onRefresh()
  }

  // Completar solicitud de servicio (mesero o cuenta)
  async function completeRequest(id: string) {
    setUpdatingId(id)
    await supabase
      .from('service_requests')
      .update({ status: 'done', completed_at: new Date().toISOString() })
      .eq('id', id)
    setUpdatingId(null)
    onRefresh()
  }

  const activeRequests = requests.filter((r) => r.status !== 'done' && r.status !== 'cancelled')
  const activeOrders = orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled')

  return (
    <div className="tab-pane">
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <h2>Actividad en Mesa y Comandas</h2>
          <p>Supervisa las solicitudes de mesero, pedidos y cuentas en tiempo real.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilter('all')}
          >
            Todos ({activeRequests.length + activeOrders.length})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${filter === 'orders' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilter('orders')}
          >
            Comandas ({activeOrders.length})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${filter === 'requests' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilter('requests')}
          >
            Llamados ({activeRequests.length})
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 24 }}>
        {/* Solicitudes de servicio (Mesero / Cuenta) */}
        {(filter === 'all' || filter === 'requests') && activeRequests.length > 0 && (
          <div>
            <h3 style={{ fontSize: '1.1rem', margin: '0 0 12px', color: 'var(--orange)' }}>
              🛎️ Llamados y Cuentas Pendientes
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {activeRequests.map((req) => (
                <div
                  key={req.id}
                  className="card"
                  style={{
                    padding: 16,
                    background: req.type === 'bill' ? 'rgba(239, 128, 91, 0.12)' : 'rgba(217, 232, 106, 0.14)',
                    border: '1.5px solid var(--border)',
                    borderRadius: 14,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <strong style={{ fontSize: '1.1rem' }}>
                      {req.type === 'waiter' ? '🛎️ Llamar mesero' : '🧾 Pide la cuenta'}
                    </strong>
                    <div style={{ fontSize: '0.85rem', marginTop: 4 }}>
                      Mesa <strong>{req.table?.label || 'General'}</strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    disabled={updatingId === req.id}
                    onClick={() => completeRequest(req.id)}
                  >
                    Atendido ✓
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Comandas de Pedidos */}
        {(filter === 'all' || filter === 'orders') && (
          <div>
            <h3 style={{ fontSize: '1.1rem', margin: '0 0 12px' }}>
              ☕ Comandas de Pedidos
            </h3>
            {activeOrders.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                No hay pedidos en preparación en este momento.
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {activeOrders.map((ord) => {
                  const total = (ord.items || []).reduce(
                    (sum, it) => sum + (it.price_cop_snapshot || 0) * (it.quantity || 1),
                    0,
                  )

                  return (
                    <div
                      key={ord.id}
                      className="card"
                      style={{
                        padding: 18,
                        background: 'var(--surface-card)',
                        border: '1.5px solid var(--border)',
                        borderRadius: 16,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <strong>Mesa {ord.table?.label || 'Sin mesa'}</strong>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 8 }}>
                            #{ord.id.slice(0, 5).toUpperCase()}
                          </span>
                        </div>
                        <span className={`status-pill status-${ord.status}`}>
                          {ord.status}
                        </span>
                      </div>

                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {(ord.items || []).map((it) => (
                          <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                            <span><strong>{it.quantity}x</strong> {it.name_snapshot}</span>
                            <span>{formatCop((it.price_cop_snapshot || 0) * (it.quantity || 1))}</span>
                          </div>
                        ))}
                      </div>

                      {ord.notes && (
                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          Nota: {ord.notes}
                        </p>
                      )}

                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong>Total: {formatCop(total)}</strong>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {ord.status === 'pending' && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline"
                              disabled={updatingId === ord.id}
                              onClick={() => updateOrderStatus(ord.id, 'acknowledged')}
                            >
                              Recibir 👀
                            </button>
                          )}
                          {ord.status === 'acknowledged' && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline"
                              disabled={updatingId === ord.id}
                              onClick={() => updateOrderStatus(ord.id, 'preparing')}
                            >
                              En barra ☕
                            </button>
                          )}
                          {ord.status === 'preparing' && (
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              disabled={updatingId === ord.id}
                              onClick={() => updateOrderStatus(ord.id, 'delivered')}
                            >
                              Entregar ✓
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            disabled={updatingId === ord.id}
                            onClick={() => updateOrderStatus(ord.id, 'cancelled')}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
