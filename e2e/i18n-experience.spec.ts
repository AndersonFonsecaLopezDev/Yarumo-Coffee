import { test, expect } from '@playwright/test'

const MOCK_ITEMS = [
  {
    id: 'cafe-origen-1',
    name: 'Espresso Yarumo Especial',
    name_en: 'Special Yarumo Espresso',
    description: 'Café de origen Armenia con notas florales y caramelo.',
    description_en: 'Armenia origin coffee with floral and caramel notes.',
    price_cop: 6500,
    category: 'Café',
    is_available: true,
    image_url: '/yarumo-cover-cafe.webp',
    gallery_urls: [],
    tags: ['Recomendado'],
    sort_order: 1,
  },
  {
    id: 'postre-1',
    name: 'Torta de Café Casera',
    name_en: null,
    description: 'Receta tradicional con café de la casa.',
    description_en: null,
    price_cop: 8000,
    category: 'Café',
    is_available: true,
    image_url: '/yarumo-cover-cafe.webp',
    gallery_urls: [],
    tags: [],
    sort_order: 2,
  },
]

const MOCK_CATEGORIES = [
  { id: 'cat-cafe', name: 'Café', name_en: 'Coffee', slug: 'cafe', icon: 'coffee', sort_order: 1 },
]

test.describe('Bloque 4 - Internacionalización (i18n es/en y BD multilingüe)', () => {
  test.beforeEach(async ({ page }) => {
    // Interceptar Supabase API
    await page.route('**/rest/v1/menu_items*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ITEMS),
      })
    })

    await page.route('**/rest/v1/menu_categories*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_CATEGORIES),
      })
    })

    await page.route('**/rest/v1/promotions*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    await page.route('**/rest/v1/site_settings*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    await page.route('**/rest/v1/recommendations*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })
  })

  test('alternar idioma actualiza el DOM, persiste en recarga y no genera hydration errors', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const initialLang = await page.evaluate(() => document.documentElement.lang)
    const targetLang = initialLang === 'es' ? 'en' : 'es'

    // Pulsar botón de toggle de idioma
    const langBtn = page.locator('#btn-language-toggle')
    await expect(langBtn).toBeVisible()
    await langBtn.click()

    // document.documentElement.lang debe haber cambiado a targetLang
    await expect(page.locator('html')).toHaveAttribute('lang', targetLang)

    if (targetLang === 'en') {
      await expect(page.locator('.nav-links')).toContainText('Digital Menu')
      await expect(page.locator('.catalog-header')).toContainText('Our Menu')
    } else {
      await expect(page.locator('.nav-links')).toContainText('Carta Digital')
      await expect(page.locator('.catalog-header')).toContainText('Nuestra Carta')
    }

    // Recargar la página y comprobar persistencia
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('html')).toHaveAttribute('lang', targetLang)

    // Cero errores de mismatch de hidratación
    const hydrationErrors = consoleErrors.filter(
      (e) => e.includes('Hydration') || e.includes('hydrating') || e.includes('did not match'),
    )
    expect(hydrationErrors).toHaveLength(0)
  })

  test('con idioma EN el modal y el carrito muestran textos en inglés y no lista negra', async ({ page }) => {
    // Inicializar con idioma 'en' en localStorage
    await page.addInitScript(() => {
      localStorage.setItem('yarumo-lang', 'en')
      localStorage.setItem(
        'yarumo_customer_cart_v1',
        JSON.stringify({
          version: 1,
          savedAt: Date.now(),
          items: [
            {
              item: {
                id: 'cafe-origen-1',
                name: 'Espresso Yarumo Especial',
                price_cop: 6500,
                category: 'Café',
                is_available: true,
              },
              quantity: 1,
              notes: '',
            },
          ],
        }),
      )
    })

    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // Abrir carrito flotante
    const floatingCartBtn = page.locator('.floating-cart-btn')
    await expect(floatingCartBtn).toBeVisible()
    await floatingCartBtn.click()

    // El drawer debe mostrar "Your Order" y botón "Remove"
    const cartDialog = page.locator('.cart-modal-dialog')
    await expect(cartDialog).toBeVisible()
    await expect(cartDialog.locator('h2')).toContainText('Your Order')
    await expect(cartDialog.locator('.cart-remove-btn')).toHaveText('Remove')

    // Abrir modal de detalles de producto
    const closeCartBtn = page.locator('.cart-modal-close')
    await closeCartBtn.click()

    const itemCard = page.locator('.item-card').first()
    if (await itemCard.locator('.item-media').isVisible()) {
      await itemCard.locator('.item-media').click()
      const modal = page.locator('.gallery-modal-card')
      await expect(modal).toBeVisible()
      await expect(modal.locator('.gallery-price-label')).toHaveText('Price')
      await expect(modal.locator('.gallery-add-btn')).toContainText('Added ✓')
    }
  })

  test('en /recomendaciones con EN activo los textos se traducen', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('yarumo-lang', 'en')
    })

    await page.goto('/recomendaciones')
    await page.waitForLoadState('domcontentloaded')

    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.locator('main')).toContainText('Voices from our tables')
    await expect(page.locator('.rec-form-card')).toContainText('Share your review')
  })

  test('formulario de staff cuenta con campos de traducción en inglés y catálogo público renderiza sin undefined', async ({ page }) => {
    // 1. Catálogo público en EN renderiza títulos válidos
    await page.addInitScript(() => {
      localStorage.setItem('yarumo-lang', 'en')
    })
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const firstCard = page.locator('.item-card').first()
    if (await firstCard.isVisible()) {
      const title = await firstCard.locator('.item-title').textContent()
      expect(title).toBeTruthy()
      expect(title).not.toContain('undefined')
      expect(title).not.toContain('null')
    }

    // 2. Staff: campos en inglés en formulario de producto
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
        body: JSON.stringify({ id: '00000000-0000-0000-0000-000000000001', email: 'barista@yarumocoffee.com' }),
      })
    })

    await page.route(/.*\/rest\/v1\/rpc\/get_my_role.*/, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify('manager') })
    })

    await page.goto('/staff?tab=menu')
    const emailInput = page.locator('input[type="email"]')
    if (await emailInput.isVisible({ timeout: 1500 }).catch(() => false)) {
      await emailInput.fill('barista@yarumocoffee.com')
      await page.locator('input[type="password"]').fill('password123')
      await page.locator('button[type="submit"]').click()
      await page.waitForLoadState('networkidle')
    }

    const nameEnInput = page.locator('#menu-name-en')
    await expect(nameEnInput).toBeVisible()
    await expect(page.locator('#menu-desc-en')).toBeVisible()
  })
})

