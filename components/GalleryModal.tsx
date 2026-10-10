'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import type { MenuItem } from '@/components/MenuCatalog'

type GalleryModalProps = {
  item: MenuItem | null
  initialIndex?: number
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
  initialIndex = 0,
  onClose,
}: GalleryModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  const images = item ? [item.image_url, ...(item.gallery_urls || [])].filter(Boolean) as string[] : []

  useEffect(() => {
    if (!item) return

    previousFocusRef.current = document.activeElement as HTMLElement | null
    closeButtonRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previousFocusRef.current?.focus()
    }
  }, [item, onClose])

  if (!item || images.length === 0) return null

  const currentImage = images[initialIndex] || images[0]

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gallery-item-title"
      onClick={onClose}
    >
      <div
        className="modal-dialog"
        style={{ maxWidth: 640 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">{item.category}</span>
            <h2 id="gallery-item-title">{item.name}</h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Cerrar galería de imágenes"
          >
            ✕
          </button>
        </div>

        <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', borderRadius: 16, overflow: 'hidden', background: 'var(--surface-card-warm)' }}>
          <Image
            src={currentImage}
            alt={`${item.name} - Imagen de presentación`}
            fill
            sizes="(max-width: 768px) 100vw, 600px"
            style={{ objectFit: 'cover' }}
            priority
          />
        </div>

        <div style={{ marginTop: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            {item.description}
          </p>
          <strong style={{ fontSize: '1.2rem', color: 'var(--orange)', whiteSpace: 'nowrap', marginLeft: 16 }}>
            {formatCop(item.price_cop)}
          </strong>
        </div>
      </div>
    </div>
  )
}
