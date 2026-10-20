import { test, expect } from '@playwright/test'

test.describe('Modal Footer Mobile Responsiveness', () => {
  test.use({ viewport: { width: 360, height: 740 } })

  test('con cantidad seleccionada, los controles del footer quedan contenidos dentro de .gallery-modal-card', async ({ page }) => {
    await page.goto('/')

    const firstMedia = page.locator('.item-media').first()
    const hasItems = await firstMedia.isVisible({ timeout: 3000 }).catch(() => false)
    test.skip(!hasItems, 'Requiere al menos un producto en la carta para abrir el modal y verificar controles móviles.')

    await firstMedia.click()

    const modalDialog = page.locator('.gallery-modal-dialog')
    await expect(modalDialog).toBeVisible({ timeout: 5000 })

    const addBtn = page.locator('#btn-modal-add-to-cart')
    await expect(addBtn).toBeVisible()

    // Agregar producto para activar stepper
    await addBtn.click()

    const stepper = page.locator('.gallery-modal-footer .item-stepper')
    if (await stepper.isVisible({ timeout: 2000 }).catch(() => false)) {
      const cardBox = await modalDialog.boundingBox()
      const stepperBox = await stepper.boundingBox()
      const addBtnBox = await addBtn.boundingBox()

      expect(cardBox).not.toBeNull()
      expect(stepperBox).not.toBeNull()
      expect(addBtnBox).not.toBeNull()

      if (cardBox && stepperBox && addBtnBox) {
        // Ningún control puede desbordar los límites del modal
        expect(stepperBox.x).toBeGreaterThanOrEqual(cardBox.x - 3)
        expect(stepperBox.x + stepperBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 3)

        expect(addBtnBox.x).toBeGreaterThanOrEqual(cardBox.x - 3)
        expect(addBtnBox.x + addBtnBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 3)
      }
    }
  })
})
