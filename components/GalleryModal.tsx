'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import type { MenuItem } from '@/components/MenuCatalog'

type GalleryModalProps = {
  item: MenuItem | null
  cartQty?: number
  onAddToCart?: (item: MenuItem) => void
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

export default function GalleryModal({
  item,
  cartQty = 0,
  onAddToCart,
  onUpdateQuantity,
  onClose,
}: GalleryModalProps) {
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  const images = item
    ? [item.image_url, ...(item.gallery_urls || [])].filter(Boolean) as string[]
    : []

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

  if (!item || images.length === 0) return null

  const currentImage = images[activeImageIndex] || images[0]

  function shareProductWhatsapp() {
    if (!item) return
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://yarumo-coffee.vercel.app'
    const link = `${origin}/?item=${item.id}#menu`
    const message = encodeURIComponent(`¡Mira este café de Yarumo Coffee! ${item.name}: ${link}`)
    window.open(`https://api.whatsapp.com/send?text=${message}`, '_blank')
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
      >
        {/* Visor de Imagen Principal */}
        <div className="gallery-viewport">
          <Image
            src={currentImage}
            alt={`${item.name} - Foto ${activeImageIndex + 1}`}
            fill
            sizes="(max-width: 768px) 100vw, 640px"
            style={{ objectFit: 'cover' }}
            priority
          />

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
          <span className="gallery-category-pill">
            {item.category}
          </span>

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

          {item.description && (
            <p className="gallery-description">
              {item.description}
            </p>
          )}
        </div>

        {/* Footer de acción comercial */}
        <div className="gallery-modal-footer">
          <div className="gallery-price-wrap">
            <span className="gallery-price-label">Precio</span>
            <strong className="gallery-price-value">
              {formatCop(item.price_cop)}
            </strong>
          </div>

          <div className="gallery-footer-actions">
            {onAddToCart && onUpdateQuantity && (
              cartQty > 0 ? (
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
              ) : (
                <button
                  type="button"
                  className="gallery-add-btn"
                  onClick={() => onAddToCart(item)}
                >
                  <span>+</span>
                  <span>Pedir</span>
                </button>
              )
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
