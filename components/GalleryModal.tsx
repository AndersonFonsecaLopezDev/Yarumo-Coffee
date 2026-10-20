'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Image from 'next/image'
import type { MenuItem, MenuItemOptionChoice, MenuItemOptionGroup } from '@/lib/types'
import { ProductPlaceholder } from '@/components/ProductPlaceholder'
import { WhatsAppIcon } from '@/components/icons/CategoryIcons'
import { useI18n } from '@/lib/i18n'
import { useScrollLock } from '@/lib/use-scroll-lock'
import { formatCop } from '@/lib/format'

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
  const [isAddedRecently, setIsAddedRecently] = useState(false)
  const [noteSavedNotice, setNoteSavedNotice] = useState(false)
  const addedTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const noteSavedTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (addedTimeoutRef.current) clearTimeout(addedTimeoutRef.current)
      if (noteSavedTimeoutRef.current) clearTimeout(noteSavedTimeoutRef.current)
    }
  }, [])
  const [selectedChoicesByGroup, setSelectedChoicesByGroup] = useState<Record<string, string[]>>({})
  const [prevItemKey, setPrevItemKey] = useState<string | null>(null)

  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

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
      } else if (event.key === 'Tab') {
        const dialog = dialogRef.current
        if (!dialog) return
        const focusables = dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (event.shiftKey) {
          if (document.activeElement === first) {
            event.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            event.preventDefault()
            first.focus()
          }
        }
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

  const choiceLabels = selectedChoicesList.map((c) => c.label)
  const choicePrefix = choiceLabels.join(' | ')
  const maxBaristaLength = Math.max(0, 200 - (choicePrefix ? choicePrefix.length + 3 : 0))
  const effectiveMaxNotesLength = Math.min(120, maxBaristaLength)

  function handleAddWithCustomization() {
    if (!item || !onAddToCart) return
    const trimmedNotes = baristaNotes.trim()
    const hadNotes = trimmedNotes.length > 0
    let combinedNotes = [...choiceLabels, trimmedNotes].filter(Boolean).join(' | ')
    if (combinedNotes.length > 200) {
      combinedNotes = combinedNotes.slice(0, 200)
    }

    onAddToCart(item, combinedNotes, extraDelta, selectedChoiceIds, selectedChoicesList)

    setIsAddedRecently(true)
    if (addedTimeoutRef.current) clearTimeout(addedTimeoutRef.current)
    addedTimeoutRef.current = setTimeout(() => {
      setIsAddedRecently(false)
      addedTimeoutRef.current = null
    }, 1500)

    setBaristaNotes('')

    if (hadNotes) {
      setNoteSavedNotice(true)
      if (noteSavedTimeoutRef.current) clearTimeout(noteSavedTimeoutRef.current)
      noteSavedTimeoutRef.current = setTimeout(() => {
        setNoteSavedNotice(false)
        noteSavedTimeoutRef.current = null
      }, 2500)
    }
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
        ref={dialogRef}
        className="gallery-modal-card gallery-modal-dialog"
        onClick={(e) => e.stopPropagation()}
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
                  <div key={group.id} className="gallery-option-group">
                    <div className="gallery-option-header">
                      <span className="gallery-option-title">
                        {group.name}
                        {group.required && <span className="gallery-option-badge-required"> *</span>}
                      </span>
                      <span className={group.required ? 'gallery-option-badge-required' : 'gallery-option-badge-optional'}>
                        {group.kind === 'single' ? t('modal_opt_choose_one') : t('modal_opt_optional')}
                      </span>
                    </div>

                    <div className="gallery-option-chips-wrap">
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
                            className={`gallery-option-chip ${isSelected ? 'active' : ''}`}
                          >
                            <span>{choice.label}</span>
                            {choice.price_delta_cop > 0 && (
                              <span className="gallery-option-price-delta">
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
          <div className="gallery-barista-card">
            <div>
              <label htmlFor="gallery-barista-notes" className="gallery-barista-label">
                {t('modal_notes_label')}
              </label>
              <input
                id="gallery-barista-notes"
                name="modal-customer-notes"
                type="text"
                maxLength={effectiveMaxNotesLength}
                placeholder={t('modal_notes_ph')}
                value={baristaNotes}
                onChange={(e) => setBaristaNotes(e.target.value)}
                className="gallery-barista-input"
              />
              {noteSavedNotice && (
                <p className="gallery-barista-saved-notice" role="status" aria-live="polite">
                  ✓ {t('modal_barista_saved')}
                </p>
              )}
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
                className={`gallery-add-btn ${isAddedRecently ? 'is-added' : ''}`}
                onClick={handleAddWithCustomization}
                id="btn-modal-add-to-cart"
                aria-live="polite"
              >
                {isAddedRecently ? (
                  <span>{t('modal_added_feedback')}</span>
                ) : (
                  <>
                    <span>+</span>
                    <span>{cartQty > 0 ? t('modal_add_another') : t('modal_add_to_cart')}</span>
                  </>
                )}
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
              title={`${t('modal_share')}: ${item.name}`}
            >
              <WhatsAppIcon size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
