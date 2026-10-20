import { test, expect } from '@playwright/test'

const viewports = [
  { name: '360x740', width: 360, height: 740 },
  { name: '390x844', width: 390, height: 844 },
]

test.describe('Mobile Header & Navbar Responsiveness', () => {
  for (const vp of viewports) {
    test(`Header a ${vp.name} sin scroll horizontal y con separación >= 12px`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto('/')

      const header = page.locator('header.header')
      await expect(header).toBeVisible()

      // Verificar que no haya scroll horizontal en el documento
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth
      })
      expect(hasHorizontalScroll).toBe(false)

      const brand = page.locator('.brand')
      const actions = page.locator('.header-actions')
      await expect(brand).toBeVisible()
      await expect(actions).toBeVisible()

      const brandBox = await brand.boundingBox()
      const actionsBox = await actions.boundingBox()

      expect(brandBox).not.toBeNull()
      expect(actionsBox).not.toBeNull()

      if (brandBox && actionsBox) {
        // La distancia horizontal entre el fin de la marca y el inicio de las acciones debe ser >= 12 px
        const distance = actionsBox.x - (brandBox.x + brandBox.width)
        expect(distance).toBeGreaterThanOrEqual(11.5)
      }
    })

    test(`Header a ${vp.name} con badge de mesa (?mesa=4) sin desborde`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto('/?mesa=4')

      const header = page.locator('header.header')
      await expect(header).toBeVisible()

      const tableBadge = page.locator('.header-table-badge')
      await expect(tableBadge).toBeVisible()

      // Sin scroll horizontal a pesar del badge
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth
      })
      expect(hasHorizontalScroll).toBe(false)
    })
  }
})
