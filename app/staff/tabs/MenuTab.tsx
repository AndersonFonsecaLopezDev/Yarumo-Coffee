'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { MenuItem, MenuCategory, MenuForm } from '../types'
import { createClient } from '@/lib/supabase/client'
import { revalidatePublicContent } from '@/app/actions/revalidate'
import PrintMenuModal from './PrintMenuModal'

type MenuTabProps = {
  items: MenuItem[]
  categories: MenuCategory[]
  onRefresh: () => void
}

const blankMenuForm: MenuForm = {
  name: '',
  slug: '',
  description: '',
  price_cop: 0,
  category: 'Bebidas Calientes',
  available: true,
  sort_order: 0,
  image_url: '',
  gallery_urls: '',
}

export default function MenuTab({
  items,
  categories,
  onRefresh,
}: MenuTabProps) {
  const [supabase] = useState(() => createClient())
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [form, setForm] = useState<MenuForm>(() => ({
    ...blankMenuForm,
    category: categories[0]?.name || 'Bebidas Calientes',
    category_id: categories[0]?.id || undefined,
  }))
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [filterQuery, setFilterQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('Todas')
  const [showPrintModal, setShowPrintModal] = useState(false)

  function editItem(item: MenuItem) {
    setEditing(item)
    setImageFile(null)
    setForm({
      name: item.name,
      slug: item.slug || '',
      description: item.description || '',
      price_cop: item.price_cop || 0,
      category: item.category || (categories[0]?.name || 'Bebidas Calientes'),
      category_id: item.category_id || categories.find((c) => c.name === item.category)?.id || undefined,
      available: item.available,
      sort_order: item.sort_order || 0,
      image_url: item.image_url || '',
      gallery_urls: (item.gallery_urls || []).join('\n'),
    })
  }

  function newItem() {
    setEditing(null)
    setForm({
      ...blankMenuForm,
      category: categories[0]?.name || 'Bebidas Calientes',
      category_id: categories[0]?.id || undefined,
    })
    setImageFile(null)
  }

  async function saveItem(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || form.price_cop < 0) {
      setError('Completa un nombre y un precio válido.')
      return
    }
    setSaving(true)
    setError('')
    let imageUrl = form.image_url.trim() || null

    if (imageFile) {
      if (!imageFile.type.startsWith('image/') || imageFile.size > 5 * 1024 * 1024) {
        setSaving(false)
        setError('Las imágenes deben ser JPG, PNG o WebP y pesar máximo 5 MB.')
        return
      }
      const extension = imageFile.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${crypto.randomUUID()}.${extension}`
      const upload = await supabase.storage
        .from('menu-images')
        .upload(path, imageFile, { cacheControl: '31536000', contentType: imageFile.type, upsert: false })
      if (upload.error) {
        setSaving(false)
        setError('No se pudo cargar la imagen. Verifica el bucket menu-images en Supabase.')
        return
      }
      imageUrl = supabase.storage.from('menu-images').getPublicUrl(path).data.publicUrl
    }

    const matchedCategory = categories.find(
      (c) => c.id === form.category_id || c.name === form.category,
    ) || categories[0]

    const payload = {
      name: form.name.trim(),
      slug:
        form.slug.trim() ||
        form.name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, ''),
      description: form.description.trim(),
      price_cop: Number(form.price_cop),
      category: matchedCategory?.name || form.category,
      category_id: matchedCategory?.id || null,
      available: form.available,
      sort_order: Number(form.sort_order) || 0,
      image_url: imageUrl,
      gallery_urls: form.gallery_urls
        .split('\n')
        .map((u) => u.trim())
        .filter(Boolean),
    }

    const result = editing
      ? await supabase.from('menu_items').update(payload).eq('id', editing.id)
      : await supabase.from('menu_items').insert(payload)

    setSaving(false)
    if (result.error) {
      setError('No se pudo guardar el producto: ' + result.error.message)
      return
    }
    newItem()
    void revalidatePublicContent(['menu'])
    onRefresh()
  }

  async function removeItem(item: MenuItem) {
    if (!confirm(`¿Eliminar definitivamente ${item.name}?`)) return
    const { error: delError } = await supabase.from('menu_items').delete().eq('id', item.id)
    if (delError) setError('Error al eliminar: ' + delError.message)
    else {
      void revalidatePublicContent(['menu'])
      onRefresh()
    }
  }

  const filteredItems = items.filter((it) => {
    if (filterCategory !== 'Todas' && it.category !== filterCategory) return false
    if (filterQuery && !it.name.toLowerCase().includes(filterQuery.toLowerCase())) return false
    return true
  })

  return (
    <div className="tab-pane">
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <h2>Productos del Menú</h2>
          <p>Gestiona los platos, bebidas y postres de la carta.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setShowPrintModal(true)}
          id="btn-open-print-menu"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <span>🖨️</span>
          <span>Imprimir Carta (Horizontal)</span>
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, marginTop: 20 }}>
        {/* Formulario */}
        <form onSubmit={saveItem} className="card" style={{ padding: 22, background: 'var(--surface-card)', borderRadius: 16, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3>{editing ? 'Editar Producto' : 'Nuevo Producto'}</h3>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Nombre *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
              placeholder="Ej: Cappuccino Yarumo"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 0.8fr', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Precio COP *</label>
              <input
                type="number"
                min="0"
                required
                value={form.price_cop || ''}
                onChange={(e) => setForm({ ...form, price_cop: Number(e.target.value) })}
                className="input"
                placeholder="12000"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Categoría</label>
              <select
                value={form.category_id || ''}
                onChange={(e) => {
                  const cat = categories.find((c) => c.id === e.target.value)
                  setForm({
                    ...form,
                    category_id: e.target.value,
                    category: cat?.name || form.category,
                  })
                }}
                className="input"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Orden</label>
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
                className="input"
                placeholder="0"
                title="Número para ordenar dentro de la categoría"
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Descripción</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input"
              placeholder="Notas de sabor, preparación..."
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Foto Principal (Archivo o URL)</label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              />
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
              <div style={{ position: 'relative', width: 64, height: 64, borderRadius: 8, overflow: 'hidden', marginTop: 8 }}>
                <Image
                  src={form.image_url}
                  alt={form.name}
                  fill
                  sizes="64px"
                  style={{ objectFit: 'cover' }}
                />
              </div>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Fotos adicionales de galería (URLs opcionales, una por línea)</label>
            <textarea
              rows={2}
              value={form.gallery_urls}
              onChange={(e) => setForm({ ...form, gallery_urls: e.target.value })}
              className="input"
              placeholder="https://.../foto2.webp&#10;https://.../foto3.webp"
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
            <input
              type="checkbox"
              checked={form.available}
              onChange={(e) => setForm({ ...form, available: e.target.checked })}
            />
            Producto disponible para pedidos
          </label>

          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Crear Producto'}
            </button>
            {editing && (
              <button type="button" className="btn btn-outline" onClick={newItem}>
                Cancelar
              </button>
            )}
          </div>
        </form>

        {/* Lista con filtro */}
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <input
              type="search"
              placeholder="Filtrar por nombre..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="input"
              style={{ flex: 1 }}
            />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="input"
            >
              <option value="Todas">Todas</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 600, overflowY: 'auto' }}>
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="card"
                style={{ padding: 14, background: 'var(--surface-card)', borderRadius: 12, border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {item.image_url ? (
                    <div style={{ position: 'relative', width: 48, height: 48, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                      <Image
                        src={item.image_url}
                        alt={item.name}
                        fill
                        sizes="48px"
                        style={{ objectFit: 'cover' }}
                      />
                    </div>
                  ) : (
                    <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--skeleton-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      ☕
                    </div>
                  )}
                  <div>
                    <strong>{item.name}</strong>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      ${item.price_cop.toLocaleString('es-CO')} · {item.category} · {item.available ? 'Disponible' : 'Agotado'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => editItem(item)}>
                    Editar
                  </button>
                  <button type="button" className="btn btn-sm btn-danger" onClick={() => removeItem(item)}>
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showPrintModal && (
        <PrintMenuModal
          items={items}
          categories={categories}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </div>
  )
}
