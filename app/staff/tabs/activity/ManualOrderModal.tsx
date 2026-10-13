'use client'

import { useMemo, useState } from 'react'
import type { CafeTable, MenuCategory, MenuItem } from '../../types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SearchIcon } from '@/components/icons/CategoryIcons'
import { formatCop } from '@/lib/format'

type ManualOrderModalProps = {
  table: CafeTable
  tables: CafeTable[]
  items: MenuItem[]
  categories: MenuCategory[]
  supabase: SupabaseClient
  onClose: () => void
  onRefresh: () => void
}

export default function ManualOrderModal({
  table,
  tables,
  items,
  categories,
  supabase,
  onClose,
  onRefresh,
}: ManualOrderModalProps) {
  const [currentTable, setCurrentTable] = useState<CafeTable>(table)
  const [manualCart, setManualCart] = useState<Array<{ item: MenuItem; quantity: number; notes: string }>>([])
  const [manualTab, setManualTab] = useState<'catalog' | 'cart'>('catalog')
  const [manualCategory, setManualCategory] = useState('Todas')
  const [manualQuery, setManualQuery] = useState('')
  const [manualNotes, setManualNotes] = useState('')
  const [manualSubmitting, setManualSubmitting] = useState(false)
  const [manualError, setManualError] = useState<string | null>(null)

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

  async function submitManualOrder() {
    if (!currentTable || !manualCart.length) return
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
        p_table_id: currentTable.id,
        p_notes: (manualNotes || '').trim(),
        p_items: payloadItems,
      })

      if (rpcErr) {
        console.warn('RPC staff_submit_order_request no disponible o falló, usando inserción directa:', rpcErr)

        // Fallback: Inserción directa en order_requests y order_request_items
        const { data: insertedOrder, error: orderErr } = await supabase
          .from('order_requests')
          .insert({
            table_id: currentTable.id || null,
            table_token: currentTable.public_token || '',
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

        const { error: itemsErr } = await supabase.from('order_request_items').insert(itemsToInsert)

        if (itemsErr) {
          throw new Error(itemsErr.message || 'No se pudieron registrar los productos del pedido.')
        }
      }

      onClose()
      onRefresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo registrar la comanda manual.'
      setManualError(msg)
      console.error('Error en submitManualOrder:', err)
    } finally {
      setManualSubmitting(false)
    }
  }

  return (
    <div className="manual-order-overlay" onClick={onClose}>
      <div className="manual-order-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="manual-order-head">
          <div className="manual-order-title-group">
            <span
              className="eyebrow"
              style={{
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--orange)',
                fontWeight: 700,
              }}
            >
              Comanda manual
            </span>
            <h2 style={{ margin: '2px 0 0', fontSize: '20px' }}>
              Tomar pedido · Mesa {currentTable.label || 'Seleccionada'}
            </h2>
          </div>
          <button type="button" className="cart-modal-close" onClick={onClose} aria-label="Cerrar modal">
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
          <div
            className={`manual-order-col manual-order-col-catalog ${manualTab === 'catalog' ? 'tab-active' : 'tab-hidden'}`}
          >
            {/* Selector de Mesa */}
            <div className="manual-table-selector-card">
              <label htmlFor="manual-table-select">
                <span>Mesa receptora:</span>
              </label>
              <select
                id="manual-table-select"
                value={currentTable.id}
                onChange={(e) => {
                  const chosen = tables.find((t) => t.id === e.target.value)
                  if (chosen) setCurrentTable(chosen)
                }}
                className="manual-table-select"
              >
                {tables.length === 0 ? (
                  <option value={currentTable.id}>Mesa {currentTable.label || 'Principal'}</option>
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
                <span className="manual-search-icon" aria-hidden="true">
                  <SearchIcon size={16} />
                </span>
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
          <div
            className={`manual-order-col manual-order-col-cart ${manualTab === 'cart' ? 'tab-active' : 'tab-hidden'}`}
          >
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
                <span>Total comanda (Mesa {currentTable.label || 'Seleccionada'}):</span>
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
                  : `Crear comanda · Mesa ${currentTable.label || 'Seleccionada'}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
