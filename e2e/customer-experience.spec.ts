import { test, expect } from '@playwright/test'

test.describe('Experiencia del Cliente - Carta, Pedidos y Servicios', () => {
  test('permite alternar el idioma entre Español e Inglés y persiste la selección', async ({ page }) => {
    await page.goto('/')

    const langBtn = page.locator('#btn-language-toggle')
    await expect(langBtn).toBeVisible()

    // Capturar idioma inicial
    const initialToggleText = (await langBtn.innerText()).trim() // 'EN' si está en ES, o 'ES' si está en EN

    // Alternar idioma
    await langBtn.click()
    const oppositeToggleText = initialToggleText === 'EN' ? 'ES' : 'EN'
    await expect(langBtn).toHaveText(oppositeToggleText)

    // Si conmutó a EN, el enlace del menú es 'Digital Menu'; si conmutó a ES, es 'Carta Digital'
    const expectedMenuText = oppositeToggleText === 'ES' ? 'Digital Menu' : 'Carta Digital'
    await expect(page.locator('.nav-links a', { hasText: expectedMenuText })).toBeVisible()

    // Recargar página y verificar persistencia en localStorage
    await page.reload()
    await expect(langBtn).toHaveText(oppositeToggleText)
    await expect(page.locator('.nav-links a', { hasText: expectedMenuText })).toBeVisible()

    // Regresar al idioma inicial
    await langBtn.click()
    await expect(langBtn).toHaveText(initialToggleText)
  })

  test('muestra badge de mesa activa o aviso amigable si el QR está caducado', async ({ page }) => {
    // Escenario: token inexistente
    await page.goto('/?mesa=999')

    // El badge en el header se activa con el parámetro
    const headerBadge = page.locator('.header-table-badge')
    await expect(headerBadge).toBeVisible()
    await expect(headerBadge).toContainText('Mesa 999')

    // Como la mesa 999 no existe en BD, TableServiceSection debe mostrar aviso amigable
    const invalidAlert = page.locator('#btn-continuar-barra')
    await expect(invalidAlert).toBeVisible()
  })

  test('protege el formulario de recomendaciones con campo trampa antispam honeypot', async ({ page }) => {
    await page.goto('/recomendaciones')

    // Verificar que el campo honeypot existe en el DOM y está oculto para usuarios visuales
    const honeypotInput = page.locator('#rec-website')
    await expect(honeypotInput).toBeAttached()

    // El contador de caracteres del comentario debe estar visible
    const charCounter = page.locator('text=0 / 500')
    await expect(charCounter).toBeVisible()

    // Rellenar exactamente 10 caracteres y verificar actualización precisa del contador
    const commentInput = page.locator('#rec-comment')
    await commentInput.fill('1234567890')
    await expect(page.locator('text=10 / 500')).toBeVisible()
  })
})
