'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import OrderCart, { type CartItem } from './OrderCart'

export type MenuItem = {
  id: string
  name: string
  description: string
  price_cop: number
  category: string
  sort_order: number
  image_url: string | null
  gallery_urls: string[]
}

export type MenuCategory = {
  id: string
  name: string
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
  sort_order: number
}

function formatCop(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

type MenuExperienceProps = {
  initialMenu: MenuItem[]
  initialCategories?: MenuCategory[]
  initialPromotions?: Promotion[]
}

export default function MenuExperience({
  initialMenu,
  initialCategories = [],
  initialPromotions = [],
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
    setNotice(
      error
        ? 'No pudimos enviar la solicitud. Intenta de nuevo.'
        : type === 'waiter'
          ? 'El mesero recibió tu solicitud.'
          : 'La cuenta fue solicitada para tu mesa.',
    )
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
      // Asegurar que si hay categorías en menu que no están en categoriesList, aparezcan al final
      const existingNames = new Set(pills.map((p) => p.name))
      menu.forEach((m) => {
        if (!existingNames.has(m.category)) {
          pills.push({ name: m.category, icon: '✨' })
          existingNames.add(m.category)
        }
      })
      return pills
    }

    // Fallback: derivado del menú si no se cargaron categorías dinámicas
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
    setNotice(`Agregaste "${item.name}" al pedido.`)
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

  function handleOrderSuccess() {
    setNotice('¡Tu pedido fue enviado al equipo de Yarumo! Lo estamos preparando.')
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
  const serviceHint = !mesaToken
    ? 'Escanea el QR de tu mesa para usar esta opción'
    : tableChecked && !table
      ? 'Este QR no está activo. Pide ayuda al equipo.'
      : ''

  return (
    <>
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
        <div className="hero-photo hero-logo-showcase">
          <Image
            className="hero-logo-img"
            src="/yarumo-logo.png"
            alt="Logo de Yarumo Coffee"
            fill
            sizes="(max-width: 700px) 100vw, 340px"
            priority
          />
          <div className="hero-photo-caption">
            <span>{table ? `Mesa ${table.label}` : 'Yarumo Coffee'}</span>
            <strong>
              Hecho para<br />
              <em>quedarse un rato.</em>
            </strong>
          </div>
        </div>
      </section>

      {/* Promociones del día (si hay activas) */}
      {promotions.length > 0 && (
        <section className="promotions-section" aria-label="Promociones especiales">
          <div className="promotions-carousel">
            {promotions.map((promo) => (
              <div
                className="promotion-card"
                key={promo.id}
                onClick={() => handlePromoClick(promo)}
                role={promo.linked_menu_item_id ? 'button' : undefined}
                tabIndex={promo.linked_menu_item_id ? 0 : undefined}
                title={promo.linked_menu_item_id ? 'Toca para ver el producto en la carta' : undefined}
              >
                <div className="promotion-badge">
                  {promo.badge_text || 'PROMO DEL DÍA'}
                </div>
                <div className="promotion-content">
                  <h3>{promo.title}</h3>
                  {promo.description && <p>{promo.description}</p>}
                  {promo.linked_menu_item_id && (
                    <span className="promotion-action">Ver producto en la carta →</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="service">
        <div className="service-card">
          <div>
            <span className="eyebrow">{table ? `Mesa ${table.label}` : 'Servicio en mesa'}</span>
            <h2>Todo desde tu celular.</h2>
            <p>Arma tu comanda, pide la cuenta o llama al mesero sin esperas.</p>
          </div>
          <div className="service-actions">
            <button className="primary" onClick={() => request('waiter')} disabled={serviceDisabled} title={serviceHint || undefined}>
              <span>🛎️</span>
              <span>{loading ? 'Enviando…' : 'Llamar al mesero'}</span>
            </button>
            <button onClick={() => request('bill')} disabled={serviceDisabled} title={serviceHint || undefined}>
              <span>🧾</span>
              <span>Pedir la cuenta</span>
            </button>
            {serviceHint && <p className="service-hint">{serviceHint}</p>}
          </div>
        </div>
      </section>

      <section className="content" id="menu">
        <div className="section-top">
          <div>
            <span className="eyebrow">Nuestra Carta</span>
            <h2>Elige tu antojo.</h2>
          </div>
          <div className="search-wrap">
            <div className="search">
              <span className="search-icon">🔍</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar café, postre, pizza..."
                aria-label="Buscar en la carta"
              />
              {query && (
                <button className="search-clear" onClick={() => setQuery('')} aria-label="Limpiar búsqueda">
                  ×
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="category-tabs-container">
          <div className="category-tabs">
            {categoryPills.map((pill) => (
              <button
                key={pill.name}
                className={`category-pill ${category === pill.name ? 'active' : ''}`}
                onClick={() => setCategory(pill.name)}
              >
                <span className="category-icon">{pill.icon}</span>
                <span className="category-label">{pill.name}</span>
                {category === pill.name && <span className="active-dot" />}
              </button>
            ))}
          </div>
        </div>

        <div className="menu-results-count">
          <span>
            Mostrando <strong>{filtered.length}</strong> {filtered.length === 1 ? 'producto' : 'productos'}
            {category !== 'Todos' && <> en <em>{category}</em></>}
          </span>
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
                    <div className="item-actions">
                      {(Boolean(item.image_url) || (item.gallery_urls?.length ?? 0) > 0) && (
                        <button
                          className="gallery-link"
                          type="button"
                          onClick={() => {
                            setGalleryItem(item)
                            setGalleryIndex(0)
                          }}
                        >
                          Ver fotos →
                        </button>
                      )}
                      <button
                        className="add-to-cart-btn"
                        type="button"
                        onClick={() => addToCart(item)}
                        disabled={serviceDisabled}
                        title={serviceHint || 'Agregar al pedido'}
                        aria-label={`Agregar ${item.name} al pedido`}
                      >
                        <span>+</span>
                        <span>Pedir</span>
                      </button>
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

      {/* Carrito de Pedidos Flotante */}
      <OrderCart
        cart={cart}
        table={table}
        mesaToken={mesaToken}
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
