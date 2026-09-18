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
          <button onClick={reset}>Intentar de nuevo</button>
        </div>
      </main>
    </>
  )
}
