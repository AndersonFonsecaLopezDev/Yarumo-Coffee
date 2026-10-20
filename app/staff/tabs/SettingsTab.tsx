'use client'

import { useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { revalidatePublicContent } from '@/app/actions/revalidate'

type SettingsTabProps = {
  heroImageUrl: string
  whatsappDeliveryNumber: string
  initialSiteName?: string
  initialSiteIcon?: string
  initialEstimatedWaitTime?: string
  onRefresh: () => void
}

type ParsedIcons = {
  '512': string
  '192': string
  '180': string
  '32': string
}

const DEFAULT_ICONS: ParsedIcons = {
  '512': '/icon-512.png',
  '192': '/icon-192.png',
  '180': '/apple-touch-icon.png',
  '32': '/icon-32.png',
}

function parseIcons(raw?: string): ParsedIcons {
  if (!raw) return DEFAULT_ICONS
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      return {
        '512': parsed['512'] || DEFAULT_ICONS['512'],
        '192': parsed['192'] || DEFAULT_ICONS['192'],
        '180': parsed['180'] || DEFAULT_ICONS['180'],
        '32': parsed['32'] || DEFAULT_ICONS['32'],
      }
    }
  } catch {}
  return DEFAULT_ICONS
}

function resizeImageToBlob(img: HTMLImageElement, size: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      reject(new Error('No se pudo inicializar canvas para redimensionar'))
      return
    }
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, size, size)
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
      } else {
        reject(new Error('Fallo al exportar blob de imagen'))
      }
    }, 'image/png')
  })
}

export default function SettingsTab({
  heroImageUrl: initialHero,
  whatsappDeliveryNumber: initialWhatsapp,
  initialSiteName = 'Yarumo Coffee',
  initialSiteIcon,
  initialEstimatedWaitTime = '15–20 min',
  onRefresh,
}: SettingsTabProps) {
  const [supabase] = useState(() => createClient())

  // Portada (Hero)
  const [heroImageUrl, setHeroImageUrl] = useState(initialHero)
  const [heroImageInput, setHeroImageInput] = useState(initialHero)
  const [heroImageFile, setHeroImageFile] = useState<File | null>(null)
  const [heroSaving, setHeroSaving] = useState(false)
  const [heroSuccess, setHeroSuccess] = useState('')

  // WhatsApp
  const [whatsappDeliveryNumber, setWhatsappDeliveryNumber] = useState(initialWhatsapp)
  const [whatsappInput, setWhatsappInput] = useState(initialWhatsapp.replace(/^57/, ''))
  const [whatsappSaving, setWhatsappSaving] = useState(false)
  const [whatsappSuccess, setWhatsappSuccess] = useState('')

  // Nombre del sitio
  const [siteName, setSiteName] = useState(initialSiteName)
  const [siteNameInput, setSiteNameInput] = useState(initialSiteName)
  const [siteNameSaving, setSiteNameSaving] = useState(false)
  const [siteNameSuccess, setSiteNameSuccess] = useState('')

  // Ícono del sitio
  const [siteIcons, setSiteIcons] = useState<ParsedIcons>(() => parseIcons(initialSiteIcon))
  const [iconFile, setIconFile] = useState<File | null>(null)
  const [iconPreviewUrl, setIconPreviewUrl] = useState<string>('')
  const [iconSaving, setIconSaving] = useState(false)
  const [iconSuccess, setIconSuccess] = useState('')

  // Tiempo de espera
  const [waitTimeInput, setWaitTimeInput] = useState(initialEstimatedWaitTime)
  const [waitTimeSaving, setWaitTimeSaving] = useState(false)
  const [waitTimeSuccess, setWaitTimeSuccess] = useState('')

  // Error general o por sección
  const [error, setError] = useState('')

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
        setError('No se pudo subir la foto de portada: ' + upload.error.message)
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
      setError('No se pudo guardar la foto de portada: ' + upsertErr.message)
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

  async function saveSiteName(e: React.FormEvent) {
    e.preventDefault()
    setSiteNameSaving(true)
    setError('')
    setSiteNameSuccess('')

    const trimmed = siteNameInput.trim()
    if (!trimmed || trimmed.length > 60) {
      setSiteNameSaving(false)
      setError('El nombre del sitio debe tener entre 1 y 60 caracteres.')
      return
    }

    const { error: upsertErr } = await supabase.from('site_settings').upsert({
      key: 'site_name',
      value: trimmed,
      updated_at: new Date().toISOString(),
    })

    setSiteNameSaving(false)
    if (upsertErr) {
      setError('No se pudo guardar el nombre del sitio: ' + upsertErr.message)
    } else {
      setSiteName(trimmed)
      setSiteNameSuccess('¡Nombre del sitio actualizado con éxito!')
      void revalidatePublicContent(['settings'])
      onRefresh()
    }
  }

  async function resetSiteName() {
    setSiteNameSaving(true)
    setError('')
    setSiteNameSuccess('')

    const fallback = 'Yarumo Coffee'
    const { error: upsertErr } = await supabase.from('site_settings').upsert({
      key: 'site_name',
      value: fallback,
      updated_at: new Date().toISOString(),
    })

    setSiteNameSaving(false)
    if (upsertErr) {
      setError('No se pudo restablecer el nombre del sitio: ' + upsertErr.message)
    } else {
      setSiteName(fallback)
      setSiteNameInput(fallback)
      setSiteNameSuccess('Nombre restablecido a "Yarumo Coffee".')
      void revalidatePublicContent(['settings'])
      onRefresh()
    }
  }

  async function handleIconFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null
    setIconFile(file)
    setError('')
    setIconSuccess('')

    if (!file) {
      setIconPreviewUrl('')
      return
    }

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('El archivo debe ser una imagen válida (PNG, JPG o WebP).')
      setIconFile(null)
      setIconPreviewUrl('')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('El ícono no debe superar los 5 MB.')
      setIconFile(null)
      setIconPreviewUrl('')
      return
    }

    const objectUrl = URL.createObjectURL(file)
    const img = new window.Image()
    img.src = objectUrl

    img.onload = () => {
      if (img.naturalWidth < 512 || img.naturalHeight < 512) {
        setError(`La imagen debe tener al menos 512x512 px (dimensiones actuales: ${img.naturalWidth}x${img.naturalHeight} px).`)
        setIconFile(null)
        setIconPreviewUrl('')
        return
      }
      if (Math.abs(img.naturalWidth - img.naturalHeight) > 2) {
        setError(`La imagen debe ser cuadrada (dimensiones actuales: ${img.naturalWidth}x${img.naturalHeight} px).`)
        setIconFile(null)
        setIconPreviewUrl('')
        return
      }
      setIconPreviewUrl(objectUrl)
    }

    img.onerror = () => {
      setError('No se pudo procesar la imagen seleccionada.')
      setIconFile(null)
      setIconPreviewUrl('')
    }
  }

  async function saveSiteIcon(e: React.FormEvent) {
    e.preventDefault()
    if (!iconFile) {
      setError('Por favor selecciona una imagen cuadrada de al menos 512x512 píxeles.')
      return
    }

    setIconSaving(true)
    setError('')
    setIconSuccess('')

    try {
      const img = new window.Image()
      const objectUrl = URL.createObjectURL(iconFile)
      img.src = objectUrl

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('No se pudo cargar la imagen para redimensionar'))
      })

      const uid = crypto.randomUUID()
      const sizes = [512, 192, 180, 32] as const
      const generatedUrls: Record<string, string> = {}

      for (const size of sizes) {
        const blob = await resizeImageToBlob(img, size)
        const path = `site-icon-${size}-${uid}.png`
        const upload = await supabase.storage.from('menu-images').upload(path, blob, {
          cacheControl: '31536000',
          contentType: 'image/png',
          upsert: false,
        })

        if (upload.error) {
          throw new Error(`Fallo al subir ícono de ${size}px: ${upload.error.message}`)
        }

        const publicUrl = supabase.storage.from('menu-images').getPublicUrl(path).data.publicUrl
        generatedUrls[String(size)] = publicUrl
      }

      const jsonStr = JSON.stringify(generatedUrls)
      const { error: upsertErr } = await supabase.from('site_settings').upsert({
        key: 'site_icon',
        value: jsonStr,
        updated_at: new Date().toISOString(),
      })

      if (upsertErr) {
        throw new Error('Error al guardar configuración en BD: ' + upsertErr.message)
      }

      setSiteIcons(generatedUrls as ParsedIcons)
      setIconFile(null)
      setIconPreviewUrl('')
      setIconSuccess('¡Ícono del sitio generado y actualizado con éxito!')
      void revalidatePublicContent(['settings'])
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado al procesar el ícono.')
    } finally {
      setIconSaving(false)
    }
  }

  async function resetSiteIcon() {
    setIconSaving(true)
    setError('')
    setIconSuccess('')

    const defaultJson = JSON.stringify(DEFAULT_ICONS)
    const { error: upsertErr } = await supabase.from('site_settings').upsert({
      key: 'site_icon',
      value: defaultJson,
      updated_at: new Date().toISOString(),
    })

    setIconSaving(false)
    if (upsertErr) {
      setError('No se pudo restablecer el ícono por defecto: ' + upsertErr.message)
    } else {
      setSiteIcons(DEFAULT_ICONS)
      setIconFile(null)
      setIconPreviewUrl('')
      setIconSuccess('Íconos restablecidos a los valores por defecto del sistema.')
      void revalidatePublicContent(['settings'])
      onRefresh()
    }
  }

  async function saveWaitTime(e: React.FormEvent) {
    e.preventDefault()
    setWaitTimeSaving(true)
    setError('')
    setWaitTimeSuccess('')

    const val = waitTimeInput.trim()
    const { error: upsertErr } = await supabase.from('site_settings').upsert({
      key: 'estimated_wait_time',
      value: val,
      updated_at: new Date().toISOString(),
    })

    setWaitTimeSaving(false)
    if (upsertErr) {
      setError('No se pudo guardar el tiempo de espera: ' + upsertErr.message)
    } else {
      setWaitTimeSuccess('¡Tiempo estimado guardado con éxito!')
      void revalidatePublicContent(['settings'])
      onRefresh()
      setTimeout(() => setWaitTimeSuccess(''), 4000)
    }
  }

  return (
    <div className="tab-pane settings-tab-pane">
      <h2>Ajustes y Personalización del Sitio</h2>
      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, marginTop: 20, alignItems: 'start' }}>
        {/* Nombre del sitio */}
        <div className="card" style={{ padding: 24, background: 'var(--surface-card)', borderRadius: 16, border: '1px solid var(--border)' }}>
          <h3>Nombre del Sitio</h3>
          {siteNameSuccess && <div className="alert alert-success" style={{ marginBottom: 12 }}>{siteNameSuccess}</div>}
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 8 }}>
            Nombre visible en la pestaña del navegador, el encabezado público y los reportes de impresión (1 a 60 caracteres).
          </p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 14 }}>
            Nombre actual: <strong>{siteName}</strong>
          </p>

          <form onSubmit={saveSiteName} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Nombre comercial</label>
              <input
                type="text"
                className="input"
                maxLength={60}
                value={siteNameInput}
                onChange={(e) => setSiteNameInput(e.target.value)}
                placeholder="Yarumo Coffee"
                required
              />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="submit" className="btn btn-primary" disabled={siteNameSaving}>
                {siteNameSaving ? 'Guardando...' : 'Guardar Nombre'}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                disabled={siteNameSaving}
                onClick={resetSiteName}
                title="Restablecer a 'Yarumo Coffee'"
              >
                Restablecer por defecto
              </button>
            </div>
          </form>
        </div>

        {/* Ícono del sitio */}
        <div className="card" style={{ padding: 24, background: 'var(--surface-card)', borderRadius: 16, border: '1px solid var(--border)' }}>
          <h3>Ícono del Sitio (Favicon y PWA)</h3>
          {iconSuccess && <div className="alert alert-success" style={{ marginBottom: 12 }}>{iconSuccess}</div>}
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 14 }}>
            Imagen cuadrada de al menos 512x512 px (PNG, JPG, WebP, máx 5 MB). Se redimensionará automáticamente a 512, 192, 180 y 32 px.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            <div style={{ position: 'relative', width: 64, height: 64, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface-muted)' }}>
              <Image
                src={iconPreviewUrl || siteIcons['192'] || siteIcons['512']}
                alt="Vista previa de ícono"
                fill
                sizes="64px"
                style={{ objectFit: 'contain' }}
              />
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <div>{iconPreviewUrl ? '⭐ Vista previa lista para guardar' : 'Ícono actual en producción'}</div>
              <small>Utilizado para favicon, app móvil instalable y encabezados.</small>
            </div>
          </div>

          <form onSubmit={saveSiteIcon} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Subir imagen cuadrada</label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleIconFileChange}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="submit" className="btn btn-primary" disabled={iconSaving || !iconFile}>
                {iconSaving ? 'Procesando y Subiendo...' : 'Guardar Ícono'}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                disabled={iconSaving}
                onClick={resetSiteIcon}
                title="Restablecer íconos originales del sitio"
              >
                Restablecer por defecto
              </button>
            </div>
          </form>
        </div>

        {/* Foto de portada */}
        <div className="card" style={{ padding: 24, background: 'var(--surface-card)', borderRadius: 16, border: '1px solid var(--border)' }}>
          <h3>Foto de Portada del Menú (Hero)</h3>
          {heroSuccess && <div className="alert alert-success" style={{ marginBottom: 12 }}>{heroSuccess}</div>}

          {heroImageUrl && (
            <div style={{ position: 'relative', width: '100%', height: 180, borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
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
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 12 }}>
            Visible para los clientes al hacer sus pedidos en mesa o barra.
          </p>
          {waitTimeSuccess && <div className="alert alert-success" style={{ marginBottom: 12 }}>{waitTimeSuccess}</div>}
          <form onSubmit={saveWaitTime} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Tiempo estimado (ej: 15–20 min)</label>
              <input
                name="waitTime"
                type="text"
                value={waitTimeInput}
                onChange={(e) => setWaitTimeInput(e.target.value)}
                placeholder="Ej: 15–20 min"
                className="input"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={waitTimeSaving}>
              {waitTimeSaving ? 'Guardando...' : 'Guardar Tiempo'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
