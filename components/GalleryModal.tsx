'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Image from 'next/image'
import type { MenuItem, MenuItemOptionChoice, MenuItemOptionGroup } from '@/lib/types'
import { ProductPlaceholder } from '@/components/ProductPlaceholder'
import { useI18n } from '@/lib/i18n'
import { useScrollLock } from '@/lib/use-scroll-lock'

type GalleryModalProps = {
  item: MenuItem | null
  cartQty?: number
  onAddToCart?: (
    item: MenuItem,
    notes?: string,
    extraPrice?: number,
    choiceIds?: string[],
    choices?: MenuItemOptionChoice[],
  ) => void
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
  const { t, language } = useI18n()
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [baristaNotes, setBaristaNotes] = useState<string>('')
  const [selectedChoicesByGroup, setSelectedChoicesByGroup] = useState<Record<string, string[]>>({})
  const [prevItemKey, setPrevItemKey] = useState<string | null>(null)

  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  const images = useMemo(() => {
    return item ? ([item.image_url, ...(item.gallery_urls || [])].filter(Boolean) as string[]) : []
  }, [item])

  if (item?.id !== prevItemKey) {
    setPrevItemKey(item?.id ?? null)
    const initial: Record<string, string[]> = {}
    if (item?.option_groups) {
      for (const group of item.option_groups) {
        const activeChoices = group.choices || []
        if (group.kind === 'single' && group.required && activeChoices.length > 0) {
          initial[group.id] = [activeChoices[0].id]
        } else {
          initial[group.id] = []
        }
      }
    }
    setSelectedChoicesByGroup(initial)
  }

  const { extraDelta, selectedChoiceIds, selectedChoicesList } = useMemo(() => {
    let delta = 0
    const ids: string[] = []
    const choicesList: MenuItemOptionChoice[] = []
    if (!item?.option_groups) return { extraDelta: 0, selectedChoiceIds: ids, selectedChoicesList: choicesList }

    for (const group of item.option_groups) {
      const currentIds = selectedChoicesByGroup[group.id] || []
      for (const cId of currentIds) {
        const found = (group.choices || []).find((c: MenuItemOptionChoice) => c.id === cId)
        if (found) {
          delta += found.price_delta_cop
          ids.push(found.id)
          choicesList.push(found)
        }
      }
    }
    return { extraDelta: delta, selectedChoiceIds: ids, selectedChoicesList: choicesList }
  }, [item, selectedChoicesByGroup])

  const effectivePrice = (item?.price_cop || 0) + extraDelta

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
    const link = `${origin}/producto/${item.id}`
    const prefix = t('share_product_text_prefix')
    const message = encodeURIComponent(`${prefix} ${item.name}: ${link}`)
    window.open(`https://api.whatsapp.com/send?text=${message}`, '_blank')
  }

  function handleAddWithCustomization() {
    if (!item || !onAddToCart) return
    const choiceLabels = selectedChoicesList.map((c) => c.label)
    const combinedNotes = [...choiceLabels, baristaNotes.trim()].filter(Boolean).join(' | ')
    onAddToCart(item, combinedNotes, extraDelta, selectedChoiceIds, selectedChoicesList)
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
            aria-label={t('modal_close_aria')}
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
                aria-label={t('modal_prev_photo')}
              >
                ‹
              </button>
              <button
                type="button"
                className="gallery-nav-btn gallery-nav-next"
                onClick={() => setActiveImageIndex((prev) => (prev + 1) % images.length)}
                aria-label={t('modal_next_photo')}
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
                aria-label={`${t('modal_thumb_aria_prefix')} ${idx + 1}`}
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
              {language === 'en' && item.name_en ? item.name_en : item.name}
            </h2>
          </div>

          {(language === 'en' && item.description_en ? item.description_en : item.description) && (
            <p className="gallery-description">
              {language === 'en' && item.description_en ? item.description_en : item.description}
            </p>
          )}

          {/* Opciones y variantes guiadas por datos */}
          {item.option_groups && item.option_groups.length > 0 && (
            <div className="gallery-options-container" style={{ marginTop: 16 }}>
              {item.option_groups.map((group: MenuItemOptionGroup) => {
                const currentSelected = selectedChoicesByGroup[group.id] || []
                return (
                  <div
                    key={group.id}
                    className="gallery-option-group"
                    style={{
                      marginBottom: 14,
                      padding: '12px 14px',
                      background: 'var(--surface, rgba(0,0,0,0.02))',
                      borderRadius: 'var(--radius-md, 12px)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>
                        {group.name}
                        {group.required && <span style={{ color: 'var(--orange)', marginLeft: 4 }}>*</span>}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {group.kind === 'single' ? t('modal_opt_choose_one') : t('modal_opt_optional')}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {(group.choices || []).map((choice: MenuItemOptionChoice) => {
                        const isSelected = currentSelected.includes(choice.id)
                        return (
                          <button
                            key={choice.id}
                            type="button"
                            onClick={() => {
                              setSelectedChoicesByGroup((prev) => {
                                if (group.kind === 'single') {
                                  return { ...prev, [group.id]: [choice.id] }
                                } else {
                                  const list = prev[group.id] || []
                                  const nextList = list.includes(choice.id)
                                    ? list.filter((id) => id !== choice.id)
                                    : [...list, choice.id]
                                  return { ...prev, [group.id]: nextList }
                                }
                              })
                            }}
                            className={`filter-chip ${isSelected ? 'active' : ''}`}
                            style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                          >
                            <span>{choice.label}</span>
                            {choice.price_delta_cop > 0 && (
                              <span style={{ marginLeft: 4, opacity: 0.85 }}>
                                (+{formatCop(choice.price_delta_cop)})
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Sección de nota para el barista */}
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
              aria-label={`${t('modal_share')}: ${item.name}`}
              title={t('modal_share')}
            >
              💬
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
