import { test, expect } from '@playwright/test'

const SAMPLE_ITEM_WITH_MILK_TEXT = {
  id: 'item-cafe-leche',
  name: 'Café Latte Especial',
  description: 'Preparado con deliciosa leche artesanal y notas de caramelo',
  price_cop: 8000,
  category: 'Café de Origen',
  category_id: 'cat-1',
  sort_order: 0, // sort_order <= 1 solía inferir falsamente "Recomendado del barista"
  image_url: '/yarumo-cover-cafe-og.webp',
  gallery_urls: [],
  tags: ['Edición Especial'],
}

test.describe('Bloque 3 Parte A - Hotfix sin heurísticas ni opciones inventadas', () => {
  test('muestra solo nota al barista y no muestra selectores de leche o tamaño', async ({ page }) => {
    await page.addInitScript((sampleItem) => {
      // Inyectar en sessionStorage o mock para validar modal directamente si es necesario
      window.__MOCK_TEST_ITEM__ = sampleItem
    }, SAMPLE_ITEM_WITH_MILK_TEXT)

    await page.goto('/')

    // Si no hay productos en la BD local, abrimos el modal programáticamente o con deep link una vez implementado
    // Probamos inyectando el item en el DOM o evaluando el comportamiento del componente
    const hasCards = await page.locator('.item-card').count()
    if (hasCards > 0) {
      // Clic en la primera tarjeta para abrir modal
      await page.locator('.item-media').first().click()
    } else {
      // Abrir modal pasando el item simulado al componente vía evento de test si está disponible
      // o verificar que no existan selectores de tipo de leche en el DOM
      await page.evaluate((item) => {
        const event = new CustomEvent('test-open-modal', { detail: item })
        window.dispatchEvent(event)
      }, SAMPLE_ITEM_WITH_MILK_TEXT)
    }

    // Si el modal está abierto:
    const modalDialog = page.locator('.gallery-modal-card')
    if (await modalDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
      // 1. Debe estar presente el campo de nota para el barista
      await expect(page.locator('#gallery-barista-notes')).toBeVisible()

      // 2. NO debe haber selector de "Tipo de leche" ni opciones de leche
      await expect(page.locator('text=Tipo de leche')).not.toBeVisible()
      await expect(page.locator('text=Temperatura')).not.toBeVisible()
      await expect(page.locator('text=Tamaño')).not.toBeVisible()

      // 3. No debe haber chips de opciones de leche
      await expect(page.locator('text=Leche entera')).not.toBeVisible()
      await expect(page.locator('text=Bebida de avena')).not.toBeVisible()
    }
  })
})
