'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import type { MenuItem, MenuCategory, MenuForm } from '../types'
import { createClient } from '@/lib/supabase/client'
import { revalidatePublicContent } from '@/app/actions/revalidate'
import { normalizeText, useUrlFilters, useDebouncedValue } from '@/lib/filters'
import PrintMenuModal from './PrintMenuModal'
import MenuItemOptionsModal from './MenuItemOptionsModal'
import { useConfirm } from '@/components/ConfirmModal'
import { SearchIcon } from '@/components/icons/CategoryIcons'

type MenuTabProps = {
  items: MenuItem[]
  categories: MenuCategory[]
  onRefresh: () => void
}

const blankMenuForm: MenuForm = {
  name: '',
  name_en: '',
  slug: '',
  description: '',
  description_en: '',
  price_cop: 0,
  category: 'Bebidas Calientes',
  available: true,
  sort_order: 0,
  image_url: '',
  gallery_urls: '',
  tags: '',
}

const defaultFilters = {
  q: '',
  cat: 'all',
  avail: 'all', // 'all' | 'available' | 'sold_out'
  photo: 'all', // 'all' | 'with_photo' | 'without_photo'
  min_p: '',
  max_p: '',
  sort: 'sort_order', // 'sort_order' | 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc'
  view: 'cards', // 'cards' | 'table'
}

export default function MenuTab({
  items,
  categories,
  onRefresh,
}: MenuTabProps) {
  const [supabase] = useState(() => createClient())
  const { confirm, ConfirmDialog } = useConfirm()
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [form, setForm] = useState<MenuForm>(() => ({
    ...blankMenuForm,
    category: categories[0]?.name || 'Bebidas Calientes',
    category_id: categories[0]?.id || undefined,
  }))
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [optionsModalItem, setOptionsModalItem] = useState<MenuItem | null>(null)
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 15

  // Selección múltiple para acciones en lote
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [bulkPercent, setBulkPercent] = useState('')
  const [showBulkPriceModal, setShowBulkPriceModal] = useState(false)
  const [showBulkCategoryModal, setShowBulkCategoryModal] = useState(false)
  const [targetBulkCategory, setTargetBulkCategory] = useState(categories[0]?.id || '')

  // Filtros persistidos en URL
  const {
    filters,
    setFilter,
    resetFilters,
    hasActiveFilters,
  } = useUrlFilters('menu', defaultFilters)

  // Búsqueda con debounce
  const debouncedQuery = useDebouncedValue(filters.q, 200)

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
      tags: (item.tags || []).join(', '),
      name_en: item.name_en || '',
      description_en: item.description_en || '',
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
      name_en: form.name_en?.trim() || null,
      slug:
        form.slug.trim() ||
        form.name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, ''),
      description: form.description.trim(),
      description_en: form.description_en?.trim() || null,
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
      tags: (form.tags || '')
        .split(',')
        .map((t) => t.trim())
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
    const ok = await confirm({
      title: '¿Eliminar producto?',
      message: `¿Estás seguro de que deseas eliminar permanentemente el producto "${item.name}"?`,
      confirmText: 'Eliminar producto',
      danger: true,
    })
    if (!ok) return
    const { error: delError } = await supabase.from('menu_items').delete().eq('id', item.id)
    if (delError) setError('Error al eliminar: ' + delError.message)
    else {
      void revalidatePublicContent(['menu'])
      onRefresh()
    }
  }

  // Alternar disponibilidad rápida ("Agotado hoy / Disponible")
  async function toggleAvailability(item: MenuItem) {
    const nextState = !item.available
    const { error: updErr } = await supabase
      .from('menu_items')
      .update({ available: nextState })
      .eq('id', item.id)

    if (updErr) {
      setError('Error al actualizar disponibilidad: ' + updErr.message)
    } else {
      void revalidatePublicContent(['menu'])
      onRefresh()
    }
  }

  // Filtrado y ordenación
  const filteredItems = useMemo(() => {
    const normQuery = normalizeText(debouncedQuery)
    const minPrice = filters.min_p ? Number(filters.min_p) : null
    const maxPrice = filters.max_p ? Number(filters.max_p) : null

    return items
      .filter((it) => {
        // 1. Categoría por category_id
        if (filters.cat !== 'all') {
          const matchId = it.category_id ? it.category_id === filters.cat : it.category === categories.find((c) => c.id === filters.cat)?.name
          if (!matchId) return false
        }

        // 2. Búsqueda por nombre o descripción sin tildes
        if (normQuery) {
          const nameNorm = normalizeText(it.name)
          const descNorm = normalizeText(it.description)
          if (!nameNorm.includes(normQuery) && !descNorm.includes(normQuery)) {
            return false
          }
        }

        // 3. Disponibilidad
        if (filters.avail === 'available' && !it.available) return false
        if (filters.avail === 'sold_out' && it.available) return false

        // 4. Con foto / sin foto
        if (filters.photo === 'with_photo' && !it.image_url) return false
        if (filters.photo === 'without_photo' && it.image_url) return false

        // 5. Rango de precio
        if (minPrice !== null && it.price_cop < minPrice) return false
        if (maxPrice !== null && it.price_cop > maxPrice) return false

        return true
      })
      .sort((a, b) => {
        switch (filters.sort) {
          case 'name_asc':
            return a.name.localeCompare(b.name, 'es')
          case 'name_desc':
            return b.name.localeCompare(a.name, 'es')
          case 'price_asc':
            return a.price_cop - b.price_cop
          case 'price_desc':
            return b.price_cop - a.price_cop
          case 'category':
            return (a.category || '').localeCompare(b.category || '', 'es')
          case 'sort_order':
          default:
            return (a.sort_order || 0) - (b.sort_order || 0) || a.name.localeCompare(b.name, 'es')
        }
      })
  }, [items, debouncedQuery, filters.cat, filters.avail, filters.photo, filters.min_p, filters.max_p, filters.sort, categories])

  // Paginación
  const totalPages = Math.ceil(filteredItems.length / PAGE_SIZE) || 1
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredItems.slice(start, start + PAGE_SIZE)
  }, [filteredItems, currentPage])

  // Manejo de Selección Múltiple
  const allFilteredSelected = filteredItems.length > 0 && filteredItems.every((it) => selectedIds.includes(it.id))

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredItems.map((it) => it.id))
    }
  }

  function toggleSelectItem(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  // Acciones en Lote
  async function handleBulkAvailability(available: boolean) {
    if (selectedIds.length === 0) return
    setBulkActionLoading(true)
    const { error: bulkErr } = await supabase
      .from('menu_items')
      .update({ available })
      .in('id', selectedIds)

    setBulkActionLoading(false)
    if (bulkErr) setError('Error al actualizar en lote: ' + bulkErr.message)
    else {
      setSelectedIds([])
      void revalidatePublicContent(['menu'])
      onRefresh()
    }
  }

  async function handleBulkCategorySubmit() {
    if (!targetBulkCategory || selectedIds.length === 0) return
    setBulkActionLoading(true)
    const cat = categories.find((c) => c.id === targetBulkCategory)
    const { error: bulkErr } = await supabase
      .from('menu_items')
      .update({
        category_id: targetBulkCategory,
        category: cat?.name || 'General',
      })
      .in('id', selectedIds)

    setBulkActionLoading(false)
    setShowBulkCategoryModal(false)
    if (bulkErr) setError('Error al cambiar categoría: ' + bulkErr.message)
    else {
      setSelectedIds([])
      void revalidatePublicContent(['menu'])
      onRefresh()
    }
  }

  async function handleBulkPriceAdjustSubmit() {
    const percent = parseFloat(bulkPercent)
    if (Number.isNaN(percent) || selectedIds.length === 0) return

    const ok = await confirm({
      title: '¿Ajustar precios en lote?',
      message: `¿Confirmas ajustar el precio de ${selectedIds.length} productos seleccionados en un ${percent > 0 ? '+' : ''}${percent}%?`,
      confirmText: 'Aplicar ajuste',
    })
    if (!ok) return

    setBulkActionLoading(true)
    const itemsToUpdate = items.filter((it) => selectedIds.includes(it.id))
    const updates = itemsToUpdate.map((it) => {
      const multiplier = 1 + percent / 100
      // Redondear a centenas más cercanas en COP (ej. 100 COP)
      const newPrice = Math.max(0, Math.round((it.price_cop * multiplier) / 100) * 100)
      return supabase.from('menu_items').update({ price_cop: newPrice }).eq('id', it.id)
    })

    await Promise.all(updates)
    setBulkActionLoading(false)
    setShowBulkPriceModal(false)
    setBulkPercent('')
    setSelectedIds([])
    void revalidatePublicContent(['menu'])
    onRefresh()
  }

  return (
    <div className="tab-pane">
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <h2>Productos del Menú</h2>
          <p>Gestiona los platos, bebidas y postres de la carta con filtros y acciones masivas.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowPrintModal(true)}
            id="btn-open-print-menu"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <span>🖨️</span>
            <span>Imprimir Carta</span>
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, marginTop: 20 }}>
        {/* Formulario de Creación / Edición */}
        <form onSubmit={saveItem} className="card" style={{ padding: 22, background: 'var(--surface-card)', borderRadius: 16, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3>{editing ? 'Editar Producto' : 'Nuevo Producto'}</h3>

          <div>
            <label htmlFor="menu-name" style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Nombre *</label>
            <input
              id="menu-name"
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
              placeholder="Ej: Cappuccino Yarumo"
            />
          </div>

          <div>
            <label htmlFor="menu-name-en" style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>
              Nombre en inglés (opcional)
            </label>
            <input
              id="menu-name-en"
              type="text"
              value={form.name_en || ''}
              onChange={(e) => setForm({ ...form, name_en: e.target.value })}
              className="input"
              placeholder="Ej: Yarumo Cappuccino"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 0.8fr', gap: 10 }}>
            <div>
              <label htmlFor="menu-price" style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Precio COP *</label>
              <input
                id="menu-price"
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
              <label htmlFor="menu-cat" style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Categoría</label>
              <select
                id="menu-cat"
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
              <label htmlFor="menu-sort" style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Orden</label>
              <input
                id="menu-sort"
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
            <label htmlFor="menu-desc" style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Descripción</label>
            <textarea
              id="menu-desc"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input"
              placeholder="Notas de sabor, preparación..."
            />
          </div>

          <div>
            <label htmlFor="menu-desc-en" style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>
              Descripción en inglés (opcional)
            </label>
            <textarea
              id="menu-desc-en"
              rows={2}
              value={form.description_en || ''}
              onChange={(e) => setForm({ ...form, description_en: e.target.value })}
              className="input"
              placeholder="Flavor notes, brewing method..."
            />
          </div>

          <div>
            <label htmlFor="menu-image" style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Foto Principal (Archivo o URL)</label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                id="menu-image"
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                className="input input-sm"
                style={{ flex: 1 }}
              />
              <input
                type="url"
                placeholder="https://... o sube archivo"
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                className="input input-sm"
                style={{ flex: 1 }}
              />
            </div>
          </div>

          <div>
            <label htmlFor="menu-tags" style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Etiquetas (separadas por coma)</label>
            <input
              id="menu-tags"
              type="text"
              placeholder="Ej: Nuevo, Vegano, Recomendado del barista"
              value={form.tags || ''}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              className="input"
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

        {/* Panel de Catálogo con Filtros Avanzados */}
        <div>
          <div className="staff-filter-card">
            <div className="filter-main-row">
              <div className="filter-input-wrap">
                <span className="filter-search-icon" aria-hidden="true"><SearchIcon size={16} /></span>
                <input
                  type="search"
                  id="menu-search-input"
                  placeholder="Buscar por nombre o descripción..."
                  value={filters.q}
                  onChange={(e) => {
                    setFilter('q', e.target.value)
                    setCurrentPage(1)
                  }}
                  className="filter-control-input"
                />
              </div>

              <select
                id="menu-category-select"
                value={filters.cat}
                onChange={(e) => {
                  setFilter('cat', e.target.value)
                  setCurrentPage(1)
                }}
                className="filter-control-select"
                style={{ minWidth: 155 }}
              >
                <option value="all">Todas las categorías</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                id="menu-availability-select"
                value={filters.avail}
                onChange={(e) => {
                  setFilter('avail', e.target.value)
                  setCurrentPage(1)
                }}
                className="filter-control-select"
                style={{ minWidth: 145 }}
              >
                <option value="all">Todos los estados</option>
                <option value="available">Solo disponibles</option>
                <option value="sold_out">Solo agotados</option>
              </select>

              <select
                id="menu-sort-select"
                value={filters.sort}
                onChange={(e) => setFilter('sort', e.target.value)}
                className="filter-control-select"
                style={{ minWidth: 145 }}
              >
                <option value="sort_order">Orden de carta</option>
                <option value="name_asc">Nombre (A-Z)</option>
                <option value="name_desc">Nombre (Z-A)</option>
                <option value="price_asc">Menor precio</option>
                <option value="price_desc">Mayor precio</option>
                <option value="category">Por categoría</option>
              </select>

              <div className="segmented-type-control" role="group" aria-label="Cambiar vista">
                <button
                  type="button"
                  className={`segmented-btn ${filters.view === 'cards' ? 'active' : ''}`}
                  onClick={() => setFilter('view', 'cards')}
                  title="Vista en tarjetas"
                >
                  ▦ Tarjetas
                </button>
                <button
                  type="button"
                  className={`segmented-btn ${filters.view === 'table' ? 'active' : ''}`}
                  onClick={() => setFilter('view', 'table')}
                  title="Vista en tabla"
                >
                  ▤ Tabla
                </button>
              </div>
            </div>

            {/* Fila de Chips y Contador */}
            <div className="filter-chips-container">
              <span className="filter-count-badge" id="menu-counter">
                Mostrando {filteredItems.length} de {items.length} productos
              </span>

              {filters.q && (
                <span className="filter-chip">
                  <span>Texto: «{filters.q}»</span>
                  <button
                    type="button"
                    className="filter-chip-remove"
                    onClick={() => setFilter('q', '')}
                    aria-label="Quitar filtro de texto"
                  >
                    ✕
                  </button>
                </span>
              )}

              {filters.cat !== 'all' && (
                <span className="filter-chip">
                  <span>{categories.find((c) => c.id === filters.cat)?.name || 'Categoría'}</span>
                  <button
                    type="button"
                    className="filter-chip-remove"
                    onClick={() => setFilter('cat', 'all')}
                    aria-label="Quitar filtro de categoría"
                  >
                    ✕
                  </button>
                </span>
              )}

              {filters.avail !== 'all' && (
                <span className="filter-chip">
                  <span>{filters.avail === 'available' ? 'Disponibles' : 'Agotados'}</span>
                  <button
                    type="button"
                    className="filter-chip-remove"
                    onClick={() => setFilter('avail', 'all')}
                    aria-label="Quitar filtro de disponibilidad"
                  >
                    ✕
                  </button>
                </span>
              )}

              {filters.photo !== 'all' && (
                <span className="filter-chip">
                  <span>{filters.photo === 'with_photo' ? 'Con foto' : 'Sin foto'}</span>
                  <button
                    type="button"
                    className="filter-chip-remove"
                    onClick={() => setFilter('photo', 'all')}
                    aria-label="Quitar filtro de foto"
                  >
                    ✕
                  </button>
                </span>
              )}

              {hasActiveFilters && (
                <button
                  type="button"
                  className="btn-clear-filters"
                  onClick={resetFilters}
                  id="btn-clear-menu-filters"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>

          {/* Estado Vacío */}
          {filteredItems.length === 0 ? (
            <div
              className="card"
              style={{
                padding: 40,
                textAlign: 'center',
                background: 'var(--surface-card)',
                borderRadius: 14,
                border: '1px dashed var(--border)',
              }}
            >
              <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}>
                <SearchIcon size={40} />
              </div>
              <h3 style={{ margin: '0 0 8px' }}>No encontramos productos</h3>
              <p style={{ color: 'var(--text-muted)', margin: '0 0 16px', fontSize: '0.9rem' }}>
                Ningún ítem coincide con los criterios de búsqueda o filtros activos.
              </p>
              <button
                type="button"
                className="btn btn-outline"
                onClick={resetFilters}
              >
                Restablecer todos los filtros
              </button>
            </div>
          ) : filters.view === 'table' ? (
            /* Vista en Tabla */
            <div className="staff-table-container">
              <table className="staff-table">
                <thead>
                  <tr>
                    <th style={{ width: 40, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={toggleSelectAll}
                        aria-label="Seleccionar todos los productos filtrados"
                      />
                    </th>
                    <th style={{ width: 50 }}>Foto</th>
                    <th>Producto</th>
                    <th>Categoría</th>
                    <th>Precio</th>
                    <th>Estado</th>
                    <th>Orden</th>
                    <th style={{ textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map((item) => {
                    const isSelected = selectedIds.includes(item.id)
                    return (
                      <tr key={item.id} className={isSelected ? 'row-selected' : ''}>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectItem(item.id)}
                            aria-label={`Seleccionar ${item.name}`}
                          />
                        </td>
                        <td>
                          {item.image_url ? (
                            <div style={{ position: 'relative', width: 36, height: 36, borderRadius: 6, overflow: 'hidden' }}>
                              <Image src={item.image_url} alt={item.name} fill sizes="36px" style={{ objectFit: 'cover' }} />
                            </div>
                          ) : (
                            <div style={{ width: 36, height: 36, borderRadius: 6, background: 'var(--skeleton-base)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              ☕
                            </div>
                          )}
                        </td>
                        <td>
                          <strong>{item.name}</strong>
                          {item.description && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', maxWidth: 280, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {item.description}
                            </div>
                          )}
                        </td>
                        <td>{item.category}</td>
                        <td>
                          <strong>${item.price_cop.toLocaleString('es-CO')}</strong>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={`btn btn-sm ${item.available ? 'btn-outline' : 'btn-danger'}`}
                            onClick={() => toggleAvailability(item)}
                            title="Haz clic para alternar disponibilidad"
                          >
                            {item.available ? 'Disponible' : 'Agotado'}
                          </button>
                        </td>
                        <td>{item.sort_order}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline"
                              onClick={() => setOptionsModalItem(item)}
                              id={`btn-options-${item.id}`}
                              title="Configurar opciones y variantes"
                            >
                              ⚙ Variantes
                            </button>
                            <button type="button" className="btn btn-sm btn-outline" onClick={() => editItem(item)}>
                              Editar
                            </button>
                            <button type="button" className="btn btn-sm btn-danger" onClick={() => removeItem(item)}>
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* Vista en Tarjetas */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px', fontSize: '0.85rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAll}
                  />
                  <span>Seleccionar todos ({filteredItems.length})</span>
                </label>
              </div>

              {paginatedItems.map((item) => {
                const isSelected = selectedIds.includes(item.id)
                return (
                  <div
                    key={item.id}
                    className="card"
                    style={{
                      padding: 14,
                      background: isSelected ? 'rgba(24, 54, 47, 0.05)' : 'var(--surface-card)',
                      borderRadius: 12,
                      border: isSelected ? '1.5px solid var(--brand-dark, #18362f)' : '1px solid var(--border)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectItem(item.id)}
                        aria-label={`Seleccionar ${item.name}`}
                      />
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
                          ${item.price_cop.toLocaleString('es-CO')} · {item.category}
                        </div>
                        {item.description && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2, maxWidth: 360 }}>
                            {item.description}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        onClick={() => setOptionsModalItem(item)}
                        id={`btn-card-options-${item.id}`}
                        title="Configurar opciones y variantes"
                      >
                        ⚙ Variantes
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm ${item.available ? 'btn-outline' : 'btn-danger'}`}
                        onClick={() => toggleAvailability(item)}
                        title="Cambio rápido de disponibilidad"
                      >
                        {item.available ? 'Disponible' : 'Agotado hoy'}
                      </button>
                      <button type="button" className="btn btn-sm btn-outline" onClick={() => editItem(item)}>
                        Editar
                      </button>
                      <button type="button" className="btn btn-sm btn-danger" onClick={() => removeItem(item)}>
                        Eliminar
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Controles de Paginación */}
          {totalPages > 1 && (
            <div className="pagination-controls">
              <span>
                Página {currentPage} de {totalPages} ({filteredItems.length} ítems)
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  ← Anterior
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  Siguiente →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Barra Flotante de Acciones en Lote */}
      {selectedIds.length > 0 && (
        <div className="bulk-actions-floating-bar" role="region" aria-label="Acciones masivas">
          <div className="bulk-actions-summary">
            ✓ {selectedIds.length} producto{selectedIds.length > 1 ? 's' : ''} seleccionado{selectedIds.length > 1 ? 's' : ''}
          </div>
          <div className="bulk-actions-buttons">
            <button
              type="button"
              className="btn btn-sm btn-outline"
              style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)' }}
              disabled={bulkActionLoading}
              onClick={() => handleBulkAvailability(true)}
            >
              Marcar disponible
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)' }}
              disabled={bulkActionLoading}
              onClick={() => handleBulkAvailability(false)}
            >
              Marcar agotado
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)' }}
              disabled={bulkActionLoading}
              onClick={() => setShowBulkCategoryModal(true)}
            >
              Cambiar categoría
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)' }}
              disabled={bulkActionLoading}
              onClick={() => setShowBulkPriceModal(true)}
            >
              Ajustar precios %
            </button>
            <button
              type="button"
              className="btn btn-sm"
              style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}
              onClick={() => setSelectedIds([])}
            >
              Deseleccionar
            </button>
          </div>
        </div>
      )}

      {/* Modal Ajustar Precios en % */}
      {showBulkPriceModal && (
        <div className="bottom-sheet-backdrop" onClick={() => setShowBulkPriceModal(false)}>
          <div className="card" style={{ maxWidth: 440, width: '90%', padding: 24, background: 'var(--surface-card)', borderRadius: 16 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px' }}>Ajustar Precios en Lote</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 16px' }}>
              Se recalculará el precio de {selectedIds.length} productos seleccionados, redondeando a centenas (COP).
            </p>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 6 }}>
              Porcentaje de ajuste (+10 para subir 10%, -5 para bajar 5%):
            </label>
            <input
              type="number"
              step="0.5"
              placeholder="Ej: 10"
              value={bulkPercent}
              onChange={(e) => setBulkPercent(e.target.value)}
              className="input"
              style={{ width: '100%', marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-outline" onClick={() => setShowBulkPriceModal(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!bulkPercent || bulkActionLoading}
                onClick={handleBulkPriceAdjustSubmit}
              >
                {bulkActionLoading ? 'Aplicando...' : 'Aplicar cambio'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cambiar Categoría en Lote */}
      {showBulkCategoryModal && (
        <div className="bottom-sheet-backdrop" onClick={() => setShowBulkCategoryModal(false)}>
          <div className="card" style={{ maxWidth: 440, width: '90%', padding: 24, background: 'var(--surface-card)', borderRadius: 16 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px' }}>Mover a otra categoría</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 16px' }}>
              Se reasignarán los {selectedIds.length} productos seleccionados.
            </p>
            <select
              value={targetBulkCategory}
              onChange={(e) => setTargetBulkCategory(e.target.value)}
              className="input"
              style={{ width: '100%', marginBottom: 16 }}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-outline" onClick={() => setShowBulkCategoryModal(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={bulkActionLoading}
                onClick={handleBulkCategorySubmit}
              >
                {bulkActionLoading ? 'Guardando...' : 'Mover productos'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Sheet Móvil para Filtros */}
      {showMobileFilters && (
        <div className="bottom-sheet-backdrop" onClick={() => setShowMobileFilters(false)}>
          <div className="bottom-sheet-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Filtros del Catálogo</h3>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => setShowMobileFilters(false)}
              >
                ✕ Cerrar
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Categoría</label>
                <select
                  value={filters.cat}
                  onChange={(e) => setFilter('cat', e.target.value)}
                  className="input"
                  style={{ width: '100%' }}
                >
                  <option value="all">Todas las categorías</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Disponibilidad</label>
                <select
                  value={filters.avail}
                  onChange={(e) => setFilter('avail', e.target.value)}
                  className="input"
                  style={{ width: '100%' }}
                >
                  <option value="all">Todos</option>
                  <option value="available">Solo disponibles</option>
                  <option value="sold_out">Solo agotados</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Fotos</label>
                <select
                  value={filters.photo}
                  onChange={(e) => setFilter('photo', e.target.value)}
                  className="input"
                  style={{ width: '100%' }}
                >
                  <option value="all">Todas</option>
                  <option value="with_photo">Con foto</option>
                  <option value="without_photo">Sin foto</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Ordenar por</label>
                <select
                  value={filters.sort}
                  onChange={(e) => setFilter('sort', e.target.value)}
                  className="input"
                  style={{ width: '100%' }}
                >
                  <option value="sort_order">Orden de carta</option>
                  <option value="name_asc">Nombre (A-Z)</option>
                  <option value="name_desc">Nombre (Z-A)</option>
                  <option value="price_asc">Menor precio</option>
                  <option value="price_desc">Mayor precio</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={resetFilters}
                  style={{ flex: 1 }}
                >
                  Limpiar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setShowMobileFilters(false)}
                  style={{ flex: 1 }}
                >
                  Ver ({filteredItems.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Impresión */}
      {showPrintModal && (
        <PrintMenuModal
          items={items}
          categories={categories}
          onClose={() => setShowPrintModal(false)}
        />
      )}

      {/* Modal de Opciones y Variantes de Producto */}
      {optionsModalItem && (
        <MenuItemOptionsModal
          menuItemId={optionsModalItem.id}
          menuItemName={optionsModalItem.name}
          onClose={() => setOptionsModalItem(null)}
        />
      )}
      <ConfirmDialog />
    </div>
  )
}
