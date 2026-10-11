'use client'

import { useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { revalidatePublicContent } from '@/app/actions/revalidate'

type SettingsTabProps = {
  heroImageUrl: string
  whatsappDeliveryNumber: string
  onRefresh: () => void
}

export default function SettingsTab({
  heroImageUrl: initialHero,
  whatsappDeliveryNumber: initialWhatsapp,
  onRefresh,
}: SettingsTabProps) {
  const [supabase] = useState(() => createClient())
  const [heroImageUrl, setHeroImageUrl] = useState(initialHero)
  const [heroImageInput, setHeroImageInput] = useState(initialHero)
  const [heroImageFile, setHeroImageFile] = useState<File | null>(null)
  const [heroSaving, setHeroSaving] = useState(false)
  const [heroSuccess, setHeroSuccess] = useState('')
  const [error, setError] = useState('')

  const [whatsappDeliveryNumber, setWhatsappDeliveryNumber] = useState(initialWhatsapp)
  const [whatsappInput, setWhatsappInput] = useState(initialWhatsapp.replace(/^57/, ''))
  const [whatsappSaving, setWhatsappSaving] = useState(false)
  const [whatsappSuccess, setWhatsappSuccess] = useState('')
  const [waitTimeSuccess, setWaitTimeSuccess] = useState('')

  async function saveHeroImage(e: React.FormEvent) {
    e.preventDefault()
    setHeroSaving(true)
    setError('')
    setHeroSuccess('')

    let finalUrl = heroImageInput.trim()

    if (heroImageFile) {
      if (!heroImageFile.type.startsWith('image/') || heroImageFile.size > 5 * 1024 * 1024) {
        setHeroSaving(false)
        setError('La imagen de portada debe ser JPG, PNG o WebP y pesar máximo 5 MB.')
        return
      }
      const extension = heroImageFile.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `homepage-hero-${crypto.randomUUID()}.${extension}`
      const upload = await supabase.storage
        .from('menu-images')
        .upload(path, heroImageFile, { cacheControl: '31536000', contentType: heroImageFile.type, upsert: false })

      if (upload.error) {
        setHeroSaving(false)
        setError('No se pudo subir la foto de portada. Verifica Supabase Storage.')
        return
      }
      finalUrl = supabase.storage.from('menu-images').getPublicUrl(path).data.publicUrl
    }

    if (!finalUrl) {
      setHeroSaving(false)
      setError('Ingresa una URL de imagen o sube un archivo.')
      return
    }

    const { error: upsertErr } = await supabase
      .from('site_settings')
      .upsert({ key: 'hero_image_url', value: finalUrl, updated_at: new Date().toISOString() })

    setHeroSaving(false)
    if (upsertErr) {
      setError('No se pudo guardar la foto de portada.')
    } else {
      setHeroImageUrl(finalUrl)
      setHeroImageInput(finalUrl)
      setHeroImageFile(null)
      setHeroSuccess('¡Foto de portada actualizada con éxito!')
      void revalidatePublicContent(['settings'])
      onRefresh()
    }
  }

  async function saveWhatsappNumber(e: React.FormEvent) {
    e.preventDefault()
    setWhatsappSaving(true)
    setError('')
    setWhatsappSuccess('')

    let clean = whatsappInput.trim().replace(/\D/g, '')
    if (!clean) {
      setWhatsappSaving(false)
      setError('Por favor introduce un número de WhatsApp válido.')
      return
    }
    if (!clean.startsWith('57') && clean.length === 10) {
      clean = '57' + clean
    }

    const { error: upsertErr } = await supabase.from('site_settings').upsert({
      key: 'whatsapp_delivery_number',
      value: clean,
      updated_at: new Date().toISOString(),
    })

    setWhatsappSaving(false)
    if (upsertErr) {
      setError('No se pudo guardar el número de WhatsApp: ' + upsertErr.message)
    } else {
      setWhatsappDeliveryNumber(clean)
      setWhatsappSuccess('¡Número de WhatsApp para domicilios actualizado con éxito!')
      void revalidatePublicContent(['settings'])
      onRefresh()
    }
  }

  return (
    <div className="tab-pane settings-tab-pane">
      <h2>Ajustes y Portada del Menú</h2>
      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, marginTop: 20 }}>
        {/* Foto de portada */}
        <div className="card" style={{ padding: 24, background: 'var(--surface-card)', borderRadius: 16, border: '1px solid var(--border)' }}>
          <h3>Foto de Portada del Menú (Hero)</h3>
          {heroSuccess && <div className="alert alert-success" style={{ marginBottom: 12 }}>{heroSuccess}</div>}

          {heroImageUrl && (
            <div style={{ position: 'relative', width: '100%', height: 200, borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
              <Image
                src={heroImageUrl}
                alt="Vista previa de portada"
                fill
                sizes="(max-width: 768px) 100vw, 400px"
                style={{ objectFit: 'cover' }}
              />
            </div>
          )}

          <form onSubmit={saveHeroImage} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Subir archivo</label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => setHeroImageFile(e.target.files?.[0] || null)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>O URL directa</label>
              <input
                type="text"
                className="input"
                value={heroImageInput}
                onChange={(e) => setHeroImageInput(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={heroSaving}>
              {heroSaving ? 'Guardando...' : 'Actualizar Portada'}
            </button>
          </form>
        </div>

        {/* WhatsApp Domicilios */}
        <div className="card" style={{ padding: 24, background: 'var(--surface-card)', borderRadius: 16, border: '1px solid var(--border)' }}>
          <h3>WhatsApp para Domicilios</h3>
          {whatsappSuccess && <div className="alert alert-success" style={{ marginBottom: 12 }}>{whatsappSuccess}</div>}
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Número actual: <strong>+{whatsappDeliveryNumber}</strong>
          </p>
          <form onSubmit={saveWhatsappNumber} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Número celular (10 dígitos en Colombia)</label>
              <input
                type="text"
                className="input"
                value={whatsappInput}
                onChange={(e) => setWhatsappInput(e.target.value)}
                placeholder="3192208938"
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={whatsappSaving}>
              {whatsappSaving ? 'Guardando...' : 'Guardar Número'}
            </button>
          </form>
        </div>

        {/* Tiempo estimado de espera */}
        <div className="card" style={{ padding: 24, background: 'var(--surface-card)', borderRadius: 16, border: '1px solid var(--border)' }}>
          <h3>Tiempo Estimado de Espera</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Visible para los clientes al hacer sus pedidos en mesa o barra.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              const target = e.currentTarget.elements.namedItem('waitTime') as HTMLInputElement
              const val = target.value.trim()
              await supabase.from('site_settings').upsert({
                key: 'estimated_wait_time',
                value: val,
                updated_at: new Date().toISOString(),
              })
              void revalidatePublicContent(['settings'])
              setWaitTimeSuccess('Tiempo estimado guardado con éxito.')
              setTimeout(() => setWaitTimeSuccess(''), 4000)
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            {waitTimeSuccess && <div className="alert alert-success">{waitTimeSuccess}</div>}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Tiempo estimado (minutos)</label>
              <input
                name="waitTime"
                type="text"
                defaultValue="10–15"
                placeholder="Ej: 15–20"
                className="input"
              />
            </div>
            <button type="submit" className="btn btn-primary">
              Guardar Tiempo
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
