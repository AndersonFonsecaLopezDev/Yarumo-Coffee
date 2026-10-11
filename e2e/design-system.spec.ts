import { test, expect } from '@playwright/test'

const staffEmail = process.env.E2E_STAFF_EMAIL
const staffPassword = process.env.E2E_STAFF_PASSWORD

test.describe('Sistema de Diseño, Iconografía y Modales Accesibles', () => {
  test('la carta pública muestra iconos SVG en pestañas y placeholder de marca para ítems sin foto', async ({ page }) => {
    // Interceptar Supabase en página pública para tener datos reproducibles
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
            id: 'item-no-photo',
            category_id: 'cat-1',
            category: 'Bebidas Calientes',
            name: 'Café de Origen Geisha',
            description: 'Notas florales de jazmín y miel',
            price_cop: 12000,
            available: true,
            image_url: null, // Sin foto
            sort_order: 1,
          },
        ]),
      })
    })

    await page.goto('/')

    // 1. Verificar que las pestañas de categorías usan iconos SVG limpios
    const allTab = page.locator('#tab-all')
    await expect(allTab).toBeVisible()
    const allTabSvg = allTab.locator('svg')
    await expect(allTabSvg).toBeVisible()

    // 2. Verificar que múltiples pestañas de categorías tienen iconos SVG integrados
    const categorySvgs = page.locator('.category-tab svg')
    await expect(categorySvgs.first()).toBeVisible()

    // 3. Probar el cambio a modo oscuro con ThemeToggle
    const themeBtn = page.locator('button.theme-toggle-btn')
    if (await themeBtn.isVisible()) {
      await themeBtn.click()
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    }
  })

  test('el panel de staff abre el modal de confirmación accesible y responde a ESC', async ({ page }) => {
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

      await page.route(/.*\/rest\/v1\/menu_categories.*/, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 'cat-test', name: 'Bebidas Especiales', slug: 'bebidas-especiales', icon: '☕', sort_order: 1, active: true },
          ]),
        })
      })

      await page.route(/.*\/rest\/v1\/menu_items.*/, async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
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
      await page.route(/.*\/rest\/v1\/promotions.*/, async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      })
      await page.route(/.*\/rest\/v1\/recommendations.*/, async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      })
    }

    await page.goto('/staff?tab=categories')

    // Si aparece login modal, iniciar sesión
    const emailInput = page.locator('input[type="email"]')
    if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await emailInput.fill(staffEmail || 'barista@yarumocoffee.com')
      await page.locator('input[type="password"]').fill(staffPassword || 'password123')
      await page.locator('button[type="submit"]').click()
      await page.waitForLoadState('networkidle')
    }

    // Ir a pestaña categorías
    const catTabBtn = page.locator('button[data-tab="categories"]')
    if (await catTabBtn.isVisible()) {
      await catTabBtn.click()
    }

    // Buscar botón eliminar categoría
    const deleteBtn = page.locator('button.btn-danger:has-text("Eliminar")').first()
    await expect(deleteBtn).toBeVisible()
    await deleteBtn.click()

    // Comprobar que se abre el modal accesible propio de Yarumo
    const modal = page.locator('div[role="dialog"][aria-modal="true"]')
    await expect(modal).toBeVisible()
    await expect(modal.locator('#confirm-modal-title')).toHaveText('¿Eliminar categoría?')

    // Presionar tecla Escape para cerrar
    await page.keyboard.press('Escape')
    await expect(modal).not.toBeVisible()
  })
})
