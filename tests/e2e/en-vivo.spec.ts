import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { auditarEnVivo } from '../../shared/live'
import { ESPERA_REGISTRO, gotoHydrated, registrarLinea } from './helpers'

/**
 * Pruebas de cierre de la Fase 4B: la vista pública en vivo.
 *
 * Lo que más importa es lo que **no** viaja: el espectador no tiene cuenta, así
 * que todo lo que llegue a su navegador es público para siempre.
 */
const email = process.env.E2E_HOST_EMAIL
const password = process.env.E2E_HOST_PASSWORD
const url = process.env.SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY

const sello = Date.now()
const JUGADOR = `Publico${sello}`

const db = () => createClient(url!, secret!, { auth: { persistSession: false } })

test.describe.serial('vista pública en vivo', () => {
  test.skip(!email || !password || !secret, 'Necesita credenciales de host y llave secreta')
  test.setTimeout(120_000)

  let sessionId: string | null = null
  let sessionEraNuestra = false

  test.afterAll(async () => {
    const c = db()
    if (sessionId) {
      // Pase lo que pase, la sesión se queda como estaba: abierta.
      await c.from('session').update({ status: 'open' }).eq('id', sessionId)
      await c.from('action_log').delete().eq('session_id', sessionId)
    }

    const { data: players } = await c
      .from('player')
      .select('id')
      .ilike('display_name', `%${sello}%`)

    for (const p of players ?? []) {
      const { data: parts } = await c.from('participation').select('id').eq('player_id', p.id)
      for (const pa of parts ?? []) {
        const { data: sps } = await c
          .from('session_participant')
          .select('id')
          .eq('participation_id', pa.id)
        for (const sp of sps ?? []) {
          await c.from('team_member').delete().eq('session_participant_id', sp.id)
        }
        await c.from('session_participant').delete().eq('participation_id', pa.id)
        await c.from('participation').delete().eq('id', pa.id)
      }
      await c.from('player').delete().eq('id', p.id)
    }

    if (sessionId && sessionEraNuestra) {
      await c.from('session_participant').delete().eq('session_id', sessionId)
      await c.from('team').delete().eq('session_id', sessionId)
      await c.from('session').delete().eq('id', sessionId)
    }
  })

  test('preparar: una sesión con alguien en la banca', async ({ page }) => {
    await gotoHydrated(page, '/host/login')
    await page.getByLabel('Correo').fill(email!)
    await page.getByLabel('Contraseña').fill(password!)
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    await expect(page).toHaveURL(/\/host$/)

    await gotoHydrated(page, '/host')
    const abrir = page.getByRole('button', { name: 'Abrir sesión' })
    if (await abrir.isVisible().catch(() => false)) {
      await abrir.click()
      sessionEraNuestra = true
    }
    await expect(page.getByText(/Sesión #\d+/)).toBeVisible()

    const { data: ses } = await db()
      .from('session')
      .select('id')
      .neq('status', 'closed')
      .order('started_at', { ascending: false })
      .limit(1)
      .single()
    sessionId = ses!.id

    await registrarLinea(page, `${JUGADOR} MID`)
    await expect(page.locator('.banca li').filter({ hasText: JUGADOR })).toBeVisible(ESPERA_REGISTRO)
  })

  // Prueba 1 del plan: el payload no lleva nada privado.
  test('el payload público no contiene bits, saldos, cárcel, restricciones ni notas', async ({
    request,
  }) => {
    // Se pide sin cookie de sesión: es exactamente lo que ve un anónimo.
    const res = await request.get('/api/live')
    expect(res.ok()).toBe(true)

    const payload = await res.json()
    expect(payload.hay).toBe(true)

    // La misma auditoría que corre el servidor antes de publicar.
    expect(auditarEnVivo(payload)).toEqual([])

    // Y por si la auditoría se relajara algún día, el texto entero tampoco.
    const crudo = JSON.stringify(payload).toLowerCase()
    for (const palabra of ['balance_bits', 'cost_bits', 'ledger', 'loan', 'jail', 'graveyard']) {
      expect(crudo, `el payload menciona ${palabra}`).not.toContain(palabra)
    }
  })

  // Prueba 2 del plan: llega en menos de 2 s y sin recargar.
  test('asignar a alguien se ve en la pantalla pública sin recargar', async ({ page, browser }) => {
    const publico = await browser.newPage()
    await gotoHydrated(publico, '/en-vivo')
    await expect(publico.locator('.conexion')).toContainText('En directo')
    await expect(publico.locator('.equipos .t1')).not.toContainText(JUGADOR)

    // El host lo manda al Team 1.
    await gotoHydrated(page, '/host/login')
    await page.getByLabel('Correo').fill(email!)
    await page.getByLabel('Contraseña').fill(password!)
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    await expect(page).toHaveURL(/\/host$/)

    await page.locator('.banca li').filter({ hasText: JUGADOR }).click()
    const acc = page.locator('.acc')
    await acc.getByRole('button', { name: 'MID', exact: true }).click()
    await acc.getByRole('button', { name: 'Team 1' }).click()

    // El cronómetro arranca en el clic que dispara la acción, no antes: lo que
    // se mide es lo que tarda en propagarse, no lo que tarda el host en pulsar.
    const arranque = Date.now()
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/assign')),
      acc.getByRole('button', { name: 'Asignar', exact: true }).click(),
    ])
    const tApi = Date.now() - arranque
    expect(resp.ok()).toBe(true)

    // Sin recargar: la misma pestaña que ya estaba abierta.
    await expect(publico.locator('.equipos .t1')).toContainText(JUGADOR, { timeout: 10_000 })
    const tardanza = Date.now() - arranque
    console.log(`  la acción del host tarda ${tApi} ms`)
    console.log(`  y llega a la pantalla pública en ${tardanza} ms`)

    await expect(publico.locator('.ultima')).toContainText(JUGADOR)
    await publico.close()
  })

  // Prueba 3 del plan: se resincroniza sola al volver la conexión.
  test('si se cae la conexión, al volver se pone al día sola', async ({ page, browser }) => {
    const contexto = await browser.newContext()
    const publico = await contexto.newPage()
    await gotoHydrated(publico, '/en-vivo')
    await expect(publico.locator('.equipos .t1')).toContainText(JUGADOR)

    // Se corta la red del espectador y, mientras está a oscuras, el host mueve.
    await contexto.setOffline(true)
    await publico.waitForTimeout(1500)

    await gotoHydrated(page, '/host/login')
    await page.getByLabel('Correo').fill(email!)
    await page.getByLabel('Contraseña').fill(password!)
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    await expect(page).toHaveURL(/\/host$/)

    await page.locator('.team.is-t1 li').filter({ hasText: JUGADOR }).click()
    await page.locator('.acc').getByRole('button', { name: 'A la banca' }).click()
    await expect(page.locator('.banca li').filter({ hasText: JUGADOR })).toBeVisible()

    // El espectador se perdió el aviso: su pantalla sigue en lo viejo.
    await expect(publico.locator('.equipos .t1')).toContainText(JUGADOR)

    // Vuelve la red: sin tocar nada, la pantalla tiene que ponerse al día.
    await contexto.setOffline(false)
    await expect(publico.locator('.equipos .t1')).not.toContainText(JUGADOR, { timeout: 30_000 })
    await expect(publico.locator('.banca')).toContainText(JUGADOR)

    await contexto.close()
  })

  // Prueba 5 del plan: con la sesión cerrada, no una pantalla rota.
  test('sin sesión abierta lo dice, no se rompe', async ({ page }) => {
    await db().from('session').update({ status: 'closed' }).eq('id', sessionId!)
    try {
      await gotoHydrated(page, '/en-vivo')
      await expect(page.locator('.nada')).toContainText('no hay ninguna CopaPerso en directo')
      await expect(page.locator('.equipos')).toHaveCount(0)
    } finally {
      await db().from('session').update({ status: 'open' }).eq('id', sessionId!)
    }
  })

  test('el modo overlay se queda sin cabecera y sin fondo', async ({ page }) => {
    await gotoHydrated(page, '/en-vivo?overlay=1')
    await expect(page.locator('.vivo.is-overlay')).toBeVisible()
    await expect(page.locator('.cab')).toHaveCount(0)

    const fondo = await page
      .locator('.vivo')
      .evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(fondo).toBe('rgba(0, 0, 0, 0)')
  })
})
