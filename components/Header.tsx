'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import ThemeToggle from '@/components/ThemeToggle'
import { useI18n } from '@/lib/i18n'

export default function Header() {
  const pathname = usePathname()
  const isHome = pathname === '/'
  const { language, setLanguage, t } = useI18n()
  const [tableLabel] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const params = new URLSearchParams(window.location.search)
      const mesaParam = params.get('mesa') || params.get('token')
      if (mesaParam) {
        return mesaParam.length <= 4 ? mesaParam : 'Activa'
      }
    } catch {}
    return null
  })

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
        <Link
          href={isHome ? '#menu' : '/#menu'}
          className={isHome ? 'active' : ''}
        >
          {t('nav_menu')}
        </Link>
        <Link
          href="/recomendaciones"
          className={pathname === '/recomendaciones' ? 'active' : ''}
        >
          {t('nav_opinions')}
        </Link>
        <Link
          href={isHome ? '#visitanos' : '/#visitanos'}
        >
          Visítanos
        </Link>
      </nav>

      <div className="header-actions">
        {tableLabel && (
          <div className="header-table-badge" title="Mesa vinculada mediante código QR">
            <span className="table-indicator-dot" />
            <span>Mesa {tableLabel}</span>
          </div>
        )}

        <button
          type="button"
          className="lang-toggle-btn"
          onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
          title={language === 'es' ? 'Switch to English' : 'Cambiar a Español'}
          aria-label={language === 'es' ? 'Switch to English' : 'Cambiar a Español'}
          id="btn-language-toggle"
        >
          {language === 'es' ? 'EN' : 'ES'}
        </button>

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
