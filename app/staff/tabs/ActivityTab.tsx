'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CafeTable, MenuCategory, MenuItem, OrderRequest, Request } from '../types'
import { createClient } from '@/lib/supabase/client'
import { useUrlFilters, useDebouncedValue, normalizeText } from '@/lib/filters'
import { useConfirm } from '@/components/ConfirmModal'
import { formatCop } from '@/lib/format'
import ActivityFilters from './activity/ActivityFilters'
import ManualOrderModal from './activity/ManualOrderModal'

type ActivityTabProps = {
  orders: OrderRequest[]
  requests: Request[]
  tables: CafeTable[]
  items: MenuItem[]
  categories: MenuCategory[]
  onRefresh: () => void
}

function getOrderStatusText(status: string): string {
  switch (status) {
    case 'pending':
      return 'Pendiente'
    case 'acknowledged':
      return 'Recibido'
    case 'preparing':
      return 'En preparación'
    case 'delivered':
      return 'Entregado'
    case 'cancelled':
      return 'Cancelado'
    default:
      return status
  }
}

export default function ActivityTab({
  orders,
  requests,
  tables,
  items,
  categories,
  onRefresh,
}: ActivityTabProps) {
  const [supabase] = useState(() => createClient())
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const { confirm, ConfirmDialog } = useConfirm()

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now())
    }, 30000)
    return () => clearInterval(timer)
  }, [])

  // Filtros sincronizados con URL
  const {
    filters,
    setFilter,
    resetFilters,
    hasActiveFilters,
  } = useUrlFilters('act', {
    type: 'all', // 'all' | 'orders' | 'requests'
    status: 'active', // 'active' | 'all' | 'pending' | 'acknowledged' | 'preparing' | 'delivered' | 'cancelled'
    table: 'all',
    q: '',
  })

  const debouncedQ = useDebouncedValue(filters.q, 200)

  // Modal Toma Manual de Pedido / Comanda
  const [manualOrderTable, setManualOrderTable] = useState<CafeTable | null>(null)

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

  // Toma manual de comanda
  function openManualOrder(tableItem?: CafeTable | null) {
    let targetTable = tableItem
    if (!targetTable) {
      targetTable = tables.find((t) => t.active) || tables[0] || null
    }
    if (!targetTable) {
      targetTable = { id: '', label: 'General', public_token: '', active: true }
    }
    setManualOrderTable(targetTable)
  }

  function getElapsedMinutes(isoString?: string | null): number {
    if (!isoString) return 0
    const diff = now - new Date(isoString).getTime()
    return Math.max(0, Math.floor(diff / 60000))
  }

  const filteredRequests = useMemo(() => {
    if (filters.type === 'orders') return []
    const norm = normalizeText(debouncedQ)

    return requests.filter((r) => {
      // Estado
      if (filters.status === 'active' && (r.status === 'done' || r.status === 'cancelled')) return false
      if (filters.status === 'delivered') return false
      if (filters.status !== 'all' && filters.status !== 'active') {
        if (filters.status === 'cancelled' && r.status !== 'cancelled') return false
        if (filters.status === 'pending' && r.status === 'done') return false
      }

      // Mesa
      if (filters.table !== 'all') {
        const matchTable = r.table_id === filters.table || r.table?.label === filters.table
        if (!matchTable) return false
      }

      // Búsqueda
      if (norm) {
        const tableLabel = normalizeText(r.table?.label)
        const typeText = r.type === 'waiter' ? 'mesero llamado' : 'cuenta'
        if (!tableLabel.includes(norm) && !typeText.includes(norm)) return false
      }

      return true
    })
  }, [requests, filters.type, filters.status, filters.table, debouncedQ])

  const filteredOrders = useMemo(() => {
    if (filters.type === 'requests') return []
    const norm = normalizeText(debouncedQ)

    return orders.filter((o) => {
      // Estado
      if (filters.status === 'active' && (o.status === 'delivered' || o.status === 'cancelled')) return false
      if (filters.status !== 'all' && filters.status !== 'active' && o.status !== filters.status) return false

      // Mesa
      if (filters.table !== 'all') {
        const matchTable = o.table_id === filters.table || o.table?.label === filters.table
        if (!matchTable) return false
      }

      // Búsqueda
      if (norm) {
        const tableLabel = normalizeText(o.table?.label)
        const notes = normalizeText(o.notes)
        const itemsMatch = (o.items || []).some((it) => normalizeText(it.name_snapshot).includes(norm))
        const orderId = (o.id || '').toLowerCase()
        if (!tableLabel.includes(norm) && !notes.includes(norm) && !itemsMatch && !orderId.includes(norm)) {
          return false
        }
      }

      return true
    })
  }, [orders, filters.type, filters.status, filters.table, debouncedQ])

  return (
    <div className="tab-pane">
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <h2>Actividad en Mesa y Comandas</h2>
          <p>Supervisa las solicitudes de mesero, pedidos y cuentas en tiempo real.</p>
        </div>
        <button
          type="button"
          className="btn-manual-order-primary"
          onClick={() => {
            const firstActive = tables.find((t) => t.active) || tables[0]
            openManualOrder(firstActive || null)
          }}
          title="Crear nueva comanda manual para una mesa"
        >
          <span style={{ fontSize: '15px', fontWeight: 'bold' }}>+</span>
          <span>Solicitar comanda manual</span>
        </button>
      </div>

      {/* Barra de Filtros de Actividad */}
      <ActivityFilters
        filters={filters}
        setFilter={setFilter}
        resetFilters={resetFilters}
        hasActiveFilters={hasActiveFilters}
        tables={tables}
        pendingRequestsCount={filteredRequests.length}
        activeOrdersCount={filteredOrders.length}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 14 }}>
        {/* Solicitudes de servicio (Mesero / Cuenta) */}
        {(filters.type === 'all' || filters.type === 'requests') && filteredRequests.length > 0 && (
          <div>
            <h3 style={{ fontSize: '1.1rem', margin: '0 0 12px', color: 'var(--orange)' }}>
              🛎️ Llamados y Cuentas Pendientes ({filteredRequests.length})
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {filteredRequests.map((req) => (
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '1.05rem' }}>
                        {req.type === 'waiter' ? '🛎️ Llamar mesero' : '🧾 Pide la cuenta'}
                      </strong>
                      <span className={`waiting-badge ${getElapsedMinutes(req.created_at) >= 5 ? 'waiting-delayed' : ''}`}>
                        {getElapsedMinutes(req.created_at) >= 5
                          ? `⚠️ Hace ${getElapsedMinutes(req.created_at)} min`
                          : `🕒 Hace ${getElapsedMinutes(req.created_at)} min`}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', marginTop: 4 }}>
                      Mesa <strong>{req.table?.label || 'General'}</strong>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {req.type === 'waiter' && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        onClick={() => {
                          const matched = tables.find((t) => t.id === req.table_id || t.label === req.table?.label)
                          openManualOrder(matched || null)
                        }}
                        title="Tomar comanda para esta mesa"
                      >
                        + Pedido
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      disabled={updatingId === req.id}
                      onClick={() => completeRequest(req.id)}
                    >
                      Atendido ✓
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Comandas de Pedidos */}
        {(filters.type === 'all' || filters.type === 'orders') && (
          <div>
            <h3 style={{ fontSize: '1.1rem', margin: '0 0 12px' }}>
              ☕ Comandas de Pedidos ({filteredOrders.length})
            </h3>
            {filteredOrders.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
                  No hay pedidos que coincidan con los filtros seleccionados.
                </p>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => {
                    const firstActive = tables.find((t) => t.active) || tables[0]
                    openManualOrder(firstActive || null)
                  }}
                >
                  + Tomar comanda ahora
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {filteredOrders.map((ord) => {
                  const total = (ord.items || []).reduce(
                    (sum, it) => sum + (it.price_cop_snapshot || 0) * (it.quantity || 1),
                    0,
                  )
                  const elapsedMins = getElapsedMinutes(ord.created_at)
                  const isDelayed = ['pending', 'acknowledged', 'preparing'].includes(ord.status) && elapsedMins >= 15

                  return (
                    <div
                      key={ord.id}
                      className="card"
                      style={{
                        padding: 18,
                        background: 'var(--surface-card)',
                        border: isDelayed ? '2px solid #ef4444' : '1.5px solid var(--border)',
                        borderRadius: 16,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 6 }}>
                        <div>
                          <strong>Mesa {ord.table?.label || 'Sin mesa'}</strong>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 8 }}>
                            #{ord.id.slice(0, 5).toUpperCase()}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {['pending', 'acknowledged', 'preparing'].includes(ord.status) && (
                            <span className={`waiting-badge ${isDelayed ? 'waiting-delayed' : ''}`}>
                              {isDelayed ? `⚠️ Demora: hace ${elapsedMins} min` : `🕒 Hace ${elapsedMins} min`}
                            </span>
                          )}
                          {ord.status === 'delivered' && (
                            <span className="waiting-badge" style={{ color: '#16a34a' }}>
                              ✓ Entregado {ord.delivered_at ? `hace ${getElapsedMinutes(ord.delivered_at)} min` : ''}
                            </span>
                          )}
                          <span className={`status-pill status-${ord.status}`}>
                            {getOrderStatusText(ord.status)}
                          </span>
                        </div>
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

                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <strong>Total: {formatCop(total)}</strong>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
                              A preparación ☕
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
                          {ord.status !== 'cancelled' && ord.status !== 'delivered' && (
                            <button
                              type="button"
                              className="btn btn-sm btn-danger"
                              disabled={updatingId === ord.id}
                              onClick={async () => {
                                const ok = await confirm({
                                  title: '¿Cancelar comanda?',
                                  message: `¿Estás seguro de que deseas cancelar la comanda #${ord.id.slice(0, 5).toUpperCase()} de la Mesa ${ord.table?.label || 'General'}?`,
                                  confirmText: 'Cancelar pedido',
                                  danger: true,
                                })
                                if (ok) {
                                  updateOrderStatus(ord.id, 'cancelled')
                                }
                              }}
                              title="Cancelar comanda"
                            >
                              ✕
                            </button>
                          )}
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

      {/* MODAL TOMA MANUAL DE PEDIDOS */}
      {manualOrderTable && (
        <ManualOrderModal
          table={manualOrderTable}
          tables={tables}
          items={items}
          categories={categories}
          supabase={supabase}
          onClose={() => setManualOrderTable(null)}
          onRefresh={onRefresh}
        />
      )}
      <ConfirmDialog />
    </div>
  )
}
