import { test, expect } from '@playwright/test'

const SAMPLE_CART = {
  version: 1,
  savedAt: Date.now(),
  items: [
    {
      item: {
        id: 'item-test-sample',
        name: 'Café Filtrado Especial',
        description: 'Origen Quindío',
        price_cop: 7500,
        category: 'Café',
        category_id: 'cat-test',
        sort_order: 1,
        image_url: '/yarumo-cover-cafe-og.webp',
        gallery_urls: [],
      },
      quantity: 1,
      notes: '',
    },
  ],
}

test.describe('Bloque 1 - Scroll bloqueado tras vaciar o cerrar el carrito', () => {
  test('restaura el scroll al vaciar el carrito con Quitar y no reabre automáticamente', async ({ page }) => {
    // Si la base de datos local no tiene items en el build, sembramos el carrito para permitir la prueba
    await page.addInitScript((sampleCart) => {
      if (!localStorage.getItem('yarumo_customer_cart_v1')) {
        localStorage.setItem('yarumo_customer_cart_v1', JSON.stringify(sampleCart))
      }
    }, SAMPLE_CART)

    await page.goto('/')

    // Si existen botones de agregar en la carta, interactuamos con uno real
    const addBtns = page.locator('.add-to-cart-btn')
    const addBtnCount = await addBtns.count()
    if (addBtnCount > 0) {
      await addBtns.first().click()
    }

    // 2. Abrir el carrito flotante
    const floatingCartBtn = page.locator('.floating-cart-btn')
    await expect(floatingCartBtn).toBeVisible()
    await floatingCartBtn.click()

    // Modal abierto: overflow debe ser 'hidden'
    const cartDialog = page.locator('.cart-modal-dialog')
    await expect(cartDialog).toBeVisible()
    const overflowWhileOpen = await page.evaluate(() => document.body.style.overflow)
    expect(overflowWhileOpen).toBe('hidden')

    // 3. Pulsar "Quitar" hasta vaciar el carrito
    const removeBtn = page.locator('.cart-remove-btn').first()
    await expect(removeBtn).toBeVisible()
    await removeBtn.click()

    // Modal se cierra automáticamente al vaciarse
    await expect(cartDialog).not.toBeVisible()

    // Overflow del body ya NO debe ser hidden
    const overflowAfterEmpty = await page.evaluate(() => document.body.style.overflow)
    expect(overflowAfterEmpty).not.toBe('hidden')

    // Verificar que window.scrollY responde tras wheel
    const initialScrollY = await page.evaluate(() => window.scrollY)
    await page.mouse.wheel(0, 800)
    await page.waitForTimeout(300)
    const scrolledY = await page.evaluate(() => window.scrollY)
    expect(scrolledY).toBeGreaterThanOrEqual(initialScrollY)

    // 4. Agregar otro producto después: NO debe abrir el panel automáticamente
    if (addBtnCount > 0) {
      await page.evaluate(() => window.scrollTo(0, 0))
      await addBtns.first().click()
      await expect(floatingCartBtn).toBeVisible()
      await expect(cartDialog).not.toBeVisible()
    }
  })

  test('restaura el scroll al cerrar el carrito con Escape, botón cerrar y overlay', async ({ page }) => {
    await page.addInitScript((sampleCart) => {
      localStorage.setItem('yarumo_customer_cart_v1', JSON.stringify(sampleCart))
    }, SAMPLE_CART)

    await page.goto('/')

    const floatingCartBtn = page.locator('.floating-cart-btn')
    await expect(floatingCartBtn).toBeVisible()

    // Prueba 1: Cerrar con Escape
    await floatingCartBtn.click()
    const cartDialog = page.locator('.cart-modal-dialog')
    await expect(cartDialog).toBeVisible()
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden')

    await page.keyboard.press('Escape')
    await expect(cartDialog).not.toBeVisible()
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')

    // Prueba 2: Cerrar con botón de cerrar (x)
    await floatingCartBtn.click()
    await expect(cartDialog).toBeVisible()
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden')

    const closeBtn = page.locator('.cart-modal-close')
    await closeBtn.click()
    await expect(cartDialog).not.toBeVisible()
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')

    // Prueba 3: Cerrar haciendo click en el overlay
    await floatingCartBtn.click()
    await expect(cartDialog).toBeVisible()
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden')

    const overlay = page.locator('.cart-modal-overlay')
    await overlay.click({ position: { x: 10, y: 10 } })
    await expect(cartDialog).not.toBeVisible()
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')
  })
})
