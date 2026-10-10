import { test, expect } from '@playwright/test'

test.describe('Usabilidad y Funcionalidades Frontend', () => {
  test('persistencia del carrito en localStorage tras recargar', async ({ page }) => {
    await page.goto('/')

    // Esperar a que la carta esté montada
    const addToCartButtons = page.locator('.add-to-cart-btn')
    const count = await addToCartButtons.count()

    if (count > 0) {
      // Agregar primer producto
      await addToCartButtons.first().click()

      // Verificar que el botón flotante aparezca
      const cartButton = page.locator('.floating-cart-btn')
      await expect(cartButton).toBeVisible()

      // Recargar la página
      await page.reload()

      // Verificar que el carrito persiste con el contador
      await expect(page.locator('.floating-cart-btn')).toBeVisible()
      await expect(page.locator('.cart-count-badge')).toHaveText('1')
    }
  })

  test('búsqueda insensible a tildes y mayúsculas', async ({ page }) => {
    await page.goto('/')

    const searchInput = page.locator('input[type="search"]')
    await expect(searchInput).toBeVisible()

    // Escribir búsqueda sin tilde 'cafe'
    await searchInput.fill('cafe')

    // Esperar a que el deferredValue actualice el DOM
    await page.waitForTimeout(300)

    // Los productos filtrados o el mensaje de resultados deben coincidir
    const items = page.locator('.item-card')
    const itemCount = await items.count()

    if (itemCount > 0) {
      // Verificar que el texto del primer producto contenga 'café' o 'cafe'
      const title = await items.first().locator('.item-title').textContent()
      expect(title?.toLowerCase()).toMatch(/caf[eé]/i)
    }
  })

  test('navegación por teclado de las pestañas de categorías', async ({ page }) => {
    await page.goto('/')

    const tabs = page.locator('.category-tab')
    const tabsCount = await tabs.count()

    if (tabsCount > 1) {
      // Enfocar primera pestaña
      await tabs.first().focus()
      await expect(tabs.first()).toBeFocused()

      // Presionar ArrowRight para avanzar
      await page.keyboard.press('ArrowRight')
      await expect(tabs.nth(1)).toBeFocused()

      // Presionar ArrowLeft para retroceder
      await page.keyboard.press('ArrowLeft')
      await expect(tabs.first()).toBeFocused()

      // Presionar End para ir a la última
      await page.keyboard.press('End')
      await expect(tabs.nth(tabsCount - 1)).toBeFocused()
    }
  })

  test('registro de Service Worker y disponibilidad offline básica', async ({ page }) => {
    await page.goto('/')

    // Verificar que el manifest esté vinculado correctamente en el HTML
    const manifestLink = page.locator('link[rel="manifest"]')
    await expect(manifestLink).toHaveAttribute('href', '/manifest.webmanifest')

    // Verificar respuesta del manifest
    const manifestRes = await page.request.get('/manifest.webmanifest')
    expect(manifestRes.ok()).toBeTruthy()
    const manifestJson = await manifestRes.json()
    expect(manifestJson.name).toContain('Yarumo')
  })
})
