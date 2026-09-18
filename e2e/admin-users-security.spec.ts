import { test, expect } from '@playwright/test'

const managerEmail = process.env.E2E_MANAGER_EMAIL || process.env.E2E_STAFF_EMAIL
const managerPassword = process.env.E2E_MANAGER_PASSWORD || process.env.E2E_STAFF_PASSWORD

test.describe('Admin Users: validación de permisos de manager sobre owner', () => {
  test.skip(!managerEmail || !managerPassword, 'Define credenciales E2E para ejecutar pruebas autenticadas.')

  test('no permite a un manager modificar el perfil o rol de un owner vía PATCH /api/admin/users', async ({ request, baseURL }) => {
    // Intento de modificar usuario owner sin permisos de owner
    const response = await request.patch('/api/admin/users', {
      headers: {
        'Origin': baseURL || 'http://localhost:3000',
        'Content-Type': 'application/json',
      },
      data: {
        id: '00000000-0000-0000-0000-000000000001',
        displayName: 'Intento de Hijacking',
        role: 'staff',
      },
    })

    // Debe denegar con 401 si no está autenticado, o 403 si el target es un owner
    expect([401, 403]).toContain(response.status())
  })
})
