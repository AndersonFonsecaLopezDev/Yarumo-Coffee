'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import type { MenuItem, MenuCategory } from '../types'
import { SITE_URL } from '@/lib/site-url'

const emptySubscribe = () => () => {}

type PrintMenuModalProps = {
  items: MenuItem[]
  categories: MenuCategory[]
  onClose: () => void
}

function formatCop(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

export default function PrintMenuModal({
  items,
  categories,
  onClose,
}: PrintMenuModalProps) {
  const [columns, setColumns] = useState<'2' | '3' | '4'>('3')
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape')
  const [paperSize, setPaperSize] = useState<'letter' | 'a4'>('letter')
  const [onlyAvailable, setOnlyAvailable] = useState(true)
  const [showDescriptions, setShowDescriptions] = useState(true)
  const [showPhotos, setShowPhotos] = useState(false)
  const [showQr, setShowQr] = useState(true)
  const [fontSize, setFontSize] = useState<'compact' | 'normal' | 'large'>('normal')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [hideEmptyCategories, setHideEmptyCategories] = useState(true)
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('')
  const [isPreparing, setIsPreparing] = useState(false)

  // Extraer dominio limpio desde SITE_URL para el pie y QR
  const displayDomain = useMemo(() => {
    try {
      const parsed = new URL(SITE_URL)
      return parsed.hostname.replace(/^www\./, '')
    } catch {
      return 'yarumocoffee.com'
    }
  }, [])

  // Verificar renderizado en cliente sin llamar a setState en effect
  const isClient = useSyncExternalStore(emptySubscribe, () => true, () => false)

  // Limpieza de nodo al desmontar si queda vacío
  useEffect(() => {
    return () => {
      const node = document.getElementById('print-root')
      if (node && node.childNodes.length === 0 && node.parentNode) {
        node.parentNode.removeChild(node)
      }
    }
  }, [])

  // Generar QR dinámico
  useEffect(() => {
    let active = true
    async function genQr() {
      try {
        const QRCode = (await import('qrcode')).default
        const targetUrl = SITE_URL.replace(/\/$/, '')
        const dataUrl = await QRCode.toDataURL(targetUrl, {
          width: 180,
          margin: 1,
          errorCorrectionLevel: 'M',
          color: { dark: '#18362f', light: '#ffffff' },
        })
        if (active) setQrCodeUrl(dataUrl)
      } catch {
        // Fallback si falla QR
      }
    }
    void genQr()
    return () => {
      active = false
    }
  }, [])

  // Tecla Escape para cerrar
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Escuchar evento afterprint para resetear estado "preparando"
  useEffect(() => {
    function onAfterPrint() {
      setIsPreparing(false)
    }
    window.addEventListener('afterprint', onAfterPrint)
    return () => window.removeEventListener('afterprint', onAfterPrint)
  }, [])

  // Fallback para isPreparing si el navegador cancela o no dispara afterprint
  useEffect(() => {
    if (!isPreparing) return
    const timer = setTimeout(() => setIsPreparing(false), 4000)
    return () => clearTimeout(timer)
  }, [isPreparing])

  // Organizar categorías respetando sort_order y filtros
  const sortedCategories = useMemo(() => {
    return [...categories]
      .filter((c) => c.active !== false)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  }, [categories])

  const categorizedItems = useMemo(() => {
    return sortedCategories
      .filter((category) => selectedCategory === 'all' || category.id === selectedCategory)
      .map((category) => {
        const catItems = items
          .filter((it) => {
            const matchCat = it.category_id ? it.category_id === category.id : it.category === category.name
            if (!matchCat) return false
            if (onlyAvailable && !it.available) return false
            return true
          })
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

        return {
          category,
          items: catItems,
        }
      })
      .filter((group) => !hideEmptyCategories || group.items.length > 0)
  }, [sortedCategories, selectedCategory, items, onlyAvailable, hideEmptyCategories])

  // Productos no categorizados
  const unassignedItems = useMemo(() => {
    if (selectedCategory !== 'all') return []
    return items.filter((it) => {
      if (onlyAvailable && !it.available) return false
      return !sortedCategories.some((c) => (it.category_id ? it.category_id === c.id : it.category === c.name))
    })
  }, [items, onlyAvailable, selectedCategory, sortedCategories])

  // Preparar e imprimir esperando carga de QR y Logo
  async function triggerPrint() {
    setIsPreparing(true)
    try {
      // 1. Asegurar QR generado si está activo
      if (showQr && !qrCodeUrl) {
        const QRCode = (await import('qrcode')).default
        const targetUrl = SITE_URL.replace(/\/$/, '')
        const dataUrl = await QRCode.toDataURL(targetUrl, {
          width: 180,
          margin: 1,
          errorCorrectionLevel: 'M',
          color: { dark: '#18362f', light: '#ffffff' },
        })
        setQrCodeUrl(dataUrl)
      }

      // 2. Pre-cargar logo de Yarumo
      await new Promise<void>((resolve) => {
        const img = new window.Image()
        img.src = '/yarumo-logo.webp'
        if (img.complete) {
          resolve()
        } else {
          img.onload = () => resolve()
          img.onerror = () => resolve()
        }
      })

      // 3. Breve espera para que el layout y fuentes se estabilicen
      await new Promise((r) => setTimeout(r, 150))

      window.print()
    } catch {
      window.print()
    }
  }

  if (!isClient) return null

  let portalNode = document.getElementById('print-root')
  if (!portalNode) {
    portalNode = document.createElement('div')
    portalNode.id = 'print-root'
    document.body.appendChild(portalNode)
  }

  const modalContent = (
    <div
      className="print-modal-overlay no-print-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Imprimir Carta Menú Yarumo"
    >
      {/* Estilo dinámico @page inyectado en el portal */}
      <style>{`
        @page {
          size: ${paperSize === 'a4' ? 'A4' : 'letter'} ${orientation};
          margin: 8mm 10mm;
        }
      `}</style>

      <div className="print-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Barra superior de herramientas (no se imprime) */}
        <div className="print-modal-toolbar no-print">
          <div className="toolbar-left">
            <h3 style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🖨️</span>
              <span>Imprimir Carta de Menú</span>
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Configura formato, papel y contenido antes de imprimir o exportar a PDF.
            </span>
          </div>

          <div className="toolbar-controls">
            <label className="toolbar-option">
              <span>Orientación:</span>
              <select
                value={orientation}
                onChange={(e) => {
                  const val = e.target.value as 'landscape' | 'portrait'
                  setOrientation(val)
                  if (val === 'portrait' && columns === '4') setColumns('2')
                }}
                className="input input-sm"
              >
                <option value="landscape">Horizontal (Landscape)</option>
                <option value="portrait">Vertical (Portrait)</option>
              </select>
            </label>

            <label className="toolbar-option">
              <span>Papel:</span>
              <select
                value={paperSize}
                onChange={(e) => setPaperSize(e.target.value as 'letter' | 'a4')}
                className="input input-sm"
              >
                <option value="letter">Carta (Letter)</option>
                <option value="a4">A4</option>
              </select>
            </label>

            <label className="toolbar-option">
              <span>Columnas:</span>
              <select
                value={columns}
                onChange={(e) => setColumns(e.target.value as '2' | '3' | '4')}
                className="input input-sm"
              >
                <option value="2">2 Columnas</option>
                <option value="3">3 Columnas (Estándar)</option>
                <option value="4">4 Columnas</option>
              </select>
            </label>

            <label className="toolbar-option">
              <span>Tamaño texto:</span>
              <select
                value={fontSize}
                onChange={(e) => setFontSize(e.target.value as 'compact' | 'normal' | 'large')}
                className="input input-sm"
              >
                <option value="compact">Compacto</option>
                <option value="normal">Normal</option>
                <option value="large">Grande</option>
              </select>
            </label>

            <label className="toolbar-option">
              <span>Categoría:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="input input-sm"
              >
                <option value="all">Todas las categorías</option>
                {sortedCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="toolbar-check">
              <input
                type="checkbox"
                checked={onlyAvailable}
                onChange={(e) => setOnlyAvailable(e.target.checked)}
              />
              <span>Solo disponibles</span>
            </label>

            <label className="toolbar-check">
              <input
                type="checkbox"
                checked={showDescriptions}
                onChange={(e) => setShowDescriptions(e.target.checked)}
              />
              <span>Descripciones</span>
            </label>

            <label className="toolbar-check">
              <input
                type="checkbox"
                checked={showPhotos}
                onChange={(e) => setShowPhotos(e.target.checked)}
              />
              <span>Incluir fotos</span>
            </label>

            <label className="toolbar-check">
              <input
                type="checkbox"
                checked={showQr}
                onChange={(e) => setShowQr(e.target.checked)}
              />
              <span>Código QR</span>
            </label>

            <label className="toolbar-check">
              <input
                type="checkbox"
                checked={hideEmptyCategories}
                onChange={(e) => setHideEmptyCategories(e.target.checked)}
              />
              <span>Ocultar vacías</span>
            </label>
          </div>

          <div className="toolbar-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={triggerPrint}
              disabled={isPreparing}
              id="btn-trigger-print"
            >
              <span>{isPreparing ? '⏳ Preparando impresión…' : '🖨️ Imprimir ahora'}</span>
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={triggerPrint}
              disabled={isPreparing}
              title="Abre el diálogo de impresión donde puedes elegir 'Guardar como PDF'"
              id="btn-download-pdf"
            >
              <span>📄 Descargar PDF</span>
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              id="btn-close-print-modal"
            >
              Cerrar
            </button>
          </div>
        </div>

        {/* Hoja de menú (previsualización en pantalla y salida en @media print) */}
        <div className="print-modal-preview-wrapper">
          <div
            id="printable-menu"
            className={`printable-menu-sheet font-size-${fontSize} cols-${columns} orientation-${orientation} paper-${paperSize}`}
          >
            {/* Encabezado del Menú Impreso */}
            <header className="print-sheet-header">
              <div className="print-header-brand">
                <div className="print-logo-wrap">
                  <Image
                    src="/yarumo-logo.webp"
                    alt="Yarumo Coffee"
                    width={56}
                    height={56}
                    priority
                  />
                </div>
                <div>
                  <h1 className="print-brand-title">YARUMO COFFEE</h1>
                  <p className="print-brand-tagline">CAFÉ ESPECIAL DE ORIGEN · ARMENIA, QUINDÍO</p>
                </div>
              </div>

              <div className="print-header-meta">
                <span className="print-slogan">«Donde cada taza cuenta una historia»</span>
                <span className="print-contact">Carrera 19 # 21 Norte-01 Local 1 · @yarumocafearmenia</span>
              </div>
            </header>

            {/* Cuadrícula de Categorías y Productos */}
            <main className="print-categories-grid">
              {categorizedItems.map(({ category, items: catItems }) => (
                <section key={category.id} className="print-category-block">
                  <h2 className="print-category-title">
                    <span className="print-cat-icon">{category.icon || '☕'}</span>
                    <span>{category.name}</span>
                  </h2>

                  <div className="print-items-list">
                    {catItems.map((item) => (
                      <article key={item.id} className="print-menu-item">
                        <div className="print-item-content">
                          {showPhotos && item.image_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="print-item-thumb"
                            />
                          )}
                          <div style={{ flex: 1 }}>
                            <div className="print-item-header">
                              <strong className="print-item-name">{item.name}</strong>
                              <span className="print-leader-dots" aria-hidden="true" />
                              <span className="print-item-price">{formatCop(item.price_cop)}</span>
                            </div>
                            {showDescriptions && item.description && (
                              <p className="print-item-desc">{item.description}</p>
                            )}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}

              {unassignedItems.length > 0 && (
                <section className="print-category-block">
                  <h2 className="print-category-title">
                    <span className="print-cat-icon">✨</span>
                    <span>Otras Delicias</span>
                  </h2>

                  <div className="print-items-list">
                    {unassignedItems.map((item) => (
                      <article key={item.id} className="print-menu-item">
                        <div className="print-item-content">
                          {showPhotos && item.image_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="print-item-thumb"
                            />
                          )}
                          <div style={{ flex: 1 }}>
                            <div className="print-item-header">
                              <strong className="print-item-name">{item.name}</strong>
                              <span className="print-leader-dots" aria-hidden="true" />
                              <span className="print-item-price">{formatCop(item.price_cop)}</span>
                            </div>
                            {showDescriptions && item.description && (
                              <p className="print-item-desc">{item.description}</p>
                            )}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}
            </main>

            {/* Pie de Página del Menú */}
            <footer className="print-sheet-footer">
              <div className="print-footer-info">
                <strong>Disfruta tu experiencia en mesa</strong>
                <span>
                  Todos nuestros métodos y cafés son preparados al momento. Pregunta a tu barista por el café de temporada.
                </span>
              </div>

              {showQr && qrCodeUrl && (
                <div className="print-footer-qr">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrCodeUrl} alt="QR Menú Digital" className="print-qr-img" />
                  <div className="print-qr-text">
                    <small>Carta Digital con Fotos</small>
                    <strong>{displayDomain}</strong>
                  </div>
                </div>
              )}
            </footer>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, portalNode)
}
