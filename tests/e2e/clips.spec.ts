import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { gotoHydrated } from './helpers'

/**
 * Pruebas de cierre de los clips de la Home.
 *
 * Lo que se comprueba aquí no es que Twitch reproduzca nada —eso no depende de
 * nosotros y no se puede probar sin red hacia Twitch—, sino las dos cosas que
 * sí son responsabilidad de esta aplicación:
 *
 * 1. **El iframe no existe hasta que la sección entra en pantalla.** Es lo que
 *    permite tener clips en la Home sin cargar cuatro reproductores enteros a
 *    quien solo lee el hero, y lo que salva la puntuación de Lighthouse.
 * 2. **El iframe declara el dominio de la página en `parent`.** Sin eso Twitch
 *    se niega a reproducir, y como el dominio cambia en cada despliegue de
 *    previsualización, tiene que salir del navegador y no de una constante.
 */
const email = process.env.E2E_HOST_EMAIL
const password = process.env.E2E_HOST_PASSWORD
const url = process.env.SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY

const sello = Date.now()
const db = () => createClient(url!, secret!, { auth: { persistSession: false } })

const SLUG = `PruebaCopaPerso${sello}`
const OTRO = `OtraPruebaCopaPerso${sello}`
const TITULO = `La remontada ${sello}`

test.describe.serial('clips de la Home', () => {
  test.skip(!email || !password || !secret, 'Necesita credenciales de host y llave secreta')
  test.setTimeout(90_000)

  test.beforeEach(async ({ page }) => {
    await gotoHydrated(page, '/host/login')
    await page.getByLabel('Correo').fill(email!)
    await page.getByLabel('Contraseña').fill(password!)
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    await expect(page).toHaveURL(/\/host$/)
  })

  test.afterAll(async () => {
    await db().from('clip').delete().in('slug', [SLUG, OTRO])
    await db()
      .from('action_log')
      .delete()
      .in('action_type', ['clip.add', 'clip.remove', 'clip.hide', 'clip.show'])
      .is('session_id', null)
  })

  test('sin clips, el apartado no sale en la Home', async ({ page }) => {
    // Se parte de una Home limpia: si el host ya tiene clips puestos, este
    // caso no aplica y lo que importa es el resto.
    const { count } = await db().from('clip').select('id', { count: 'exact', head: true })
    test.skip((count ?? 0) > 0, 'Ya hay clips puestos')

    await gotoHydrated(page, '/')
    await expect(page.locator('.clips')).toHaveCount(0)
  })

  test('pegar el enlace de un clip lo añade y lo previsualiza', async ({ page }) => {
    await gotoHydrated(page, '/host/clips')

    await page.getByLabel('Enlace del clip').fill(`https://clips.twitch.tv/${SLUG}`)
    await page.getByLabel('Título').fill(TITULO)
    await page.getByLabel(/Edición/).fill('CopaPerso #1')

    // La previsualización aparece antes de guardar: es como el host comprueba
    // que el enlace es el que cree.
    const previa = page.locator('.previa iframe')
    await expect(previa).toHaveAttribute('src', new RegExp(`clip=${SLUG}`))

    await page.getByRole('button', { name: 'Añadir' }).click()
    await expect(page.locator('.lista li')).toHaveCount(1, { timeout: 15_000 })
    await expect(page.locator('.datos__slug')).toHaveText(SLUG)
  })

  test('un enlace que no es de Twitch no se puede añadir', async ({ page }) => {
    await gotoHydrated(page, '/host/clips')

    await page.getByLabel('Enlace del clip').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    await page.getByLabel('Título').fill('No debería entrar')

    await expect(page.locator('.pista--mal')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Añadir' })).toBeDisabled()

    // Ni por la puerta de atrás: el servidor lo vuelve a comprobar.
    const res = await page.request.post('/api/clips', {
      data: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'No debería entrar' },
    })
    expect(res.status()).toBe(422)
  })

  test('el mismo clip no se añade dos veces', async ({ page }) => {
    const res = await page.request.post('/api/clips', {
      data: { url: `https://www.twitch.tv/targetac/clip/${SLUG}`, title: 'Repetido' },
    })
    expect(res.status()).toBe(409)
  })

  // Prueba de cierre 1: el iframe no se monta hasta llegar a la sección.
  test('el reproductor no se carga hasta que se llega a los clips', async ({ page }) => {
    // En un móvil, que es donde más duele cargar cuatro reproductores. Y
    // además es determinista: en una pantalla de escritorio el apartado queda
    // casi a la vista nada más cargar, y entonces sí debe montarse.
    await page.setViewportSize({ width: 390, height: 640 })
    await gotoHydrated(page, '/')

    const seccion = page.locator('.clips')
    await expect(seccion).toBeVisible()
    await expect(seccion.locator('h3')).toContainText(TITULO)

    // Arriba del todo, donde está el hero, todavía no hay ningún reproductor.
    await page.evaluate(() => window.scrollTo(0, 0))
    await expect(page.locator('.clip__marco iframe')).toHaveCount(0)
    await expect(page.locator('.clip__espera')).toHaveCount(1)

    await seccion.scrollIntoViewIfNeeded()
    await expect(page.locator('.clip__marco iframe')).toHaveCount(1, { timeout: 10_000 })
  })

  // Prueba de cierre 2: el parent sale del navegador, no de una constante.
  test('el iframe declara el dominio de la página', async ({ page }) => {
    await gotoHydrated(page, '/')
    await page.locator('.clips').scrollIntoViewIfNeeded()

    const src = await page.locator('.clip__marco iframe').first().getAttribute('src')
    const q = new URL(src!).searchParams
    expect(q.get('clip')).toBe(SLUG)
    expect(q.get('parent')).toBe(new URL(page.url()).hostname)
    // Nada arranca solo: la Home no se pone a sonar sola.
    expect(q.get('autoplay')).toBe('false')
  })

  test('ocultar un clip lo quita de la Home sin borrarlo', async ({ page }) => {
    await gotoHydrated(page, '/host/clips')
    await page.getByRole('button', { name: 'Ocultar' }).click()
    await expect(page.getByRole('button', { name: 'Enseñar' })).toBeVisible({ timeout: 15_000 })

    const publico = await page.request.get('/api/public/clips')
    expect(await publico.json()).toEqual([])

    // Sigue en la lista del host, apagado.
    await expect(page.locator('.lista li.is-oculto')).toHaveCount(1)

    await page.getByRole('button', { name: 'Enseñar' }).click()
    await expect(page.getByRole('button', { name: 'Ocultar' })).toBeVisible({ timeout: 15_000 })
  })

  test('subir un clip cambia el orden que ve la Home', async ({ page }) => {
    await gotoHydrated(page, '/host/clips')

    await page.getByLabel('Enlace del clip').fill(`https://clips.twitch.tv/${OTRO}`)
    await page.getByLabel('Título').fill(`El segundo ${sello}`)
    await page.getByRole('button', { name: 'Añadir' }).click()
    await expect(page.locator('.lista li')).toHaveCount(2, { timeout: 15_000 })

    // El nuevo entra el último; se sube al primer puesto.
    await page.locator('.lista li').nth(1).locator('.orden button', { hasText: '↑' }).click()
    await expect(page.locator('.lista li').first().locator('.datos__slug')).toHaveText(OTRO, {
      timeout: 15_000,
    })

    const publico = await page.request.get('/api/public/clips')
    const lista = (await publico.json()) as { slug: string }[]
    expect(lista.map((c) => c.slug)).toEqual([OTRO, SLUG])
  })

  test('quitar un clip lo borra de verdad', async ({ page }) => {
    await gotoHydrated(page, '/host/clips')
    page.on('dialog', (d) => d.accept())

    await page.locator('.lista li').first().getByRole('button', { name: 'Quitar' }).click()
    await expect(page.locator('.lista li')).toHaveCount(1, { timeout: 15_000 })

    const { data } = await db().from('clip').select('slug').eq('slug', OTRO)
    expect(data).toHaveLength(0)
  })
})
