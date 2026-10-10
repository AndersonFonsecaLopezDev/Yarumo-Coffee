'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { Promotion, MenuItem, PromotionForm } from '../types'
import { createClient } from '@/lib/supabase/client'
import { revalidatePublicContent } from '@/app/actions/revalidate'

type PromotionsTabProps = {
  promotions: Promotion[]
  items: MenuItem[]
  onRefresh: () => void
}

function toLocalDatetimeInput(isoString?: string | null) {
  if (!isoString) return ''
  const date = new Date(isoString)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const blankPromotionForm: PromotionForm = {
  title: '',
  description: '',
  badge_text: '',
  image_url: '',
  linked_menu_item_id: '',
  starts_at: '',
  ends_at: '',
  active: true,
  sort_order: 0,
}

export default function PromotionsTab({
  promotions,
  items,
  onRefresh,
}: PromotionsTabProps) {
  const [supabase] = useState(() => createClient())
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null)
  const [form, setForm] = useState<PromotionForm>({
    ...blankPromotionForm,
    starts_at: toLocalDatetimeInput(new Date().toISOString()),
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function editPromo(promo: Promotion) {
    setEditingPromotion(promo)
    setImageFile(null)
    setForm({
      title: promo.title,
      description: promo.description || '',
      badge_text: promo.badge_text || '',
      image_url: promo.image_url || '',
      linked_menu_item_id: promo.linked_menu_item_id || '',
      starts_at: toLocalDatetimeInput(promo.starts_at),
      ends_at: toLocalDatetimeInput(promo.ends_at),
      active: promo.active,
      sort_order: promo.sort_order,
    })
  }

  function newPromo() {
    setEditingPromotion(null)
    setImageFile(null)
    setForm({
      ...blankPromotionForm,
      starts_at: toLocalDatetimeInput(new Date().toISOString()),
    })
  }

  async function savePromotion(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) {
      setError('El título de la promoción es obligatorio.')
      return
    }
    setError('')
    setSaving(true)

    let imageUrl = form.image_url.trim() || null

    if (imageFile) {
      if (!imageFile.type.startsWith('image/') || imageFile.size > 5 * 1024 * 1024) {
        setSaving(false)
        setError('Las imágenes deben ser JPG, PNG o WebP y pesar máximo 5 MB.')
        return
      }
      const extension = imageFile.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `promo-${crypto.randomUUID()}.${extension}`
      const upload = await supabase.storage
        .from('menu-images')
        .upload(path, imageFile, { cacheControl: '31536000', contentType: imageFile.type, upsert: false })
      if (upload.error) {
        setSaving(false)
        setError('No se pudo cargar la imagen de la promoción: ' + upload.error.message)
        return
      }
      imageUrl = supabase.storage.from('menu-images').getPublicUrl(path).data.publicUrl
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      badge_text: form.badge_text.trim() || null,
      image_url: imageUrl,
      linked_menu_item_id: form.linked_menu_item_id || null,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : new Date().toISOString(),
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      active: form.active,
      sort_order: Number(form.sort_order) || 0,
    }

    const res = editingPromotion
      ? await supabase.from('promotions').update(payload).eq('id', editingPromotion.id)
      : await supabase.from('promotions').insert(payload)

    setSaving(false)
    if (res.error) {
      setError('No se pudo guardar la promoción: ' + res.error.message)
      return
    }
    newPromo()
    void revalidatePublicContent(['promotions'])
    onRefresh()
  }

  async function removePromotion(promo: Promotion) {
    if (!confirm(`¿Eliminar la promoción "${promo.title}"?`)) return
    await supabase.from('promotions').delete().eq('id', promo.id)
    void revalidatePublicContent(['promotions'])
    onRefresh()
  }

  return (
    <div className="tab-pane">
      <div className="section-header">
        <div>
          <h2>Promociones y Destacados</h2>
          <p>Configura ofertas vigentes que se muestran en el carrusel de la carta.</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, marginTop: 20 }}>
        {/* Formulario */}
        <form onSubmit={savePromotion} className="card" style={{ padding: 22, background: 'var(--surface-card)', borderRadius: 16, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3>{editingPromotion ? 'Editar Promoción' : 'Nueva Promoción'}</h3>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Título *</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="input"
              placeholder="Ej: 2x1 en Cappuccino"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Texto del Badge</label>
            <input
              type="text"
              value={form.badge_text}
              onChange={(e) => setForm({ ...form, badge_text: e.target.value })}
              className="input"
              placeholder="Ej: PROMO DE LA TARDE"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Descripción</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input"
              placeholder="Válido de 3pm a 6pm"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Fecha de Inicio</label>
              <input
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Fecha de Fin (Opcional)</label>
              <input
                type="datetime-local"
                value={form.ends_at}
                onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                className="input"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Producto Vinculado</label>
              <select
                value={form.linked_menu_item_id}
                onChange={(e) => {
                  const linkedId = e.target.value
                  const linkedItem = items.find((it) => it.id === linkedId)
                  setForm({
                    ...form,
                    linked_menu_item_id: linkedId,
                    // Si no tiene imagen propia y el producto tiene imagen, sugerirla
                    image_url: form.image_url || linkedItem?.image_url || '',
                  })
                }}
                className="input"
              >
                <option value="">-- Ninguno (solo informativo) --</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name} (${it.price_cop.toLocaleString('es-CO')})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Orden en Carrusel</label>
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
                className="input"
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Imagen de la Promoción (Archivo o URL)</label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              />
              {form.linked_menu_item_id && (() => {
                const linked = items.find((it) => it.id === form.linked_menu_item_id)
                if (linked?.image_url && linked.image_url !== form.image_url) {
                  return (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={() => setForm({ ...form, image_url: linked.image_url || '' })}
                    >
                      Usar foto de {linked.name}
                    </button>
                  )
                }
                return null
              })()}
              {form.image_url && (
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={() => {
                    setForm({ ...form, image_url: '' })
                    setImageFile(null)
                  }}
                >
                  Quitar foto
                </button>
              )}
            </div>
            {form.image_url && !imageFile && (
              <div style={{ position: 'relative', width: 72, height: 72, borderRadius: 10, overflow: 'hidden', marginTop: 8 }}>
                <Image
                  src={form.image_url}
                  alt={form.title || 'Foto de promoción'}
                  fill
                  sizes="72px"
                  style={{ objectFit: 'cover' }}
                />
              </div>
            )}
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Promoción activa y visible en la carta
          </label>

          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : editingPromotion ? 'Actualizar' : 'Crear Promoción'}
            </button>
            {editingPromotion && (
              <button type="button" className="btn btn-outline" onClick={newPromo}>
                Cancelar
              </button>
            )}
          </div>
        </form>

        {/* Lista */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {promotions.map((promo) => (
            <div
              key={promo.id}
              className="card"
              style={{ padding: 18, background: 'var(--surface-card)', borderRadius: 14, border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <strong>{promo.title}</strong>
                  {promo.badge_text && <span className="badge">{promo.badge_text}</span>}
                  <span className={`status-pill ${promo.active ? 'status-delivered' : 'status-cancelled'}`}>
                    {promo.active ? 'Activa' : 'Pausada'}
                  </span>
                </div>
                {promo.description && <p style={{ margin: '6px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{promo.description}</p>}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => editPromo(promo)}>
                  Editar
                </button>
                <button type="button" className="btn btn-sm btn-danger" onClick={() => removePromotion(promo)}>
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
