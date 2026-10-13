import { test, expect } from '@playwright/test'

test.describe('Bloque 9 - UX, accesibilidad, trampa de foco y objetivos táctiles', () => {
  test('trampa de foco en GalleryModal: tras 15 tabs el foco nunca sale del diálogo', async ({ page }) => {
    await page.goto('/')

    const firstMedia = page.locator('.item-media').first()
    const count = await firstMedia.count()
    if (count > 0) {
      await firstMedia.click()

      const modalDialog = page.locator('.gallery-modal-card')
      await expect(modalDialog).toBeVisible()

      // Pulsar Tab 15 veces y comprobar que activeElement siempre está contenido dentro del modal
      for (let i = 0; i < 15; i++) {
        await page.keyboard.press('Tab')
        const isInside = await page.evaluate(() => {
          const dialog = document.querySelector('.gallery-modal-card')
          return dialog ? dialog.contains(document.activeElement) : false
        })
        expect(isInside).toBe(true)
      }

      // Presionar Escape para cerrar y comprobar que se cierra
      await page.keyboard.press('Escape')
      await expect(modalDialog).not.toBeVisible()
    }
  })

  test('trampa de foco en el carrito: tras 15 tabs el foco nunca sale del diálogo', async ({ page }) => {
    // Sembramos un item en el carrito para que sea visible
    await page.addInitScript(() => {
      const item = {
        id: 'test-item-touch',
        name: 'Café Especial',
        price_cop: 6500,
        category: 'Café',
        sort_order: 1,
      }
      localStorage.setItem(
        'yarumo_customer_cart_v2',
        JSON.stringify({
          version: 2,
          savedAt: Date.now(),
          items: [{ id: 'line-1', item, quantity: 1, notes: 'Sin azúcar', effectivePrice: 6500 }],
        }),
      )
    })

    await page.goto('/')

    const floatingCart = page.locator('.floating-cart-btn')
    await expect(floatingCart).toBeVisible()
    await floatingCart.click()

    const cartDialog = page.locator('.cart-modal-dialog')
    await expect(cartDialog).toBeVisible()

    // 15 pulsaciones de Tab
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab')
      const isInside = await page.evaluate(() => {
        const dialog = document.querySelector('.cart-modal-dialog')
        return dialog ? dialog.contains(document.activeElement) : false
      })
      expect(isInside).toBe(true)
    }

    await page.keyboard.press('Escape')
    await expect(cartDialog).not.toBeVisible()
  })

  test('objetivos táctiles: los steppers y botones de control del carrito cumplen con al menos 40-44px', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const item = {
        id: 'test-item-touch',
        name: 'Café Especial',
        price_cop: 6500,
        category: 'Café',
        sort_order: 1,
      }
      localStorage.setItem(
        'yarumo_customer_cart_v2',
        JSON.stringify({
          version: 2,
          savedAt: Date.now(),
          items: [{ id: 'line-1', item, quantity: 1, notes: '', effectivePrice: 6500 }],
        }),
      )
    })

    await page.goto('/')

    const floatingCart = page.locator('.floating-cart-btn')
    await expect(floatingCart).toBeVisible()
    await floatingCart.click()

    const plusBtn = page.locator('.cart-qty-picker button').nth(1)
    await expect(plusBtn).toBeVisible()
    const box = await plusBtn.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeGreaterThanOrEqual(40)
    expect(box!.height).toBeGreaterThanOrEqual(40)

    const removeBtn = page.locator('.cart-remove-btn').first()
    const removeBox = await removeBtn.boundingBox()
    expect(removeBox).not.toBeNull()
    expect(removeBox!.height).toBeGreaterThanOrEqual(40)
  })
})
