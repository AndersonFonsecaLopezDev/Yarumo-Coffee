import { test, expect } from '@playwright/test'

test.describe('Bloque 5 - Enlace de WhatsApp y Deep Links de Producto', () => {
  test('/?item=<id> abre el GalleryModal de producto en menos de 2s y limpia el parámetro', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const firstCard = page.locator('.item-card[id^="item-"]').first()
    const hasItems = await firstCard.isVisible({ timeout: 2000 }).catch(() => false)

    if (hasItems) {
      const fullId = await firstCard.getAttribute('id')
      expect(fullId).toBeTruthy()
      const itemId = fullId!.replace('item-', '')
      const expectedName = await firstCard.locator('.item-title').textContent()

      // Navegar a /?item=<id>
      const startTime = Date.now()
      await page.goto(`/?item=${itemId}`)

      // El modal de detalles debe abrirse automáticamente en menos de 2 segundos
      const modal = page.locator('.gallery-modal-card')
      await expect(modal).toBeVisible({ timeout: 2000 })
      const elapsed = Date.now() - startTime
      expect(elapsed).toBeLessThan(4000)

      // Título visible en el modal
      const modalTitle = modal.locator('#gallery-item-title')
      await expect(modalTitle).toBeVisible()
      if (expectedName) {
        await expect(modalTitle).toContainText(expectedName.trim())
      }

      // El parámetro ?item= debe haber sido limpiado de la URL
      await expect(page).toHaveURL(/\/(?!.*item=)/)
    } else {
      // Entorno local sin seed de base de datos: probar el deep link y verificación de aviso
      await page.goto('/?item=placeholder-item-1')
      await page.waitForLoadState('domcontentloaded')
      const notice = page.locator('.catalog-deeplink-notice')
      await expect(notice).toBeVisible()
      await expect(notice).toContainText(/no disponible|no longer available/i)
    }
  })

  test('/producto/<id> renderiza la home con modal abierto si existe o 404 si no', async ({ page, request }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const firstCard = page.locator('.item-card[id^="item-"]').first()
    const hasItems = await firstCard.isVisible({ timeout: 2000 }).catch(() => false)

    if (hasItems) {
      const fullId = await firstCard.getAttribute('id')
      const itemId = fullId!.replace('item-', '')
      const expectedName = await firstCard.locator('.item-title').textContent()

      await page.goto(`/producto/${itemId}`)
      await page.waitForLoadState('domcontentloaded')

      const modal = page.locator('.gallery-modal-card')
      await expect(modal).toBeVisible({ timeout: 2000 })

      const modalTitle = modal.locator('#gallery-item-title')
      await expect(modalTitle).toBeVisible()
      if (expectedName) {
        await expect(modalTitle).toContainText(expectedName.trim())
      }

      // Probar metadatos Open Graph
      const response = await request.get(`/producto/${itemId}`)
      expect(response.status()).toBe(200)
      const html = await response.text()
      expect(html).toContain('property="og:title"')
      expect(html).toContain('property="og:image"')
    } else {
      // Si el id no existe en BD, debe mostrar la pantalla not-found o responder 404
      const response = await page.goto('/producto/00000000-0000-0000-0000-000000000000')
      const isNotFoundPage = await page.locator('.empty-state').isVisible().catch(() => false)
      expect(response?.status() === 404 || isNotFoundPage).toBeTruthy()
      await expect(page.locator('.empty-state')).toBeVisible()
    }
  })

  test('con id inexistente en /?item=muestra aviso de no disponible y la carta sigue usable', async ({ page }) => {
    await page.goto('/?item=no-existe-xyz-999')
    await page.waitForLoadState('domcontentloaded')

    // Aviso visible
    const notice = page.locator('.catalog-deeplink-notice')
    await expect(notice).toBeVisible()
    await expect(notice).toContainText(/no disponible|no longer available/i)

    // La sección del catálogo sigue usable y visible en el DOM
    const catalogSection = page.locator('#menu')
    await expect(catalogSection).toBeVisible()
  })

  test('producto inexistente en /producto/id-invalido devuelve 404 o muestra pantalla not found', async ({ page }) => {
    const response = await page.goto('/producto/00000000-0000-0000-0000-000000000000')
    const isNotFoundPage = await page.locator('.empty-state').isVisible().catch(() => false)
    expect(response?.status() === 404 || isNotFoundPage).toBeTruthy()
    await expect(page.locator('.empty-state')).toBeVisible()
    await expect(page.locator('main')).toContainText(/No encontramos esta página|not found/i)
  })
})
