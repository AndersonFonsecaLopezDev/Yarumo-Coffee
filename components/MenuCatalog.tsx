'use client'

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import type { CartItem, TableOrder } from './OrderCart'
import { createClient } from '@/lib/supabase/client'

// Carga diferida con dynamic(..., { ssr: false }) para aligerar el bundle inicial de la home
const OrderCart = dynamic(() => import('./OrderCart'), { ssr: false })
const GalleryModal = dynamic(() => import('./GalleryModal'), { ssr: false })
const CustomerOrderTracker = dynamic(() => import('./CustomerOrderTracker'), { ssr: false })
import { CategoryIcon } from '@/components/icons/CategoryIcons'
import { ProductPlaceholder } from '@/components/ProductPlaceholder'

export type MenuItem = {
  id: string
  name: string
  description: string
  price_cop: number
  category: string
  category_id?: string | null
  sort_order: number
  image_url: string | null
  gallery_urls: string[]
  tags?: string[]
}

export type MenuCategory = {
  id: string
  name: string
  slug?: string
  icon: string
  sort_order: number
}

type MenuCatalogProps = {
  initialMenu: MenuItem[]
  initialCategories: MenuCategory[]
  table: { id: string; label: string } | null
  mesaToken: string | null
  whatsappDeliveryNumber: string
}

const CART_STORAGE_KEY = 'yarumo_customer_cart_v1'
const FAVORITES_STORAGE_KEY = 'yarumo_user_favorites'

function formatCop(value?: number | null) {
  const safe = typeof value === 'number' && !Number.isNaN(value) ? value : 0
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(safe)
}

import { normalizeText } from '@/lib/filters'

// Componente para resaltar coincidencias en la búsqueda
function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>
  const normQuery = normalizeText(query)
  const normText = normalizeText(text)
  const matchIndex = normText.indexOf(normQuery)
  if (matchIndex === -1) return <>{text}</>

  const before = text.slice(0, matchIndex)
  const matched = text.slice(matchIndex, matchIndex + query.length)
  const after = text.slice(matchIndex + query.length)

  return (
    <>
      {before}
      <mark style={{ background: 'rgba(217, 232, 106, 0.45)', color: 'inherit', borderRadius: 3, padding: '0 2px' }}>
        {matched}
      </mark>
      {after}
    </>
  )
}

// Retorna exclusivamente las etiquetas guardadas para el producto
function getProductTags(item: MenuItem): string[] {
  return Array.isArray(item.tags) ? item.tags : []
}

export default function MenuCatalog({
  initialMenu,
  initialCategories,
  table,
  mesaToken,
  whatsappDeliveryNumber,
}: MenuCatalogProps) {
  const [supabase] = useState(() => createClient())
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all')
  const [galleryItem, setGalleryItem] = useState<MenuItem | null>(null)
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const raw = localStorage.getItem(FAVORITES_STORAGE_KEY)
      return raw ? new Set(JSON.parse(raw)) : new Set()
    } catch {
      return new Set()
    }
  })
  const [tableOrders, setTableOrders] = useState<TableOrder[]>([])
  const [toastMessage, setToastMessage] = useState<string>('')

  // Referencia a las pestañas para navegación por teclado ARIA
  const tabsContainerRef = useRef<HTMLDivElement>(null)

  // 1. Carrito con persistencia en localStorage (versión 1 y caducidad de 24h)
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      const now = Date.now()
      if (parsed.savedAt && now - parsed.savedAt > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(CART_STORAGE_KEY)
        return []
      }
      return Array.isArray(parsed.items) ? parsed.items : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(
        CART_STORAGE_KEY,
        JSON.stringify({
          version: 1,
          savedAt: Date.now(),
          items: cart,
        }),
      )
    } catch {}
  }, [cart])

  const cartQuantityMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const entry of cart) {
      map.set(entry.item.id, entry.quantity)
    }
    return map
  }, [cart])

  // 2. Deep link ?item=id o ?item=slug al cargar
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const targetItemId = params.get('item')
    if (targetItemId) {
      setTimeout(() => {
        const el = document.getElementById(`item-${targetItemId}`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          el.style.outline = '3px solid var(--lime)'
          setTimeout(() => {
            el.style.outline = 'none'
          }, 3000)
        }
      }, 300)
    }
  }, [])

  const toggleFavorite = useCallback((itemId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      try {
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(next)))
      } catch {}
      return next
    })
  }, [])

  // 3. Cargar comandas en tiempo real si hay mesa activa
  const fetchTableOrders = useCallback(async (tableId: string, token: string) => {
    const { data } = await supabase.rpc('get_table_orders', {
      p_table_id: tableId,
      p_table_token: token,
    })
    if (data) {
      setTableOrders(data as TableOrder[])
    }
  }, [supabase])

  useEffect(() => {
    let active = true
    if (!table || !mesaToken) return
    void Promise.resolve().then(() => {
      if (active) void fetchTableOrders(table.id, mesaToken)
    })

    const channel = supabase
      .channel(`catalog-table-orders-${table.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_requests',
          filter: `table_id=eq.${table.id}`,
        },
        () => {
          void fetchTableOrders(table.id, mesaToken)
        },
      )
      .subscribe()

    return () => {
      active = false
      void supabase.removeChannel(channel)
    }
  }, [table, mesaToken, fetchTableOrders, supabase])

  const latestOrder = useMemo(() => {
    if (!tableOrders.length) return null
    const inFlight = tableOrders.find(
      (o) => o.status === 'pending' || o.status === 'acknowledged' || o.status === 'preparing',
    )
    return inFlight || tableOrders[0]
  }, [tableOrders])

  // 4. Filtrado del menú por category_id y búsqueda insensible a tildes
  const filteredMenu = useMemo(() => {
    const normalizedQuery = normalizeText(deferredQuery)

    return initialMenu.filter((item) => {
      if (selectedCategoryId === 'favorites') {
        if (!favorites.has(item.id)) return false
      } else if (selectedCategoryId !== 'all') {
        const matchesCategoryId = item.category_id === selectedCategoryId
        const matchesCategoryName = item.category === selectedCategoryId
        if (!matchesCategoryId && !matchesCategoryName) {
          return false
        }
      }

      if (!normalizedQuery) return true

      const nameNorm = normalizeText(item.name)
      const descNorm = normalizeText(item.description || '')
      const catNorm = normalizeText(item.category || '')

      return nameNorm.includes(normalizedQuery) || descNorm.includes(normalizedQuery) || catNorm.includes(normalizedQuery)
    })
  }, [initialMenu, deferredQuery, selectedCategoryId, favorites])

  const addToCart = useCallback((item: MenuItem, customNotes = '', extraPrice = 0) => {
    setCart((prev) => {
      const targetNotes = customNotes.trim()
      const idx = prev.findIndex((entry) => entry.item.id === item.id && (entry.notes || '').trim() === targetNotes)
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + 1 }
        return copy
      }
      const itemWithCustomPrice = extraPrice > 0 ? { ...item, price_cop: item.price_cop + extraPrice } : item
      return [...prev, { item: itemWithCustomPrice, quantity: 1, notes: targetNotes }]
    })
    setToastMessage(`✓ ${item.name} agregado al pedido`)
    setTimeout(() => setToastMessage(''), 2400)
  }, [])

  const updateCartQuantity = useCallback((indexOrId: number | string, delta: number) => {
    setCart((prev) =>
      prev
        .map((entry, idx) => {
          const matches = typeof indexOrId === 'number' ? idx === indexOrId : entry.item.id === indexOrId
          if (matches) {
            const nextQty = entry.quantity + delta
            return nextQty > 0 ? { ...entry, quantity: nextQty } : null
          }
          return entry
        })
        .filter(Boolean) as CartItem[],
    )
  }, [])

  const updateCartItemNotes = useCallback((indexOrId: number | string, notes: string) => {
    setCart((prev) =>
      prev.map((entry, idx) => {
        const matches = typeof indexOrId === 'number' ? idx === indexOrId : entry.item.id === indexOrId
        return matches ? { ...entry, notes } : entry
      }),
    )
  }, [])

  const removeCartItem = useCallback((indexOrId: number | string) => {
    setCart((prev) =>
      prev.filter((entry, idx) => {
        return typeof indexOrId === 'number' ? idx !== indexOrId : entry.item.id !== indexOrId
      }),
    )
  }, [])

  const clearCart = useCallback(() => {
    setCart([])
  }, [])

  const handleSelectCategory = (catId: string, event: React.MouseEvent<HTMLButtonElement>) => {
    setSelectedCategoryId(catId)
    event.currentTarget.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    })
  }

  // Navegación por teclado accesible en pestañas (patrón WAI-ARIA tablist)
  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const tabs = Array.from(tabsContainerRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') || [])
    const currentIndex = tabs.findIndex((t) => t === document.activeElement)
    if (currentIndex === -1) return

    let nextIndex = currentIndex
    if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % tabs.length
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = tabs.length - 1
    } else {
      return
    }

    event.preventDefault()
    tabs[nextIndex]?.focus()
    tabs[nextIndex]?.click()
  }

  return (
    <>
      {table && mesaToken && latestOrder && (
        <CustomerOrderTracker
          latestOrder={latestOrder}
          onRefresh={() => fetchTableOrders(table.id, mesaToken)}
        />
      )}

      <section className="catalog-section" id="menu" aria-label="Carta digital de productos">
        <div className="catalog-header">
          <div>
            <span className="eyebrow">Selección de la casa</span>
            <h2>Nuestra Carta</h2>
          </div>
        </div>

        {/* Barra sticky con búsqueda y pestañas de categorías */}
        <div className="sticky-filter-wrapper">
          <div className="filter-bar">
            <div className="search-container">
              <div className="search-input-wrap">
                <span aria-hidden="true">🔍</span>
                <input
                  type="search"
                  placeholder="Buscar café, postres, bebidas..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Buscar productos en la carta"
                />
                {query && (
                  <button
                    type="button"
                    className="search-clear-btn"
                    onClick={() => setQuery('')}
                    aria-label="Limpiar búsqueda"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <div className="category-scroll-container">
              <div
                className="category-tabs"
                role="tablist"
                aria-label="Categorías de la carta"
                ref={tabsContainerRef}
                onKeyDown={handleTabKeyDown}
              >
                <button
                  type="button"
                  role="tab"
                  id="tab-all"
                  aria-selected={selectedCategoryId === 'all'}
                  aria-controls="panel-menu"
                  tabIndex={selectedCategoryId === 'all' ? 0 : -1}
                  className={`category-tab ${selectedCategoryId === 'all' ? 'active' : ''}`}
                  onClick={(e) => handleSelectCategory('all', e)}
                >
                  <CategoryIcon category="Todos" size={17} />
                  <span>Todos</span>
                </button>
                {favorites.size > 0 && (
                  <button
                    type="button"
                    role="tab"
                    id="tab-favorites"
                    aria-selected={selectedCategoryId === 'favorites'}
                    aria-controls="panel-menu"
                    tabIndex={selectedCategoryId === 'favorites' ? 0 : -1}
                    className={`category-tab ${selectedCategoryId === 'favorites' ? 'active' : ''}`}
                    onClick={(e) => handleSelectCategory('favorites', e)}
                  >
                    <CategoryIcon category="Favoritos" size={17} />
                    <span>Favoritos ({favorites.size})</span>
                  </button>
                )}
                {initialCategories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    role="tab"
                    id={`tab-${cat.id}`}
                    aria-selected={selectedCategoryId === cat.id}
                    aria-controls="panel-menu"
                    tabIndex={selectedCategoryId === cat.id ? 0 : -1}
                    className={`category-tab ${selectedCategoryId === cat.id ? 'active' : ''}`}
                    onClick={(e) => handleSelectCategory(cat.id, e)}
                  >
                    <CategoryIcon category={cat.name} slug={cat.slug} icon={cat.icon} size={17} />
                    <span>{cat.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Cuadrícula de productos */}
        <div id="panel-menu" role="tabpanel" aria-labelledby={selectedCategoryId === 'all' ? 'tab-all' : `tab-${selectedCategoryId}`}>
          {filteredMenu.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '1.1rem', marginBottom: 8 }}>
                {selectedCategoryId === 'favorites'
                  ? 'Aún no tienes productos guardados en favoritos.'
                  : 'No encontramos productos que coincidan con tu búsqueda.'}
              </p>
              <button
                type="button"
                className="service-btn"
                onClick={() => {
                  setQuery('')
                  setSelectedCategoryId('all')
                }}
              >
                Ver todos los productos
              </button>
            </div>
          ) : (
            <div className="menu-grid">
              {filteredMenu.map((item) => {
                const isFav = favorites.has(item.id)
                const hasGallery = (item.gallery_urls?.length ?? 0) > 0
                const tags = getProductTags(item)
                const cartQty = cartQuantityMap.get(item.id) || 0

                return (
                  <article
                    key={item.id}
                    className={`item-card ${cartQty > 0 ? 'is-in-cart' : ''}`}
                    id={`item-${item.id}`}
                  >
                    {cartQty > 0 && (
                      <span className="item-in-cart-pill" aria-label={`${cartQty} en tu pedido`}>
                        ✓ {cartQty} en pedido
                      </span>
                    )}

                    {item.image_url ? (
                      <div
                        className="item-media"
                        onClick={() => setGalleryItem(item)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') setGalleryItem(item)
                        }}
                        aria-label={`Ver detalles y fotos de ${item.name}`}
                      >
                        <Image
                          src={item.image_url}
                          alt={item.name}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 360px"
                          loading="lazy"
                          placeholder="blur"
                          blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iOCIgaGVpZ2h0PSI2IiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSI4IiBoZWlnaHQ9IjYiIGZpbGw9IiMxODM2MmYiLz48L3N2Zz4="
                        />
                        <span className="item-badge-category">{item.category}</span>
                        {hasGallery && (
                          <span className="item-gallery-badge">
                            📷 +{item.gallery_urls.length}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div
                        className="item-media"
                        onClick={() => setGalleryItem(item)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') setGalleryItem(item)
                        }}
                        aria-label={`Ver detalles de ${item.name}`}
                      >
                        <ProductPlaceholder category={item.category} />
                        <span className="item-badge-category">{item.category}</span>
                      </div>
                    )}

                    <button
                      type="button"
                      className={`item-fav-btn ${isFav ? 'is-favorite' : ''}`}
                      onClick={() => toggleFavorite(item.id)}
                      aria-label={isFav ? `Quitar ${item.name} de favoritos` : `Guardar ${item.name} en favoritos`}
                      title={isFav ? 'Quitar de favoritos' : 'Guardar en favoritos'}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill={isFav ? '#e53e3e' : 'none'}
                        stroke={isFav ? '#e53e3e' : 'currentColor'}
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="fav-heart-icon"
                        aria-hidden="true"
                      >
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                    </button>

                    <div className="item-body">
                      {tags.length > 0 && (
                        <div className="item-tag-list">
                          {tags.map((tag) => (
                            <span key={tag} className="item-tag">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="item-title-row">
                        <h3 className="item-title">
                          <HighlightMatch text={item.name} query={deferredQuery} />
                        </h3>
                      </div>

                      {item.description && (
                        <p className="item-description">
                          <HighlightMatch text={item.description} query={deferredQuery} />
                        </p>
                      )}

                      <div className="item-footer">
                        <span className="item-price">{formatCop(item.price_cop)}</span>

                        <div className="item-footer-actions">
                          {cartQty > 0 ? (
                            <div className="item-stepper" role="group" aria-label={`Modificar cantidad de ${item.name}`}>
                              <button
                                type="button"
                                className="stepper-btn stepper-btn-minus"
                                onClick={() => updateCartQuantity(item.id, -1)}
                                aria-label={`Quitar uno de ${item.name}`}
                              >
                                −
                              </button>
                              <span className="stepper-qty" aria-live="polite">
                                {cartQty}
                              </span>
                              <button
                                type="button"
                                className="stepper-btn stepper-btn-plus"
                                onClick={() => updateCartQuantity(item.id, 1)}
                                aria-label={`Agregar otro ${item.name}`}
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="item-add-btn add-to-cart-btn"
                              onClick={() => addToCart(item)}
                              aria-label={`Pedir ${item.name}`}
                            >
                              <span>+</span>
                              <span>Pedir</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Carrito flotante cargado dinámicamente */}
      <OrderCart
        cart={cart}
        table={table}
        mesaToken={mesaToken}
        tableOrders={tableOrders}
        whatsappNumber={whatsappDeliveryNumber}
        onOrdersRefresh={() => {
          if (table && mesaToken) void fetchTableOrders(table.id, mesaToken)
        }}
        onUpdateQuantity={updateCartQuantity}
        onUpdateItemNotes={updateCartItemNotes}
        onRemoveItem={removeCartItem}
        onClearCart={clearCart}
        onOrderSuccess={(orderId) => {
          setCart([])
          setToastMessage(`✓ Comanda #${orderId.slice(0, 5)} enviada con éxito`)
          setTimeout(() => setToastMessage(''), 3000)
        }}
      />

      {/* Modal de galería y personalización cargado dinámicamente */}
      {galleryItem && (
        <GalleryModal
          key={galleryItem.id}
          item={galleryItem}
          cartQty={cartQuantityMap.get(galleryItem.id) || 0}
          onAddToCart={(it, notes, extra) => addToCart(it, notes, extra)}
          onUpdateQuantity={(delta) => updateCartQuantity(galleryItem.id, delta)}
          onClose={() => setGalleryItem(null)}
        />
      )}

      {/* Toast de confirmación con aria-live */}
      {toastMessage && (
        <div className="toast-notice" role="status" aria-live="polite">
          <span>{toastMessage}</span>
        </div>
      )}
    </>
  )
}
