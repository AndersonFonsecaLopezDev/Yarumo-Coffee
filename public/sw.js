// Service Worker para Yarumo Coffee (Stale-While-Revalidate)
const CACHE_NAME = 'yarumo-cache-v2'

const PRECACHE_URLS = [
  '/',
  '/manifest.webmanifest',
  '/yarumo-logo.webp',
  '/yarumo-logo.avif',
  '/icon-32.png',
  '/icon-192.png',
  '/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS)
    }).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key)
          }
        })
      )
    }).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Ignorar peticiones que no sean GET o que sean de APIs autenticadas de staff/auth
  if (request.method !== 'GET') return
  if (url.pathname.startsWith('/api/admin') || url.pathname.startsWith('/auth')) return

  // Estrategia Stale-While-Revalidate para la carta, imágenes y páginas
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(request)

      const networkFetch = fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          cache.put(request, networkResponse.clone())
        }
        return networkResponse
      }).catch(() => {
        // Fallback offline si la red falla y hay respuesta en caché
        return cachedResponse
      })

      return cachedResponse || networkFetch
    })
  )
})
