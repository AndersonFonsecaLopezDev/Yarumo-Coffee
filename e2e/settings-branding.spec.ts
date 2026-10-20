import { test, expect } from '@playwright/test'

const email = process.env.E2E_STAFF_EMAIL
const password = process.env.E2E_STAFF_PASSWORD

test.describe('Settings Branding E2E (Site Name & Metadata)', () => {
  test.skip(!email || !password, 'Define E2E_STAFF_EMAIL y E2E_STAFF_PASSWORD (rol owner/manager) para correr pruebas de persistencia de branding.')

  test('un usuario con rol owner/manager actualiza el nombre del sitio y verifica su actualización en la aplicación', async ({ page, request }) => {
    await page.goto('/staff')

    await page.locator('#staff-email').fill(email!)
    await page.locator('#staff-password').fill(password!)
    await page.locator('.login-submit-button').click()

    const settingsTabBtn = page.locator('button[data-tab="settings"]')
    await expect(settingsTabBtn).toBeVisible({ timeout: 10000 })
    await settingsTabBtn.click()

    const nameInput = page.locator('input[placeholder="Yarumo Coffee"]')
    await expect(nameInput).toBeVisible()

    const testSiteName = 'Yarumo Especial'
    await nameInput.fill(testSiteName)
    await page.getByRole('button', { name: 'Guardar Nombre' }).click()

    // Confirmación de éxito
    await expect(page.getByText('¡Nombre del sitio actualizado con éxito!')).toBeVisible()

    // Verificar en la página pública
    await page.goto('/')
    await expect(page).toHaveTitle(/Yarumo Especial/)
    const brand = page.locator('header.header .brand')
    await expect(brand).toContainText('Yarumo')

    // Verificar manifest dinámico
    const manifestRes = await request.get('/manifest.webmanifest')
    expect(manifestRes.ok()).toBe(true)
    const manifestJson = await manifestRes.json()
    expect(manifestJson.name).toContain('Yarumo Especial')

    // Limpieza: Restablecer a Yarumo Coffee
    await page.goto('/staff?tab=settings')
    await page.getByRole('button', { name: 'Restablecer por defecto' }).first().click()
    await expect(page.getByText('Nombre restablecido a "Yarumo Coffee".')).toBeVisible()
  })
})
