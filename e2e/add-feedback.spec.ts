import { test, expect } from '@playwright/test'

test.describe('Add to Cart Feedback & Note Reset', () => {
  test('al agregar un producto con nota, muestra confirmación, limpia la nota y el toast queda en capa superior', async ({ page }) => {
    await page.goto('/')

    const firstMedia = page.locator('.item-media').first()
    const hasItems = await firstMedia.isVisible({ timeout: 3000 }).catch(() => false)
    test.skip(!hasItems, 'Requiere al menos un producto en la carta para abrir el modal y probar el flujo.')

    await firstMedia.click()

    const modalDialog = page.locator('.gallery-modal-dialog')
    await expect(modalDialog).toBeVisible({ timeout: 5000 })

    const noteInput = page.locator('#modal-customer-notes')
    await expect(noteInput).toBeVisible()
    await noteInput.fill('Sin azúcar y con leche de avena')

    const addBtn = page.locator('#btn-modal-add-to-cart')
    await addBtn.click()

    // 1. Confirmación en el botón del modal
    await expect(addBtn).toContainText(/Agregado|Added/i)

    // 2. Banner de instrucción al barista visible
    const baristaFeedback = page.locator('.gallery-notes-feedback')
    await expect(baristaFeedback).toBeVisible()

    // 3. El campo de notas se limpia tras agregar
    await expect(noteInput).toHaveValue('')

    // 4. El toast notice se muestra y su z-index está por encima del modal overlay (z-index >= 150)
    const toast = page.locator('.toast-notice')
    await expect(toast).toBeVisible()

    const toastZIndex = await toast.evaluate((el) => {
      return parseInt(window.getComputedStyle(el).zIndex || '0', 10)
    })
    expect(toastZIndex).toBeGreaterThanOrEqual(150)
  })
})
