'use client'

import { useState } from 'react'
import type { MenuCategory, CategoryForm } from '../types'
import { createClient } from '@/lib/supabase/client'
import { revalidatePublicContent } from '@/app/actions/revalidate'
import { useConfirm } from '@/components/ConfirmModal'

type CategoriesTabProps = {
  categories: MenuCategory[]
  onRefresh: () => void
}

const blankCategoryForm: CategoryForm = {
  name: '',
  name_en: '',
  slug: '',
  icon: '☕',
  sort_order: 0,
  active: true,
}

export default function CategoriesTab({
  categories,
  onRefresh,
}: CategoriesTabProps) {
  const [supabase] = useState(() => createClient())
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null)
  const [form, setForm] = useState<CategoryForm>(blankCategoryForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function editCategory(cat: MenuCategory) {
    setEditingCategory(cat)
    setForm({
      name: cat.name,
      name_en: cat.name_en || '',
      slug: cat.slug || '',
      icon: cat.icon || '☕',
      sort_order: cat.sort_order || 0,
      active: cat.active,
    })
  }

  function newCat() {
    setEditingCategory(null)
    setForm(blankCategoryForm)
  }

  async function saveCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('El nombre de la categoría es obligatorio.')
      return
    }
    setError('')
    setSaving(true)

    const rawSlug = form.slug.trim() || form.name.trim()
    const slug = rawSlug
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

    const payload = {
      name: form.name.trim(),
      name_en: form.name_en?.trim() || null,
      slug,
      icon: form.icon.trim() || '☕',
      sort_order: Number(form.sort_order) || 0,
      active: form.active,
    }

    const res = editingCategory
      ? await supabase.from('menu_categories').update(payload).eq('id', editingCategory.id)
      : await supabase.from('menu_categories').insert(payload)

    setSaving(false)
    if (res.error) {
      setError('No se pudo guardar la categoría: ' + res.error.message)
      return
    }
    newCat()
    void revalidatePublicContent(['categories'])
    onRefresh()
  }

  const { confirm, ConfirmDialog } = useConfirm()

  async function removeCategory(cat: MenuCategory) {
    const ok = await confirm({
      title: '¿Eliminar categoría?',
      message: `¿Estás seguro de que deseas eliminar la categoría "${cat.name}"?`,
      confirmText: 'Eliminar',
      danger: true,
    })
    if (!ok) return
    await supabase.from('menu_categories').delete().eq('id', cat.id)
    void revalidatePublicContent(['categories'])
    onRefresh()
  }

  return (
    <div className="tab-pane">
      <div className="section-header">
        <div>
          <h2>Categorías del Menú</h2>
          <p>Organiza las secciones de la carta digital.</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="staff-two-column-layout">
        {/* Formulario */}
        <form onSubmit={saveCategory} className="card menu-form-sticky" style={{ padding: 22, background: 'var(--surface-card)', borderRadius: 16, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12, alignSelf: 'start' }}>
          <h3>{editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}</h3>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Nombre *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
              placeholder="Ej: Cafés Filtrados"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Nombre en inglés (opcional)</label>
            <input
              type="text"
              value={form.name_en || ''}
              onChange={(e) => setForm({ ...form, name_en: e.target.value })}
              className="input"
              placeholder="Ej: Filtered Coffees"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Ícono (Emoji)</label>
            <input
              type="text"
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
              className="input"
              placeholder="☕"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Slug (Identificador URL)</label>
            <input
              type="text"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              className="input"
              placeholder="cafes-filtrados"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Orden</label>
            <input
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
              className="input"
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Categoría activa
          </label>

          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : editingCategory ? 'Actualizar' : 'Crear'}
            </button>
            {editingCategory && (
              <button type="button" className="btn btn-outline" onClick={newCat}>
                Cancelar
              </button>
            )}
          </div>
        </form>

        {/* Lista */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="card"
              style={{ padding: 16, background: 'var(--surface-card)', borderRadius: 14, border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.4rem' }}>{cat.icon}</span>
                <div>
                  <strong>{cat.name}</strong>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Orden: {cat.sort_order} · {cat.active ? 'Activa' : 'Inactiva'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => editCategory(cat)}>
                  Editar
                </button>
                <button type="button" className="btn btn-sm btn-danger" onClick={() => removeCategory(cat)}>
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <ConfirmDialog />
    </div>
  )
}
