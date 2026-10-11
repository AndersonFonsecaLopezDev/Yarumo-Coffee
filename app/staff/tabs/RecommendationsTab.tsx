'use client'

import { useMemo, useState } from 'react'
import type { RecommendationItem } from '../types'
import { createClient } from '@/lib/supabase/client'
import { revalidatePublicContent } from '@/app/actions/revalidate'
import { normalizeText } from '@/lib/filters'

type RecommendationsTabProps = {
  recommendations: RecommendationItem[]
  onRefresh: () => void
}

export default function RecommendationsTab({
  recommendations,
  onRefresh,
}: RecommendationsTabProps) {
  const [supabase] = useState(() => createClient())
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'hidden'>('all')
  const [ratingFilter, setRatingFilter] = useState<string>('all')

  const filteredRecommendations = useMemo(() => {
    const q = normalizeText(searchQuery)
    return recommendations.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (ratingFilter !== 'all' && String(r.rating) !== ratingFilter) return false
      if (q) {
        const nameNorm = normalizeText(r.name)
        const commentNorm = normalizeText(r.comment)
        const tableNorm = normalizeText(r.table_number ? `mesa ${r.table_number}` : '')
        if (!nameNorm.includes(q) && !commentNorm.includes(q) && !tableNorm.includes(q)) {
          return false
        }
      }
      return true
    })
  }, [recommendations, searchQuery, statusFilter, ratingFilter])

  async function updateStatus(id: string, status: 'published' | 'hidden') {
    setLoadingId(id)
    await supabase.from('recommendations').update({ status }).eq('id', id)
    void revalidatePublicContent(['recommendations'])
    setLoadingId(null)
    onRefresh()
  }

  async function removeRecommendation(id: string) {
    if (!confirm('¿Eliminar definitivamente esta opinión?')) return
    setLoadingId(id)
    await supabase.from('recommendations').delete().eq('id', id)
    void revalidatePublicContent(['recommendations'])
    setLoadingId(null)
    onRefresh()
  }

  return (
    <div className="tab-pane">
      <div className="section-header">
        <div>
          <h2>Moderación de Opiniones</h2>
          <p>Gestiona las recomendaciones recibidas de los clientes.</p>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 18, marginBottom: 14 }}>
        <input
          type="search"
          placeholder="Buscar por cliente, comentario o mesa..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input"
          style={{ flex: 1, minWidth: 220 }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | 'published' | 'hidden')}
          className="input"
          style={{ minWidth: 140 }}
        >
          <option value="all">Todos los estados</option>
          <option value="published">Publicadas</option>
          <option value="hidden">Ocultas</option>
        </select>
        <select
          value={ratingFilter}
          onChange={(e) => setRatingFilter(e.target.value)}
          className="input"
          style={{ minWidth: 130 }}
        >
          <option value="all">Todas las estrellas</option>
          <option value="5">⭐⭐⭐⭐⭐ (5)</option>
          <option value="4">⭐⭐⭐⭐ (4)</option>
          <option value="3">⭐⭐⭐ (3)</option>
          <option value="2">⭐⭐ (2)</option>
          <option value="1">⭐ (1)</option>
        </select>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Mostrando {filteredRecommendations.length} de {recommendations.length}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {filteredRecommendations.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No se encontraron opiniones coincidentes.</p>
        ) : (
          filteredRecommendations.map((rec) => (
            <div
              key={rec.id}
              className="card"
              style={{
                padding: 18,
                background: 'var(--surface-card)',
                borderRadius: 14,
                border: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 16,
              }}
            >
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <strong>{rec.name}</strong>
                  {rec.table_number && <span className="badge">Mesa {rec.table_number}</span>}
                  <span style={{ color: 'var(--orange)' }}>{'★'.repeat(rec.rating)}</span>
                  <span className={`status-pill ${rec.status === 'published' ? 'status-delivered' : 'status-pending'}`}>
                    {rec.status === 'published' ? 'Visible' : 'Oculto'}
                  </span>
                </div>
                <p style={{ margin: '8px 0 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  {rec.comment}
                </p>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {rec.status === 'published' ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    disabled={loadingId === rec.id}
                    onClick={() => updateStatus(rec.id, 'hidden')}
                  >
                    Ocultar
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    disabled={loadingId === rec.id}
                    onClick={() => updateStatus(rec.id, 'published')}
                  >
                    Publicar
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  disabled={loadingId === rec.id}
                  onClick={() => removeRecommendation(rec.id)}
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
