import { test, expect } from '@playwright/test'

/**
 * Prueba de cierre 2 de la Fase 1.
 * Necesita un Supabase con un host dado de alta:
 *   E2E_HOST_EMAIL / E2E_HOST_PASSWORD
 */
const email = process.env.E2E_HOST_EMAIL
const password = process.env.E2E_HOST_PASSWORD

test('el área del host está cerrada para anónimos', async ({ page }) => {
  await page.goto('/host')
  await expect(page).toHaveURL(/\/host\/login/)
  await expect(page.getByRole('heading', { name: 'Acceso host' })).toBeVisible()
})

test('la home pública se ve sin iniciar sesión', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('comunidad')
})

test.describe('con credenciales de host', () => {
  test.skip(!email || !password, 'Define E2E_HOST_EMAIL y E2E_HOST_PASSWORD')

  test('entrar y salir del panel', async ({ page }) => {
    await page.goto('/host/login')
    await page.getByLabel('Correo').fill(email!)
    await page.getByLabel('Contraseña').fill(password!)
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()

    await expect(page).toHaveURL(/\/host$/)
    await expect(page.getByText('Base de datos conectada')).toBeVisible()

    await page.getByRole('button', { name: 'Cerrar sesión' }).click()
    await expect(page).toHaveURL(/\/host\/login/)

    // Y al volver a intentarlo, sigue bloqueado.
    await page.goto('/host')
    await expect(page).toHaveURL(/\/host\/login/)
  })
})
