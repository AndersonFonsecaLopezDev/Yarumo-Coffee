import { test, expect } from '@playwright/test'
import { SITE_URL } from '@/lib/site-url'

test.describe('Bloque 10 - Contenido, configuración centralizada y caché Network-First', () => {
  test('la firma de pedido por WhatsApp en OrderCart incluye el host de SITE_URL', async ({ page }) => {
    // Sembramos un item en el carrito para que aparezca el botón de enviar
    await page.addInitScript(() => {
      const item = {
        id: 'test-item-sign',
        name: 'Café Espresso Doble',
        price_cop: 7000,
        category: 'Café',
        sort_order: 1,
      }
      localStorage.setItem(
        'yarumo_customer_cart_v2',
        JSON.stringify({
          version: 2,
          savedAt: Date.now(),
          items: [{ id: 'line-sign-1', item, quantity: 1, notes: '', effectivePrice: 7000 }],
        }),
      )
    })

    await page.goto('/')

    const floatingCart = page.locator('.floating-cart-btn')
    await expect(floatingCart).toBeVisible()
    await floatingCart.click()

    // Llenar datos de entrega para domicilio
    await page.locator('#delivery-name').fill('Carlos Ramírez')
    await page.locator('#delivery-address').fill('Calle 10 # 14-20')
    await page.locator('#delivery-phone').fill('3151234567')

    // Interceptar la llamada a window.open para verificar la URL
    let interceptedUrl = ''
    await page.exposeFunction('mockWindowOpen', (url: string) => {
      interceptedUrl = url
    })
    await page.evaluate(() => {
      window.open = (url) => {
        ;(window as unknown as { mockWindowOpen: (u: string) => void }).mockWindowOpen(String(url))
        return null
      }
    })

    const submitBtn = page.locator('.btn-whatsapp-submit')
    await expect(submitBtn).toBeVisible()
    await submitBtn.click()

    expect(interceptedUrl).toContain('https://wa.me/')
    const decoded = decodeURIComponent(interceptedUrl)
    const expectedDomain = SITE_URL.replace(/^https?:\/\//, '')
    expect(decoded).toContain(`_Pedido generado desde ${expectedDomain}_`)
  })

  test('service worker v4: con offline tras una visita previa, la página carga desde caché', async ({
    page,
    context,
  }) => {
    // 1. Visitar online primero
    await page.goto('/')
    await expect(page.locator('h1')).toBeVisible()

    // Registrar y esperar a que el Service Worker esté activo
    await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.register('/sw.js')
        await navigator.serviceWorker.ready
        // Asegurar que el precache de la raíz esté listo
        const cache = await caches.open('yarumo-cache-v4')
        const existing = await cache.match('/')
        if (!existing) {
          const res = await fetch('/')
          if (res.ok) await cache.put('/', res)
        }
        return reg.active?.state
      }
      return null
    })

    // 2. Simular modo desconectado
    await context.setOffline(true)

    // 3. Recargar la página: debe responder desde la caché offline
    try {
      await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 15_000 })
      const title = await page.title()
      expect(title.length).toBeGreaterThan(0)
    } finally {
      // Restaurar conexión para no afectar otras pruebas
      await context.setOffline(false)
    }
  })
})
