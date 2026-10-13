import Image from 'next/image'
import Link from 'next/link'
import { T } from '@/lib/i18n'

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
          <h3><T k="not_found_title" /></h3>
          <p><T k="not_found_desc" /></p>
          <Link href="/">
            <button><T k="not_found_btn" /></button>
          </Link>
        </div>
      </main>
    </>
  )
}
