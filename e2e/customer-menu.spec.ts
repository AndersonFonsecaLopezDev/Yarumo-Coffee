import { test, expect } from '@playwright/test'

// Requiere una mesa de prueba activa en el proyecto de Supabase apuntado por
// NEXT_PUBLIC_SUPABASE_URL. Define su public_token (columna public_token de
// cafe_tables) en la variable de entorno E2E_TABLE_TOKEN antes de correr
// `npm run test:e2e` (ver README, sección "Pruebas end-to-end").
const tableToken = process.env.E2E_TABLE_TOKEN

test.describe('Cliente en mesa', () => {
  test.skip(!tableToken, 'Define E2E_TABLE_TOKEN con el token de una mesa de prueba activa para correr este flujo.')

  test('abre el menú desde el QR de la mesa y pide la cuenta', async ({ page }) => {
    await page.goto(`/?mesa=${tableToken}`)

    // El menú se renderiza en el servidor: debería haber al menos un producto
    // visible sin depender de ninguna petición adicional del cliente.
    await expect(page.locator('.item').first()).toBeVisible()

    await page.getByRole('button', { name: 'Pedir la cuenta' }).click()

    await expect(page.getByText('La cuenta fue solicitada para tu mesa.')).toBeVisible()
  })
})
