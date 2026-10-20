import { test, expect } from '@playwright/test'

const staffEmail = process.env.E2E_STAFF_EMAIL
const staffPassword = process.env.E2E_STAFF_PASSWORD

test.describe('Staff Navigation & Header Links', () => {
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
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify('manager') })
      })
      await page.route(/.*\/rest\/v1\/cafe_tables.*/, async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      })
      await page.route(/.*\/rest\/v1\/service_requests.*/, async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      })
      await page.route(/.*\/rest\/v1\/order_requests.*/, async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      })
      await page.route(/.*\/rest\/v1\/menu_categories.*/, async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      })
      await page.route(/.*\/rest\/v1\/menu_items.*/, async (route) => {
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

  test('el encabezado de staff incluye enlace "Ver menú" a "/" y la pestaña Ayuda no contiene emojis', async ({ page }) => {
    await page.goto('/staff')

    const emailInput = page.locator('input[type="email"]')
    if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await emailInput.fill(staffEmail || 'barista@yarumocoffee.com')
      await page.locator('input[type="password"]').fill(staffPassword || 'password123')
      await page.locator('button[type="submit"]').click()
      await page.waitForLoadState('networkidle')
    }

    // 1. Enlace a "/" en el header de staff
    const viewMenuBtn = page.locator('.staff-header-actions .btn-view-menu')
    await expect(viewMenuBtn).toBeVisible({ timeout: 10000 })
    await expect(viewMenuBtn).toHaveAttribute('href', '/')
    await expect(viewMenuBtn).toContainText(/Ver menú/i)

    // 2. Pestaña de ayuda sin emoji 📖
    const helpTabBtn = page.locator('button[data-tab="help"]')
    await expect(helpTabBtn).toBeVisible()
    const helpTabText = (await helpTabBtn.textContent()) || ''
    expect(helpTabText.trim()).toBe('Ayuda')
    expect(helpTabText).not.toContain('📖')

    // 3. Título de HelpTab sin emoji 📖
    await helpTabBtn.click()
    const helpHeading = page.locator('.help-tab-pane h2').first()
    await expect(helpHeading).toBeVisible()
    const helpHeadingText = (await helpHeading.textContent()) || ''
    expect(helpHeadingText).not.toContain('📖')
  })
})
