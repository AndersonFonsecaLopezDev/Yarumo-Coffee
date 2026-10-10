'use client'

import { useState } from 'react'

export default function RecommendationForm() {
  const [name, setName] = useState('')
  const [rating, setRating] = useState(5)
  const [hoverRating, setHoverRating] = useState(0)
  const [tableNumber, setTableNumber] = useState('')
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

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

      setSuccessMsg('¡Muchas gracias por tu recomendación! Tu opinión ha sido recibida y se publicará pronto.')
      setName('')
      setRating(5)
      setTableNumber('')
      setComment('')
    } catch {
      setErrorMsg('No se pudo conectar con el servidor. Por favor intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rec-form-card" style={{ background: 'var(--surface-card)', border: '1px solid var(--border)', borderRadius: 20, padding: 24, boxShadow: 'var(--shadow-sm)' }}>
      <h3 style={{ margin: '0 0 6px', fontSize: '1.25rem' }}>Déjanos tu opinión</h3>
      <p style={{ margin: '0 0 20px', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
        Tu experiencia nos ayuda a mejorar y a que otros descubran la magia del café especial.
      </p>

      {successMsg && (
        <div style={{ background: 'rgba(217, 232, 106, 0.25)', border: '1px solid var(--lime)', padding: 14, borderRadius: 12, marginBottom: 16, color: 'var(--ink)' }}>
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div style={{ background: 'rgba(239, 128, 91, 0.15)', border: '1px solid var(--orange)', padding: 14, borderRadius: 12, marginBottom: 16, color: 'var(--orange)' }}>
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label htmlFor="rec-name" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: 6 }}>
            Tu Nombre *
          </label>
          <input
            id="rec-name"
            type="text"
            required
            placeholder="Ej: Laura Gómez"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.95rem' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: 6 }}>
            Calificación *
          </label>
          <div style={{ display: 'flex', gap: 6 }} role="radiogroup" aria-label="Calificación en estrellas">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                aria-label={`${star} estrellas`}
                style={{
                  fontSize: 26,
                  color: (hoverRating || rating) >= star ? '#ef805b' : 'var(--border)',
                  transition: 'transform 0.15s',
                  transform: (hoverRating || rating) >= star ? 'scale(1.15)' : 'none',
                }}
              >
                ★
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="rec-table" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: 6 }}>
            Número de Mesa (Opcional)
          </label>
          <input
            id="rec-table"
            type="text"
            placeholder="Ej: 3"
            value={tableNumber}
            onChange={(e) => setTableNumber(e.target.value)}
            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.95rem' }}
          />
        </div>

        <div>
          <label htmlFor="rec-comment" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: 6 }}>
            Tu Comentario *
          </label>
          <textarea
            id="rec-comment"
            required
            rows={3}
            placeholder="¿Qué te pareció el café, la atención y el espacio?"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.95rem', resize: 'vertical' }}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="service-btn primary"
          style={{ width: '100%', justifyContent: 'center' }}
        >
          {submitting ? 'Enviando...' : 'Publicar recomendación'}
        </button>
      </form>
    </div>
  )
}
