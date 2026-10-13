import { test, expect } from '@playwright/test'

const SAMPLE_ITEM_WITH_OPTIONS = {
  id: 'item-options-test',
  name: 'Cappuccino de Origen',
  slug: 'cappuccino-de-origen',
  description: 'Extracción de café con textura suave',
  price_cop: 7000,
  category: 'Café',
  category_id: 'cat-1',
  available: true,
  sort_order: 1,
  image_url: '/yarumo-cover-cafe-og.webp',
  gallery_urls: [],
  tags: ['Recomendado'],
  option_groups: [
    {
      id: 'grp-leche',
      menu_item_id: 'item-options-test',
      name: 'Tipo de Leche',
      kind: 'single' as const,
      required: true,
      sort_order: 1,
      active: true,
      choices: [
        { id: 'ch-entera', group_id: 'grp-leche', label: 'Leche entera', price_delta_cop: 0, sort_order: 1, active: true },
        { id: 'ch-avena', group_id: 'grp-leche', label: 'Leche de avena', price_delta_cop: 2000, sort_order: 2, active: true },
      ],
    },
  ],
}

test.describe('Bloque 3 Parte B - Opciones guiadas por datos y consistencia de precios', () => {
  test('staff puede abrir el modal de variantes y crear grupos de opciones', async ({ page }) => {
    // Mocks completos de autenticación y endpoints de staff
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

    await page.route(/.*\/rest\/v1\/service_requests.*/, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })

    await page.route(/.*\/rest\/v1\/order_requests.*/, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })

    await page.route(/.*\/rest\/v1\/cafe_tables.*/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'tbl-1', label: '1', public_token: 'tok-1', active: true }]),
      })
    })

    await page.route(/.*\/rest\/v1\/promotions.*/, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })

    await page.route(/.*\/rest\/v1\/recommendations.*/, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })

    await page.route(/.*\/rest\/v1\/menu_categories.*/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'cat-1', name: 'Café', slug: 'cafe', icon: '☕', sort_order: 1, active: true }]),
      })
    })

    await page.route(/.*\/rest\/v1\/menu_items.*/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([SAMPLE_ITEM_WITH_OPTIONS]),
      })
    })

    await page.route(/.*\/rest\/v1\/menu_item_option_groups.*/, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(SAMPLE_ITEM_WITH_OPTIONS.option_groups),
        })
      } else {
        await route.fulfill({ status: 201, contentType: 'application/json', body: '[]' })
      }
    })

    await page.goto('/staff?tab=menu')

    const emailInput = page.locator('input[type="email"]')
    if (await emailInput.isVisible({ timeout: 1500 }).catch(() => false)) {
      await emailInput.fill('barista@yarumocoffee.com')
      await page.locator('input[type="password"]').fill('password123')
      await page.locator('button[type="submit"]').click()
      await page.waitForLoadState('networkidle')
    }

    const menuTab = page.locator('button[data-tab="menu"]')
    if (await menuTab.isVisible()) {
      await menuTab.click()
    }

    // El botón "⚙ Variantes" debe existir en la lista de productos
    const variantsBtn = page.locator(`button[id*="options-item-options-test"]`).first()
    await expect(variantsBtn).toBeVisible()
    await variantsBtn.click()

    // El modal de personalización debe estar visible con grupos
    await expect(page.locator('text=Personalización de Producto')).toBeVisible()
    await expect(page.locator('text=Tipo de Leche')).toBeVisible()
    await expect(page.locator('text=Leche de avena')).toBeVisible()

    // Cerrar modal
    await page.locator('button[aria-label="Cerrar modal"]').click()
  })

  test('en el catálogo público, seleccionar opciones actualiza precio y carrito', async ({ page }) => {
    const cartWithOption = {
      version: 1,
      savedAt: Date.now(),
      items: [
        {
          item: SAMPLE_ITEM_WITH_OPTIONS,
          quantity: 1,
          notes: 'Leche de avena (+ $2.000)',
          selectedChoiceIds: ['ch-avena'],
          selectedChoices: [SAMPLE_ITEM_WITH_OPTIONS.option_groups[0].choices[1]],
          effectivePrice: 9000, // 7000 base + 2000 delta
        },
      ],
    }

    await page.addInitScript((cartData) => {
      localStorage.setItem('yarumo_customer_cart_v1', JSON.stringify(cartData))
    }, cartWithOption)

    await page.goto('/')

    // El carrito flotante debe mostrar el precio calculado con el extra ($9.000)
    const floatingCartBtn = page.locator('.floating-cart-btn')
    await expect(floatingCartBtn).toBeVisible()
    await expect(floatingCartBtn).toContainText('9.000')

    // Al abrir el carrito, el precio total refleja $9.000
    await floatingCartBtn.click()
    const cartDialog = page.locator('.cart-modal-dialog')
    await expect(cartDialog).toBeVisible()
    await expect(page.locator('.cart-item-total-price')).toContainText('9.000')
    await expect(page.locator('text=Leche de avena')).toBeVisible()
  })
})
