'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      process.env.NODE_ENV === 'production'
    ) {
      const register = () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            registration.update().catch(() => {})
          })
          .catch((err) => {
            console.debug('Service Worker no registrado:', err)
          })
      }

      if (document.readyState === 'complete') {
        register()
      } else {
        window.addEventListener('load', register)
        return () => window.removeEventListener('load', register)
      }
    }
  }, [])

  return null
}
