'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import type { MenuItem, MenuCategory } from '../types'
import { SITE_URL } from '@/lib/site-url'

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
  const [columns, setColumns] = useState<'3' | '4'>('3')
  const [onlyAvailable, setOnlyAvailable] = useState(true)
  const [showDescriptions, setShowDescriptions] = useState(true)
  const [showQr, setShowQr] = useState(true)
  const [fontSize, setFontSize] = useState<'compact' | 'normal' | 'large'>('normal')
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('')

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

  // Organizar productos por categoría respetando sort_order
  const sortedCategories = [...categories]
    .filter((c) => c.active !== false)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

  const categorizedItems = sortedCategories
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
    .filter((group) => group.items.length > 0)

  // Productos huérfanos o sin categoría asignada
  const unassignedItems = items.filter((it) => {
    if (onlyAvailable && !it.available) return false
    return !sortedCategories.some((c) => (it.category_id ? it.category_id === c.id : it.category === c.name))
  })

  function handlePrint() {
    window.print()
  }

  return (
    <div className="print-modal-overlay no-print-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Imprimir Menú Horizontal">
      <div className="print-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Barra superior de herramientas (no se imprime) */}
        <div className="print-modal-toolbar no-print">
          <div className="toolbar-left">
            <h3 style={{ margin: 0, fontSize: '1.15rem' }}>🖨️ Imprimir Carta Horizontal (Landscape)</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Configura las opciones y previsualiza la hoja antes de imprimir o guardar como PDF.
            </span>
          </div>

          <div className="toolbar-controls">
            <label className="toolbar-option">
              <span>Columnas:</span>
              <select
                value={columns}
                onChange={(e) => setColumns(e.target.value as '3' | '4')}
                className="input input-sm"
              >
                <option value="3">3 Columnas (Recomendado)</option>
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
                checked={showQr}
                onChange={(e) => setShowQr(e.target.checked)}
              />
              <span>Código QR</span>
            </label>
          </div>

          <div className="toolbar-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handlePrint}
              id="btn-trigger-print"
            >
              <span>🖨️ Imprimir ahora</span>
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
            >
              Cerrar
            </button>
          </div>
        </div>

        {/* Hoja de menú apaisada (se previsualiza en pantalla y se imprime con @media print) */}
        <div className="print-modal-preview-wrapper">
          <div
            id="printable-menu"
            className={`printable-menu-sheet font-size-${fontSize} cols-${columns}`}
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

            {/* Cuadrícula de Categorías y Productos en Columnas Horizontales */}
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
                        <div className="print-item-header">
                          <strong className="print-item-name">{item.name}</strong>
                          <span className="print-leader-dots" aria-hidden="true" />
                          <span className="print-item-price">{formatCop(item.price_cop)}</span>
                        </div>
                        {showDescriptions && item.description && (
                          <p className="print-item-desc">{item.description}</p>
                        )}
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
                        <div className="print-item-header">
                          <strong className="print-item-name">{item.name}</strong>
                          <span className="print-leader-dots" aria-hidden="true" />
                          <span className="print-item-price">{formatCop(item.price_cop)}</span>
                        </div>
                        {showDescriptions && item.description && (
                          <p className="print-item-desc">{item.description}</p>
                        )}
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
                    <strong>yarumocoffee.com</strong>
                  </div>
                </div>
              )}
            </footer>
          </div>
        </div>
      </div>
    </div>
  )
}
