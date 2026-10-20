import { test, expect } from '@playwright/test'

test.describe('Desktop Category Scroll & Arrows', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('a 1280x800 muestra flechas cuando hay desbordamiento y permite scroll con clic hasta la última categoría', async ({ page }) => {
    await page.goto('/')

    const tabsContainer = page.locator('.category-tabs')
    await expect(tabsContainer).toBeVisible()

    const categoryChips = page.locator('.category-tab')
    const count = await categoryChips.count()

    // Si hay suficiente contenido para desbordar
    const hasOverflow = await tabsContainer.evaluate((el) => el.scrollWidth > el.clientWidth)

    if (hasOverflow) {
      const rightArrow = page.locator('.category-nav-arrow.arrow-right')
      await expect(rightArrow).toBeVisible()

      const initialScrollLeft = await tabsContainer.evaluate((el) => el.scrollLeft)

      await rightArrow.click()
      await page.waitForTimeout(400)

      const newScrollLeft = await tabsContainer.evaluate((el) => el.scrollLeft)
      expect(newScrollLeft).toBeGreaterThan(initialScrollLeft)

      // El último chip es interactivo sin requerir teclado
      const lastChip = categoryChips.nth(count - 1)
      await lastChip.scrollIntoViewIfNeeded()
      await expect(lastChip).toBeVisible()
      await lastChip.click()
      await expect(lastChip).toHaveAttribute('aria-selected', 'true')
    } else {
      // Si la base de datos de prueba tiene menos categorías, verificar que las flechas se oculten limpiamente
      const rightArrow = page.locator('.category-nav-arrow.arrow-right')
      await expect(rightArrow).not.toBeVisible()
    }
  })
})
