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
import MenuItemForm from './menu/MenuItemForm'
import MenuFilters from './menu/MenuFilters'
import MenuBulkActions from './menu/MenuBulkActions'

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

  async function handleBulkCategorySubmit(targetCategoryId: string) {
    if (!targetCategoryId || selectedIds.length === 0) return
    setBulkActionLoading(true)
    const cat = categories.find((c) => c.id === targetCategoryId)
    const { error: bulkErr } = await supabase
      .from('menu_items')
      .update({
        category_id: targetCategoryId,
        category: cat?.name || 'General',
      })
      .in('id', selectedIds)

    setBulkActionLoading(false)
    if (bulkErr) setError('Error al cambiar categoría: ' + bulkErr.message)
    else {
      setSelectedIds([])
      void revalidatePublicContent(['menu'])
      onRefresh()
    }
  }

  async function handleBulkPriceAdjustSubmit(percent: number) {
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

      <div className="staff-two-column-layout">
        {/* Formulario de Creación / Edición */}
        <MenuItemForm
          form={form}
          setForm={setForm}
          categories={categories}
          editing={editing}
          saving={saving}
          error={error}
          imageFile={imageFile}
          setImageFile={setImageFile}
          onSave={saveItem}
          onCancel={newItem}
        />

        {/* Panel de Catálogo con Filtros Avanzados */}
        <div>
          <MenuFilters
            filters={filters}
            setFilter={setFilter}
            resetFilters={resetFilters}
            hasActiveFilters={hasActiveFilters}
            categories={categories}
            items={items}
            filteredCount={filteredItems.length}
            setCurrentPage={setCurrentPage}
          />

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

      {/* Acciones en Lote y sus modales */}
      <MenuBulkActions
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        bulkActionLoading={bulkActionLoading}
        categories={categories}
        onBulkAvailability={handleBulkAvailability}
        onBulkCategoryChange={handleBulkCategorySubmit}
        onBulkPriceAdjust={handleBulkPriceAdjustSubmit}
      />

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
