import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { gotoHydrated } from './helpers'

/**
 * Reglas y patch notes.
 *
 * Lo que se comprueba es la garantía que separa las dos mitades de la página:
 * **un parche no se ve hasta que se publica**. Escribirlo es un trabajo a
 * medias —se va guardando, se relee, se corrige— y nada de eso tiene por qué
 * salir a la web mientras tanto.
 */
const email = process.env.E2E_HOST_EMAIL
const password = process.env.E2E_HOST_PASSWORD
const url = process.env.SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY

const sello = Date.now()
const db = () => createClient(url!, secret!, { auth: { persistSession: false } })

const TITULO = `Parche de prueba ${sello}`
const ENTRA = `El Blue Shell cuesta 500 bits ${sello}`
const SALE = `Se quita el cambio de rol gratis ${sello}`
const CUERPO = `+ ${ENTRA}\n- ${SALE}\n-15 LP por derrota, como siempre`

test.describe.serial('reglas y patch notes', () => {
  test.skip(!email || !password || !secret, 'Necesita credenciales de host y llave secreta')
  test.setTimeout(90_000)

  let parche: string | null = null

  test.beforeEach(async ({ page }) => {
    await gotoHydrated(page, '/host/login')
    await page.getByLabel('Correo').fill(email!)
    await page.getByLabel('Contraseña').fill(password!)
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    await expect(page).toHaveURL(/\/host$/)
  })

  test.afterAll(async () => {
    const c = db()
    if (parche) await c.from('rule_patch').delete().eq('id', parche)
    await c
      .from('action_log')
      .delete()
      .in('action_type', ['patch.create', 'patch.publish', 'patch.unpublish', 'patch.remove'])
      .is('session_id', null)
  })

  // La primera mitad de la página: texto, sin base de datos de por medio.
  test('las reglas se leen sin haber publicado nada', async ({ page }) => {
    await gotoHydrated(page, '/reglas')

    await expect(page.locator('h1')).toContainText('Reglas y formato')
    await expect(page.locator('.hoja').first()).toContainText('estar presente cuando se anuncia')
    // Los cinco modos, con su explicación.
    await expect(page.locator('.modos li')).toHaveCount(5)
    await expect(page.locator('.modos')).toContainText('ARAM AFK')
    // Los seis canjeos con su precio, y la puntuación.
    await expect(page.locator('.precios').first().locator('tbody tr')).toHaveCount(6)
    await expect(page.locator('.hojas')).toContainText('100 LP')
  })

  test('el enlace directo abre la pestaña de patch notes', async ({ page }) => {
    await gotoHydrated(page, '/reglas#patch-notes')
    await expect(page.getByRole('button', { name: /Patch notes/ })).toHaveClass(/is-on/)
  })

  test('un parche nuevo nace sin publicar y no se ve en la web', async ({ page }) => {
    await gotoHydrated(page, '/host/patch-notes')

    await page.getByLabel('Título').fill(TITULO)
    await page.getByLabel(/Versión/).fill(`v${sello}`)
    await page.getByRole('button', { name: 'Crear' }).click()

    const fila = page.locator('.lista li').filter({ hasText: TITULO })
    await expect(fila).toHaveClass(/is-borrador/, { timeout: 15_000 })
    await expect(fila).toContainText('sin publicar')

    const { data } = await db().from('rule_patch').select('id, published_at').eq('title', TITULO).single()
    parche = data!.id
    expect(data!.published_at, 'nace sin publicar').toBeNull()

    // Y la web no sabe que existe.
    const publico = await page.request.get('/api/public/patch-notes')
    const lista = (await publico.json()) as { title: string }[]
    expect(lista.map((p) => p.title)).not.toContain(TITULO)
  })

  test('escribir los cambios: la previsualización distingue lo que entra de lo que sale', async ({ page }) => {
    await gotoHydrated(page, '/host/patch-notes')

    const fila = page.locator('.lista li').filter({ hasText: TITULO })
    await fila.locator('.fila__abrir').click()

    await page.getByLabel('Los cambios').fill(CUERPO)

    // Se ve tal cual quedará, antes de guardar.
    const previa = page.locator('.previa .cambios')
    await expect(previa.locator('li.es-añade')).toHaveCount(1)
    await expect(previa.locator('li.es-quita')).toHaveCount(1)
    // «-15 LP» es texto, no una regla que se quita: el signo va pegado al número.
    await expect(previa.locator('li.es-texto')).toHaveCount(1)

    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect
      .poll(
        async () => (await db().from('rule_patch').select('body').eq('id', parche!).single()).data?.body,
        { timeout: 15_000 },
      )
      .toBe(CUERPO)

    // El resumen de la fila cuenta uno y uno.
    await expect(fila.locator('.mas')).toHaveText('+1')
    await expect(fila.locator('.menos')).toHaveText('−1')
  })

  // La prueba de cierre: publicar es lo que lo saca a la web.
  test('publicarlo lo lleva a las reglas, con su fecha', async ({ page }) => {
    await gotoHydrated(page, '/host/patch-notes')

    const fila = page.locator('.lista li').filter({ hasText: TITULO })
    await fila.getByRole('button', { name: 'Publicar' }).click()
    await expect(fila.getByRole('button', { name: 'Retirar' })).toBeVisible({ timeout: 15_000 })

    await gotoHydrated(page, '/reglas#patch-notes')
    const parcheWeb = page.locator('.parche').filter({ hasText: TITULO })
    await expect(parcheWeb).toBeVisible()
    await expect(parcheWeb.locator('li.es-añade')).toContainText(ENTRA)
    await expect(parcheWeb.locator('li.es-quita')).toContainText(SALE)
    await expect(parcheWeb.locator('time')).not.toBeEmpty()
  })

  test('retirarlo lo quita de la web pero lo deja en el panel', async ({ page }) => {
    await gotoHydrated(page, '/host/patch-notes')

    const fila = page.locator('.lista li').filter({ hasText: TITULO })
    await fila.getByRole('button', { name: 'Retirar' }).click()
    await expect(fila.getByRole('button', { name: 'Publicar' })).toBeVisible({ timeout: 15_000 })

    const publico = await page.request.get('/api/public/patch-notes')
    const lista = (await publico.json()) as { title: string }[]
    expect(lista.map((p) => p.title)).not.toContain(TITULO)

    // Sigue en el panel, como borrador.
    await expect(fila).toHaveClass(/is-borrador/)
  })

  test('borrarlo lo quita del todo', async ({ page }) => {
    await gotoHydrated(page, '/host/patch-notes')
    page.on('dialog', (d) => d.accept())

    const fila = page.locator('.lista li').filter({ hasText: TITULO })
    await fila.getByRole('button', { name: 'Borrar' }).click()
    await expect(page.locator('.lista li').filter({ hasText: TITULO })).toHaveCount(0, {
      timeout: 15_000,
    })

    const { data } = await db().from('rule_patch').select('id').eq('id', parche!)
    expect(data).toHaveLength(0)
    parche = null
  })
})
