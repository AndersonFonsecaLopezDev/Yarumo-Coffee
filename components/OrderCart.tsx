'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { MenuItem } from './MenuExperience'

export type CartItem = {
  item: MenuItem
  quantity: number
  notes: string
}

export type TableOrderItem = {
  id: string
  name_snapshot: string
  price_cop_snapshot: number
  quantity: number
  item_notes: string
}

export type TableOrder = {
  id: string
  status: 'pending' | 'acknowledged' | 'preparing' | 'delivered' | 'cancelled'
  notes: string
  source: string
  created_at: string
  acknowledged_at: string | null
  delivered_at: string | null
  items: TableOrderItem[]
}

type OrderCartProps = {
  cart: CartItem[]
  table: { id: string; label: string } | null
  mesaToken: string | null
  tableOrders?: TableOrder[]
  onOrdersRefresh?: () => void
  onUpdateQuantity: (itemId: string, delta: number) => void
  onUpdateItemNotes: (itemId: string, notes: string) => void
  onRemoveItem: (itemId: string) => void
  onClearCart: () => void
  onOrderSuccess: (orderId: string) => void
}

function formatCop(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

function getStatusLabel(status: TableOrder['status']) {
  switch (status) {
    case 'pending':
      return { text: '⏳ Enviado a barra', className: 'status-pending' }
    case 'acknowledged':
      return { text: '👀 Recibido', className: 'status-acknowledged' }
    case 'preparing':
      return { text: '☕ En preparación', className: 'status-preparing' }
    case 'delivered':
      return { text: '✓ Entregado', className: 'status-delivered' }
    case 'cancelled':
      return { text: '✕ Cancelado', className: 'status-cancelled' }
    default:
      return { text: status, className: 'status-pending' }
  }
}

export default function OrderCart({
  cart,
  table,
  mesaToken,
  tableOrders: propTableOrders,
  onOrdersRefresh,
  onUpdateQuantity,
  onUpdateItemNotes,
  onRemoveItem,
  onClearCart,
  onOrderSuccess,
}: OrderCartProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [orderNotes, setOrderNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [internalOrders, setInternalOrders] = useState<TableOrder[]>([])

  const effectiveOrders = propTableOrders ?? internalOrders
  const totalItems = cart.reduce((acc, curr) => acc + curr.quantity, 0)
  const totalPrice = cart.reduce((acc, curr) => acc + curr.item.price_cop * curr.quantity, 0)

  // Cargar historial si no se provee por props
  const fetchOrdersForTable = useCallback(async (tableId: string, token: string) => {
    if (propTableOrders && onOrdersRefresh) {
      onOrdersRefresh()
      return
    }
    const supabase = createClient()
    const { data } = await supabase.rpc('get_table_orders', {
      p_table_id: tableId,
      p_table_token: token,
    })
    if (data) {
      setInternalOrders(data as TableOrder[])
    }
  }, [propTableOrders, onOrdersRefresh])

  useEffect(() => {
    let active = true
    if (!table || !mesaToken || propTableOrders) return

    void Promise.resolve().then(() => {
      if (active) {
        void fetchOrdersForTable(table.id, mesaToken)
      }
    })

    const supabase = createClient()
    const channel = supabase
      .channel(`table-orders-${table.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_requests',
          filter: `table_id=eq.${table.id}`,
        },
        () => {
          if (active) void fetchOrdersForTable(table.id, mesaToken)
        },
      )
      .subscribe()

    return () => {
      active = false
      void supabase.removeChannel(channel)
    }
  }, [table, mesaToken, propTableOrders, fetchOrdersForTable])

  // Total acumulado de todos los pedidos no cancelados de la mesa
  const accumulatedTotalCop = effectiveOrders
    .filter((o) => o.status !== 'cancelled')
    .reduce((acc, o) => {
      const orderSum = (o.items || []).reduce(
        (sum, it) => sum + (it.price_cop_snapshot || 0) * (it.quantity || 1),
        0,
      )
      return acc + orderSum
    }, 0)

  async function handleSendOrder() {
    if (!table || !mesaToken) {
      setErrorMessage('Debes escanear el QR asignado a tu mesa para enviar un pedido.')
      return
    }

    if (!cart.length) {
      setErrorMessage('Tu carrito está vacío.')
      return
    }

    setSubmitting(true)
    setErrorMessage('')

    const supabase = createClient()
    const payloadItems = cart.map((ci) => ({
      menu_item_id: ci.item.id,
      quantity: ci.quantity,
      item_notes: ci.notes.trim(),
    }))

    try {
      const { data, error } = await supabase.rpc('submit_order_request', {
        p_table_id: table.id,
        p_table_token: mesaToken,
        p_notes: orderNotes.trim(),
        p_items: payloadItems,
      })

      if (error) {
        setErrorMessage(
          error.message.includes('No es posible crear el pedido')
            ? 'Por favor espera unos segundos antes de enviar otro pedido.'
            : error.message || 'No se pudo enviar el pedido. Intenta nuevamente.',
        )
        setSubmitting(false)
        return
      }

      const orderData = data as { success: boolean; order_id: string; created_at: string } | null
      const orderId = orderData?.order_id || 'ok'

      onClearCart()
      setOrderNotes('')
      setSubmitting(false)
      setIsOpen(false)
      void fetchOrdersForTable(table.id, mesaToken)
      onOrderSuccess(orderId)
    } catch {
      setErrorMessage('Error de conexión al enviar el pedido. Verifica tu conexión a internet.')
      setSubmitting(false)
    }
  }

  // El botón flotante solo es visible si hay items en carrito o si hay pedidos realizados para la mesa
  if (!totalItems && effectiveOrders.length === 0) {
    return null
  }

  return (
    <>
      {/* Floating Cart Button */}
      <button
        type="button"
        className="floating-cart-btn"
        onClick={() => setIsOpen(true)}
        aria-label={`Ver pedido actual (${totalItems} productos)`}
      >
        <div className="cart-badge-icon">
          <span>🛒</span>
          {totalItems > 0 && <span className="cart-count-badge">{totalItems}</span>}
        </div>
        <div className="cart-btn-info">
          <span className="cart-btn-label">
            {table ? `Mesa ${table.label}` : 'Tu Pedido'}
          </span>
          <strong className="cart-btn-price">
            {totalItems > 0 ? formatCop(totalPrice) : `${effectiveOrders.length} comanda(s)`}
          </strong>
        </div>
        <span className="cart-btn-arrow" aria-hidden="true">→</span>
      </button>

      {/* Cart Drawer Modal */}
      {isOpen && (
        <div
          className="cart-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Resumen de tu pedido"
          onClick={() => setIsOpen(false)}
        >
          <div className="cart-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="cart-modal-header">
              <div>
                <span className="eyebrow">{table ? `Mesa ${table.label}` : 'Servicio en mesa'}</span>
                <h2>Tu Pedido</h2>
              </div>
              <button
                type="button"
                className="cart-modal-close"
                onClick={() => setIsOpen(false)}
                aria-label="Cerrar pedido"
              >
                ×
              </button>
            </div>

            {errorMessage && (
              <div className="admin-error" style={{ margin: '12px 16px' }} role="alert">
                {errorMessage}
              </div>
            )}

            <div className="cart-modal-body">
              {cart.length === 0 ? (
                <div className="cart-empty-message">
                  <span className="cart-empty-icon">☕</span>
                  <p>No tienes nuevos productos por enviar en el carrito.</p>
                </div>
              ) : (
                <div className="cart-items-list">
                  {cart.map(({ item, quantity, notes }) => (
                    <div className="cart-item-row" key={item.id}>
                      <div className="cart-item-main">
                        <div>
                          <strong className="cart-item-name">{item.name}</strong>
                          <span className="cart-item-unit-price">{formatCop(item.price_cop)} c/u</span>
                        </div>
                        <strong className="cart-item-total-price">
                          {formatCop(item.price_cop * quantity)}
                        </strong>
                      </div>

                      <div className="cart-item-controls">
                        <div className="cart-qty-picker">
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(item.id, -1)}
                            aria-label={`Disminuir cantidad de ${item.name}`}
                          >
                            −
                          </button>
                          <span>{quantity}</span>
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(item.id, 1)}
                            disabled={quantity >= 20}
                            aria-label={`Aumentar cantidad de ${item.name}`}
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          className="cart-remove-btn"
                          onClick={() => onRemoveItem(item.id)}
                          aria-label={`Eliminar ${item.name} del pedido`}
                        >
                          Quitar
                        </button>
                      </div>

                      <div className="cart-item-note-input-wrap">
                        <input
                          type="text"
                          placeholder="Nota para este ítem (ej. sin azúcar, leche de almendra)"
                          value={notes}
                          onChange={(e) => onUpdateItemNotes(item.id, e.target.value)}
                          maxLength={150}
                          aria-label={`Nota adicional para ${item.name}`}
                        />
                      </div>
                    </div>
                  ))}

                  <div className="cart-general-notes">
                    <label htmlFor="order-general-notes">Notas o instrucciones para el equipo:</label>
                    <textarea
                      id="order-general-notes"
                      rows={2}
                      placeholder="Ej. Servir bebidas primero, cubiertos adicionales..."
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      maxLength={400}
                    />
                  </div>
                </div>
              )}

              {/* Historial Real de Pedidos de la Mesa */}
              {effectiveOrders.length > 0 && (
                <div className="cart-session-history">
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <h3>Todo lo que has pedido</h3>
                    <small style={{ color: 'var(--orange)', fontWeight: 700 }}>
                      Consumo: {formatCop(accumulatedTotalCop)}
                    </small>
                  </div>
                  <div className="session-orders-list">
                    {effectiveOrders.map((ord, idx) => {
                      const statusInfo = getStatusLabel(ord.status)
                      const orderSum = (ord.items || []).reduce(
                        (sum, it) => sum + it.price_cop_snapshot * it.quantity,
                        0,
                      )
                      return (
                        <div className="session-order-badge" key={ord.id || idx}>
                          <div className="session-order-header">
                            <span>
                              Comanda #{effectiveOrders.length - idx}{' '}
                              {ord.source === 'staff' && <small style={{ color: 'var(--text-muted)' }}>(Mesero)</small>}
                            </span>
                            <span className={`order-status-pill ${statusInfo.className}`}>
                              {statusInfo.text}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', margin: '4px 0', color: 'var(--text)' }}>
                            {(ord.items || []).map((it) => (
                              <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>{it.quantity}x {it.name_snapshot}</span>
                                <span style={{ color: 'var(--text-muted)' }}>{formatCop(it.price_cop_snapshot * it.quantity)}</span>
                              </div>
                            ))}
                          </div>
                          <small style={{ color: 'var(--text-muted)' }}>
                            {new Date(ord.created_at).toLocaleTimeString('es-CO', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })} · Subtotal: {formatCop(orderSum)}
                          </small>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="cart-modal-footer">
                <div className="cart-footer-summary">
                  <span>Total a enviar</span>
                  <strong>{formatCop(totalPrice)}</strong>
                </div>
                <button
                  type="button"
                  className="cart-submit-order-btn"
                  onClick={handleSendOrder}
                  disabled={submitting || !table}
                >
                  {submitting ? 'Enviando comanda…' : table ? `Enviar comanda a Mesa ${table.label}` : 'Escanea el QR de tu mesa'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
