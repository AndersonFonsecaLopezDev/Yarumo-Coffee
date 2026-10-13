'use client'

import type { MenuForm, MenuItem, MenuCategory } from '../../types'

type MenuItemFormProps = {
  form: MenuForm
  setForm: React.Dispatch<React.SetStateAction<MenuForm>>
  categories: MenuCategory[]
  editing: MenuItem | null
  saving: boolean
  error: string
  imageFile: File | null
  setImageFile: (f: File | null) => void
  onSave: (e: React.FormEvent) => void
  onCancel: () => void
}

export default function MenuItemForm({
  form,
  setForm,
  categories,
  editing,
  saving,
  error,
  imageFile,
  setImageFile,
  onSave,
  onCancel,
}: MenuItemFormProps) {
  return (
    <form
      onSubmit={onSave}
      className="menu-form staff-panel card menu-form-sticky"
      style={{ padding: 20, alignSelf: 'start', alignContent: 'start' }}
    >
      <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem' }}>
        {editing ? 'Editar Producto' : 'Nuevo Producto'}
      </h3>

      {error && (
        <div style={{ color: 'var(--red, #e53e3e)', fontSize: '0.85rem', marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div>
        <label htmlFor="menu-name" style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>
          Nombre
        </label>
        <input
          id="menu-name"
          type="text"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="input"
          placeholder="Ej: Latte Vainilla"
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
          placeholder="Ej: Vanilla Latte"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
        <div>
          <label htmlFor="menu-price" style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>
            Precio COP
          </label>
          <input
            id="menu-price"
            type="number"
            required
            min={0}
            step={500}
            value={form.price_cop}
            onChange={(e) => setForm({ ...form, price_cop: Number(e.target.value) })}
            className="input"
            placeholder="8000"
          />
        </div>
        <div>
          <label htmlFor="menu-category" style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>
            Categoría
          </label>
          <select
            id="menu-category"
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
          <label htmlFor="menu-sort" style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>
            Orden
          </label>
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
        <label htmlFor="menu-desc" style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>
          Descripción
        </label>
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
        <label htmlFor="menu-image" style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>
          Foto Principal (Archivo o URL)
        </label>
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
        {imageFile && (
          <small style={{ display: 'block', marginTop: 4, color: 'var(--brand-gold, #cca463)' }}>
            Seleccionado: {imageFile.name}
          </small>
        )}
      </div>

      <div>
        <label htmlFor="menu-tags" style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>
          Etiquetas (separadas por coma)
        </label>
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
          <button type="button" className="btn btn-outline" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}
