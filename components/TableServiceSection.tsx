'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n'

type TableServiceSectionProps = {
  onTableResolved?: (table: { id: string; label: string } | null, token: string | null) => void
  onToastNotice?: (message: string) => void
}

export default function TableServiceSection({
  onTableResolved,
  onToastNotice,
}: TableServiceSectionProps) {
  const { t } = useI18n()
  const [supabase] = useState(() => createClient())
  const [table, setTable] = useState<{ id: string; label: string } | null>(null)
  const [mesaToken, setMesaToken] = useState<string | null>(null)
  const [tableChecked, setTableChecked] = useState(false)
  const [loadingAction, setLoadingAction] = useState<'waiter' | 'bill' | null>(null)

  useEffect(() => {
    let active = true

    void Promise.resolve().then(() => {
      if (!active) return
      const params = new URLSearchParams(window.location.search)
      const token = params.get('mesa') || params.get('token')

      if (!token) {
        setTableChecked(true)
        onTableResolved?.(null, null)
        return
      }

      setMesaToken(token)

      async function checkToken() {
        try {
          const { data, error } = await supabase.rpc('get_table_by_token', { token })
          if (!active) return
          if (data && data[0]) {
            const resolvedTable = data[0] as { id: string; label: string }
            setTable(resolvedTable)
            onTableResolved?.(resolvedTable, token)
          } else {
            setTable(null)
            onTableResolved?.(null, token)
            if (error || !data || data.length === 0) {
              onToastNotice?.(t('toast_qr_expired'))
            }
          }
          setTableChecked(true)
        } catch {
          if (!active) return
          setTableChecked(true)
        }
      }

      void checkToken()
    })

    return () => {
      active = false
    }
  }, [supabase, onTableResolved, onToastNotice, t])

  async function handleServiceRequest(type: 'waiter' | 'bill') {
    if (!table || !mesaToken) {
      onToastNotice?.(t('toast_scan_qr_prompt'))
      return
    }

    setLoadingAction(type)
    const { error } = await supabase.from('service_requests').insert({
      table_id: table.id,
      table_token: mesaToken,
      type,
    })
    setLoadingAction(null)

    if (error) {
      onToastNotice?.(t('toast_service_error'))
    } else if (type === 'waiter') {
      onToastNotice?.(t('toast_waiter_sent'))
    } else {
      onToastNotice?.(t('toast_bill_sent'))
    }
  }

  // Si aún se está verificando el token (o no ha montado en cliente), mostrar esqueleto fiel sin parpadeo
  if (!tableChecked) {
    return (
      <section className="service" aria-label={t('service_checking_aria')}>
        <div className="service-skeleton">
          <div className="service-info">
            <div className="sk-title skeleton-pulse" />
            <div className="sk-sub skeleton-pulse" />
          </div>
          <div className="service-actions">
            <div className="sk-btn skeleton-pulse" />
            <div className="sk-btn skeleton-pulse" />
          </div>
        </div>
      </section>
    )
  }

  // Si el token es inválido o no existe la mesa, mostrar aviso amigable para pedir en barra
  if (mesaToken && !table) {
    return (
      <section className="service" id="servicio-mesa" aria-label={t('service_notice_aria')}>
        <div className="service-card" style={{ borderLeft: '4px solid var(--amber, #f59e0b)' }}>
          <div className="service-info">
            <span className="eyebrow" style={{ color: 'var(--amber, #f59e0b)' }}>
              {t('service_qr_invalid_title')}
            </span>
            <h2>{t('service_qr_invalid_heading')}</h2>
            <p>{t('service_qr_invalid_desc')}</p>
          </div>
          <div className="service-actions">
            <a href="#menu" className="service-btn primary" id="btn-continuar-barra">
              <span>☕</span>
              <span>{t('service_continue_counter')}</span>
            </a>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="service" id="servicio-mesa" aria-label={t('service_aria')}>
      <div className="service-card">
        <div className="service-info">
          <span className="eyebrow">
            {table ? `${t('service_eyebrow_table_prefix')} ${table.label}` : t('service_eyebrow_delivery')}
          </span>
          <h2>{table ? `${t('table_label_prefix')} ${table.label} ${t('service_heading_table_suffix')}` : t('service_heading_general')}</h2>
          <p>
            {table
              ? t('service_desc_table')
              : t('service_desc_general')}
          </p>
        </div>

        <div className="service-actions">
          {table ? (
            <>
              <button
                type="button"
                className="service-btn"
                onClick={() => handleServiceRequest('waiter')}
                disabled={loadingAction !== null}
                aria-label={t('service_call_waiter_aria')}
                id="btn-llamar-mesero"
              >
                <span>🛎️</span>
                <span>{loadingAction === 'waiter' ? t('service_calling_waiter') : t('service_call_waiter')}</span>
              </button>
              <button
                type="button"
                className="service-btn primary"
                onClick={() => handleServiceRequest('bill')}
                disabled={loadingAction !== null}
                aria-label={t('service_request_bill_aria')}
                id="btn-pedir-cuenta"
              >
                <span>🧾</span>
                <span>{loadingAction === 'bill' ? t('service_requesting_bill') : t('service_request_bill')}</span>
              </button>
            </>
          ) : (
            <a href="#menu" className="service-btn primary" id="btn-explorar-carta">
              <span>☕</span>
              <span>{t('service_explore_menu')}</span>
            </a>
          )}
        </div>
      </div>
    </section>
  )
}
