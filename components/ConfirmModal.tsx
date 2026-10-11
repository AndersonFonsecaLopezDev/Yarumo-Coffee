'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type ConfirmOptions = {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

type ConfirmState = (ConfirmOptions & {
  resolve: (value: boolean) => void
}) | null

function ConfirmDialogModal({
  state,
  onCancel,
  onConfirm,
}: {
  state: ConfirmState
  onCancel: () => void
  onConfirm: () => void
}) {
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null)
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!state) return

    // Enfocar automáticamente el botón según el tipo de acción
    const focusTarget = state.danger ? cancelBtnRef.current : confirmBtnRef.current
    focusTarget?.focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state, onCancel])

  if (!state) return null

  return (
    <div
      className="confirm-modal-backdrop"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="confirm-modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-modal-icon-wrap" data-danger={state.danger ? 'true' : 'false'}>
          {state.danger ? (
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          )}
        </div>

        <div className="confirm-modal-body">
          <h3 id="confirm-modal-title">{state.title}</h3>
          <p id="confirm-modal-desc">{state.message}</p>
        </div>

        <div className="confirm-modal-actions">
          <button
            ref={cancelBtnRef}
            type="button"
            className="btn btn-secondary confirm-btn-cancel"
            onClick={onCancel}
          >
            {state.cancelText || 'Cancelar'}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            className={`btn ${state.danger ? 'btn-danger confirm-btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {state.confirmText || 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function useConfirm() {
  const [state, setState] = useState<ConfirmState>(null)

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setState({
        ...options,
        resolve,
      })
    })
  }, [])

  const handleConfirm = useCallback(() => {
    if (state) {
      state.resolve(true)
      setState(null)
    }
  }, [state])

  const handleCancel = useCallback(() => {
    if (state) {
      state.resolve(false)
      setState(null)
    }
  }, [state])

  const ConfirmDialog = useCallback(() => {
    return (
      <ConfirmDialogModal
        state={state}
        onCancel={handleCancel}
        onConfirm={handleConfirm}
      />
    )
  }, [state, handleCancel, handleConfirm])

  return { confirm, ConfirmDialog }
}
