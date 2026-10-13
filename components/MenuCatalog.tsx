'use client'

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import type {
  MenuItem,
  MenuCategory,
  CartItem,
  TableOrder,
  MenuItemOptionChoice,
  MenuItemOptionGroup,
} from '@/lib/types'

export type { MenuItem, MenuCategory, CartItem, MenuItemOptionChoice, MenuItemOptionGroup }

import { createClient } from '@/lib/supabase/client'
import { CategoryIcon, SearchIcon } from '@/components/icons/CategoryIcons'
import { ProductPlaceholder } from '@/components/ProductPlaceholder'
import { useI18n } from '@/lib/i18n'

const OrderCart = dynamic(() => import('./OrderCart'), { ssr: false })
const GalleryModal = dynamic(() => import('./GalleryModal'), { ssr: false })
const CustomerOrderTracker = dynamic(() => import('./CustomerOrderTracker'), { ssr: false })
 
type MenuCatalogProps = {
  initialMenu: MenuItem[]
  initialCategories: MenuCategory[]
  table: { id: string; label: string } | null
  mesaToken: string | null
  whatsappDeliveryNumber: string
  initialItemId?: string
}

const CART_STORAGE_KEY_V1 = 'yarumo_customer_cart_v1'
const CART_STORAGE_KEY = 'yarumo_customer_cart_v2'
const FAVORITES_STORAGE_KEY = 'yarumo_user_favorites'

function generateLineId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `line-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

import { normalizeText } from '@/lib/filters'
import { formatCop } from '@/lib/format'

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
  initialItemId,
}: MenuCatalogProps) {
  const { t, language } = useI18n()
  const [supabase] = useState(() => createClient())
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all')
  const [galleryItem, setGalleryItem] = useState<MenuItem | null>(() => {
    if (initialItemId) {
      return initialMenu.find((it) => it.id === initialItemId || it.slug === initialItemId) || null
    }
    return null
  })
  const [deepLinkNotice, setDeepLinkNotice] = useState<string>('')
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

  // 1. Carrito con persistencia en localStorage (versión 2 con migración de v1 y caducidad de 24h)
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const now = Date.now()
      // Intentar cargar v2
      const rawV2 = localStorage.getItem(CART_STORAGE_KEY)
      if (rawV2) {
        const parsed = JSON.parse(rawV2)
        if (parsed.savedAt && now - parsed.savedAt > 24 * 60 * 60 * 1000) {
          localStorage.removeItem(CART_STORAGE_KEY)
          return []
        }
        if (Array.isArray(parsed.items)) {
          return parsed.items.map((it: CartItem) => ({
            ...it,
            id: it.id || generateLineId(),
          }))
        }
      }

      // Migrar con gracia formato v1 anterior si existe y no ha caducado
      const rawV1 = localStorage.getItem(CART_STORAGE_KEY_V1)
      if (rawV1) {
        const parsedV1 = JSON.parse(rawV1)
        if (parsedV1.savedAt && now - parsedV1.savedAt <= 24 * 60 * 60 * 1000 && Array.isArray(parsedV1.items)) {
          const migrated: CartItem[] = parsedV1.items.map((it: CartItem) => ({
            ...it,
            id: it.id || generateLineId(),
          }))
          try {
            localStorage.removeItem(CART_STORAGE_KEY_V1)
          } catch {}
          return migrated
        }
      }
      return []
    } catch {
      return []
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(
        CART_STORAGE_KEY,
        JSON.stringify({
          version: 2,
          savedAt: Date.now(),
          items: cart,
        }),
      )
    } catch {}
  }, [cart])

  // El mapa suma cantidades de todas las líneas para reflejar el total real de ese producto
  const cartQuantityMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const entry of cart) {
      const current = map.get(entry.item.id) || 0
      map.set(entry.item.id, current + entry.quantity)
    }
    return map
  }, [cart])

  // 2. Deep link: abrir GalleryModal de producto por initialItemId o por ?item=id
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const urlItemId = params.get('item')
    const targetItemId = initialItemId || urlItemId

    if (targetItemId) {
      const foundItem = initialMenu.find(
        (it) => it.id === targetItemId || (it.slug && it.slug === targetItemId),
      )

      if (foundItem) {
        const timer = setTimeout(() => {
          setGalleryItem(foundItem)
          const el = document.getElementById(`item-${foundItem.id}`)
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }, 50)

        // Limpiar URL si venía por parámetro ?item=
        if (urlItemId) {
          params.delete('item')
          const remainingQuery = params.toString()
          const newUrl = `${window.location.pathname}${remainingQuery ? `?${remainingQuery}` : ''}${window.location.hash || ''}`
          window.history.replaceState({}, '', newUrl)
        }
        return () => clearTimeout(timer)
      } else {
        const timer = setTimeout(() => {
          setDeepLinkNotice(t('item_unavailable'))
        }, 50)
        const clearNotice = setTimeout(() => setDeepLinkNotice(''), 4500)
        return () => {
          clearTimeout(timer)
          clearTimeout(clearNotice)
        }
      }
    }
  }, [initialItemId, initialMenu, t])

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

  const addToCart = useCallback(
    (
      item: MenuItem,
      customNotes = '',
      extraPrice = 0,
      choiceIds: string[] = [],
      choices: MenuItemOptionChoice[] = [],
    ) => {
      setCart((prev) => {
        const targetNotes = customNotes.trim()
        const effectivePrice = item.price_cop + (extraPrice > 0 ? extraPrice : 0)
        const idx = prev.findIndex(
          (entry) =>
            entry.item.id === item.id &&
            (entry.notes || '').trim() === targetNotes &&
            JSON.stringify(entry.selectedChoiceIds || []) === JSON.stringify(choiceIds),
        )
        if (idx >= 0) {
          const copy = [...prev]
          copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + 1 }
          return copy
        }
        return [
          ...prev,
          {
            id: generateLineId(),
            item,
            quantity: 1,
            notes: targetNotes,
            selectedChoiceIds: choiceIds,
            selectedChoices: choices,
            effectivePrice,
          },
        ]
      })
      setToastMessage(`✓ ${item.name} agregado al pedido`)
      setTimeout(() => setToastMessage(''), 2400)
    },
    [],
  )

  // Stepper de la tarjeta de catálogo y del modal de detalle: opera sobre la línea más reciente
  const updateCartQuantityByProduct = useCallback(
    (productId: string, delta: number) => {
      setCart((prev) => {
        let targetIdx = -1
        for (let i = prev.length - 1; i >= 0; i--) {
          if (prev[i].item.id === productId) {
            targetIdx = i
            break
          }
        }

        if (targetIdx === -1) {
          if (delta > 0) {
            const item = initialMenu.find((it) => it.id === productId)
            if (!item) return prev
            return [
              ...prev,
              {
                id: generateLineId(),
                item,
                quantity: 1,
                notes: '',
                effectivePrice: item.price_cop,
              },
            ]
          }
          return prev
        }

        const target = prev[targetIdx]
        const nextQty = target.quantity + delta
        const copy = [...prev]

        if (nextQty > 0) {
          copy[targetIdx] = { ...target, quantity: nextQty }
          return copy
        }

        // Si llega a 0, eliminar esta línea específica
        copy.splice(targetIdx, 1)
        return copy
      })
    },
    [initialMenu],
  )

  // Actualización por ID de línea para el carrito desplegable (OrderCart)
  const updateCartQuantity = useCallback((lineIdOrIndex: number | string, delta: number) => {
    setCart((prev) =>
      prev
        .map((entry, idx) => {
          const matches =
            typeof lineIdOrIndex === 'number'
              ? idx === lineIdOrIndex
              : entry.id === lineIdOrIndex || (entry.id == null && entry.item.id === lineIdOrIndex)
          if (matches) {
            const nextQty = entry.quantity + delta
            return nextQty > 0 ? { ...entry, quantity: nextQty } : null
          }
          return entry
        })
        .filter(Boolean) as CartItem[],
    )
  }, [])

  const updateCartItemNotes = useCallback((lineIdOrIndex: number | string, notes: string) => {
    setCart((prev) =>
      prev.map((entry, idx) => {
        const matches =
          typeof lineIdOrIndex === 'number'
            ? idx === lineIdOrIndex
            : entry.id === lineIdOrIndex || (entry.id == null && entry.item.id === lineIdOrIndex)
        return matches ? { ...entry, notes } : entry
      }),
    )
  }, [])

  const removeCartItem = useCallback((lineIdOrIndex: number | string) => {
    setCart((prev) =>
      prev.filter((entry, idx) => {
        return typeof lineIdOrIndex === 'number'
          ? idx !== lineIdOrIndex
          : entry.id !== lineIdOrIndex && (entry.id != null || entry.item.id !== lineIdOrIndex)
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

      <section className="catalog-section" id="menu" aria-label={t('catalog_aria')}>
        <div className="catalog-header">
          <div>
            <span className="eyebrow">{t('catalog_eyebrow')}</span>
            <h2>{t('catalog_title')}</h2>
          </div>
        </div>

        {deepLinkNotice && (
          <div
            className="catalog-deeplink-notice alert alert-warning"
            role="status"
            aria-live="polite"
            style={{
              maxWidth: 640,
              margin: '0 auto 18px',
              padding: '12px 18px',
              borderRadius: 12,
              textAlign: 'center',
              fontWeight: 500,
            }}
          >
            <span>⚠️ {deepLinkNotice}</span>
          </div>
        )}

        {/* Barra sticky con búsqueda y pestañas de categorías */}
        <div className="sticky-filter-wrapper">
          <div className="filter-bar">
            <div className="search-container">
              <div className="search-input-wrap">
                <SearchIcon size={18} className="search-input-icon" />
                <input
                  type="search"
                  placeholder={t('search_placeholder')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label={t('search_aria')}
                />
                {query && (
                  <button
                    type="button"
                    className="search-clear-btn"
                    onClick={() => setQuery('')}
                    aria-label={t('clear_search')}
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
                  <span>{t('tab_all')}</span>
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
                    <span>{t('tab_favorites')} ({favorites.size})</span>
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
                    <span>{language === 'en' && cat.name_en ? cat.name_en : cat.name}</span>
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
                  ? t('no_favorites')
                  : t('no_results')}
              </p>
              <button
                type="button"
                className="service-btn"
                onClick={() => {
                  setQuery('')
                  setSelectedCategoryId('all')
                }}
              >
                {t('view_all_products')}
              </button>
            </div>
          ) : (
            <div className="menu-grid">
              {filteredMenu.map((item) => {
                const isFav = favorites.has(item.id)
                const hasGallery = (item.gallery_urls?.length ?? 0) > 0
                const tags = getProductTags(item)
                const cartQty = cartQuantityMap.get(item.id) || 0
                const displayName = language === 'en' && item.name_en ? item.name_en : item.name
                const displayDesc = language === 'en' && item.description_en ? item.description_en : item.description

                return (
                  <article
                    key={item.id}
                    className={`item-card ${cartQty > 0 ? 'is-in-cart' : ''}`}
                    id={`item-${item.id}`}
                  >
                    {cartQty > 0 && (
                      <span className="item-in-cart-pill" aria-label={`${cartQty} ${t('in_order')}`}>
                        ✓ {cartQty} {t('in_order')}
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
                        aria-label={`${t('media_details_aria_prefix')} ${displayName}`}
                      >
                        <Image
                          src={item.image_url}
                          alt={displayName}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 360px"
                          loading="lazy"
                          placeholder="blur"
                          blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iOCIgaGVpZ2h0PSI2IiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSI4IiBoZWlnaHQ9IjYiIGZpbGw9IiMxODM2MmYiLz48L3N2Zz4="
                        />
                        <span className="item-badge-category">{item.category}</span>
                        {hasGallery && (
                          <span className="item-gallery-badge">
                            📷 +{item.gallery_urls?.length ?? 0}
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
                        aria-label={`${t('media_details_simple_prefix')} ${displayName}`}
                      >
                        <ProductPlaceholder category={item.category} />
                        <span className="item-badge-category">{item.category}</span>
                      </div>
                    )}

                    <button
                      type="button"
                      className={`item-fav-btn ${isFav ? 'is-favorite' : ''}`}
                      onClick={() => toggleFavorite(item.id)}
                      aria-label={isFav ? `${t('fav_remove_prefix')} ${displayName}` : `${t('fav_add_prefix')} ${displayName}`}
                      title={isFav ? t('fav_remove_prefix') : t('fav_add_prefix')}
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
                          <HighlightMatch text={displayName} query={deferredQuery} />
                        </h3>
                      </div>

                      {displayDesc && (
                        <p className="item-description">
                          <HighlightMatch text={displayDesc} query={deferredQuery} />
                        </p>
                      )}

                      <div className="item-footer">
                        <span className="item-price">{formatCop(item.price_cop)}</span>

                        <div className="item-footer-actions">
                          {cartQty > 0 ? (
                            <div className="item-stepper" role="group" aria-label={`${t('stepper_modify_prefix')} ${item.name}`}>
                              <button
                                type="button"
                                className="stepper-btn stepper-btn-minus"
                                onClick={() => updateCartQuantityByProduct(item.id, -1)}
                                aria-label={`${t('stepper_minus_prefix')} ${item.name}`}
                              >
                                −
                              </button>
                              <span className="stepper-qty" aria-live="polite">
                                {cartQty}
                              </span>
                              <button
                                type="button"
                                className="stepper-btn stepper-btn-plus"
                                onClick={() => updateCartQuantityByProduct(item.id, 1)}
                                aria-label={`${t('stepper_plus_prefix')} ${item.name}`}
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="item-add-btn add-to-cart-btn"
                              onClick={() => addToCart(item)}
                              aria-label={`${t('btn_order')} ${item.name}`}
                            >
                              <span>+</span>
                              <span>{t('btn_order')}</span>
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
          setToastMessage(`${t('toast_order_success_prefix')} #${orderId.slice(0, 5)}`)
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
          onUpdateQuantity={(delta) => updateCartQuantityByProduct(galleryItem.id, delta)}
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
