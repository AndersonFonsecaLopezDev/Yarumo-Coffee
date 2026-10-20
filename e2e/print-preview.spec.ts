import { test, expect } from '@playwright/test'

const staffEmail = process.env.E2E_STAFF_EMAIL
const staffPassword = process.env.E2E_STAFF_PASSWORD

test.describe('Print Menu Preview Layout & Sheet Containment', () => {
  test('con 3 columnas, Carta y orientación horizontal, los bloques de categorías quedan dentro de la hoja blanca', async ({ page }) => {
    if (!staffEmail || !staffPassword) {
      await page.route(/.*\/auth\/v1\/token.*/, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            access_token: 'fake-jwt-token',
            token_type: 'bearer',
            expires_in: 3600,
            refresh_token: 'fake-refresh-token',
            user: { id: '00000000-0000-0000-0000-000000000001', email: 'barista@yarumocoffee.com' },
          }),
        })
      })

      await page.route(/.*\/auth\/v1\/user.*/, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: '00000000-0000-0000-0000-000000000001',
            email: 'barista@yarumocoffee.com',
          }),
        })
      })

      // Ruta genérica fallback primero
      await page.route(/.*\/rest\/v1\/.*/, async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      })

      await page.route(/.*\/rest\/v1\/rpc\/get_my_role.*/, async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify('manager') })
      })

      await page.route(/.*\/rest\/v1\/menu_categories.*/, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 'cat-1', name: 'Bebidas Calientes', slug: 'bebidas-calientes', icon: '☕', sort_order: 1, active: true },
            { id: 'cat-2', name: 'Pastelería y Repostería', slug: 'pasteleria', icon: '🥐', sort_order: 2, active: true },
          ]),
        })
      })

      await page.route(/.*\/rest\/v1\/menu_items.*/, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 'i1', name: 'Café Tinto Campesino', price_cop: 4500, category: 'Bebidas Calientes', category_id: 'cat-1', description: 'Café suave tradicional', available: true, sort_order: 1 },
            { id: 'i2', name: 'Capuchino Vainilla', price_cop: 8000, category: 'Bebidas Calientes', category_id: 'cat-1', description: 'Espresso doble y leche espumada', available: true, sort_order: 2 },
            { id: 'i3', name: 'Croissant Tradicional', price_cop: 6500, category: 'Pastelería y Repostería', category_id: 'cat-2', description: 'Mantequilla pura y masa hojaldrada', available: true, sort_order: 3 },
          ]),
        })
      })
    }

    await page.goto('/staff?tab=menu')

    const emailInput = page.locator('#staff-email')
    if (await emailInput.isVisible({ timeout: 2500 }).catch(() => false)) {
      await emailInput.fill(staffEmail || 'barista@yarumocoffee.com')
      await page.locator('#staff-password').fill(staffPassword || 'password123')
      await page.locator('.login-submit-button').click()
      await page.waitForLoadState('networkidle')
    }

    const menuTabButton = page.locator('button[data-tab="menu"]')
    if (await menuTabButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await menuTabButton.click()
    }

    const printButton = page.locator('#btn-open-print-menu')
    await expect(printButton).toBeVisible({ timeout: 10000 })
    await printButton.click()

    const sheet = page.locator('#printable-menu')
    await expect(sheet).toBeVisible({ timeout: 10000 })

    // Verificar clases de Carta, horizontal y 3 columnas
    await expect(sheet).toHaveClass(/cols-3/)
    await expect(sheet).toHaveClass(/orientation-landscape/)
    await expect(sheet).toHaveClass(/paper-letter/)

    const sheetBox = await sheet.boundingBox()
    expect(sheetBox).not.toBeNull()

    // Aviso informativo de paginación
    const paginationNotice = page.locator('.print-pagination-notice')
    await expect(paginationNotice).toBeVisible()

    // Comprobar que todos los bloques de categoría están dentro de la hoja blanca
    const categoryBlocks = sheet.locator('.print-category-block')
    const blockCount = await categoryBlocks.count()
    expect(blockCount).toBeGreaterThan(0)

    for (let i = 0; i < blockCount; i++) {
      const block = categoryBlocks.nth(i)
      const blockBox = await block.boundingBox()
      expect(blockBox).not.toBeNull()

      if (sheetBox && blockBox) {
        expect(blockBox.x).toBeGreaterThanOrEqual(sheetBox.x - 2)
        expect(blockBox.x + blockBox.width).toBeLessThanOrEqual(sheetBox.x + sheetBox.width + 2)
      }
    }
  })
})
