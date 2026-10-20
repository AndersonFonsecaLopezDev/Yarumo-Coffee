// Service Worker para Yarumo Coffee
// Versión 5: Network-First para navegación pública con respaldo en caché offline.
// Excluye expresamente /staff, APIs, Auth y llamadas REST autenticadas.
const CACHE_NAME = 'yarumo-cache-v5'
const MAX_IMAGE_ENTRIES = 80

const PRECACHE_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/yarumo-logo.webp',
  '/yarumo-logo.avif',
  '/yarumo-cover-cafe.webp',
  '/icon-32.png',
  '/icon-192.png',
  '/icon-512.png',
]

// Poda LRU/FIFO para mantener las imágenes cacheadas bajo el límite de entradas
async function pruneCacheEntries(cacheName, maxEntries) {
  try {
    const cache = await caches.open(cacheName)
    const keys = await cache.keys()
    const imageKeys = keys.filter((req) => {
      const u = new URL(req.url)
      return (
        u.pathname.endsWith('.webp') ||
        u.pathname.endsWith('.avif') ||
        u.pathname.endsWith('.png') ||
        u.pathname.endsWith('.jpg') ||
        u.pathname.endsWith('.jpeg') ||
        u.pathname.includes('/storage/v1/object/public/')
      )
    })

    if (imageKeys.length > maxEntries) {
      const countToDelete = imageKeys.length - maxEntries
      for (let i = 0; i < countToDelete; i++) {
        await cache.delete(imageKeys[i])
      }
    }
  } catch {}
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(async (cache) => {
        await Promise.allSettled(
          PRECACHE_ASSETS.map(async (asset) => {
            try {
              const res = await fetch(asset)
              if (res && res.status === 200) {
                await cache.put(asset, res)
              }
            } catch {}
          }),
        )
      })
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key)
            }
          }),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  // 1. Solo cachear peticiones GET
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // 2. EXCLUSIÓN ESTRICTA: Rutas de administración, autenticación y endpoints de API
  if (
    url.pathname.startsWith('/staff') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth') ||
    url.pathname.includes('/auth/')
  ) {
    return
  }

  // 3. EXCLUSIÓN ESTRICTA: Llamadas a APIs de Supabase (REST, Auth, Realtime)
  if (
    url.hostname.endsWith('supabase.co') &&
    (url.pathname.startsWith('/rest/v1') ||
      url.pathname.startsWith('/auth/v1') ||
      url.pathname.startsWith('/realtime/v1'))
  ) {
    return
  }

  // 4. Si la petición incluye cabecera Authorization, no cachear
  if (request.headers.has('authorization')) {
    return
  }

  // 5. Estrategia por tipo de recurso:
  // A. Recursos estáticos inmutables de Next.js (_next/static/) e imágenes: Cache-First con fallback a red
  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.avif') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.svg') ||
    (url.hostname.endsWith('supabase.co') && url.pathname.startsWith('/storage/v1/object/public/'))

  if (isStaticAsset) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request)
        if (cached) return cached

        try {
          const networkRes = await fetch(request)
          if (networkRes && networkRes.status === 200) {
            cache.put(request, networkRes.clone())
            void pruneCacheEntries(CACHE_NAME, MAX_IMAGE_ENTRIES)
          }
          return networkRes
        } catch {
          return cached || new Response('', { status: 408 })
        }
      }),
    )
    return
  }

  // B. Páginas públicas (/ y /recomendaciones): Network-First con respaldo en caché solo sin conexión
  const isPublicPage =
    url.origin === self.location.origin &&
    (url.pathname === '/' || url.pathname === '/recomendaciones' || url.pathname.startsWith('/producto/'))

  if (isPublicPage) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone)
            })
          }
          return networkResponse
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME)
          const cachedResponse = await cache.match(request)
          if (cachedResponse) {
            return cachedResponse
          }
          // Fallback a la raíz si no hay coincidencia exacta de ruta
          const rootFallback = await cache.match('/')
          if (rootFallback) return rootFallback
          return new Response('Sin conexión', { status: 503, headers: { 'Content-Type': 'text/plain' } })
        }),
    )
  }
})

