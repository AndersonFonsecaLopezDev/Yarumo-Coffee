'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'

type Recommendation = {
  id: string
  name: string
  rating: number
  comment: string
  table_number: string | null
  created_at: string
}

export default function RecomendacionesPage() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // Form state
  const [name, setName] = useState('')
  const [rating, setRating] = useState(5)
  const [hoverRating, setHoverRating] = useState(0)
  const [tableNumber, setTableNumber] = useState('')
  const [comment, setComment] = useState('')

  useEffect(() => {
    async function fetchRecommendations() {
      try {
        const res = await fetch('/api/recommendations', { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          setRecommendations(data)
        }
      } catch {
        // Fallback silently if offline or database error
      } finally {
        setLoading(false)
      }
    }
    void fetchRecommendations()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const res = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          rating,
          comment: comment.trim(),
          tableNumber: tableNumber.trim() || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error || 'Ocurrió un error al enviar tu recomendación.')
        setSubmitting(false)
        return
      }

      setSuccessMsg('¡Muchas gracias por tu recomendación! Tu opinión ha sido publicada.')
      setName('')
      setRating(5)
      setTableNumber('')
      setComment('')

      // Add to list dynamically
      setRecommendations((prev) => [data, ...prev])
    } catch {
      setErrorMsg('No se pudo conectar con el servidor. Intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <header className="header">
        <Link className="brand" href="/">
          <Image src="/yarumo-logo.webp" alt="Yarumo Coffee" width={44} height={44} priority />
          <span>
            <strong>Yarumo</strong>
            <small>COFFEE</small>
          </span>
        </Link>
        <nav className="nav-links">
          <Link href="/">Carta</Link>
          <Link href="/recomendaciones" className="active">Opiniones</Link>
          <Link href="/#visitanos">Visítanos</Link>
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ThemeToggle />
          <a className="instagram-link" href="https://www.instagram.com/yarumocafearmenia/" target="_blank" rel="noreferrer">
            Instagram ↗
          </a>
        </div>
      </header>

      <main className="recomendaciones-main">
        <section className="hero">
          <div className="hero-content">
            <span className="eyebrow">Comunidad Yarumo</span>
            <h1>
              Déjanos tu<br />
              <em>recomendación.</em>
            </h1>
            <p>Donde cada taza cuenta una historia. Tu experiencia u opinión nos ayuda a crecer.</p>
          </div>
        </section>

        <section className="recomendaciones-container">
          <form className="recomendacion-form" onSubmit={handleSubmit}>
            <h2>Escribe tu opinión</h2>
            <p className="form-sub">Comparte tu experiencia con nosotros y otros visitantes.</p>

            {errorMsg && <div className="admin-error">{errorMsg}</div>}
            {successMsg && <div className="notice-success">{successMsg}</div>}

            <label className="form-label">
              <span>Tu calificación</span>
              <div className="stars-picker" onMouseLeave={() => setHoverRating(0)}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className={`star-btn ${(hoverRating || rating) >= star ? 'filled' : ''}`}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    aria-label={`${star} estrella${star > 1 ? 's' : ''}`}
                  >
                    ★
                  </button>
                ))}
                <span className="rating-num">{hoverRating || rating} / 5</span>
              </div>
            </label>

            <div className="form-row">
              <label className="form-label flex-1">
                <span>Tu nombre *</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. María Fernanda"
                  required
                  minLength={2}
                  maxLength={80}
                />
              </label>

              <label className="form-label min-w-120">
                <span>Mesa (opcional)</span>
                <input
                  type="text"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  placeholder="Ej. 4"
                />
              </label>
            </div>

            <label className="form-label">
              <span>Tu recomendación o comentario *</span>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="¿Qué fue lo que más te gustó? ¿Qué café o preparación nos recomiendas?"
                required
                minLength={5}
                maxLength={1000}
                rows={4}
              />
            </label>

            <button type="submit" className="button submit-rec-btn" disabled={submitting}>
              {submitting ? 'Enviando…' : 'Publicar recomendación'}
            </button>
          </form>

          <div className="recomendaciones-list-wrap">
            <h2>Recomendaciones recientes ({recommendations.length})</h2>

            {loading ? (
              <div className="skeleton-item" style={{ height: '180px' }} />
            ) : recommendations.length === 0 ? (
              <div className="empty-rec-box">
                <p>Sé el primero en dejar una recomendación para Yarumo Coffee.</p>
              </div>
            ) : (
              <div className="recomendaciones-grid">
                {recommendations.map((rec) => (
                  <article key={rec.id} className="rec-card">
                    <div className="rec-card-header">
                      <div className="rec-card-stars">
                        {'★'.repeat(rec.rating)}
                        <span className="empty-stars">{'★'.repeat(5 - rec.rating)}</span>
                      </div>
                      <span className="rec-card-date">
                        {new Date(rec.created_at).toLocaleDateString('es-CO', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    <p className="rec-card-comment">“{rec.comment}”</p>

                    <div className="rec-card-author">
                      <strong>{rec.name}</strong>
                      {rec.table_number && <small>Mesa {rec.table_number}</small>}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <footer className="footer">
          <span>Yarumo Coffee · Donde cada taza cuenta una historia.</span>
          <span>
            <a href="https://www.google.com/search?q=Yarumo+Coffee+Armenia" target="_blank" rel="noreferrer">
              Reseñas de Google ↗
            </a>{' '}
            ·{' '}
            <a href="https://www.instagram.com/yarumocafearmenia/" target="_blank" rel="noreferrer">
              Instagram ↗
            </a>
          </span>
        </footer>
      </main>
    </>
  )
}
