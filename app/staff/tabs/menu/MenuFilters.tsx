'use client'

import { SearchIcon } from '@/components/icons/CategoryIcons'
import type { MenuCategory, MenuItem } from '../../types'

export type MenuFilterState = {
  q: string
  cat: string
  avail: string
  photo: string
  min_p: string
  max_p: string
  sort: string
  view: string
}

type MenuFiltersProps = {
  filters: MenuFilterState
  setFilter: <K extends keyof MenuFilterState>(key: K, value: MenuFilterState[K]) => void
  resetFilters: () => void
  hasActiveFilters: boolean
  categories: MenuCategory[]
  items: MenuItem[]
  filteredCount: number
  setCurrentPage: (page: number) => void
}

export default function MenuFilters({
  filters,
  setFilter,
  resetFilters,
  hasActiveFilters,
  categories,
  items,
  filteredCount,
  setCurrentPage,
}: MenuFiltersProps) {
  return (
    <div className="staff-filter-card">
      <div className="filter-main-row">
        <div className="filter-input-wrap">
          <span className="filter-search-icon" aria-hidden="true">
            <SearchIcon size={16} />
          </span>
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
          Mostrando {filteredCount} de {items.length} productos
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
  )
}
