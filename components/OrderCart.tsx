'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { MenuItem } from './MenuExperience'

export type CartItem = {
  item: MenuItem
  quantity: number
  notes: string
}

export type PlacedOrder = {
  id: string
  created_at: string
  itemsCount: number
  totalCop: number
  status: 'pending' | 'acknowledged' | 'preparing' | 'delivered' | 'cancelled'
}

type OrderCartProps = {
  cart: CartItem[]
  table: { id: string; label: string } | null
  mesaToken: string | null
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

export default function OrderCart({
  cart,
  table,
  mesaToken,
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
  const [sessionOrders, setSessionOrders] = useState<PlacedOrder[]>([])

  const totalItems = cart.reduce((acc, curr) => acc + curr.quantity, 0)
  const totalPrice = cart.reduce((acc, curr) => acc + curr.item.price_cop * curr.quantity, 0)

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

      setSessionOrders((prev) => [
        {
          id: orderId,
          created_at: new Date().toISOString(),
          itemsCount: totalItems,
          totalCop: totalPrice,
          status: 'pending',
        },
        ...prev,
      ])

      onClearCart()
      setOrderNotes('')
      setSubmitting(false)
      setIsOpen(false)
      onOrderSuccess(orderId)
    } catch {
      setErrorMessage('Error de conexión al enviar el pedido. Verifica tu conexión a internet.')
      setSubmitting(false)
    }
  }

  // Floating trigger button (visible when there are items in cart or orders in session)
  if (!totalItems && sessionOrders.length === 0) {
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
            {totalItems > 0 ? formatCop(totalPrice) : `${sessionOrders.length} pedido(s)`}
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
                  <p>No tienes productos en el carrito actualmente.</p>
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

              {sessionOrders.length > 0 && (
                <div className="cart-session-history">
                  <h3>Pedidos enviados en esta sesión</h3>
                  <div className="session-orders-list">
                    {sessionOrders.map((ord, idx) => (
                      <div className="session-order-badge" key={ord.id || idx}>
                        <div className="session-order-header">
                          <span>
                            Pedido #{idx + 1} ({ord.itemsCount} {ord.itemsCount === 1 ? 'ítem' : 'ítems'})
                          </span>
                          <span className="order-status-pill status-pending">Enviado al barista</span>
                        </div>
                        <small>
                          {new Date(ord.created_at).toLocaleTimeString('es-CO', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })} · Total: {formatCop(ord.totalCop)}
                        </small>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="cart-modal-footer">
                <div className="cart-footer-summary">
                  <span>Total estimado</span>
                  <strong>{formatCop(totalPrice)}</strong>
                </div>
                <button
                  type="button"
                  className="cart-submit-order-btn"
                  onClick={handleSendOrder}
                  disabled={submitting || !table}
                >
                  {submitting ? 'Enviando comanda…' : table ? `Enviar pedido a Mesa ${table.label}` : 'Escanea el QR de tu mesa'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
