'use client'

import { useSyncExternalStore } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import ThemeToggle from '@/components/ThemeToggle'
import { useI18n } from '@/lib/i18n'

function subscribeToLocation(callback: () => void) {
  window.addEventListener('popstate', callback)
  return () => window.removeEventListener('popstate', callback)
}

function getTableSnapshot() {
  try {
    const params = new URLSearchParams(window.location.search)
    const mesaParam = params.get('mesa') || params.get('token')
    if (mesaParam) {
      return mesaParam.length <= 4 ? mesaParam : 'Activa'
    }
  } catch {}
  return null
}

function getServerTableSnapshot() {
  return null
}

export default function Header() {
  const pathname = usePathname()
  const isHome = pathname === '/'
  const { language, setLanguage, t } = useI18n()
  const tableLabel = useSyncExternalStore(
    subscribeToLocation,
    getTableSnapshot,
    getServerTableSnapshot,
  )

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

      <nav className="nav-links" aria-label={t('nav_aria_main')}>
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
          {t('nav_visit')}
        </Link>
      </nav>

      <div className="header-actions">
        {tableLabel && (
          <div className="header-table-badge" title={t('table_badge_title')}>
            <span className="table-indicator-dot" />
            <span>{t('table_label_prefix')} {tableLabel === 'Activa' ? t('table_badge_active') : tableLabel}</span>
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
          aria-label={t('instagram_aria')}
          title="Instagram @yarumocafearmenia"
        >
          <svg
            className="instagram-icon"
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
          </svg>
          <span className="instagram-link-text">Instagram ↗</span>
        </a>
      </div>
    </header>
  )
}
