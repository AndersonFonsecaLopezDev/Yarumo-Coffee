'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Image from 'next/image'
import type { MenuItem } from '@/components/MenuCatalog'
import { ProductPlaceholder } from '@/components/ProductPlaceholder'
import { useI18n } from '@/lib/i18n'
import { useScrollLock } from '@/lib/use-scroll-lock'

type GalleryModalProps = {
  item: MenuItem | null
  cartQty?: number
  onAddToCart?: (item: MenuItem, notes?: string, extraPrice?: number) => void
  onUpdateQuantity?: (delta: number) => void
  onClose: () => void
}

function formatCop(value?: number | null) {
  const safe = typeof value === 'number' && !Number.isNaN(value) ? value : 0
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(safe)
}

const MILK_OPTIONS = [
  { id: 'entera', label: 'Leche entera', extra: 0 },
  { id: 'deslactosada', label: 'Deslactosada', extra: 0 },
  { id: 'avena', label: 'Bebida de avena (+ $2.000)', extra: 2000 },
  { id: 'almendras', label: 'Bebida de almendras (+ $2.000)', extra: 2000 },
]

const TEMP_OPTIONS = [
  { id: 'caliente', label: 'Caliente' },
  { id: 'frio', label: 'Frío / Con hielo' },
]

const SIZE_OPTIONS = [
  { id: 'regular', label: 'Estándar', extra: 0 },
  { id: 'doble', label: 'Doble / Grande (+ $3.000)', extra: 3000 },
]

export default function GalleryModal({
  item,
  cartQty = 0,
  onAddToCart,
  onUpdateQuantity,
  onClose,
}: GalleryModalProps) {
  const { t } = useI18n()
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [selectedMilk, setSelectedMilk] = useState<string>('entera')
  const [selectedTemp, setSelectedTemp] = useState<string>('caliente')
  const [selectedSize, setSelectedSize] = useState<string>('regular')
  const [baristaNotes, setBaristaNotes] = useState<string>('')

  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  const images = useMemo(() => {
    return item ? ([item.image_url, ...(item.gallery_urls || [])].filter(Boolean) as string[]) : []
  }, [item])

  // Detectar si el producto admite variantes de leche/temperatura (cafés, bebidas)
  const isBeverage = useMemo(() => {
    if (!item) return false
    const cat = item.category.toLowerCase()
    const name = item.name.toLowerCase()
    return (
      cat.includes('café') ||
      cat.includes('cafe') ||
      cat.includes('bebida') ||
      cat.includes('origen') ||
      name.includes('latte') ||
      name.includes('cappuccino') ||
      name.includes('mocaccino') ||
      name.includes('tinto') ||
      name.includes('espresso')
    )
  }, [item])

  const hasMilk = useMemo(() => {
    if (!item) return false
    const name = item.name.toLowerCase()
    const desc = (item.description || '').toLowerCase()
    return (
      name.includes('latte') ||
      name.includes('cappuccino') ||
      name.includes('mocaccino') ||
      name.includes('leche') ||
      desc.includes('leche')
    )
  }, [item])

  // Calcular precio final con extras
  const extraPrice = useMemo(() => {
    let extra = 0
    if (hasMilk) {
      const milk = MILK_OPTIONS.find((m) => m.id === selectedMilk)
      if (milk) extra += milk.extra
    }
    if (isBeverage) {
      const size = SIZE_OPTIONS.find((s) => s.id === selectedSize)
      if (size) extra += size.extra
    }
    return extra
  }, [hasMilk, isBeverage, selectedMilk, selectedSize])

  const effectivePrice = (item?.price_cop || 0) + extraPrice

  useScrollLock(Boolean(item))

  useEffect(() => {
    if (!item) return

    previousFocusRef.current = document.activeElement as HTMLElement | null
    closeButtonRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      } else if (event.key === 'ArrowRight' && images.length > 1) {
        setActiveImageIndex((prev) => (prev + 1) % images.length)
      } else if (event.key === 'ArrowLeft' && images.length > 1) {
        setActiveImageIndex((prev) => (prev - 1 + images.length) % images.length)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previousFocusRef.current?.focus()
    }
  }, [item, images.length, onClose])

  if (!item) return null

  const currentImage = images[activeImageIndex] || images[0]

  function shareProductWhatsapp() {
    if (!item) return
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://yarumo-coffee.vercel.app'
    const link = `${origin}/?item=${item.id}#menu`
    const message = encodeURIComponent(`¡Mira este café de Yarumo Coffee! ${item.name}: ${link}`)
    window.open(`https://api.whatsapp.com/send?text=${message}`, '_blank')
  }

  function handleAddWithCustomization() {
    if (!item || !onAddToCart) return

    const parts: string[] = []
    if (hasMilk) {
      const milkObj = MILK_OPTIONS.find((m) => m.id === selectedMilk)
      if (milkObj && milkObj.id !== 'entera') parts.push(`Leche: ${milkObj.label.split(' (')[0]}`)
    }
    if (isBeverage) {
      if (selectedTemp === 'frio') parts.push('Frío con hielo')
      const sizeObj = SIZE_OPTIONS.find((s) => s.id === selectedSize)
      if (sizeObj && sizeObj.id !== 'regular') parts.push(`Tamaño: ${sizeObj.label.split(' (')[0]}`)
    }
    if (baristaNotes.trim()) {
      parts.push(baristaNotes.trim())
    }

    const noteString = parts.length > 0 ? parts.join(' | ') : ''
    onAddToCart(item, noteString, extraPrice)
  }

  return (
    <div
      className="gallery-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gallery-item-title"
      onClick={onClose}
    >
      <div
        className="gallery-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '92vh', overflowY: 'auto' }}
      >
        {/* Visor de Imagen o Arte Vectorial de Marca */}
        <div className="gallery-viewport">
          {images.length > 0 ? (
            <Image
              src={currentImage}
              alt={`${item.name} - Foto ${activeImageIndex + 1}`}
              fill
              sizes="(max-width: 768px) 100vw, 640px"
              style={{ objectFit: 'cover' }}
              priority
            />
          ) : (
            <div style={{ position: 'absolute', inset: 0 }}>
              <ProductPlaceholder category={item.category} />
            </div>
          )}

          {/* Botón flotante para cerrar */}
          <button
            ref={closeButtonRef}
            type="button"
            className="gallery-close-btn"
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            ✕
          </button>

          {/* Badge de Categoría */}
          <span className="gallery-category-pill">{item.category}</span>

          {/* Controles de navegación si hay múltiples imágenes */}
          {images.length > 1 && (
            <>
              <button
                type="button"
                className="gallery-nav-btn gallery-nav-prev"
                onClick={() => setActiveImageIndex((prev) => (prev - 1 + images.length) % images.length)}
                aria-label="Foto anterior"
              >
                ‹
              </button>
              <button
                type="button"
                className="gallery-nav-btn gallery-nav-next"
                onClick={() => setActiveImageIndex((prev) => (prev + 1) % images.length)}
                aria-label="Foto siguiente"
              >
                ›
              </button>
              <span className="gallery-counter-pill">
                {activeImageIndex + 1} / {images.length}
              </span>
            </>
          )}
        </div>

        {/* Miniaturas de la galería si hay más de 1 imagen */}
        {images.length > 1 && (
          <div className="gallery-thumbnails-strip">
            {images.map((imgUrl, idx) => (
              <button
                key={imgUrl}
                type="button"
                className={`gallery-thumb-btn ${idx === activeImageIndex ? 'active' : ''}`}
                onClick={() => setActiveImageIndex(idx)}
                aria-label={`Ver foto ${idx + 1}`}
              >
                <Image
                  src={imgUrl}
                  alt={`Miniatura ${idx + 1}`}
                  fill
                  sizes="64px"
                  style={{ objectFit: 'cover' }}
                />
              </button>
            ))}
          </div>
        )}

        {/* Información y detalles del producto */}
        <div className="gallery-details-body">
          <div className="gallery-title-row">
            <h2 id="gallery-item-title" className="gallery-title">
              {item.name}
            </h2>
          </div>

          {item.description && <p className="gallery-description">{item.description}</p>}

          {/* Selector de Variantes Comunes */}
          {(hasMilk || isBeverage) && (
            <div
              className="gallery-variants-section"
              style={{
                marginTop: 18,
                padding: '14px 16px',
                background: 'var(--surface, rgba(0,0,0,0.02))',
                borderRadius: 'var(--radius-md, 12px)',
                border: '1px solid var(--border)',
              }}
            >
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>
                {t('modal_variants')}
              </h3>

              {hasMilk && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)' }}>
                    Tipo de leche
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {MILK_OPTIONS.map((milk) => (
                      <button
                        key={milk.id}
                        type="button"
                        onClick={() => setSelectedMilk(milk.id)}
                        className={`filter-chip ${selectedMilk === milk.id ? 'active' : ''}`}
                        style={{ fontSize: '0.78rem', padding: '5px 10px' }}
                      >
                        {milk.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {isBeverage && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)' }}>
                      Temperatura
                    </label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {TEMP_OPTIONS.map((tmp) => (
                        <button
                          key={tmp.id}
                          type="button"
                          onClick={() => setSelectedTemp(tmp.id)}
                          className={`filter-chip ${selectedTemp === tmp.id ? 'active' : ''}`}
                          style={{ fontSize: '0.78rem', padding: '5px 10px' }}
                        >
                          {tmp.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)' }}>
                      Tamaño
                    </label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {SIZE_OPTIONS.map((sz) => (
                        <button
                          key={sz.id}
                          type="button"
                          onClick={() => setSelectedSize(sz.id)}
                          className={`filter-chip ${selectedSize === sz.id ? 'active' : ''}`}
                          style={{ fontSize: '0.78rem', padding: '5px 10px' }}
                        >
                          {sz.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label
                  htmlFor="gallery-barista-notes"
                  style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 4, color: 'var(--text-muted)' }}
                >
                  {t('modal_notes_label')}
                </label>
                <input
                  id="gallery-barista-notes"
                  type="text"
                  maxLength={120}
                  placeholder={t('modal_notes_ph')}
                  value={baristaNotes}
                  onChange={(e) => setBaristaNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '0.85rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer de acción comercial */}
        <div className="gallery-modal-footer">
          <div className="gallery-price-wrap">
            <span className="gallery-price-label">{t('modal_price')}</span>
            <strong className="gallery-price-value">{formatCop(effectivePrice)}</strong>
          </div>

          <div className="gallery-footer-actions">
            {onAddToCart && (
              <button
                type="button"
                className="gallery-add-btn"
                onClick={handleAddWithCustomization}
                id="btn-modal-add-to-cart"
              >
                <span>+</span>
                <span>{cartQty > 0 ? t('btn_added') : t('modal_add_to_cart')}</span>
              </button>
            )}

            {onUpdateQuantity && cartQty > 0 && (
              <div className="item-stepper" role="group" aria-label={`Modificar cantidad de ${item.name}`}>
                <button
                  type="button"
                  className="stepper-btn stepper-btn-minus"
                  onClick={() => onUpdateQuantity(-1)}
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
                  onClick={() => onUpdateQuantity(1)}
                  aria-label={`Agregar otro ${item.name}`}
                >
                  +
                </button>
              </div>
            )}

            <button
              type="button"
              className="item-share-btn"
              onClick={shareProductWhatsapp}
              aria-label={`Compartir ${item.name} por WhatsApp`}
              title="Compartir por WhatsApp"
            >
              💬
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
