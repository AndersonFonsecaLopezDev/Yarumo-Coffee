import { test, expect } from '@playwright/test'

const viewports = [
  { name: 'mobile', width: 360, height: 740 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
]

test.describe('Bloque 2 - Lupa y padding en buscadores de staff', () => {
  test.beforeEach(async ({ page }) => {
    // Mocks de autenticación y datos de staff
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

    await page.route(/.*\/rest\/v1\/rpc\/get_my_role.*/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify('manager'),
      })
    })

    await page.route(/.*\/rest\/v1\/menu_categories.*/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'cat-1', name: 'Bebidas Calientes', slug: 'bebidas-calientes', icon: '☕', sort_order: 1, active: true },
        ]),
      })
    })

    await page.route(/.*\/rest\/v1\/menu_items.*/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'item-1',
            category_id: 'cat-1',
            category: 'Bebidas Calientes',
            name: 'Cappuccino Yarumo',
            description: 'Café con leche',
            price_cop: 7500,
            available: true,
            image_url: null,
            sort_order: 1,
          },
        ]),
      })
    })

    await page.route(/.*\/rest\/v1\/cafe_tables.*/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'tbl-1', label: '1', public_token: 'tbl-tok-1', active: true },
        ]),
      })
    })

    await page.route(/.*\/rest\/v1\/service_requests.*/, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })

    await page.route(/.*\/rest\/v1\/order_requests.*/, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })

    await page.route(/.*\/rest\/v1\/promotions.*/, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })

    await page.route(/.*\/rest\/v1\/recommendations.*/, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })
  })

  for (const vp of viewports) {
    for (const theme of ['light', 'dark'] as const) {
      test(`verifica padding-left >= 36px y que el icono no tape el texto en ${vp.name} (${theme})`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height })

        // Configurar tema en localStorage / DOM
        await page.addInitScript((th) => {
          localStorage.setItem('yarumo_theme', th)
          if (th === 'dark') {
            document.documentElement.classList.add('dark')
          } else {
            document.documentElement.classList.remove('dark')
          }
        }, theme)

        await page.goto('/staff?tab=activity')

        // Login si es necesario
        const emailInput = page.locator('input[type="email"]')
        if (await emailInput.isVisible({ timeout: 1500 }).catch(() => false)) {
          await emailInput.fill('barista@yarumocoffee.com')
          await page.locator('input[type="password"]').fill('password123')
          await page.locator('button[type="submit"]').click()
          await page.waitForLoadState('networkidle')
        }

        // 1. Validar #activity-search-input
        const activityInput = page.locator('#activity-search-input')
        await expect(activityInput).toBeVisible()
        const actPadLeft = await activityInput.evaluate((el) => parseFloat(window.getComputedStyle(el).paddingLeft))
        expect(actPadLeft).toBeGreaterThanOrEqual(36)

        const actIcon = page.locator('.filter-search-icon').first()
        const actIconBox = await actIcon.boundingBox()
        const actInputBox = await activityInput.boundingBox()
        expect(actIconBox).not.toBeNull()
        expect(actInputBox).not.toBeNull()
        if (actIconBox && actInputBox) {
          // El borde derecho del icono debe ser menor o igual al inicio del contenido del input (inputBox.x + paddingLeft)
          expect(actIconBox.x + actIconBox.width).toBeLessThanOrEqual(actInputBox.x + actPadLeft)
        }

        // 2. Abrir comanda manual para validar .manual-search-input
        const manualOrderBtn = page.locator('.btn-manual-order-primary')
        if (await manualOrderBtn.isVisible()) {
          await manualOrderBtn.click()
          const manualInput = page.locator('.manual-search-input')
          await expect(manualInput).toBeVisible()
          const manualPadLeft = await manualInput.evaluate((el) => parseFloat(window.getComputedStyle(el).paddingLeft))
          expect(manualPadLeft).toBeGreaterThanOrEqual(36)

          const manualIcon = page.locator('.manual-search-icon')
          const manualIconBox = await manualIcon.boundingBox()
          const manualInputBox = await manualInput.boundingBox()
          expect(manualIconBox).not.toBeNull()
          expect(manualInputBox).not.toBeNull()
          if (manualIconBox && manualInputBox) {
            expect(manualIconBox.x + manualIconBox.width).toBeLessThanOrEqual(manualInputBox.x + manualPadLeft)
          }

          // Cerrar modal de comanda manual
          await page.locator('.cart-modal-close').click()
        }

        // 3. Validar #menu-search-input en la pestaña de menú
        await page.locator('button[data-tab="menu"]').click()
        const menuInput = page.locator('#menu-search-input')
        await expect(menuInput).toBeVisible()
        const menuPadLeft = await menuInput.evaluate((el) => parseFloat(window.getComputedStyle(el).paddingLeft))
        expect(menuPadLeft).toBeGreaterThanOrEqual(36)

        const menuIcon = page.locator('.filter-search-icon').first()
        const menuIconBox = await menuIcon.boundingBox()
        const menuInputBox = await menuInput.boundingBox()
        expect(menuIconBox).not.toBeNull()
        expect(menuInputBox).not.toBeNull()
        if (menuIconBox && menuInputBox) {
          expect(menuIconBox.x + menuIconBox.width).toBeLessThanOrEqual(menuInputBox.x + menuPadLeft)
        }
      })
    }
  }
})
