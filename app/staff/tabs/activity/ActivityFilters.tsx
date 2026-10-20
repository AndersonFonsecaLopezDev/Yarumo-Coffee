'use client'

import { SearchIcon } from '@/components/icons/CategoryIcons'
import type { CafeTable } from '../../types'

export type ActivityFilterState = {
  q: string
  type: string
  status: string
  table: string
}

type ActivityFiltersProps = {
  filters: ActivityFilterState
  setFilter: <K extends keyof ActivityFilterState>(key: K, value: ActivityFilterState[K]) => void
  resetFilters: () => void
  hasActiveFilters: boolean
  tables: CafeTable[]
  pendingRequestsCount: number
  activeOrdersCount: number
}

export default function ActivityFilters({
  filters,
  setFilter,
  resetFilters,
  hasActiveFilters,
  tables,
  pendingRequestsCount,
  activeOrdersCount,
}: ActivityFiltersProps) {
  return (
    <div className="staff-filter-card" style={{ marginTop: 18 }}>
      <div className="filter-main-row">
        <div className="filter-input-wrap">
          <span className="filter-search-icon" aria-hidden="true">
            <SearchIcon size={16} />
          </span>
          <input
            type="search"
            id="activity-search-input"
            placeholder="Buscar por mesa, producto o nota..."
            value={filters.q}
            onChange={(e) => setFilter('q', e.target.value)}
            className="filter-control-input"
          />
        </div>

        {/* Selector de Tipo */}
        <div className="segmented-type-control" role="group" aria-label="Filtrar por tipo de actividad">
          <button
            type="button"
            className={`segmented-btn ${filters.type === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('type', 'all')}
          >
            Todo ({pendingRequestsCount + activeOrdersCount})
          </button>
          <button
            type="button"
            className={`segmented-btn ${filters.type === 'orders' ? 'active' : ''}`}
            onClick={() => setFilter('type', 'orders')}
          >
            <span className="seg-emoji">☕ </span><span>Comandas ({activeOrdersCount})</span>
          </button>
          <button
            type="button"
            className={`segmented-btn ${filters.type === 'requests' ? 'active' : ''}`}
            onClick={() => setFilter('type', 'requests')}
          >
            <span className="seg-emoji">🛎️ </span><span>Solicitudes ({pendingRequestsCount})</span>
          </button>
        </div>

        {/* Selectores de Estado y Mesa agrupados para rejilla responsiva */}
        <div className="filter-selects-grid">
          <select
            id="activity-status-select"
            value={filters.status}
            onChange={(e) => setFilter('status', e.target.value)}
            className="filter-control-select"
          >
            <option value="active">Activos en cocina</option>
            <option value="pending">Solo pendientes</option>
            <option value="preparing">En preparación</option>
            <option value="delivered">Entregados (Historial)</option>
            <option value="cancelled">Cancelados (Historial)</option>
            <option value="all">Todos los estados</option>
          </select>

          <select
            id="activity-table-select"
            value={filters.table}
            onChange={(e) => setFilter('table', e.target.value)}
            className="filter-control-select"
          >
            <option value="all">Todas las mesas</option>
            {tables.map((t) => (
              <option key={t.id} value={t.id}>
                Mesa {t.label || t.id}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Fila de Chips y Contador */}
      <div className="filter-chips-container">
        <span className="filter-count-badge" id="activity-counter">
          {pendingRequestsCount + activeOrdersCount} registros activos
        </span>

        {filters.q && (
          <span className="filter-chip">
            <span>Búsqueda: «{filters.q}»</span>
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

        {filters.type !== 'all' && (
          <span className="filter-chip">
            <span>{filters.type === 'orders' ? 'Solo Comandas' : 'Solo Solicitudes'}</span>
            <button
              type="button"
              className="filter-chip-remove"
              onClick={() => setFilter('type', 'all')}
              aria-label="Quitar filtro de tipo"
            >
              ✕
            </button>
          </span>
        )}

        {filters.status !== 'active' && (
          <span className="filter-chip">
            <span>Estado: {filters.status}</span>
            <button
              type="button"
              className="filter-chip-remove"
              onClick={() => setFilter('status', 'active')}
              aria-label="Restablecer filtro de estado"
            >
              ✕
            </button>
          </span>
        )}

        {filters.table !== 'all' && (
          <span className="filter-chip">
            <span>Mesa: {tables.find((t) => t.id === filters.table)?.label || filters.table}</span>
            <button
              type="button"
              className="filter-chip-remove"
              onClick={() => setFilter('table', 'all')}
              aria-label="Quitar filtro de mesa"
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
            id="btn-clear-activity-filters"
          >
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  )
}
