'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { CafeTable } from '../types'
import { SITE_URL as PUBLIC_MENU_URL } from '@/lib/site-url'

type QrTabProps = {
  tables: CafeTable[]
}

export default function QrTab({ tables }: QrTabProps) {
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  // Carga QRCode dinámicamente bajo demanda para no engordar el bundle de staff
  async function generateQrs() {
    setLoading(true)
    try {
      const QRCode = (await import('qrcode')).default
      const canonicalMenuUrl = PUBLIC_MENU_URL.replace(/\/$/, '')

      const generated = await Promise.all(
        tables.map(async (table) => {
          const tableUrl = `${canonicalMenuUrl}/?mesa=${table.public_token}`
          const dataUrl = await QRCode.toDataURL(tableUrl, {
            width: 320,
            margin: 3,
            errorCorrectionLevel: 'M',
            color: { dark: '#18362f', light: '#fffaf2' },
          })
          return [table.id, dataUrl] as const
        }),
      )
      setQrCodes(Object.fromEntries(generated))
    } catch (err) {
      console.error('Error al generar códigos QR:', err)
    } finally {
      setLoading(false)
    }
  }

  function downloadQr(table: CafeTable) {
    const dataUrl = qrCodes[table.id]
    if (!dataUrl) return
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `yarumo-coffee-mesa-${table.label}.png`
    link.click()
  }

  function downloadAllQrs() {
    tables
      .filter((t) => t.active && qrCodes[t.id])
      .forEach((t, index) => {
        window.setTimeout(() => downloadQr(t), index * 180)
      })
  }

  return (
    <div className="tab-pane qr-tab-pane">
      <div className="section-header">
        <div>
          <h2>Mesas y Códigos QR</h2>
          <p>Genera y descarga los códigos QR para cada mesa del café.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={generateQrs}
            disabled={loading}
          >
            {loading ? 'Generando...' : 'Generar Códigos QR'}
          </button>
          {Object.keys(qrCodes).length > 0 && (
            <button type="button" className="btn btn-secondary" onClick={downloadAllQrs}>
              Descargar Todos ↓
            </button>
          )}
        </div>
      </div>

      <div className="qr-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 20, marginTop: 24 }}>
        {tables.map((table) => {
          const qrDataUrl = qrCodes[table.id]
          return (
            <div
              key={table.id}
              className="card qr-card"
              style={{ textAlign: 'center', padding: 20, background: 'var(--surface-card)', borderRadius: 16, border: '1px solid var(--border)' }}
            >
              <h3 style={{ margin: '0 0 12px' }}>Mesa {table.label}</h3>
              {qrDataUrl ? (
                <div style={{ margin: '0 auto 16px', width: 180, height: 180, position: 'relative' }}>
                  <Image
                    src={qrDataUrl}
                    alt={`Código QR de la mesa ${table.label}`}
                    width={180}
                    height={180}
                    unoptimized
                    style={{ borderRadius: 8 }}
                  />
                </div>
              ) : (
                <div
                  style={{
                    width: 180,
                    height: 180,
                    margin: '0 auto 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--skeleton-base)',
                    borderRadius: 8,
                    color: 'var(--text-muted)',
                    fontSize: '0.85rem',
                  }}
                >
                  Haz clic en Generar Códigos QR
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                {qrDataUrl && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => downloadQr(table)}
                  >
                    Descargar PNG ↓
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
