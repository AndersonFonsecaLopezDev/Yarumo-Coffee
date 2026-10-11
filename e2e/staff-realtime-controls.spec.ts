import { test, expect } from '@playwright/test'

const staffEmail = process.env.E2E_STAFF_EMAIL
const staffPassword = process.env.E2E_STAFF_PASSWORD

test.describe('Controles de Realtime, Alertas Sonoras y Resiliencia del Panel (/staff)', () => {
  test.beforeEach(async ({ page }) => {
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
          body: JSON.stringify([]),
        })
      })

      await page.route(/.*\/rest\/v1\/cafe_tables.*/, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 'tbl-1', label: '1', public_token: 'tok-1', active: true },
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
    }
  })

  test('muestra el indicador de conexión realtime, botón de refresco y toggle de alertas sonoras persistente', async ({ page }) => {
    await page.goto('/staff')

    // Si aparece login modal, iniciar sesión
    const emailInput = page.locator('input[type="email"]')
    if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await emailInput.fill(staffEmail || 'barista@yarumocoffee.com')
      await page.locator('input[type="password"]').fill(staffPassword || 'password123')
      await page.locator('button[type="submit"]').click()
      await page.waitForLoadState('networkidle')
    }

    // 1. Verificar presencia del badge de conexión
    const connectionBadge = page.locator('.staff-connection-badge')
    await expect(connectionBadge).toBeVisible()

    // 2. Verificar botón de refresco manual
    const refreshBtn = page.locator('#btn-staff-manual-refresh')
    await expect(refreshBtn).toBeVisible()
    await refreshBtn.click()

    // 3. Verificar toggle de alertas sonoras
    const soundToggle = page.locator('#btn-staff-sound-toggle')
    await expect(soundToggle).toBeVisible()
    await expect(soundToggle).toHaveText('🔔')

    // Silenciar alertas sonoras
    await soundToggle.click()
    await expect(soundToggle).toHaveText('🔕')

    // Verificar persistencia en localStorage
    const savedSetting = await page.evaluate(() => localStorage.getItem('yarumo_staff_sound'))
    expect(savedSetting).toBe('false')

    // Reactivar alertas sonoras
    await soundToggle.click()
    await expect(soundToggle).toHaveText('🔔')
    const savedAfterReenable = await page.evaluate(() => localStorage.getItem('yarumo_staff_sound'))
    expect(savedAfterReenable).toBe('true')
  })
})
