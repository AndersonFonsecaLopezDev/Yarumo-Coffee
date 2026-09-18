'use client'

import { useEffect, useRef, useState } from 'react'

export type StaffAlert = {
  id: string
  sourceId: string // id of order_requests or service_requests for resolution matching
  type: 'order' | 'waiter' | 'bill'
  tableLabel: string
  title: string
  subtitle: string
  createdAt: number
}

type StaffAlertsProps = {
  alerts: StaffAlert[]
  onDismiss: (id: string) => void
  onAlertClick: (alert: StaffAlert) => void
}

const TOAST_DURATION_MS = 14000
const MAX_VISIBLE_ALERTS = 4

export default function StaffAlerts({ alerts, onDismiss, onAlertClick }: StaffAlertsProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [isTabVisible, setIsTabVisible] = useState(true)
  const timersRef = useRef<Record<string, number>>({})

  // Detect tab visibility to pause auto-dismiss while staff is away
  useEffect(() => {
    function handleVisibilityChange() {
      setIsTabVisible(document.visibilityState === 'visible')
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // Auto-dismiss timer management
  useEffect(() => {
    alerts.forEach((alert) => {
      if (timersRef.current[alert.id]) return

      // Only schedule timer if tab is visible and not hovered
      if (isTabVisible && hoveredId !== alert.id) {
        const remaining = Math.max(
          1000,
          TOAST_DURATION_MS - (Date.now() - alert.createdAt),
        )
        timersRef.current[alert.id] = window.setTimeout(() => {
          onDismiss(alert.id)
          delete timersRef.current[alert.id]
        }, remaining)
      }
    })

    // Cleanup timers for dismissed alerts
    const activeIds = new Set(alerts.map((a) => a.id))
    Object.keys(timersRef.current).forEach((id) => {
      if (!activeIds.has(id)) {
        clearTimeout(timersRef.current[id])
        delete timersRef.current[id]
      }
    })
  }, [alerts, isTabVisible, hoveredId, onDismiss])

  if (!alerts.length) return null

  const visibleAlerts = alerts.slice(0, MAX_VISIBLE_ALERTS)
  const overflowCount = alerts.length - MAX_VISIBLE_ALERTS

  return (
    <div className="staff-alerts-container" aria-live="assertive" role="region" aria-label="Alertas en tiempo real">
      {visibleAlerts.map((alert) => (
        <div
          key={alert.id}
          className={`staff-toast-item toast-type-${alert.type}`}
          onClick={() => onAlertClick(alert)}
          onMouseEnter={() => {
            setHoveredId(alert.id)
            if (timersRef.current[alert.id]) {
              clearTimeout(timersRef.current[alert.id])
              delete timersRef.current[alert.id]
            }
          }}
          onMouseLeave={() => setHoveredId(null)}
          role="alert"
          tabIndex={0}
        >
          <div className="toast-icon">
            {alert.type === 'order' ? '🛍️' : alert.type === 'waiter' ? '🛎️' : '🧾'}
          </div>
          <div className="toast-content">
            <strong className="toast-title">{alert.title}</strong>
            <span className="toast-subtitle">{alert.subtitle}</span>
          </div>
          <button
            type="button"
            className="toast-close-btn"
            onClick={(e) => {
              e.stopPropagation()
              onDismiss(alert.id)
            }}
            aria-label="Descartar alerta"
          >
            ×
          </button>
        </div>
      ))}

      {overflowCount > 0 && (
        <div className="staff-toast-overflow">
          +{overflowCount} alerta{overflowCount > 1 ? 's' : ''} más en cola
        </div>
      )}
    </div>
  )
}
