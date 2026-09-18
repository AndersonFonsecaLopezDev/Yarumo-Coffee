'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import * as Sentry from '@sentry/nextjs'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Unhandled application error:', error)
    Sentry.captureException(error)
  }, [error])

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
      </header>

      <main className="content">
        <div className="empty-state">
          <div className="empty-state-icon">☕</div>
          <h3>Algo salió mal</h3>
          <p>No pudimos cargar Yarumo en este momento. Intenta de nuevo en unos segundos.</p>
          {error?.message && (
            <pre style={{
              margin: '12px auto',
              padding: '10px 14px',
              maxWidth: '560px',
              fontSize: '12px',
              color: '#d9534f',
              backgroundColor: 'rgba(217, 83, 79, 0.1)',
              borderRadius: '8px',
              whiteSpace: 'pre-wrap',
              textAlign: 'left',
              wordBreak: 'break-word',
            }}>
              {error.message}
              {error.digest ? `\n(Digest: ${error.digest})` : ''}
            </pre>
          )}
          <button onClick={reset}>Intentar de nuevo</button>
        </div>
      </main>
    </>
  )
}
