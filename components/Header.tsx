import Image from 'next/image'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'

export default function Header() {
  return (
    <header className="header">
      <Link className="brand" href="/" aria-label="Yarumo Coffee Inicio">
        <Image
          src="/yarumo-logo.webp"
          alt="Yarumo Coffee"
          width={44}
          height={44}
          priority
        />
        <span>
          <strong>Yarumo</strong>
          <small>COFFEE</small>
        </span>
      </Link>
      <nav className="nav-links" aria-label="Navegación principal">
        <a href="#menu">Carta</a>
        <Link href="/recomendaciones">Opiniones</Link>
        <a href="#visitanos">Visítanos</a>
      </nav>
      <div className="header-actions">
        <ThemeToggle />
        <a
          className="instagram-link"
          href="https://www.instagram.com/yarumocafearmenia/"
          target="_blank"
          rel="noreferrer"
          aria-label="Abrir perfil de Instagram de Yarumo Coffee"
        >
          Instagram ↗
        </a>
      </div>
    </header>
  )
}
