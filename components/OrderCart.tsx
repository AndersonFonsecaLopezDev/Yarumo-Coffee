'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useScrollLock } from '@/lib/use-scroll-lock'
import { useI18n } from '@/lib/i18n'
import type { CartItem, TableOrder, TableOrderItem } from '@/lib/types'

export type { CartItem, TableOrder, TableOrderItem }

type OrderCartProps = {
  cart: CartItem[]
  table: { id: string; label: string } | null
  mesaToken: string | null
  tableOrders?: TableOrder[]
  whatsappNumber?: string
  onOrdersRefresh?: () => void
  onUpdateQuantity: (indexOrId: number | string, delta: number) => void
  onUpdateItemNotes: (indexOrId: number | string, notes: string) => void
  onRemoveItem: (indexOrId: number | string) => void
  onClearCart: () => void
  onOrderSuccess: (orderId: string) => void
}

function formatCop(value?: number | null) {
  const safe = typeof value === 'number' && !Number.isNaN(value) ? value : 0
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(safe)
}

export default function OrderCart({
  cart,
  table,
  mesaToken,
  tableOrders: propTableOrders,
  whatsappNumber = '573192208938',
  onOrdersRefresh,
  onUpdateQuantity,
  onUpdateItemNotes,
  onRemoveItem,
  onClearCart,
  onOrderSuccess,
}: OrderCartProps) {
  const { t } = useI18n()
  const [isOpen, setIsOpen] = useState(false)
  const [orderNotes, setOrderNotes] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'Efectivo' | 'Llave (Transferencia)'>('Efectivo')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [internalOrders, setInternalOrders] = useState<TableOrder[]>([])

  const isInsideTable = Boolean(table && mesaToken)
  const effectiveOrders = propTableOrders ?? internalOrders
  const totalItems = cart.reduce((acc, curr) => acc + curr.quantity, 0)
  const totalPrice = cart.reduce((acc, curr) => acc + (curr.effectivePrice ?? curr.item.price_cop) * curr.quantity, 0)
  const hasContent = totalItems > 0 || effectiveOrders.length > 0
  const drawerOpen = isOpen && hasContent

  const [prevHasContent, setPrevHasContent] = useState(hasContent)
  if (prevHasContent !== hasContent) {
    setPrevHasContent(hasContent)
    if (!hasContent && isOpen) {
      setIsOpen(false)
    }
  }

  useScrollLock(drawerOpen)

  useEffect(() => {
    if (!drawerOpen) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [drawerOpen])

  function getStatusLabel(status: TableOrder['status']) {
    switch (status) {
      case 'pending':
        return { text: t('cart_status_pending_label'), className: 'status-pending' }
      case 'acknowledged':
        return { text: t('cart_status_acknowledged_label'), className: 'status-acknowledged' }
      case 'preparing':
        return { text: t('cart_status_preparing_label'), className: 'status-preparing' }
      case 'delivered':
        return { text: t('cart_status_delivered_label'), className: 'status-delivered' }
      case 'cancelled':
        return { text: t('cart_status_cancelled_label'), className: 'status-cancelled' }
      default:
        return { text: status, className: 'status-pending' }
    }
  }

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
    if (!cart.length) {
      setErrorMessage(t('cart_err_empty'))
      return
    }

    setErrorMessage('')

    // FLUJO 1: SERVICIO EN MESA (Comanda a cocina por Supabase)
    if (isInsideTable) {
      if (!table || !mesaToken) {
        setErrorMessage(t('cart_err_scan_qr'))
        return
      }

      setSubmitting(true)

      const supabase = createClient()
      const payloadItems = cart.map((ci) => ({
        menu_item_id: ci.item.id,
        quantity: ci.quantity,
        item_notes: ci.notes.trim(),
        option_choice_ids: ci.selectedChoiceIds || [],
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
              ? t('cart_err_wait_seconds')
              : error.message || t('cart_err_generic'),
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
        setErrorMessage(t('cart_err_connection'))
        setSubmitting(false)
      }
      return
    }

    // FLUJO 2: PEDIDO A DOMICILIO (Envío estructurado a WhatsApp)
    if (!customerName.trim()) {
      setErrorMessage(t('cart_err_name_req'))
      return
    }

    if (!deliveryAddress.trim()) {
      setErrorMessage(t('cart_err_address_req'))
      return
    }

    if (!customerPhone.trim()) {
      setErrorMessage(t('cart_err_phone_req'))
      return
    }

    // Guardar datos del cliente en localStorage
    try {
      localStorage.setItem(
        'yarumo_delivery_customer',
        JSON.stringify({
          name: customerName.trim(),
          address: deliveryAddress.trim(),
          phone: customerPhone.trim(),
          paymentMethod,
        }),
      )
    } catch {}

    // Decisión de diseño i18n: El mensaje a WhatsApp para el restaurante se mantiene en español
    // porque es recibido y procesado por el equipo de baristas y barra local en Armenia, Quindío.
    const lines = [
      '*¡Hola Yarumo Coffee! Quiero hacer un pedido a domicilio:*',
      '',
      `*Cliente:* ${customerName.trim()}`,
      `*Dirección:* ${deliveryAddress.trim()}`,
      `*Teléfono:* ${customerPhone.trim()}`,
      `*Forma de pago:* ${paymentMethod}`,
      '',
      '*PRODUCTOS:*',
    ]

    cart.forEach((ci) => {
      const unitPrice = ci.effectivePrice ?? ci.item.price_cop
      const itemTotal = unitPrice * ci.quantity
      const notePart = ci.notes.trim() ? ` _(${ci.notes.trim()})_` : ''
      lines.push(`- ${ci.quantity}x ${ci.item.name}${notePart} — ${formatCop(itemTotal)}`)
    })

    if (orderNotes.trim()) {
      lines.push('')
      lines.push(`*Notas / Instrucciones:* ${orderNotes.trim()}`)
    }

    lines.push('')
    lines.push(`*TOTAL PRODUCTOS:* ${formatCop(totalPrice)}`)
    lines.push('_(Nota: El costo de domicilio aún no está incluido. Quedo atento a que me confirmen el valor de la entrega y el total final)_')
    lines.push('')
    lines.push('_Pedido generado desde yarumocoffee.com_')

    const cleanNumber = (whatsappNumber || '573192208938').replace(/\D/g, '')
    const message = lines.join('\n')
    const whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`

    // Abrir WhatsApp
    window.open(whatsappUrl, '_blank')

    onClearCart()
    setIsOpen(false)
    onOrderSuccess('whatsapp')
  }

  function openCartDrawer() {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('yarumo_delivery_customer') : null
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.name) setCustomerName(parsed.name)
        if (parsed.address) setDeliveryAddress(parsed.address)
        if (parsed.phone) setCustomerPhone(parsed.phone)
        if (parsed.paymentMethod) setPaymentMethod(parsed.paymentMethod)
      }
    } catch {}
    setIsOpen(true)
  }

  // El botón flotante solo es visible si hay items en carrito o si hay pedidos realizados para la mesa
  if (!hasContent) {
    return null
  }

  return (
    <>
      {/* Floating Cart Button */}
      <button
        type="button"
        className="floating-cart-btn"
        onClick={openCartDrawer}
        aria-label={`${t('cart_floating_aria_prefix')} (${totalItems} ${t('cart_floating_products_suffix')})`}
      >
        <div className="cart-badge-icon">
          <span>{isInsideTable ? '🛒' : '🛵'}</span>
          {totalItems > 0 && <span className="cart-count-badge">{totalItems}</span>}
        </div>
        <div className="cart-btn-info">
          <span className="cart-btn-label">
            {isInsideTable ? `${t('cart_floating_table_prefix')} ${table?.label}` : t('cart_floating_delivery')}
          </span>
          <strong className="cart-btn-price">
            {totalItems > 0 ? formatCop(totalPrice) : `${effectiveOrders.length} ${t('cart_floating_orders_suffix')}`}
          </strong>
        </div>
        <span className="cart-btn-arrow" aria-hidden="true">→</span>
      </button>

      {/* Cart Drawer Modal */}
      {drawerOpen && (
        <div
          className="cart-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={isInsideTable ? t('cart_dialog_table_aria') : t('cart_dialog_delivery_aria')}
          onClick={() => setIsOpen(false)}
        >
          <div className="cart-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="cart-modal-header">
              <div>
                <span className="eyebrow">
                  {isInsideTable ? `${t('cart_floating_table_prefix')} ${table?.label}` : t('cart_eyebrow_delivery')}
                </span>
                <h2>{isInsideTable ? t('cart_title_table') : t('cart_title')}</h2>
              </div>
              <button
                type="button"
                className="cart-modal-close"
                onClick={() => setIsOpen(false)}
                aria-label={t('cart_close_aria')}
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
                  <p>{t('cart_empty_msg')}</p>
                </div>
              ) : (
                <div className="cart-items-list">
                  {cart.map(({ item, quantity, notes }, index) => (
                    <div className="cart-item-row" key={`${item.id}-${index}`}>
                      <div className="cart-item-main">
                        <div>
                          <strong className="cart-item-name">{item.name}</strong>
                          <span className="cart-item-unit-price">
                            {formatCop(cart[index]?.effectivePrice ?? item.price_cop)} {t('cart_each_suffix')}
                          </span>
                          {notes && (
                            <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  background: 'rgba(224, 90, 43, 0.12)',
                                  color: 'var(--orange)',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                }}
                              >
                                ☕ {notes}
                              </span>
                            </div>
                          )}
                        </div>
                        <strong className="cart-item-total-price">
                          {formatCop((cart[index]?.effectivePrice ?? item.price_cop) * quantity)}
                        </strong>
                      </div>

                      <div className="cart-item-controls">
                        <div className="cart-qty-picker">
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(index, -1)}
                            aria-label={`${t('cart_qty_minus_prefix')} ${item.name}`}
                          >
                            −
                          </button>
                          <span>{quantity}</span>
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(index, 1)}
                            disabled={quantity >= 20}
                            aria-label={`${t('cart_qty_plus_prefix')} ${item.name}`}
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          className="cart-remove-btn"
                          onClick={() => onRemoveItem(index)}
                          aria-label={`${t('cart_remove_aria_prefix')} ${item.name}`}
                        >
                          {t('cart_remove_btn')}
                        </button>
                      </div>

                      <div className="cart-item-note-input-wrap">
                        <input
                          type="text"
                          placeholder={t('cart_item_note_ph')}
                          value={notes}
                          onChange={(e) => onUpdateItemNotes(index, e.target.value)}
                          maxLength={150}
                          aria-label={`${t('cart_item_note_aria_prefix')} ${item.name}`}
                        />
                      </div>
                    </div>
                  ))}

                  {/* FORMULARIO DE DOMICILIO: Solo cuando NO está en mesa física */}
                  {!isInsideTable && (
                    <div className="delivery-form-section">
                      <div className="delivery-form-title">
                        <span>{t('cart_delivery_section_title')}</span>
                      </div>

                      <div className="delivery-field-group">
                        <label htmlFor="delivery-name">{t('cart_delivery_name_label')}</label>
                        <input
                          id="delivery-name"
                          type="text"
                          placeholder={t('cart_delivery_name_ph')}
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          required
                          className="delivery-input"
                        />
                      </div>

                      <div className="delivery-field-group">
                        <label htmlFor="delivery-address">{t('cart_delivery_address_label')}</label>
                        <input
                          id="delivery-address"
                          type="text"
                          placeholder={t('cart_delivery_address_ph')}
                          value={deliveryAddress}
                          onChange={(e) => setDeliveryAddress(e.target.value)}
                          required
                          className="delivery-input"
                        />
                      </div>

                      <div className="delivery-field-group">
                        <label htmlFor="delivery-phone">{t('cart_delivery_phone_label')}</label>
                        <input
                          id="delivery-phone"
                          type="tel"
                          placeholder={t('cart_delivery_phone_ph')}
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          required
                          className="delivery-input"
                        />
                      </div>

                      <div className="delivery-field-group">
                        <label>{t('cart_delivery_payment_label')}</label>
                        <div className="delivery-payment-options">
                          <button
                            type="button"
                            className={`delivery-payment-btn ${paymentMethod === 'Efectivo' ? 'active' : ''}`}
                            onClick={() => setPaymentMethod('Efectivo')}
                          >
                            <span>💵</span>
                            <span>{t('cart_payment_cash')}</span>
                          </button>
                          <button
                            type="button"
                            className={`delivery-payment-btn ${paymentMethod === 'Llave (Transferencia)' ? 'active' : ''}`}
                            onClick={() => setPaymentMethod('Llave (Transferencia)')}
                          >
                            <span>🔑</span>
                            <span>{t('cart_payment_transfer')}</span>
                          </button>
                        </div>
                      </div>

                      <div
                        style={{
                          fontSize: '11px',
                          color: 'var(--text-muted)',
                          background: 'color-mix(in srgb, var(--orange) 10%, var(--surface))',
                          border: '1px dashed color-mix(in srgb, var(--orange) 40%, transparent)',
                          borderRadius: '8px',
                          padding: '8px 10px',
                          lineHeight: '1.4',
                        }}
                      >
                        {t('cart_delivery_disclaimer')}
                      </div>
                    </div>
                  )}

                  <div className="cart-general-notes">
                    <label htmlFor="order-general-notes">
                      {isInsideTable
                        ? t('cart_notes_table_label')
                        : t('cart_notes_delivery_label')}
                    </label>
                    <textarea
                      id="order-general-notes"
                      rows={2}
                      placeholder={
                        isInsideTable
                          ? t('cart_notes_table_ph')
                          : t('cart_notes_delivery_ph')
                      }
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      maxLength={400}
                    />
                  </div>
                </div>
              )}

              {/* Historial Real de Pedidos de la Mesa */}
              {isInsideTable && effectiveOrders.length > 0 && (
                <div className="cart-session-history">
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <h3>{t('cart_history_title')}</h3>
                    <small style={{ color: 'var(--orange)', fontWeight: 700 }}>
                      {t('cart_history_consumption_prefix')} {formatCop(accumulatedTotalCop)}
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
                              {t('cart_order_order_prefix')}{effectiveOrders.length - idx}{' '}
                              {ord.source === 'staff' && <small style={{ color: 'var(--text-muted)' }}>{t('cart_order_waiter_tag')}</small>}
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
                            })} · {t('cart_order_subtotal_prefix')} {formatCop(orderSum)}
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
                  <div>
                    <span>{isInsideTable ? t('cart_total_to_send') : t('cart_total_products')}</span>
                    {!isInsideTable && (
                      <small style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>
                        {t('cart_delivery_not_included')}
                      </small>
                    )}
                  </div>
                  <strong>{formatCop(totalPrice)}</strong>
                </div>
                <button
                  type="button"
                  className={`cart-submit-order-btn ${!isInsideTable ? 'btn-whatsapp-submit' : ''}`}
                  onClick={handleSendOrder}
                  disabled={submitting}
                >
                  {isInsideTable
                    ? submitting
                      ? t('cart_btn_sending_kitchen')
                      : `${t('cart_btn_send_table_prefix')} ${table?.label}`
                    : t('cart_btn_send_whatsapp_cta')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
