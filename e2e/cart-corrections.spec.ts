import { test, expect } from '@playwright/test'

const SAMPLE_V1_CART = {
  version: 1,
  savedAt: Date.now(),
  items: [
    {
      item: {
        id: 'item-migrated-1',
        name: 'Cappuccino de la Casa',
        description: 'Espresso doble con leche cremosa',
        price_cop: 8500,
        category: 'Bebidas Calientes',
        category_id: 'cat-hot',
        sort_order: 1,
        image_url: '/yarumo-cover-cafe-og.webp',
        gallery_urls: [],
      },
      quantity: 2,
      notes: 'Con canela',
    },
  ],
}

test.describe('Bloque 6 - Corrección del carrito, identificación por línea y vaciado', () => {
  test('dos notas distintas para el mismo producto generan dos líneas separadas y la tarjeta suma las cantidades', async ({
    page,
  }) => {
    await page.goto('/')

    // Sembrar dos líneas con notas distintas si no hay interacción directa
    const addBtns = page.locator('.add-to-cart-btn')
    const hasProducts = (await addBtns.count()) > 0

    if (hasProducts) {
      // 1. Abrir el modal de detalle del primer producto para agregar con nota 1
      const firstMedia = page.locator('.item-media').first()
      await firstMedia.click()

      const modalDialog = page.locator('.gallery-modal-dialog')
      await expect(modalDialog).toBeVisible()

      // Escribir nota personalizada 1
      const noteInput = page.locator('#modal-customer-notes')
      await noteInput.fill('Sin azúcar, por favor')

      const addBtn = page.locator('#btn-modal-add-to-cart')
      await addBtn.click()

      // Cerrar modal
      await page.keyboard.press('Escape')
      await expect(modalDialog).not.toBeVisible()

      // 2. Abrir nuevamente el modal para el mismo producto con nota 2
      await firstMedia.click()
      await expect(modalDialog).toBeVisible()

      // El botón ahora debe decir "modal_add_another" (Agregar otro)
      await expect(page.locator('#btn-modal-add-to-cart')).toContainText(/Agregar otro|Add another/i)

      await noteInput.fill('Con hielo extra')
      await addBtn.click()

      await page.keyboard.press('Escape')
      await expect(modalDialog).not.toBeVisible()

      // 3. Verificar que la tarjeta de producto muestra la suma total: 2 en el stepper
      const stepperQty = page.locator('.stepper-qty').first()
      await expect(stepperQty).toHaveText('2')

      // 4. Abrir el carrito
      const floatingCart = page.locator('.floating-cart-btn')
      await floatingCart.click()

      const cartDialog = page.locator('.cart-modal-dialog')
      await expect(cartDialog).toBeVisible()

      // Debe haber 2 líneas de producto
      const itemRows = page.locator('.cart-item-row')
      await expect(itemRows).toHaveCount(2)

      // Verificar que una línea tiene la nota 1 y la otra la nota 2
      await expect(itemRows.nth(0)).toContainText('Sin azúcar, por favor')
      await expect(itemRows.nth(1)).toContainText('Con hielo extra')

      // 5. Incrementar la cantidad de la primera línea: debe subir a 2 sin cambiar la segunda línea
      const plusBtnFirst = itemRows.nth(0).locator('.cart-qty-picker button').nth(1)
      await plusBtnFirst.click()

      await expect(itemRows.nth(0).locator('.cart-qty-picker span')).toHaveText('2')
      await expect(itemRows.nth(1).locator('.cart-qty-picker span')).toHaveText('1')

      // 6. Probar vaciar carrito con confirmación
      const clearBtn = page.locator('#btn-clear-cart')
      await expect(clearBtn).toBeVisible()
      await clearBtn.click()

      // Diálogo de confirmación debe ser visible
      const confirmDialog = page.locator('.confirm-modal-content')
      await expect(confirmDialog).toBeVisible()

      // Confirmar vaciado
      const confirmAcceptBtn = page.locator('.confirm-btn-danger, .confirm-modal-actions .btn-danger')
      await confirmAcceptBtn.click()

      // El carrito debe haberse vaciado y cerrado
      await expect(cartDialog).not.toBeVisible()
    } else {
      // Si corre en CI sin DB sembrada, validar persistencia e hidratación directa
      await page.evaluate(() => {
        const item = {
          id: 'test-item-manual',
          name: 'Café de Prueba',
          price_cop: 5000,
          category: 'Café',
          sort_order: 1,
        }
        localStorage.setItem(
          'yarumo_customer_cart_v2',
          JSON.stringify({
            version: 2,
            savedAt: Date.now(),
            items: [
              { id: 'line-1', item, quantity: 1, notes: 'Nota A', effectivePrice: 5000 },
              { id: 'line-2', item, quantity: 1, notes: 'Nota B', effectivePrice: 5000 },
            ],
          }),
        )
      })
      await page.reload()
      const floatingCart = page.locator('.floating-cart-btn')
      await expect(floatingCart).toBeVisible()
      await floatingCart.click()
      const itemRows = page.locator('.cart-item-row')
      await expect(itemRows).toHaveCount(2)
    }
  })

  test('migra elegantemente un carrito guardado en formato v1 a formato v2 sin romper la app', async ({ page }) => {
    // Sembramos formato antiguo en localStorage antes de que cargue la aplicación
    await page.addInitScript((sample) => {
      localStorage.setItem('yarumo_customer_cart_v1', JSON.stringify(sample))
      localStorage.removeItem('yarumo_customer_cart_v2')
    }, SAMPLE_V1_CART)

    await page.goto('/')

    // Verificar que el carrito flotante aparece y muestra la cantidad migrada (2)
    const floatingCart = page.locator('.floating-cart-btn')
    await expect(floatingCart).toBeVisible()

    // Abrir el carrito y verificar el ítem
    await floatingCart.click()
    const itemRows = page.locator('.cart-item-row')
    await expect(itemRows).toHaveCount(1)
    await expect(itemRows.first()).toContainText('Cappuccino de la Casa')
    await expect(itemRows.first()).toContainText('Con canela')

    // Verificar que en localStorage ahora existe la versión 2 con id asignado
    const savedV2 = await page.evaluate(() => {
      return localStorage.getItem('yarumo_customer_cart_v2')
    })
    expect(savedV2).not.toBeNull()
    const parsedV2 = JSON.parse(savedV2!)
    expect(parsedV2.version).toBe(2)
    expect(parsedV2.items[0].id).toBeDefined()
    expect(parsedV2.items[0].id.length).toBeGreaterThan(0)
  })
})
