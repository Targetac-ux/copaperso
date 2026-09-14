import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { ESPERA_REGISTRO, gotoHydrated, registrarLinea } from './helpers'

/**
 * Prueba de cierre 6 de la Fase 3A: diez jugadores desde cero a dos equipos
 * completos en menos de tres minutos.
 *
 * El plan la define como prueba manual, porque lo que mide de verdad es si el
 * host llega a tiempo en directo. Automatizada mide la otra mitad: que el
 * sistema no sea el cuello de botella. Si la máquina tarda dos minutos en
 * hacerlo sola, una persona no lo hará en tres.
 */
const email = process.env.E2E_HOST_EMAIL
const password = process.env.E2E_HOST_PASSWORD
const url = process.env.SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY

const sello = Date.now()
const JUGADORES = [
  ['Alfa', 'TOP'], ['Bravo', 'JG'], ['Charlie', 'MID'], ['Delta', 'ADC'], ['Eco', 'SUP'],
  ['Fox', 'TOP'], ['Golf', 'JG'], ['Hotel', 'MID'], ['India', 'ADC'], ['Julio', 'SUP'],
].map(([n, r]) => [`${n}${sello}`, r] as const)

test.describe('velocidad del draft', () => {
  test.skip(!email || !password || !secret, 'Necesita credenciales de host y llave secreta')
  test.setTimeout(240_000)

  let sessionId: string | null = null
  let sessionEraNuestra = false
  const db = () => createClient(url!, secret!, { auth: { persistSession: false } })

  test.afterAll(async () => {
    const c = db()
    if (sessionId) {
      const { data: players } = await c.from('player').select('id').ilike('display_name', `%${sello}%`)
      for (const p of players ?? []) {
        const { data: parts } = await c.from('participation').select('id').eq('player_id', p.id)
        for (const pa of parts ?? []) {
          const { data: sps } = await c
            .from('session_participant')
            .select('id')
            .eq('participation_id', pa.id)
          for (const sp of sps ?? []) await c.from('team_member').delete().eq('session_participant_id', sp.id)
          await c.from('session_participant').delete().eq('participation_id', pa.id)
        }
      }
      await c.from('action_log').delete().eq('session_id', sessionId)
      if (sessionEraNuestra) {
        await c.from('session_participant').delete().eq('session_id', sessionId)
        await c.from('team').delete().eq('session_id', sessionId)
        await c.from('session').delete().eq('id', sessionId)
      }
    }
    const { data: players } = await c.from('player').select('id').ilike('display_name', `%${sello}%`)
    for (const p of players ?? []) {
      await c.from('participation').delete().eq('player_id', p.id)
      await c.from('player').delete().eq('id', p.id)
    }
  })

  test('diez jugadores a dos equipos completos', async ({ page }) => {
    await gotoHydrated(page, '/host/login')
    await page.getByLabel('Correo').fill(email!)
    await page.getByLabel('Contraseña').fill(password!)
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    await expect(page).toHaveURL(/\/host$/)

    const arranque = Date.now()

    // 1. Registrar a los diez, tal como los diría el chat.
    await gotoHydrated(page, '/host/jugadores')
    const campo = page.getByLabel('Registrar participante')
    await campo.waitFor()
    for (const [nombre, rol] of JUGADORES) {
      await registrarLinea(page, `${nombre} ${rol}`)
      await expect(page.getByRole('row', { name: new RegExp(nombre) })).toBeVisible(ESPERA_REGISTRO)
    }
    const tRegistro = Date.now() - arranque

    // 2. Abrir sesión y meterlos a todos en la banca.
    await gotoHydrated(page, '/host')
    const abrir = page.getByRole('button', { name: 'Abrir sesión' })
    if (await abrir.isVisible().catch(() => false)) {
      await abrir.click()
      sessionEraNuestra = true
    }
    await expect(page.getByText(/Sesión #\d+/)).toBeVisible()

    const c = db()
    const { data: ses } = await c
      .from('session')
      .select('id')
      .neq('status', 'closed')
      .order('started_at', { ascending: false })
      .limit(1)
      .single()
    sessionId = ses!.id

    for (const [nombre] of JUGADORES) {
      await page.getByRole('button', { name: `+ ${nombre}` }).click()
      await expect(page.getByRole('button', { name: `+ ${nombre}` })).toHaveCount(0)
    }

    // 3. Arrastrar cada uno a su puesto: cinco por equipo.
    for (const [i, [nombre, rol]] of JUGADORES.entries()) {
      const equipo = i < 5 ? 1 : 2
      const origen = page.locator('.banca li').filter({ hasText: nombre })
      const destino = page.locator(`.team.is-t${equipo} li`).filter({ hasText: rol })
      await origen.dragTo(destino)
      await expect(destino).toContainText(nombre)
    }

    const total = Date.now() - arranque

    await expect(page.locator('.team.is-t1')).toContainText('Equipo completo')
    await expect(page.locator('.team.is-t2')).toContainText('Equipo completo')

    console.log(`  registro de 10: ${(tRegistro / 1000).toFixed(1)} s`)
    console.log(`  total hasta 5v5: ${(total / 1000).toFixed(1)} s`)

    // El sistema tiene que dejar margen de sobra a la persona que lo opera.
    expect(total, 'el sistema solo debería tardar una fracción de los 3 minutos').toBeLessThan(90_000)
  })
})
