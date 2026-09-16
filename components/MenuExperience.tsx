'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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

const CATEGORY_ICONS: Record<string, string> = {
  Todos: '☕',
  'Bebidas Calientes': '♨️',
  'Bebidas Frías': '🧊',
  Gaseosas: '🥤',
  Cervezas: '🍺',
  'Antojitos Panaderos': '🥐',
  Sándwiches: '🥪',
  Sánduches: '🥪',
  'Tortas y Brownies': '🍰',
  Hojaldrados: '🥟',
  Pizzetas: '🍕',
  Café: '☕',
  Frío: '🧊',
  'Para comer': '🍴',
  Otros: '✨',
}

function formatCop(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

export default function MenuExperience({ initialMenu }: { initialMenu: MenuItem[] }) {
  const supabase = useMemo(() => createClient(), [])
  const [table, setTable] = useState<{ id: string; label: string } | null>(null)
  const [tableChecked, setTableChecked] = useState(false)
  const [mesaToken, setMesaToken] = useState<string | null>(null)
  const [menu] = useState<MenuItem[]>(initialMenu)
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('Todos')
  const [galleryItem, setGalleryItem] = useState<MenuItem | null>(null)
  const [galleryIndex, setGalleryIndex] = useState(0)
  const galleryCloseRef = useRef<HTMLButtonElement>(null)
  const galleryPreviousFocusRef = useRef<HTMLElement | null>(null)

  // Accesibilidad por teclado del modal de galería: Escape cierra, las flechas
  // navegan entre fotos, y el foco se mueve al botón de cerrar al abrir y
  // vuelve al elemento que lo abrió al cerrar (focus trap básico).
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

  // Mesa (?mesa=) token detection stays client-side: it depends on the URL the
  // customer actually opened (from the printed QR) and on a live RPC call.
  // Wrapped in an async IIFE so every setState call happens inside a resolved
  // callback rather than synchronously in the effect body (avoids cascading
  // renders on mount, see react-hooks/set-state-in-effect).
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
      if (hash.includes('access_token') || hash.includes('type=recovery') || (search.includes('code=') && !window.location.pathname.startsWith('/auth/callback'))) {
        router.push('/staff' + search + hash)
      }
    }
  }, [router])

  const categories = useMemo(() => {
    const unique = Array.from(new Set(menu.map((item) => item.category)))
    return ['Todos', ...unique]
  }, [menu])

  const filtered = useMemo(() => {
    return menu.filter(
      (item) =>
        (category === 'Todos' || item.category === category) &&
        `${item.name} ${item.description}`.toLowerCase().includes(query.toLowerCase()),
    )
  }, [menu, category, query])

  // No tenemos token de mesa (o todavía no terminamos de verificarlo): deshabilita
  // visualmente las acciones de servicio en vez de solo avisar después de tocarlas.
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
          <p>Abre tu carta, pide la cuenta o llama al mesero sin levantarte de la mesa.</p>
          <a className="hero-link" href="#menu">
            Explorar la carta <span>↓</span>
          </a>
        </div>
        <div className="hero-photo">
          <Image src="/yarumo-cover-cafe.webp" alt="Café de Yarumo Coffee servido en mesa" fill sizes="(max-width: 700px) 100vw, 340px" priority />
          <div className="hero-photo-caption">
            <span>{table ? `Mesa ${table.label}` : 'Yarumo Coffee'}</span>
            <strong>
              Hecho para<br />
              <em>quedarse un rato.</em>
            </strong>
          </div>
        </div>
      </section>

      <section className="service">
        <div className="service-card">
          <div>
            <span className="eyebrow">{table ? `Mesa ${table.label}` : 'Servicio en mesa'}</span>
            <h2>Todo desde tu celular.</h2>
            <p>Sin esperas. Toca una opción y el equipo recibe la solicitud.</p>
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
            {categories.map((item) => (
              <button
                key={item}
                className={`category-pill ${category === item ? 'active' : ''}`}
                onClick={() => setCategory(item)}
              >
                <span className="category-icon">{CATEGORY_ICONS[item] || '✨'}</span>
                <span className="category-label">{item}</span>
                {category === item && <span className="active-dot" />}
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
              <article className="item" key={item.id}>
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
