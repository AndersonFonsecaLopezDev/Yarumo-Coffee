import Image from 'next/image'
import Link from 'next/link'

export default function NotFound() {
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
          <div className="empty-state-icon">🌿</div>
          <h3>No encontramos esta página</h3>
          <p>El enlace que seguiste no existe o se movió. Vuelve al menú para seguir explorando.</p>
          <Link href="/">
            <button>Volver al menú</button>
          </Link>
        </div>
      </main>
    </>
  )
}
