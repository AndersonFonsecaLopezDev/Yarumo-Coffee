import { test, expect } from '@playwright/test'

// Requiere un usuario de prueba con rol `owner` o `manager` en staff_profiles.
// Define sus credenciales en E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD antes de
// correr `npm run test:e2e` (ver README, sección "Pruebas end-to-end").
const email = process.env.E2E_STAFF_EMAIL
const password = process.env.E2E_STAFF_PASSWORD

test.describe('Staff: login y creación de producto', () => {
  test.skip(!email || !password, 'Define E2E_STAFF_EMAIL y E2E_STAFF_PASSWORD (rol owner/manager) para correr este flujo.')

  test('un owner/manager inicia sesión, navega por las pestañas y crea un producto de menú', async ({ page }) => {
    await page.goto('/staff')

    await page.locator('#staff-email').fill(email!)
    await page.locator('#staff-password').fill(password!)
    await page.getByRole('button', { name: 'Entrar al panel' }).click()

    await expect(page.getByRole('button', { name: /^Pedidos/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Solicitudes/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Categorías/ })).toBeVisible()

    await page.getByRole('button', { name: /^Menú/ }).click()
    await page.getByRole('button', { name: '+ Nuevo producto' }).click()

    const productName = `Producto E2E ${Date.now()}`
    await page.locator('#menu-name').fill(productName)
    await page.locator('#menu-price').fill('9000')

    await page.getByRole('button', { name: 'Guardar producto' }).click()

    await expect(page.getByText(productName)).toBeVisible()
  })
})
