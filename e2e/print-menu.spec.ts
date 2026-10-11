import { test, expect } from '@playwright/test'

const staffEmail = process.env.E2E_STAFF_EMAIL
const staffPassword = process.env.E2E_STAFF_PASSWORD

test.describe('Impresión de Carta de Menú (/staff)', () => {
  test('abre el modal de impresión en #print-root y en media print solo muestra la carta sin controles ni sidebar', async ({ page }) => {
    // Si no hay credenciales reales, interceptamos las llamadas a Supabase para permitir testeo determinista en CI
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
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
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
            { id: 'cat-2', name: 'Bebidas Frías', slug: 'bebidas-frias', icon: '🧊', sort_order: 2, active: true },
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
              name: 'Espresso Yarumo',
              price_cop: 5500,
              category: 'Bebidas Calientes',
              category_id: 'cat-1',
              description: 'Notas a panela y frutos rojos del Quindío',
              available: true,
              sort_order: 1,
            },
            {
              id: 'item-2',
              name: 'Cold Brew Naranjal',
              price_cop: 8900,
              category: 'Bebidas Frías',
              category_id: 'cat-2',
              description: 'Extracción en frío durante 18 horas',
              available: true,
              sort_order: 2,
            },
          ]),
        })
      })
    }

    await page.goto('/staff?tab=menu')

    // Iniciar sesión
    const emailInput = page.locator('#staff-email')
    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await emailInput.fill(staffEmail || 'barista@yarumocoffee.com')
      await page.locator('#staff-password').fill(staffPassword || 'password12345')
      await page.locator('.login-submit-button').click()
      await page.waitForLoadState('networkidle')
    }

    // Ir a pestaña Menú si no está seleccionada
    const menuTabButton = page.locator('button[data-tab="menu"]')
    if (await menuTabButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await menuTabButton.click()
    }

    // Abrir modal de imprimir
    const printButton = page.locator('#btn-open-print-menu')
    await expect(printButton).toBeVisible()
    await printButton.click()

    // Verificar que el modal se renderizó dentro del portal #print-root
    const printRoot = page.locator('#print-root')
    await expect(printRoot).toBeAttached()

    const printableMenu = printRoot.locator('#printable-menu')
    await expect(printableMenu).toBeVisible()
    await expect(printableMenu).toContainText('YARUMO COFFEE')
    await expect(printableMenu).toContainText('CAFÉ ESPECIAL DE ORIGEN')

    // Verificar controles del modal antes de imprimir
    const triggerPrintBtn = page.locator('#btn-trigger-print')
    await expect(triggerPrintBtn).toBeVisible()
    await expect(page.locator('#btn-download-pdf')).toBeVisible()

    // Emular modo de medios "print" (como hace el navegador al abrir la vista de impresión)
    await page.emulateMedia({ media: 'print' })

    // Verificar que la carta sigue visible dentro de #print-root
    await expect(printableMenu).toBeVisible()

    // Verificar que los elementos no imprimibles están ocultos por CSS
    await expect(page.locator('.sidebar')).toBeHidden()
    await expect(page.locator('.staff-header')).toBeHidden()
    await expect(page.locator('.print-modal-toolbar')).toBeHidden()
    await expect(triggerPrintBtn).toBeHidden()

    // Restaurar medio a pantalla
    await page.emulateMedia({ media: 'screen' })

    // Cerrar el modal
    await page.locator('#btn-close-print-modal').click()
    await expect(printableMenu).toBeHidden()
  })
})
