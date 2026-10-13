'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CafeTable, MenuCategory, MenuItem, OrderRequest, Request } from '../types'
import { createClient } from '@/lib/supabase/client'
import { useUrlFilters, useDebouncedValue, normalizeText } from '@/lib/filters'
import { useConfirm } from '@/components/ConfirmModal'
import { SearchIcon } from '@/components/icons/CategoryIcons'

type ActivityTabProps = {
  orders: OrderRequest[]
  requests: Request[]
  tables: CafeTable[]
  items: MenuItem[]
  categories: MenuCategory[]
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
  const [manualCart, setManualCart] = useState<Array<{ item: MenuItem; quantity: number; notes: string }>>([])
  const [manualTab, setManualTab] = useState<'catalog' | 'cart'>('catalog')
  const [manualNotes, setManualNotes] = useState('')
  const [manualQuery, setManualQuery] = useState('')
  const [manualCategory, setManualCategory] = useState('Todas')
  const [manualSubmitting, setManualSubmitting] = useState(false)
  const [manualError, setManualError] = useState<string | null>(null)

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
    setManualCart([])
    setManualTab('catalog')
    setManualNotes('')
    setManualQuery('')
    setManualCategory('Todas')
    setManualError(null)
  }

  function addManualProduct(item: MenuItem) {
    if (!item || !item.id) return
    setManualCart((prev) => {
      const exists = prev.find((ci) => ci.item?.id === item.id)
      if (exists) {
        return prev.map((ci) =>
          ci.item?.id === item.id ? { ...ci, quantity: Math.min((ci.quantity || 1) + 1, 20) } : ci,
        )
      }
      return [...prev, { item, quantity: 1, notes: '' }]
    })
  }

  function updateManualQty(itemId: string, delta: number) {
    setManualCart((prev) =>
      prev
        .map((ci) => {
          if (ci.item?.id === itemId) {
            const next = (ci.quantity || 1) + delta
            return next > 0 ? { ...ci, quantity: Math.min(next, 20) } : null
          }
          return ci
        })
        .filter(Boolean) as Array<{ item: MenuItem; quantity: number; notes: string }>,
    )
  }

  function updateManualItemNotes(itemId: string, notes: string) {
    setManualCart((prev) => prev.map((ci) => (ci.item?.id === itemId ? { ...ci, notes: notes || '' } : ci)))
  }

  async function submitManualOrder() {
    if (!manualOrderTable || !manualCart.length) return
    setManualSubmitting(true)
    setManualError(null)

    try {
      const validCartItems = manualCart.filter((ci) => ci && ci.item && ci.item.id)
      if (!validCartItems.length) {
        throw new Error('Debes seleccionar al menos un producto válido.')
      }

      const payloadItems = validCartItems.map((ci) => ({
        menu_item_id: ci.item.id,
        quantity: Math.max(1, Math.min(ci.quantity || 1, 20)),
        item_notes: (ci.notes || '').trim(),
      }))

      // Intentar primero a través de la función RPC segura
      const { error: rpcErr } = await supabase.rpc('staff_submit_order_request', {
        p_table_id: manualOrderTable.id,
        p_notes: (manualNotes || '').trim(),
        p_items: payloadItems,
      })

      if (rpcErr) {
        console.warn('RPC staff_submit_order_request no disponible o falló, usando inserción directa:', rpcErr)

        // Fallback: Inserción directa en order_requests y order_request_items
        const { data: insertedOrder, error: orderErr } = await supabase
          .from('order_requests')
          .insert({
            table_id: manualOrderTable.id || null,
            table_token: manualOrderTable.public_token || '',
            notes: (manualNotes || '').trim(),
            status: 'pending',
            source: 'staff',
          })
          .select('id')
          .single()

        if (orderErr || !insertedOrder) {
          throw new Error(orderErr?.message || rpcErr.message || 'No se pudo crear el pedido.')
        }

        const itemsToInsert = validCartItems.map((ci) => ({
          order_request_id: insertedOrder.id,
          menu_item_id: ci.item.id,
          name_snapshot: ci.item.name || 'Producto',
          price_cop_snapshot: typeof ci.item.price_cop === 'number' ? ci.item.price_cop : 0,
          quantity: Math.max(1, Math.min(ci.quantity || 1, 20)),
          item_notes: (ci.notes || '').trim(),
        }))

        const { error: itemsErr } = await supabase
          .from('order_request_items')
          .insert(itemsToInsert)

        if (itemsErr) {
          throw new Error(itemsErr.message || 'No se pudieron registrar los productos del pedido.')
        }
      }

      setManualOrderTable(null)
      setManualCart([])
      setManualNotes('')
      onRefresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo registrar la comanda manual.'
      setManualError(msg)
      console.error('Error en submitManualOrder:', err)
    } finally {
      setManualSubmitting(false)
    }
  }

  const categoryNames = useMemo(() => {
    const fromCategories = categories.map((c) => c.name).filter(Boolean)
    const fromItems = items.map((i) => i.category).filter(Boolean)
    return Array.from(new Set([...fromCategories, ...fromItems]))
  }, [categories, items])

  const filteredCatalogItems = useMemo(() => {
    return items
      .filter((it) => it && it.available)
      .filter((it) => {
        const matchCat = manualCategory === 'Todas' || it.category === manualCategory
        const query = (manualQuery || '').toLowerCase().trim()
        const matchQuery = !query || `${it.name || ''} ${it.description || ''}`.toLowerCase().includes(query)
        return matchCat && matchQuery
      })
  }, [items, manualCategory, manualQuery])

  const manualTotalQty = manualCart.reduce((sum, ci) => sum + (ci?.quantity || 1), 0)
  const manualTotalPrice = manualCart.reduce((sum, ci) => {
    const p = typeof ci?.item?.price_cop === 'number' ? ci.item.price_cop : 0
    const q = typeof ci?.quantity === 'number' ? ci.quantity : 1
    return sum + p * q
  }, 0)

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
      <div className="staff-filter-card" style={{ marginTop: 18 }}>
        <div className="filter-main-row">
          <div className="filter-input-wrap">
            <span className="filter-search-icon" aria-hidden="true"><SearchIcon size={16} /></span>
            <input
              type="search"
              id="activity-search-input"
              placeholder="Buscar por mesa, producto o nota..."
              value={filters.q}
              onChange={(e) => setFilter('q', e.target.value)}
              className="filter-control-input"
            />
          </div>

          <div className="segmented-type-control" role="group" aria-label="Filtrar por tipo">
            <button
              type="button"
              className={`segmented-btn ${filters.type === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('type', 'all')}
            >
              Todos ({filteredOrders.length + filteredRequests.length})
            </button>
            <button
              type="button"
              className={`segmented-btn ${filters.type === 'orders' ? 'active' : ''}`}
              onClick={() => setFilter('type', 'orders')}
            >
              Comandas ({filteredOrders.length})
            </button>
            <button
              type="button"
              className={`segmented-btn ${filters.type === 'requests' ? 'active' : ''}`}
              onClick={() => setFilter('type', 'requests')}
            >
              Llamados ({filteredRequests.length})
            </button>
          </div>

          <select
            id="activity-status-select"
            value={filters.status}
            onChange={(e) => setFilter('status', e.target.value)}
            className="filter-control-select"
            style={{ minWidth: 165 }}
          >
            <option value="active">Activos en cocina</option>
            <option value="pending">Solo pendientes</option>
            <option value="preparing">En preparación</option>
            <option value="delivered">Entregados (Historial)</option>
            <option value="cancelled">Cancelados (Historial)</option>
            <option value="all">Todos los estados</option>
          </select>

          <select
            id="activity-table-select"
            value={filters.table}
            onChange={(e) => setFilter('table', e.target.value)}
            className="filter-control-select"
            style={{ minWidth: 140 }}
          >
            <option value="all">Todas las mesas</option>
            {tables.map((t) => (
              <option key={t.id} value={t.id}>
                Mesa {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Chips de Filtros y Contador */}
        <div className="filter-chips-container">
          <span className="filter-count-badge" id="activity-counter">
            Mostrando {filteredOrders.length} comandas y {filteredRequests.length} llamados
          </span>

          {filters.q && (
            <span className="filter-chip">
              <span>Texto: «{filters.q}»</span>
              <button
                type="button"
                className="filter-chip-remove"
                onClick={() => setFilter('q', '')}
                aria-label="Quitar filtro de texto"
              >
                ✕
              </button>
            </span>
          )}

          {filters.status !== 'active' && (
            <span className="filter-chip">
              <span>Estado: {filters.status}</span>
              <button
                type="button"
                className="filter-chip-remove"
                onClick={() => setFilter('status', 'active')}
                aria-label="Quitar filtro de estado"
              >
                ✕
              </button>
            </span>
          )}

          {filters.table !== 'all' && (
            <span className="filter-chip">
              <span>Mesa: {tables.find((t) => t.id === filters.table)?.label || filters.table}</span>
              <button
                type="button"
                className="filter-chip-remove"
                onClick={() => setFilter('table', 'all')}
                aria-label="Quitar filtro de mesa"
              >
                ✕
              </button>
            </span>
          )}

          {hasActiveFilters && (
            <button
              type="button"
              className="btn-clear-filters"
              onClick={resetFilters}
              id="btn-clear-activity-filters"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

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
        <div className="manual-order-overlay" onClick={() => setManualOrderTable(null)}>
          <div className="manual-order-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="manual-order-head">
              <div className="manual-order-title-group">
                <span className="eyebrow" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--orange)', fontWeight: 700 }}>
                  Comanda manual
                </span>
                <h2 style={{ margin: '2px 0 0', fontSize: '20px' }}>
                  Tomar pedido · Mesa {manualOrderTable.label || 'Seleccionada'}
                </h2>
              </div>
              <button
                type="button"
                className="cart-modal-close"
                onClick={() => setManualOrderTable(null)}
                aria-label="Cerrar modal"
              >
                ×
              </button>
            </div>

            {manualError && (
              <div
                style={{
                  margin: '12px 18px 0',
                  padding: '10px 14px',
                  borderRadius: 10,
                  fontSize: 13,
                  background: 'rgba(234, 67, 53, 0.12)',
                  color: '#b3391b',
                  border: '1px solid rgba(234, 67, 53, 0.3)',
                }}
              >
                ⚠️ {manualError}
              </div>
            )}

            {/* Mobile Tab switcher (visible only on mobile) */}
            <div className="manual-order-tabs">
              <button
                type="button"
                className={`manual-order-tab-btn ${manualTab === 'catalog' ? 'active' : ''}`}
                onClick={() => setManualTab('catalog')}
              >
                <span>🔍 Carta ({filteredCatalogItems.length})</span>
              </button>
              <button
                type="button"
                className={`manual-order-tab-btn ${manualTab === 'cart' ? 'active' : ''}`}
                onClick={() => setManualTab('cart')}
              >
                <span>🛍️ Comanda ({manualTotalQty})</span>
                {manualTotalPrice > 0 && <span className="tab-btn-price">{formatCop(manualTotalPrice)}</span>}
              </button>
            </div>

            <div className="manual-order-body">
              {/* COLUMNA 1: CARTA Y BÚSQUEDA */}
              <div className={`manual-order-col manual-order-col-catalog ${manualTab === 'catalog' ? 'tab-active' : 'tab-hidden'}`}>
                {/* Selector de Mesa */}
                <div className="manual-table-selector-card">
                  <label htmlFor="manual-table-select">
                    <span>Mesa receptora:</span>
                  </label>
                  <select
                    id="manual-table-select"
                    value={manualOrderTable.id}
                    onChange={(e) => {
                      const chosen = tables.find((t) => t.id === e.target.value)
                      if (chosen) setManualOrderTable(chosen)
                    }}
                    className="manual-table-select"
                  >
                    {tables.length === 0 ? (
                      <option value={manualOrderTable.id}>Mesa {manualOrderTable.label || 'Principal'}</option>
                    ) : (
                      tables.map((t) => (
                        <option key={t.id} value={t.id}>
                          Mesa {t.label || t.id} {!t.active ? '(Inactiva)' : ''}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Buscador y filtro de categoría */}
                <div className="manual-search-filter-row">
                  <div className="manual-search-input-wrap">
                    <span className="manual-search-icon" aria-hidden="true"><SearchIcon size={16} /></span>
                    <input
                      type="text"
                      placeholder="Buscar producto en la carta..."
                      value={manualQuery}
                      onChange={(e) => setManualQuery(e.target.value)}
                      className="manual-search-input"
                    />
                  </div>
                  <select
                    value={manualCategory}
                    onChange={(e) => setManualCategory(e.target.value)}
                    className="manual-category-select"
                    aria-label="Filtrar por categoría"
                  >
                    <option value="Todas">Todas las categorías</option>
                    {categoryNames.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Lista de productos para agregar */}
                <div className="manual-products-list">
                  {filteredCatalogItems.length > 0 ? (
                    filteredCatalogItems.map((it) => {
                      const inCart = manualCart.find((ci) => ci.item?.id === it.id)
                      const inCartQty = inCart?.quantity || 0

                      return (
                        <div className={`manual-product-row ${inCartQty > 0 ? 'is-in-cart' : ''}`} key={it.id}>
                          <div className="manual-product-info">
                            <div className="manual-product-name-row">
                              <strong>{it.name || 'Sin nombre'}</strong>
                              {inCartQty > 0 && (
                                <span className="manual-product-badge-qty">{inCartQty} en comanda</span>
                              )}
                            </div>
                            <small>
                              {formatCop(it.price_cop)} {it.category ? `· ${it.category}` : ''}
                            </small>
                          </div>

                          <div className="manual-product-action">
                            {inCartQty > 0 ? (
                              <div className="manual-row-qty-picker">
                                <button
                                  type="button"
                                  onClick={() => updateManualQty(it.id, -1)}
                                  aria-label={`Disminuir ${it.name}`}
                                >
                                  −
                                </button>
                                <span>{inCartQty}</span>
                                <button
                                  type="button"
                                  onClick={() => updateManualQty(it.id, 1)}
                                  aria-label={`Aumentar ${it.name}`}
                                >
                                  +
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="btn-manual-add"
                                onClick={() => addManualProduct(it)}
                              >
                                + Agregar
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="manual-products-empty">
                      <span>☕ No se encontraron productos coincidentes.</span>
                    </div>
                  )}
                </div>

                {/* Botón móvil para ver la comanda */}
                {manualCart.length > 0 && (
                  <button
                    type="button"
                    className="manual-mobile-view-cart-btn"
                    onClick={() => setManualTab('cart')}
                  >
                    <span>🛍️ Ver comanda ({manualTotalQty})</span>
                    <strong>{formatCop(manualTotalPrice)} →</strong>
                  </button>
                )}
              </div>

              {/* COLUMNA 2: ITEMS AGREGADOS A LA COMANDA */}
              <div className={`manual-order-col manual-order-col-cart ${manualTab === 'cart' ? 'tab-active' : 'tab-hidden'}`}>
                <div className="manual-cart-header-section">
                  <div className="manual-cart-header">
                    <span>Productos en la comanda ({manualTotalQty}):</span>
                    {manualCart.length > 0 && (
                      <button
                        type="button"
                        className="manual-cart-clear-btn"
                        onClick={() => setManualCart([])}
                      >
                        Vaciar
                      </button>
                    )}
                  </div>
                </div>

                {manualCart.length > 0 ? (
                  <div className="manual-cart-scroll-area">
                    {manualCart.map(({ item, quantity, notes }) => {
                      if (!item) return null
                      const itemPrice = typeof item.price_cop === 'number' ? item.price_cop : 0
                      const qty = typeof quantity === 'number' ? quantity : 1
                      return (
                        <div key={item.id} className="manual-cart-item-box">
                          <div className="manual-cart-item-row">
                            <div>
                              <strong>{item.name || 'Producto'}</strong>
                              <span className="manual-item-subtotal">
                                {formatCop(itemPrice * qty)}
                              </span>
                            </div>
                            <div className="cart-qty-picker">
                              <button type="button" onClick={() => updateManualQty(item.id, -1)}>
                                −
                              </button>
                              <span>{qty}</span>
                              <button type="button" onClick={() => updateManualQty(item.id, 1)}>
                                +
                              </button>
                            </div>
                          </div>
                          <input
                            type="text"
                            placeholder="Nota o especificación (ej. sin azúcar, deslactosada)"
                            value={notes || ''}
                            onChange={(e) => updateManualItemNotes(item.id, e.target.value)}
                            className="manual-item-note-input"
                          />
                        </div>
                      )
                    })}
                    <div className="manual-notes-group">
                      <label htmlFor="manual-general-notes">Nota general para barra/cocina:</label>
                      <input
                        id="manual-general-notes"
                        type="text"
                        placeholder="Instrucciones para el servicio..."
                        value={manualNotes}
                        onChange={(e) => setManualNotes(e.target.value)}
                        className="manual-general-notes-input"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="manual-cart-empty-state">
                    <span className="empty-cart-icon">🛍️</span>
                    <p>Aún no has agregado productos a esta comanda.</p>
                    <button
                      type="button"
                      className="btn-manual-browse-menu"
                      onClick={() => setManualTab('catalog')}
                    >
                      Ver carta y agregar productos
                    </button>
                  </div>
                )}

                <div className="manual-order-cart-footer manual-order-footer">
                  <div className="manual-order-total-info">
                    <span>Total comanda (Mesa {manualOrderTable.label || 'Seleccionada'}):</span>
                    <strong>{formatCop(manualTotalPrice)}</strong>
                  </div>
                  <button
                    type="button"
                    className="btn-manual-submit"
                    disabled={manualSubmitting || !manualCart.length}
                    onClick={submitManualOrder}
                  >
                    {manualSubmitting
                      ? 'Registrando…'
                      : `Crear comanda · Mesa ${manualOrderTable.label || 'Seleccionada'}`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog />
    </div>
  )
}
