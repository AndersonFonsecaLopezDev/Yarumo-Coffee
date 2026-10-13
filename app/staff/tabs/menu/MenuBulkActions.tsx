'use client'

import { useState } from 'react'
import type { MenuCategory } from '../../types'

type MenuBulkActionsProps = {
  selectedIds: string[]
  setSelectedIds: (ids: string[]) => void
  bulkActionLoading: boolean
  categories: MenuCategory[]
  onBulkAvailability: (avail: boolean) => void
  onBulkCategoryChange: (categoryId: string) => void
  onBulkPriceAdjust: (percent: number) => void
}

export default function MenuBulkActions({
  selectedIds,
  setSelectedIds,
  bulkActionLoading,
  categories,
  onBulkAvailability,
  onBulkCategoryChange,
  onBulkPriceAdjust,
}: MenuBulkActionsProps) {
  const [showBulkPriceModal, setShowBulkPriceModal] = useState(false)
  const [showBulkCategoryModal, setShowBulkCategoryModal] = useState(false)
  const [bulkPercent, setBulkPercent] = useState('')
  const [targetBulkCategory, setTargetBulkCategory] = useState(categories[0]?.id || '')

  if (selectedIds.length === 0) return null

  return (
    <>
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
            onClick={() => onBulkAvailability(true)}
          >
            Marcar disponible
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)' }}
            disabled={bulkActionLoading}
            onClick={() => onBulkAvailability(false)}
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

      {/* Modal Ajustar Precios en % */}
      {showBulkPriceModal && (
        <div className="bottom-sheet-backdrop" onClick={() => setShowBulkPriceModal(false)}>
          <div
            className="card"
            style={{ maxWidth: 440, width: '90%', padding: 24, background: 'var(--surface-card)', borderRadius: 16 }}
            onClick={(e) => e.stopPropagation()}
          >
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
                onClick={() => {
                  onBulkPriceAdjust(Number(bulkPercent))
                  setShowBulkPriceModal(false)
                }}
              >
                {bulkActionLoading ? 'Aplicando...' : 'Aplicar Ajuste'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cambiar Categoría en Lote */}
      {showBulkCategoryModal && (
        <div className="bottom-sheet-backdrop" onClick={() => setShowBulkCategoryModal(false)}>
          <div
            className="card"
            style={{ maxWidth: 440, width: '90%', padding: 24, background: 'var(--surface-card)', borderRadius: 16 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 8px' }}>Cambiar Categoría en Lote</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 16px' }}>
              Mover los {selectedIds.length} productos seleccionados a la categoría indicada:
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
                disabled={bulkActionLoading || !targetBulkCategory}
                onClick={() => {
                  onBulkCategoryChange(targetBulkCategory)
                  setShowBulkCategoryModal(false)
                }}
              >
                {bulkActionLoading ? 'Moviendo...' : 'Cambiar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
