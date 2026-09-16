'use client'

import { useState, useSyncExternalStore } from 'react'

const emptySubscribe = () => () => {}

function useIsMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  )
}

function applyTheme(newTheme: 'light' | 'dark' | 'system') {
  const root = document.documentElement
  if (newTheme === 'system') {
    root.removeAttribute('data-theme')
    localStorage.removeItem('yarumo-theme')
  } else {
    root.setAttribute('data-theme', newTheme)
    localStorage.setItem('yarumo-theme', newTheme)
  }
}

export default function ThemeToggle() {
  const isMounted = useIsMounted()
  // Read the current data-theme attribute as the source of truth (set by inline script)
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    if (typeof window === 'undefined') return 'system'
    const attr = document.documentElement.getAttribute('data-theme')
    if (attr === 'light' || attr === 'dark') return attr
    return 'system'
  })

  function toggle() {
    let nextTheme: 'light' | 'dark' | 'system' = 'dark'
    if (theme === 'system') nextTheme = 'dark'
    else if (theme === 'dark') nextTheme = 'light'
    else if (theme === 'light') nextTheme = 'system'
    setTheme(nextTheme)
    applyTheme(nextTheme)
  }

  if (!isMounted) return null

  return (
    <button
      type="button"
      className="theme-toggle-btn"
      onClick={toggle}
      title={`Tema actual: ${theme === 'dark' ? 'Oscuro' : theme === 'light' ? 'Claro' : 'Automático'}`}
      aria-label={`Cambiar modo oscuro o claro. Actual: ${theme}`}
    >
      {theme === 'dark' ? (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : theme === 'light' ? (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      )}
      <span className="theme-toggle-label">{theme === 'dark' ? 'Oscuro' : theme === 'light' ? 'Claro' : 'Auto'}</span>
    </button>
  )
}
