'use client'

import { useState } from 'react'
import { useI18n } from '@/lib/i18n'

export default function RecommendationForm() {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [rating, setRating] = useState(5)
  const [hoverRating, setHoverRating] = useState(0)
  const [tableNumber, setTableNumber] = useState('')
  const [comment, setComment] = useState('')
  const [website, setWebsite] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    // Detección inmediata de bot en cliente
    if (website.trim()) {
      setSuccessMsg(t('rec_bot_success_msg'))
      setName('')
      setComment('')
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          rating,
          comment: comment.trim(),
          tableNumber: tableNumber.trim() || undefined,
          website: website.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error || t('rec_err_generic'))
        setSubmitting(false)
        return
      }

      setSuccessMsg(t('rec_success_msg'))
      setName('')
      setRating(5)
      setTableNumber('')
      setComment('')
    } catch {
      setErrorMsg(t('rec_err_connection'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rec-form-card" style={{ background: 'var(--surface-card)', border: '1px solid var(--border)', borderRadius: 20, padding: 24, boxShadow: 'var(--shadow-sm)' }}>
      <h3 style={{ margin: '0 0 6px', fontSize: '1.25rem' }}>{t('rec_form_title')}</h3>
      <p style={{ margin: '0 0 20px', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
        {t('rec_form_desc')}
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
            {t('rec_name_label')}
          </label>
          <input
            id="rec-name"
            type="text"
            required
            placeholder={t('rec_name_ph')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.95rem' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: 6 }}>
            {t('rec_rating_label')}
          </label>
          <div style={{ display: 'flex', gap: 6 }} role="radiogroup" aria-label={t('rec_rating_aria')}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                aria-label={`${star} ${t('rec_stars_suffix')}`}
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
            {t('rec_table_label')}
          </label>
          <input
            id="rec-table"
            type="text"
            placeholder={t('rec_table_ph')}
            value={tableNumber}
            onChange={(e) => setTableNumber(e.target.value)}
            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.95rem' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label htmlFor="rec-comment" style={{ fontSize: '0.85rem', fontWeight: 700 }}>
              {t('rec_comment_label')}
            </label>
            <span style={{ fontSize: '0.78rem', color: comment.length > 450 ? 'var(--orange)' : 'var(--text-muted)' }}>
              {comment.length} / 500
            </span>
          </div>
          <textarea
            id="rec-comment"
            required
            rows={3}
            maxLength={500}
            placeholder={t('rec_comment_ph')}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.95rem', resize: 'vertical' }}
          />
        </div>

        {/* Campo Honeypot Oculto (trampa para bots antispam) */}
        <div style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', height: 0, width: 0, overflow: 'hidden' }} aria-hidden="true">
          <label htmlFor="rec-website">Website (dejar vacío)</label>
          <input
            id="rec-website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="service-btn primary"
          style={{ width: '100%', justifyContent: 'center' }}
        >
          {submitting ? t('rec_submitting') : t('rec_submit_btn')}
        </button>
      </form>
    </div>
  )
}
