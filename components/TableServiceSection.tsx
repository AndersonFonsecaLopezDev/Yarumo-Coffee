'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type TableServiceSectionProps = {
  onTableResolved?: (table: { id: string; label: string } | null, token: string | null) => void
  onToastNotice?: (message: string) => void
}

export default function TableServiceSection({
  onTableResolved,
  onToastNotice,
}: TableServiceSectionProps) {
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
              onToastNotice?.('Este código QR no está activo o caducó. Pide asistencia a nuestro equipo.')
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
  }, [supabase, onTableResolved, onToastNotice])

  async function handleServiceRequest(type: 'waiter' | 'bill') {
    if (!table || !mesaToken) {
      onToastNotice?.('Escanea el QR de tu mesa para llamar al mesero o pedir la cuenta.')
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
      onToastNotice?.('No se pudo enviar la solicitud. Intenta nuevamente.')
    } else if (type === 'waiter') {
      onToastNotice?.('🛎️ Solicitud enviada: el mesero viene en camino a tu mesa.')
    } else {
      onToastNotice?.('🧾 Solicitud enviada: la cuenta fue solicitada para tu mesa.')
    }
  }

  // Si aún se está verificando el token (o no ha montado en cliente), mostrar esqueleto fiel sin parpadeo
  if (!tableChecked) {
    return (
      <section className="service" aria-label="Verificando mesa">
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
      <section className="service" id="servicio-mesa" aria-label="Aviso de mesa">
        <div className="service-card" style={{ borderLeft: '4px solid var(--amber, #f59e0b)' }}>
          <div className="service-info">
            <span className="eyebrow" style={{ color: 'var(--amber, #f59e0b)' }}>
              ⚠️ Código QR no encontrado o caducado
            </span>
            <h2>Atención en Barra o Para Llevar</h2>
            <p>
              El código escaneado no corresponde a una mesa activa en este momento. Puedes explorar la carta para pedir en barra, solicitar domicilio o consultar a nuestro equipo.
            </p>
          </div>
          <div className="service-actions">
            <a href="#menu" className="service-btn primary" id="btn-continuar-barra">
              <span>☕</span>
              <span>Continuar en barra / Para llevar</span>
            </a>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="service" id="servicio-mesa" aria-label="Servicio en mesa">
      <div className="service-card">
        <div className="service-info">
          <span className="eyebrow">
            {table ? `Atención personalizada · Mesa ${table.label}` : 'Atención en mesa y domicilios'}
          </span>
          <h2>{table ? `Mesa ${table.label} conectada` : 'Pide a tu mesa o a domicilio'}</h2>
          <p>
            {table
              ? 'Puedes llamar al mesero, pedir la cuenta o agregar productos directo a tu comanda.'
              : 'Si estás en la cafetería, escanea el código QR de tu mesa para vincular tu pedido.'}
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
                aria-label="Llamar al mesero a la mesa"
                id="btn-llamar-mesero"
              >
                <span>🛎️</span>
                <span>{loadingAction === 'waiter' ? 'Llamando...' : 'Llamar mesero'}</span>
              </button>
              <button
                type="button"
                className="service-btn primary"
                onClick={() => handleServiceRequest('bill')}
                disabled={loadingAction !== null}
                aria-label="Pedir la cuenta de la mesa"
                id="btn-pedir-cuenta"
              >
                <span>🧾</span>
                <span>{loadingAction === 'bill' ? 'Solicitando...' : 'Pedir la cuenta'}</span>
              </button>
            </>
          ) : (
            <a href="#menu" className="service-btn primary" id="btn-explorar-carta">
              <span>☕</span>
              <span>Explorar carta</span>
            </a>
          )}
        </div>
      </div>
    </section>
  )
}
