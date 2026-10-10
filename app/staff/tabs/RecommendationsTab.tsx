'use client'

import { useState } from 'react'
import type { RecommendationItem } from '../types'
import { createClient } from '@/lib/supabase/client'
import { revalidatePublicContent } from '@/app/actions/revalidate'

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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 20 }}>
        {recommendations.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No hay recomendaciones registradas.</p>
        ) : (
          recommendations.map((rec) => (
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
