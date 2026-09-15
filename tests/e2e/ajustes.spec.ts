import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { gotoHydrated } from './helpers'

/**
 * Ajustes: precios, enlaces y cronómetro.
 *
 * Tres cosas que hasta ahora exigían un despliegue. La que más importa probar
 * es la tercera columna de la tabla de abajo: **lo que se escribe aquí acaba en
 * el `href` de un enlace de la página pública**, así que el servidor no puede
 * fiarse de que la pantalla ya lo haya validado.
 */
const email = process.env.E2E_HOST_EMAIL
const password = process.env.E2E_HOST_PASSWORD
const url = process.env.SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY

const sello = Date.now()
const db = () => createClient(url!, secret!, { auth: { persistSession: false } })

const INSTAGRAM = `https://instagram.com/copaperso${sello}`
/** Desde cuándo son nuestras las entradas del historial, para limpiar solo esas. */
const DESDE = new Date().toISOString()

test.describe.serial('ajustes', () => {
  test.skip(!email || !password || !secret, 'Necesita credenciales de host y llave secreta')
  test.setTimeout(90_000)

  /** Lo que hubiera antes, para devolverlo tal cual. */
  let precioPrevio: { id: string; cost_bits: number } | null = null
  let cronoPrevio: string | null = null
  let sesionNueva: string | null = null

  test.beforeEach(async ({ page }) => {
    await gotoHydrated(page, '/host/login')
    await page.getByLabel('Correo').fill(email!)
    await page.getByLabel('Contraseña').fill(password!)
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    await expect(page).toHaveURL(/\/host$/)
  })

  test.afterAll(async () => {
    const c = db()
    if (precioPrevio) {
      await c.from('action_catalog').update({ cost_bits: precioPrevio.cost_bits }).eq('id', precioPrevio.id)
    }
    await c.from('site_link').delete().in('network', ['instagram', 'youtube'])
    if (cronoPrevio === null) await c.from('setting').delete().eq('key', 'timer_seconds')
    else await c.from('setting').update({ value: cronoPrevio }).eq('key', 'timer_seconds')
    if (sesionNueva) await c.from('session').delete().eq('id', sesionNueva)
    // Por fecha y no por sesión: los cambios de precio se cuelgan de la copa
    // abierta, que es la del host, y no hay que llevarse su historial por delante.
    await c
      .from('action_log')
      .delete()
      .in('action_type', ['settings.link', 'settings.timer', 'catalog.update'])
      .gte('created_at', DESDE)
  })

  test('preparar: apuntar lo que había', async () => {
    const c = db()
    const { data: crono } = await c.from('setting').select('value').eq('key', 'timer_seconds').maybeSingle()
    cronoPrevio = crono?.value ?? null
  })

  // Prueba 1: el precio llega a la mesa.
  test('cambiar un precio se ve en los canjeos del CCTM', async ({ page }) => {
    await gotoHydrated(page, '/host/ajustes')

    const fila = page.locator('.precios li').filter({ hasText: 'Blue Shell' })
    await expect(fila).toBeVisible({ timeout: 15_000 })

    const campo = fila.locator('input')
    const antes = Number(await campo.inputValue())
    const nuevo = antes === 777 ? 778 : 777

    const c = db()
    const { data: cat } = await c
      .from('action_catalog')
      .select('id, cost_bits')
      .eq('code', 'BLUE_SHELL')
      .eq('active', true)
      .limit(1)
      .single()
    precioPrevio = { id: cat!.id, cost_bits: cat!.cost_bits }

    await campo.fill(String(nuevo))
    await campo.blur()
    await expect(page.locator('.ok')).toBeVisible({ timeout: 15_000 })

    // Y en la mesa, que es donde el host lo lee en directo.
    await gotoHydrated(page, '/host')
    await expect(page.locator('.canj .precios')).toContainText(String(nuevo), { timeout: 15_000 })
  })

  // Prueba 2: ese cambio se puede deshacer desde el historial.
  test('el cambio de precio queda en el historial y se deshace', async ({ page }) => {
    await gotoHydrated(page, '/host')

    // La entrada del cambio de precio, con su ↶.
    const entrada = page.locator('.log li').filter({ hasText: 'Blue Shell' }).first()
    await expect(entrada).toBeVisible({ timeout: 15_000 })
    await entrada.locator('button.undo').click()

    await expect
      .poll(
        async () =>
          (await db().from('action_catalog').select('cost_bits').eq('id', precioPrevio!.id).single())
            .data?.cost_bits,
        { timeout: 15_000 },
      )
      .toBe(precioPrevio!.cost_bits)
  })

  // Prueba 3: un enlace guardado aparece en la Home; quitado, desaparece.
  test('guardar un enlace de Instagram pone su icono en el pie', async ({ page }) => {
    await gotoHydrated(page, '/host/ajustes')

    const fila = page.locator('.enlaces li').filter({ hasText: 'Instagram' })
    await fila.locator('input').fill(INSTAGRAM)
    await fila.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.locator('.ok')).toBeVisible({ timeout: 15_000 })

    await gotoHydrated(page, '/')
    const icono = page.locator('.site__redes a[href*="instagram"]')
    await expect(icono).toHaveCount(1)
    await expect(icono).toHaveAttribute('href', INSTAGRAM)

    // Quitarlo lo borra de la Home.
    await gotoHydrated(page, '/host/ajustes')
    await page
      .locator('.enlaces li')
      .filter({ hasText: 'Instagram' })
      .getByRole('button', { name: 'Quitar' })
      .click()
    await expect(page.locator('.ok')).toBeVisible({ timeout: 15_000 })

    await gotoHydrated(page, '/')
    await expect(page.locator('.site__redes a[href*="instagram"]')).toHaveCount(0)
  })

  /**
   * Prueba 4: la que justifica que el servidor valide.
   *
   * Lo que se guarda aquí acaba en el `href` de un enlace que pulsa cualquiera
   * que entre a la web. Un `javascript:` ahí no es una errata: es ejecución de
   * código en el navegador del visitante.
   */
  test('un enlace con javascript: no entra, ni por la puerta de atrás', async ({ page }) => {
    await gotoHydrated(page, '/host/ajustes')

    // La pantalla no deja ni pulsar Guardar.
    const fila = page.locator('.enlaces li').filter({ hasText: 'YouTube' })
    await fila.locator('input').fill('javascript:alert(1)')
    await expect(fila.locator('.mal')).toBeVisible()
    await expect(fila.getByRole('button', { name: 'Guardar' })).toBeDisabled()

    // Y el servidor tampoco.
    const res = await page.request.put('/api/settings/links/youtube', {
      data: { url: 'javascript:alert(1)' },
    })
    expect(res.status()).toBe(422)

    const { data } = await db().from('site_link').select('url').eq('network', 'youtube')
    expect(data, 'no se escribió nada').toHaveLength(0)
  })

  test('los enlaces públicos no exponen nada más que la red y la URL', async ({ page }) => {
    const res = await page.request.get('/api/public/links')
    expect(res.status()).toBe(200)
    for (const e of (await res.json()) as Record<string, unknown>[]) {
      expect(Object.keys(e).sort()).toEqual(['network', 'sortOrder', 'url', 'visible'])
    }
  })

  test('un anónimo no puede tocar los ajustes', async ({ browser }) => {
    const anon = await browser.newContext()
    const res = await anon.request.patch('http://localhost:3000/api/settings', {
      data: { cronometro: 60 },
    })
    expect([401, 403]).toContain(res.status())
    await anon.close()
  })

  // Prueba 5: la duración guardada manda en la copa siguiente.
  test('la duración guardada es con la que empieza la copa siguiente', async ({ page }) => {
    await gotoHydrated(page, '/host/ajustes')

    await page.getByLabel('Duración').fill('10:00')
    await page.locator('.crono').getByRole('button', { name: 'Guardar' }).click()
    await expect(page.locator('.ok')).toBeVisible({ timeout: 15_000 })

    const c = db()
    const { data: guardado } = await c
      .from('setting')
      .select('value')
      .eq('key', 'timer_seconds')
      .single()
    expect(guardado!.value).toBe('600')

    // La sesión abierta conserva la suya: esto solo manda en las nuevas.
    const { data: abierta } = await c
      .from('session')
      .select('id, timer_seconds')
      .neq('status', 'closed')
      .maybeSingle()

    if (abierta) {
      // Se aparta para poder abrir una y comprobarlo.
      await c.from('session').update({ status: 'closed' }).eq('id', abierta.id)
    }

    const res = await page.request.post('/api/sessions', { data: { mode: 'perso' } })
    expect(res.status()).toBe(201)
    const nueva = (await res.json()) as { id: string; timer_seconds: number }
    sesionNueva = nueva.id
    expect(nueva.timer_seconds, 'la copa nueva empieza con lo guardado').toBe(600)

    // Y se devuelve la que estuviera abierta.
    await c.from('session').delete().eq('id', nueva.id)
    sesionNueva = null
    if (abierta) await c.from('session').update({ status: 'open' }).eq('id', abierta.id)
  })
})
