import { test, expect } from '@playwright/test'

const staffEmail = process.env.E2E_STAFF_EMAIL
const staffPassword = process.env.E2E_STAFF_PASSWORD

test.describe('Staff Activity Filters Mobile Responsiveness', () => {
  test.use({ viewport: { width: 390, height: 844 } })

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
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ id: 'tbl-1', label: '1', public_token: 'tok-1', active: true }]),
        })
      })

      await page.route(/.*\/rest\/v1\/service_requests.*/, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 'req-1', table_id: 'tbl-1', type: 'waiter', status: 'pending', created_at: new Date().toISOString(), table: { label: '1' } },
          ]),
        })
      })

      await page.route(/.*\/rest\/v1\/order_requests.*/, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'ord-1',
              table_id: 'tbl-1',
              status: 'pending',
              notes: '',
              created_at: new Date().toISOString(),
              table: { label: '1' },
              items: [{ id: 'it-1', name_snapshot: 'Café', price_cop_snapshot: 5000, quantity: 1, item_notes: '' }],
            },
          ]),
        })
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

  test('a 390x844 la altura de .staff-filter-card <= 220px y el texto Solicitudes no está recortado', async ({ page }) => {
    await page.goto('/staff?tab=activity')

    const emailInput = page.locator('input[type="email"]')
    if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await emailInput.fill(staffEmail || 'barista@yarumocoffee.com')
      await page.locator('input[type="password"]').fill(staffPassword || 'password123')
      await page.locator('button[type="submit"]').click()
      await page.waitForLoadState('networkidle')
    }

    const filterCard = page.locator('.staff-filter-card')
    await expect(filterCard).toBeVisible({ timeout: 10000 })

    const box = await filterCard.boundingBox()
    expect(box).not.toBeNull()
    if (box) {
      // Criterio de aceptación: altura <= 220 px a 390px
      expect(box.height).toBeLessThanOrEqual(220)
    }

    // Verificar texto completo sin recorte en control segmentado
    const requestsSegmentBtn = filterCard.locator('.segmented-btn').filter({ hasText: /Solicitudes/i }).first()
    await expect(requestsSegmentBtn).toBeVisible()

    const isTruncated = await requestsSegmentBtn.evaluate((el) => {
      return el.scrollWidth > el.clientWidth
    })
    expect(isTruncated).toBe(false)
  })
})
