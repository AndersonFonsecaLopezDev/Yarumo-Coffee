import { test, expect } from '@playwright/test'

const staffEmail = process.env.E2E_STAFF_EMAIL
const staffPassword = process.env.E2E_STAFF_PASSWORD

test.describe('Filtros del Panel de Staff (/staff)', () => {
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
            { id: 'cat-2', name: 'Pastelería', slug: 'pasteleria', icon: '🥐', sort_order: 2, active: true },
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
              description: 'Café de origen con leche vaporizada',
              price_cop: 7500,
              available: true,
              image_url: 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=400',
              sort_order: 1,
            },
            {
              id: 'item-2',
              category_id: 'cat-2',
              category: 'Pastelería',
              name: 'Croissant de Almendras',
              description: 'Croissant hojaldrado relleno de crema de almendras',
              price_cop: 9000,
              available: false,
              image_url: null,
              sort_order: 2,
            },
            {
              id: 'item-3',
              category_id: 'cat-1',
              category: 'Bebidas Calientes',
              name: 'Espresso Doble',
              description: 'Extracción corta de café de origen',
              price_cop: 5000,
              available: true,
              image_url: null,
              sort_order: 3,
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
            { id: 'tbl-2', label: '2', public_token: 'tbl-tok-2', active: true },
          ]),
        })
      })

      await page.route(/.*\/rest\/v1\/service_requests.*/, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'req-1',
              table_id: 'tbl-1',
              type: 'waiter',
              status: 'pending',
              created_at: new Date(Date.now() - 360000).toISOString(),
              table: { label: '1' },
            },
          ]),
        })
      })

      await page.route(/.*\/rest\/v1\/order_requests.*/, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'ord-100',
              table_id: 'tbl-1',
              status: 'pending',
              notes: 'Sin azúcar por favor',
              created_at: new Date(Date.now() - 600000).toISOString(),
              acknowledged_at: null,
              delivered_at: null,
              table: { label: '1' },
              items: [
                {
                  id: 'oi-1',
                  name_snapshot: 'Cappuccino Yarumo',
                  price_cop_snapshot: 7500,
                  quantity: 2,
                  item_notes: 'Leche de avena',
                },
              ],
            },
          ]),
        })
      })

      await page.route(/.*\/rest\/v1\/promotions.*/, async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      })

      await page.route(/.*\/rest\/v1\/recommendations.*/, async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      })
    }
  })

  test('filtra productos en MenuTab, actualiza URL con debounce y limpia filtros', async ({ page }) => {
    await page.goto('/staff?tab=menu')

    // Si aparece login modal, iniciar sesión mock
    const emailInput = page.locator('input[type="email"]')
    if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await emailInput.fill(staffEmail || 'barista@yarumocoffee.com')
      await page.locator('input[type="password"]').fill(staffPassword || 'password123')
      await page.locator('button[type="submit"]').click()
      await page.waitForLoadState('networkidle')
    }

    // Asegurarse de estar en la pestaña de menú
    const menuTabBtn = page.locator('button[data-tab="menu"]')
    if (await menuTabBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await menuTabBtn.click()
    }

    // Verificar presencia del buscador de menú
    const searchInput = page.locator('#menu-search-input')
    await expect(searchInput).toBeVisible()

    // Escribir búsqueda "Croissant"
    await searchInput.fill('Croissant')

    // Verificar actualización de la URL con prefijo menu_q
    await expect(page).toHaveURL(/.*menu_q=Croissant.*/, { timeout: 4000 })

    // Verificar que solo se visualice Croissant de Almendras
    await expect(page.locator('text=Croissant de Almendras')).toBeVisible()
    await expect(page.locator('text=Cappuccino Yarumo')).not.toBeVisible()

    // Probar chip de filtro activo
    const chip = page.locator('.filter-chip:has-text("Croissant")')
    await expect(chip).toBeVisible()

    // Hacer clic en limpiar filtros
    const clearBtn = page.locator('#btn-clear-menu-filters')
    await clearBtn.click()

    // Ambos productos deben reaparecer
    await expect(page.locator('text=Cappuccino Yarumo')).toBeVisible()
    await expect(page.locator('text=Croissant de Almendras')).toBeVisible()
  })

  test('filtra actividad por texto y comanda con persistencia en URL', async ({ page }) => {
    await page.goto('/staff?tab=activity')

    const emailInput = page.locator('input[type="email"]')
    if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await emailInput.fill(staffEmail || 'barista@yarumocoffee.com')
      await page.locator('input[type="password"]').fill(staffPassword || 'password123')
      await page.locator('button[type="submit"]').click()
      await page.waitForLoadState('networkidle')
    }

    const activitySearch = page.locator('#activity-search-input')
    await expect(activitySearch).toBeVisible()

    await activitySearch.fill('avena')
    await expect(page).toHaveURL(/.*act_q=avena.*/, { timeout: 4000 })

    // Debe mostrar la comanda que contiene 'avena'
    await expect(page.locator('text=Cappuccino Yarumo')).toBeVisible()
  })
})
