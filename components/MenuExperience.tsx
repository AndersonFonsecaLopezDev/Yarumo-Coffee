'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import OrderCart, { type CartItem, type TableOrder } from './OrderCart'

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
}

export type MenuCategory = {
  id: string
  name: string
  slug?: string
  icon: string
  sort_order: number
}

export type Promotion = {
  id: string
  title: string
  description: string
  badge_text: string | null
  image_url: string | null
  linked_menu_item_id: string | null
  starts_at?: string
  ends_at?: string | null
  sort_order: number
}

function formatCop(value?: number | null) {
  const safe = typeof value === 'number' && !Number.isNaN(value) ? value : 0
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(safe)
}

function getOrderStep(status: TableOrder['status']) {
  switch (status) {
    case 'pending':
      return { step: 1, label: 'Enviado a barra', icon: '⏳', desc: 'Tu comanda está en fila' }
    case 'acknowledged':
      return { step: 2, label: 'Recibido', icon: '👀', desc: 'El equipo confirmó tu pedido' }
    case 'preparing':
      return { step: 3, label: 'En preparación', icon: '☕', desc: 'Estamos preparando tus productos' }
    case 'delivered':
      return { step: 4, label: 'Entregado en mesa', icon: '✓', desc: '¡Buen provecho!' }
    case 'cancelled':
      return { step: 0, label: 'Comanda cancelada', icon: '✕', desc: 'Consulta con el mesero' }
    default:
      return { step: 1, label: status, icon: '☕', desc: '' }
  }
}

type MenuExperienceProps = {
  initialMenu: MenuItem[]
  initialCategories?: MenuCategory[]
  initialPromotions?: Promotion[]
  heroImageUrl?: string
  whatsappDeliveryNumber?: string
}

export default function MenuExperience({
  initialMenu,
  initialCategories = [],
  initialPromotions = [],
  heroImageUrl = '/yarumo-cover-cafe.webp',
  whatsappDeliveryNumber = '573192208938',
}: MenuExperienceProps) {
  const supabase = useMemo(() => createClient(), [])
  const [table, setTable] = useState<{ id: string; label: string } | null>(null)
  const [tableChecked, setTableChecked] = useState(false)
  const [mesaToken, setMesaToken] = useState<string | null>(null)
  const [menu] = useState<MenuItem[]>(initialMenu)
  const [categoriesList] = useState<MenuCategory[]>(initialCategories)
  const [promotions] = useState<Promotion[]>(initialPromotions)
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('Todos')
  const [galleryItem, setGalleryItem] = useState<MenuItem | null>(null)
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [cart, setCart] = useState<CartItem[]>([])
  const [tableOrders, setTableOrders] = useState<TableOrder[]>([])
  const [showOrderTrackerDetail, setShowOrderTrackerDetail] = useState(false)

  const galleryCloseRef = useRef<HTMLButtonElement>(null)
  const galleryPreviousFocusRef = useRef<HTMLElement | null>(null)

  // Accesibilidad por teclado del modal de galería
  useEffect(() => {
    if (!galleryItem) return

    galleryPreviousFocusRef.current = document.activeElement as HTMLElement | null
    galleryCloseRef.current?.focus()

    const images = [galleryItem.image_url, ...(galleryItem.gallery_urls || [])].filter(Boolean) as string[]

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setGalleryItem(null)
      } else if (event.key === 'ArrowLeft' && images.length > 1) {
        setGalleryIndex((current) => (current - 1 + images.length) % images.length)
      } else if (event.key === 'ArrowRight' && images.length > 1) {
        setGalleryIndex((current) => (current + 1) % images.length)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      galleryPreviousFocusRef.current?.focus()
    }
  }, [galleryItem])

  // Mesa (?mesa=) token detection
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const token = new URLSearchParams(window.location.search).get('mesa')
      await Promise.resolve()
      if (cancelled) return

      if (!token) {
        setMesaToken(null)
        setTableChecked(true)
        return
      }

      setMesaToken(token)
      const { data } = await supabase.rpc('get_table_by_token', { token })
      if (cancelled) return
      if (data?.[0]) setTable(data[0])
      else setNotice('Este QR no está activo. Pide ayuda al equipo.')
      setTableChecked(true)
    })()
    return () => {
      cancelled = true
    }
  }, [supabase])

  // Cargar pedidos en tiempo real de la mesa
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
      .channel(`customer-table-orders-${table.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_requests',
          filter: `table_id=eq.${table.id}`,
        },
        () => {
          if (active) void fetchTableOrders(table.id, mesaToken)
        },
      )
      .subscribe()

    return () => {
      active = false
      void supabase.removeChannel(channel)
    }
  }, [table, mesaToken, fetchTableOrders, supabase])

  // Total acumulado de consumo de la mesa (no cancelados)
  const accumulatedTotalCop = useMemo(() => {
    return tableOrders
      .filter((o) => o.status !== 'cancelled')
      .reduce((acc, o) => {
        const orderSum = (o.items || []).reduce(
          (sum, it) => sum + (it.price_cop_snapshot || 0) * (it.quantity || 1),
          0,
        )
        return acc + orderSum
      }, 0)
  }, [tableOrders])

  // Pedido activo más reciente (en progreso o entregado reciente)
  const latestOrder = useMemo(() => {
    if (!tableOrders.length) return null
    // Priorizar comandas no entregadas/no canceladas
    const inFlight = tableOrders.find(
      (o) => o.status === 'pending' || o.status === 'acknowledged' || o.status === 'preparing',
    )
    return inFlight || tableOrders[0]
  }, [tableOrders])

  async function request(type: 'waiter' | 'bill') {
    if (!table) {
      setNotice('Escanea el QR asignado a tu mesa para solicitar atención.')
      return
    }
    setLoading(true)
    const { error } = await supabase.from('service_requests').insert({
      table_id: table.id,
      table_token: mesaToken,
      type,
    })
    setLoading(false)
    if (error) {
      setNotice('No pudimos enviar la solicitud. Intenta de nuevo.')
    } else if (type === 'waiter') {
      setNotice('🛎️ El mesero recibió tu llamado y viene en camino.')
    } else {
      const totalMsg = accumulatedTotalCop > 0 ? ` (Total acumulado: ${formatCop(accumulatedTotalCop)})` : ''
      setNotice(`🧾 La cuenta fue solicitada para tu mesa${totalMsg}.`)
    }
  }

  const router = useRouter()
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash
      const search = window.location.search
      if (
        hash.includes('access_token') ||
        hash.includes('type=recovery') ||
        (search.includes('code=') && !window.location.pathname.startsWith('/auth/callback'))
      ) {
        router.push('/staff' + search + hash)
      }
    }
  }, [router])

  // Categorías ordenadas y dinámicas
  const categoryPills = useMemo(() => {
    if (categoriesList.length > 0) {
      const pills = [{ name: 'Todos', icon: '☕' }]
      categoriesList.forEach((c) => {
        pills.push({ name: c.name, icon: c.icon || '✨' })
      })
      const existingNames = new Set(pills.map((p) => p.name))
      menu.forEach((m) => {
        if (!existingNames.has(m.category)) {
          pills.push({ name: m.category, icon: '✨' })
          existingNames.add(m.category)
        }
      })
      return pills
    }

    const unique = Array.from(new Set(menu.map((item) => item.category)))
    return [
      { name: 'Todos', icon: '☕' },
      ...unique.map((u) => ({ name: u, icon: '✨' })),
    ]
  }, [categoriesList, menu])

  const filtered = useMemo(() => {
    return menu.filter(
      (item) =>
        (category === 'Todos' || item.category === category) &&
        `${item.name} ${item.description}`.toLowerCase().includes(query.toLowerCase()),
    )
  }, [menu, category, query])

  // Manejo del Carrito de Pedidos
  function addToCart(item: MenuItem) {
    setCart((prev) => {
      const existing = prev.find((ci) => ci.item.id === item.id)
      if (existing) {
        return prev.map((ci) =>
          ci.item.id === item.id ? { ...ci, quantity: Math.min(ci.quantity + 1, 20) } : ci,
        )
      }
      return [...prev, { item, quantity: 1, notes: '' }]
    })
    setNotice(
      isInsideTable
        ? `Agregaste "${item.name}" a tu comanda.`
        : `Agregaste "${item.name}" a tu pedido a domicilio.`,
    )
  }

  function updateCartQuantity(itemId: string, delta: number) {
    setCart((prev) => {
      return prev
        .map((ci) => {
          if (ci.item.id === itemId) {
            const newQty = ci.quantity + delta
            return newQty > 0 ? { ...ci, quantity: Math.min(newQty, 20) } : null
          }
          return ci
        })
        .filter(Boolean) as CartItem[]
    })
  }

  function updateCartItemNotes(itemId: string, notes: string) {
    setCart((prev) =>
      prev.map((ci) => (ci.item.id === itemId ? { ...ci, notes } : ci)),
    )
  }

  function removeCartItem(itemId: string) {
    setCart((prev) => prev.filter((ci) => ci.item.id !== itemId))
  }

  function clearCart() {
    setCart([])
  }

  function handleOrderSuccess(orderId?: string) {
    if (orderId === 'whatsapp') {
      setNotice('¡Abriendo WhatsApp para enviar tu pedido a domicilio!')
    } else {
      setNotice('¡Tu pedido fue enviado al equipo de Yarumo! Lo estamos preparando.')
      if (table && mesaToken) {
        void fetchTableOrders(table.id, mesaToken)
      }
    }
  }

  function handlePromoClick(promo: Promotion) {
    if (promo.linked_menu_item_id) {
      const el = document.getElementById(`item-${promo.linked_menu_item_id}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('item-highlight')
        setTimeout(() => el.classList.remove('item-highlight'), 2500)
      }
    }
  }

  const serviceDisabled = loading || !mesaToken || (tableChecked && !table)
  const isInsideTable = Boolean(table && mesaToken)
  const serviceHint = !mesaToken
    ? 'Escanea el QR de tu mesa para pedir o llamar al mesero'
    : tableChecked && !table
      ? 'Este QR no está activo. Pide ayuda al equipo.'
      : ''

  const latestStepInfo = latestOrder ? getOrderStep(latestOrder.status) : null

  return (
    <>
      {/* HERO SECTION */}
      <section className="hero">
        <div className="hero-content">
          <span className="eyebrow">Café de origen · Armenia</span>
          <h1>
            Donde cada taza<br />
            <em>cuenta una historia.</em>
          </h1>
          <p>Abre tu carta, pide a la mesa o llama al mesero sin levantarte de tu lugar.</p>
          <a className="hero-link" href="#menu">
            Explorar la carta <span>↓</span>
          </a>
        </div>
        <div className="hero-photo">
          <Image
            src={heroImageUrl || '/yarumo-cover-cafe.webp'}
            alt="Café de Yarumo Coffee servido en mesa"
            fill
            sizes="(max-width: 700px) 100vw, 340px"
            priority
            style={{ objectFit: 'cover' }}
          />
          <div className="hero-photo-caption">
            <div className="hero-caption-logo-wrap">
              <Image
                src="/yarumo-logo.webp"
                alt="Yarumo Coffee"
                width={72}
                height={72}
                className="hero-caption-logo"
              />
            </div>
            <span>{table ? `Mesa ${table.label}` : 'Yarumo Coffee · Café de Origen'}</span>
          </div>
        </div>
      </section>

      {/* SERVICE SECTION (En mesa o Domicilio) */}
      <section className="service">
        {isInsideTable ? (
          <div className="service-card">
            <div>
              <span className="eyebrow">{table ? `Mesa ${table.label}` : 'Servicio en mesa'}</span>
              <h2>Todo desde tu celular.</h2>
              <p>
                Arma tu comanda, sigue el estado de tu pedido o pide la cuenta.
              </p>
            </div>
            <div className="service-actions">
              <button
                className="primary"
                onClick={() => request('waiter')}
                disabled={serviceDisabled}
                title={serviceHint || undefined}
              >
                <span>🛎️</span>
                <span>{loading ? 'Enviando…' : 'Llamar al mesero'}</span>
              </button>
              <button
                onClick={() => request('bill')}
                disabled={serviceDisabled}
                title={serviceHint || undefined}
                className="bill-request-btn"
              >
                <span>🧾</span>
                <span>
                  {accumulatedTotalCop > 0
                    ? `Pedir la cuenta (${formatCop(accumulatedTotalCop)})`
                    : 'Pedir la cuenta'}
                </span>
              </button>
              {serviceHint && <p className="service-hint">{serviceHint}</p>}
            </div>
          </div>
        ) : (
          <div className="service-card delivery-service-card">
            <div>
              <span className="eyebrow">🛵 Pedidos a Domicilio</span>
              <h2>Pide tu café a domicilio.</h2>
              <p>
                Selecciona tus productos favoritos. Al confirmar el carrito, enviaremos el pedido por WhatsApp para despacharlo de inmediato.
              </p>
            </div>
            <div className="service-actions">
              <a className="hero-link delivery-explore-btn" href="#menu">
                <span>Explorar carta y pedir</span> <span>↓</span>
              </a>
            </div>
          </div>
        )}
      </section>

      {/* LIVE ORDER STATUS TRACKER FOR CUSTOMER (Requisito 6) */}
      {isInsideTable && latestOrder && latestStepInfo && latestOrder.status !== 'cancelled' && (
        <section className="customer-order-tracker-wrap" aria-label="Estado de tu pedido">
          <div className={`customer-order-tracker-card status-${latestOrder.status}`}>
            <div className="tracker-top">
              <div className="tracker-title-wrap">
                <span className="tracker-live-dot" />
                <div>
                  <span className="tracker-eyebrow">Estado de tu comanda #{latestOrder.id.slice(0, 5).toUpperCase()}</span>
                  <h3>{latestStepInfo.icon} {latestStepInfo.label}</h3>
                </div>
              </div>
              <button
                type="button"
                className="tracker-toggle-btn"
                onClick={() => setShowOrderTrackerDetail(!showOrderTrackerDetail)}
              >
                {showOrderTrackerDetail ? 'Ocultar detalles ▲' : 'Ver productos ▼'}
              </button>
            </div>

            {/* Visual Stepper */}
            <div className="tracker-stepper">
              <div className={`step-node ${latestStepInfo.step >= 1 ? 'completed' : ''} ${latestStepInfo.step === 1 ? 'active' : ''}`}>
                <div className="step-circle">1</div>
                <span>Enviado</span>
              </div>
              <div className={`step-line ${latestStepInfo.step >= 2 ? 'completed' : ''}`} />
              <div className={`step-node ${latestStepInfo.step >= 2 ? 'completed' : ''} ${latestStepInfo.step === 2 ? 'active' : ''}`}>
                <div className="step-circle">2</div>
                <span>Recibido</span>
              </div>
              <div className={`step-line ${latestStepInfo.step >= 3 ? 'completed' : ''}`} />
              <div className={`step-node ${latestStepInfo.step >= 3 ? 'completed' : ''} ${latestStepInfo.step === 3 ? 'active' : ''}`}>
                <div className="step-circle">3</div>
                <span>En barra</span>
              </div>
              <div className={`step-line ${latestStepInfo.step >= 4 ? 'completed' : ''}`} />
              <div className={`step-node ${latestStepInfo.step >= 4 ? 'completed' : ''} ${latestStepInfo.step === 4 ? 'active' : ''}`}>
                <div className="step-circle">4</div>
                <span>Entregado</span>
              </div>
            </div>

            <p className="tracker-desc-text">{latestStepInfo.desc}</p>

            {/* Expandable item details */}
            {showOrderTrackerDetail && (
              <div className="tracker-items-detail">
                <div className="tracker-items-list">
                  {(latestOrder.items || []).map((it) => (
                    <div key={it.id} className="tracker-item-row">
                      <span><strong>{it.quantity}x</strong> {it.name_snapshot}</span>
                      <small>{formatCop((it.price_cop_snapshot || 0) * (it.quantity || 1))}</small>
                    </div>
                  ))}
                </div>
                {latestOrder.notes && (
                  <p className="tracker-order-notes">
                    <strong>Nota:</strong> {latestOrder.notes}
                  </p>
                )}
                {accumulatedTotalCop > 0 && (
                  <div className="tracker-total-bar">
                    <span>Total acumulado mesa:</span>
                    <strong>{formatCop(accumulatedTotalCop)}</strong>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* PROMOTION SECTION: Placed gracefully before the menu with clean max-width (Requisito 5) */}
      {promotions.length > 0 && (
        <section className="promotions-section" aria-label="Promociones especiales">
          <div className="promotions-container">
            <div className="promotions-header">
              <span className="eyebrow">Destacados</span>
              <h2>Promociones de hoy.</h2>
            </div>
            <div className="promotions-grid">
              {promotions.map((promo) => (
                <div
                  className="promotion-card"
                  key={promo.id}
                  onClick={() => handlePromoClick(promo)}
                  tabIndex={0}
                  role="button"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handlePromoClick(promo)
                    }
                  }}
                >
                  {promo.badge_text && <span className="promotion-badge">{promo.badge_text}</span>}
                  <div className="promotion-content">
                    <h3>{promo.title}</h3>
                    {promo.description && <p>{promo.description}</p>}
                    {promo.linked_menu_item_id && (
                      <span className="promotion-action">Ver en la carta →</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* MENU SECTION */}
      <section className="content" id="menu">
        <div className="section-top">
          <div>
            <span className="eyebrow">Nuestro Menú</span>
            <h2>Sabores de origen.</h2>
          </div>
          <div className="search-wrap">
            <div className="search">
              <span className="search-icon" aria-hidden="true">🔍</span>
              <input
                type="text"
                placeholder="Buscar por nombre o ingrediente..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Buscar productos del menú"
              />
              {query && (
                <button
                  type="button"
                  className="search-clear"
                  onClick={() => setQuery('')}
                  aria-label="Limpiar búsqueda"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Category Pill Tabs */}
        <div className="category-tabs-container">
          <div className="category-tabs" role="tablist" aria-label="Categorías del menú">
            {categoryPills.map((cat) => (
              <button
                key={cat.name}
                type="button"
                role="tab"
                aria-selected={category === cat.name}
                className={`category-pill ${category === cat.name ? 'active' : ''}`}
                onClick={() => setCategory(cat.name)}
              >
                <span className="category-icon">{cat.icon}</span>
                <span>{cat.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="menu">
          {filtered.length ? (
            filtered.map((item) => (
              <article className="item" key={item.id} id={`item-${item.id}`}>
                {item.image_url ? (
                  <button
                    className="item-image-wrap"
                    type="button"
                    onClick={() => {
                      setGalleryItem(item)
                      setGalleryIndex(0)
                    }}
                    aria-label={`Ver fotos de ${item.name}`}
                  >
                    <Image
                      className="item-image"
                      src={item.image_url}
                      alt={item.name}
                      fill
                      sizes="(max-width: 700px) 45vw, 255px"
                    />
                    {(item.gallery_urls?.length || 0) > 0 && <span className="gallery-count">+{item.gallery_urls.length} fotos</span>}
                    <span className="image-expand" aria-hidden="true">↗</span>
                  </button>
                ) : null}
                <div className="item-copy">
                  <div className="item-header">
                    <span className="item-badge">{item.category}</span>
                  </div>
                  <h3>{item.name}</h3>
                  {item.description && <p>{item.description}</p>}
                  <div className="item-footer">
                    <small className="item-price">{formatCop(item.price_cop)}</small>
                    
                    {/* Botón Pedir: Activo tanto en mesa como para Domicilio */}
                    <div className="item-actions">
                      <button
                        className="add-to-cart-btn"
                        type="button"
                        onClick={() => addToCart(item)}
                        disabled={loading || (isInsideTable && tableChecked && !table)}
                        title={isInsideTable ? (serviceHint || 'Agregar a tu pedido') : 'Agregar a tu pedido a domicilio'}
                        aria-label={`Agregar ${item.name} al pedido`}
                      >
                        <span>+</span>
                        <span>{isInsideTable ? 'Pedir' : 'Pedir'}</span>
                      </button>

                      {!isInsideTable && (Boolean(item.image_url) || (item.gallery_urls?.length ?? 0) > 0) && (
                        <button
                          className="gallery-link"
                          type="button"
                          onClick={() => {
                            setGalleryItem(item)
                            setGalleryIndex(0)
                          }}
                          aria-label={`Ver fotos de ${item.name}`}
                        >
                          Fotos ↗
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">☕</div>
              <h3>No encontramos ningún producto</h3>
              <p>Prueba buscando con otro término o explora todas las categorías.</p>
              <button
                onClick={() => {
                  setQuery('')
                  setCategory('Todos')
                }}
              >
                Ver toda la carta
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Carrito de Pedidos Flotante (En mesa o a Domicilio) */}
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
        onOrderSuccess={handleOrderSuccess}
      />

      {notice && (
        <button className="notice" onClick={() => setNotice('')}>
          <span>{notice}</span>
          <span className="notice-close">×</span>
        </button>
      )}

      {galleryItem && (() => {
        const images = [galleryItem.image_url, ...(galleryItem.gallery_urls || [])].filter(Boolean) as string[]
        const currentImage = images[galleryIndex] || images[0]
        return (
          <div className="gallery-modal" role="dialog" aria-modal="true" aria-label={`Galería de ${galleryItem.name}`} onClick={() => setGalleryItem(null)}>
            <div className="gallery-dialog" onClick={(event) => event.stopPropagation()}>
              <button ref={galleryCloseRef} className="gallery-close" type="button" onClick={() => setGalleryItem(null)} aria-label="Cerrar galería">×</button>
              <div className="gallery-main-image">
                <Image src={currentImage} alt={`${galleryItem.name}, foto ${galleryIndex + 1}`} fill sizes="(max-width: 700px) 100vw, 60vw" />
                {images.length > 1 && <>
                  <button className="gallery-arrow gallery-prev" type="button" onClick={() => setGalleryIndex((galleryIndex - 1 + images.length) % images.length)} aria-label="Foto anterior">←</button>
                  <button className="gallery-arrow gallery-next" type="button" onClick={() => setGalleryIndex((galleryIndex + 1) % images.length)} aria-label="Foto siguiente">→</button>
                </>}
              </div>
              <div className="gallery-details">
                <span className="eyebrow">{galleryItem.category}</span>
                <h2>{galleryItem.name}</h2>
                {galleryItem.description && <p>{galleryItem.description}</p>}
                <strong>{formatCop(galleryItem.price_cop)}</strong>
                {images.length > 1 && <div className="gallery-dots">{images.map((image, index) => <button key={image} type="button" className={index === galleryIndex ? 'active' : ''} onClick={() => setGalleryIndex(index)} aria-label={`Ver foto ${index + 1}`} />)}</div>}
              </div>
            </div>
          </div>
        )
      })()}
    </>
  )
}
