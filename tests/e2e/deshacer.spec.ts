import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { gotoHydrated } from './helpers'

/**
 * Pruebas de cierre de la Fase 3C: el historial y el deshacer.
 *
 * La prueba fuerte es la 2: tras deshacer, la base tiene que quedar
 * **idénticamente** como estaba. Se compara un retrato de las tablas antes y
 * después, no solo lo que se ve en pantalla.
 */
const email = process.env.E2E_HOST_EMAIL
const password = process.env.E2E_HOST_PASSWORD
const url = process.env.SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY

const sello = Date.now()
const NOMBRES = ['Undo1', 'Undo2'].map((n) => `${n}${sello}`)
const db = () => createClient(url!, secret!, { auth: { persistSession: false } })

/** Retrato del estado del draft, para comparar antes y después. */
async function retrato(sessionId: string) {
  const c = db()
  const { data: sps } = await c
    .from('session_participant')
    .select('id, participation_id, state')
    .eq('session_id', sessionId)
    .order('id')
  const { data: teams } = await c.from('team').select('id').eq('session_id', sessionId)
  const ids = (teams ?? []).map((t) => t.id)
  const { data: miembros } = ids.length
    ? await c
        .from('team_member')
        .select('team_id, session_participant_id, role')
        .in('team_id', ids)
        .order('session_participant_id')
    : { data: [] }
  return JSON.stringify({ sps, miembros })
}

test.describe.serial('historial y deshacer', () => {
  test.skip(!email || !password || !secret, 'Necesita credenciales de host y llave secreta')

  let sessionId: string | null = null
  let sessionEraNuestra = false

  test.beforeEach(async ({ page }) => {
    // Un cronómetro vencido —de este spec o de otro— deja el aviso abierto, y
    // el aviso intercepta los clics. Se limpia en cualquier sesión abierta.
    await db()
      .from('session')
      .update({ timer_ends_at: null, timer_running: false })
      .neq('status', 'closed')
    await gotoHydrated(page, '/host/login')
    await page.getByLabel('Correo').fill(email!)
    await page.getByLabel('Contraseña').fill(password!)
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    await expect(page).toHaveURL(/\/host$/)
  })

  test.afterAll(async () => {
    const c = db()
    const { data: players } = await c.from('player').select('id').ilike('display_name', `%${sello}%`)
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
      }
      await c.from('participation').delete().eq('player_id', p.id)
      await c.from('player').delete().eq('id', p.id)
    }
    if (sessionId) {
      await c.from('action_log').delete().eq('session_id', sessionId)
      if (sessionEraNuestra) {
        await c.from('session_participant').delete().eq('session_id', sessionId)
        await c.from('team').delete().eq('session_id', sessionId)
        await c.from('session').delete().eq('id', sessionId)
      }
    }
  })

  test('deshacer una asignación deja la base como estaba', async ({ page }) => {
    // Preparar: dos jugadores en la banca.
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

    // Partir de equipos vacíos: si quedara alguien de otro spec, el drag
    // dispararía el aviso de rol duplicado y el test mediría otra cosa.
    const { data: equipos } = await c.from('team').select('id').eq('session_id', sessionId)
    await c
      .from('team_member')
      .delete()
      .in('team_id', (equipos ?? []).map((t) => t.id))
    await c
      .from('session_participant')
      .update({ state: 'bench' })
      .eq('session_id', sessionId)
      .eq('state', 'team')
    await page.reload()
    await page.waitForSelector('html[data-hydrated]')

    const campo = page.getByLabel('Registrar participante')
    await campo.waitFor()
    for (const nombre of NOMBRES) {
      await campo.fill(`${nombre} MID`)
      await campo.press('Enter')
      await expect(page.locator('.banca li').filter({ hasText: nombre })).toBeVisible()
    }

    const antes = await retrato(sessionId)

    // Asignar al primero a MID del Team 1.
    const origen = page.locator('.banca li').filter({ hasText: NOMBRES[0]! })
    const destino = page.locator('.team.is-t1 li').filter({ hasText: 'MID' })
    await origen.dragTo(destino)
    await expect(destino).toContainText(NOMBRES[0]!)
    expect(await retrato(sessionId), 'la asignación cambió algo').not.toBe(antes)

    // Deshacer desde el historial.
    await page.getByRole('button', { name: '↶ Deshacer lo último' }).click()
    await expect(page.locator('.banca li').filter({ hasText: NOMBRES[0]! })).toBeVisible()

    expect(await retrato(sessionId), 'tras deshacer, todo igual que antes').toBe(antes)
  })

  test('deshacer dos veces no aplica el efecto dos veces', async ({ page }) => {
    await gotoHydrated(page, '/host')
    const c = db()

    // Asignar y quedarse con el id de esa entrada del historial.
    const origen = page.locator('.banca li').filter({ hasText: NOMBRES[1]! })
    const destino = page.locator('.team.is-t2 li').filter({ hasText: 'MID' })
    await origen.dragTo(destino)
    await expect(destino).toContainText(NOMBRES[1]!)

    const { data: entrada } = await c
      .from('action_log')
      .select('id')
      .eq('session_id', sessionId!)
      .eq('action_type', 'draft.assign')
      .is('undone_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const primera = await page.request.post(`/api/log/${entrada!.id}/undo`)
    expect(primera.ok()).toBeTruthy()

    // La segunda tiene que rebotar, no repetir.
    const segunda = await page.request.post(`/api/log/${entrada!.id}/undo`)
    expect(segunda.status()).toBe(409)
    expect(await segunda.text()).toContain('ya estaba deshecha')
  })

  test('lo deshecho se queda tachado en el historial', async ({ page }) => {
    await gotoHydrated(page, '/host')
    await expect(page.locator('.log li.is-undone').first()).toBeVisible()
    // Y no ofrece volver a deshacerlo.
    await expect(page.locator('.log li.is-undone .undo')).toHaveCount(0)
  })

  test('lo irreversible se rechaza con un mensaje claro', async ({ page }) => {
    const c = db()
    const { data: entrada } = await c
      .from('action_log')
      .insert({
        session_id: sessionId,
        action_type: 'session.close',
        summary: 'Sesión cerrada',
        reversible: false,
      })
      .select('id')
      .single()

    await gotoHydrated(page, '/host')
    const res = await page.request.post(`/api/log/${entrada!.id}/undo`)
    expect(res.status()).toBe(422)
    expect(await res.text()).toContain('no se puede deshacer')

    await c.from('action_log').delete().eq('id', entrada!.id)
  })

  test('cada mutación deja exactamente una entrada', async ({ page }) => {
    await gotoHydrated(page, '/host')
    const c = db()

    const { count: antes } = await c
      .from('action_log')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId!)

    // Una sola acción: mandar a alguien a la cárcel.
    await page.locator('.banca li').filter({ hasText: NOMBRES[0]! }).click()
    await page.locator('.acc').getByRole('button', { name: 'Cárcel' }).click()
    await expect(page.locator('.banca li').filter({ hasText: NOMBRES[0]! })).toHaveCount(0)

    const { count: despues } = await c
      .from('action_log')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId!)

    expect((despues ?? 0) - (antes ?? 0), 'una acción, una entrada').toBe(1)

    // Y la entrada trae actor y receta para deshacerse.
    const { data: ultima } = await c
      .from('action_log')
      .select('actor, inverse_payload, summary')
      .eq('session_id', sessionId!)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    expect(ultima!.actor, 'la entrada dice quién lo hizo').not.toBeNull()
    expect(ultima!.inverse_payload, 'y cómo deshacerlo').not.toBeNull()
  })

  test('deshacer un movimiento del banco devuelve el saldo', async ({ page }) => {
    const c = db()
    const { data: cuenta } = await c
      .from('ledger_account')
      .insert({ display_name: `Banco${sello}`, kind: 'supporter', balance_bits: 1000 })
      .select('id')
      .single()

    await gotoHydrated(page, '/host')

    // Restar 500 bits, como haría el host tras cobrar una recompensa.
    const res = await page.request.post(`/api/ledger/${cuenta!.id}/entries`, {
      data: { delta_bits: -500, reason: 'Blue Shell', session_id: sessionId },
    })
    expect(res.ok()).toBeTruthy()

    const { data: tras } = await c
      .from('ledger_account')
      .select('balance_bits')
      .eq('id', cuenta!.id)
      .single()
    expect(tras!.balance_bits).toBe(500)

    // Deshacerlo devuelve el saldo...
    const { data: entrada } = await c
      .from('action_log')
      .select('id')
      .eq('action_type', 'ledger.entry')
      .is('undone_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    expect((await page.request.post(`/api/log/${entrada!.id}/undo`)).ok()).toBeTruthy()

    const { data: vuelta } = await c
      .from('ledger_account')
      .select('balance_bits')
      .eq('id', cuenta!.id)
      .single()
    expect(vuelta!.balance_bits, 'el saldo vuelve a donde estaba').toBe(1000)

    // ...anotando la corrección, en vez de borrar el movimiento original.
    const { data: asientos } = await c
      .from('ledger_entry')
      .select('delta_bits, reason')
      .eq('account_id', cuenta!.id)
      .order('created_at')
    expect(asientos, 'el original se queda y se añade la corrección').toHaveLength(2)
    expect(asientos![1]!.delta_bits).toBe(500)

    await c.from('ledger_entry').delete().eq('account_id', cuenta!.id)
    await c.from('ledger_account').delete().eq('id', cuenta!.id)
  })

  test('deshacer una acción antigua con otras encima no rompe nada', async ({ page }) => {
    await gotoHydrated(page, '/host')
    const c = db()

    // Sacar de la cárcel, asignar, devolver a banca: tres acciones encima.
    await page.locator('.eco').getByRole('button', { name: /^Estados/ }).click()
    await page.locator('.eco').getByRole('button', { name: 'Soltar' }).first().click()
    await expect(page.locator('.banca li').filter({ hasText: NOMBRES[0]! })).toBeVisible()

    const { data: entradas } = await c
      .from('action_log')
      .select('id, summary')
      .eq('session_id', sessionId!)
      .eq('reversible', true)
      .is('undone_at', null)
      .order('created_at', { ascending: false })
      .limit(3)

    // Deshacer la más antigua de las tres, saltándose las dos posteriores.
    const antigua = entradas![entradas!.length - 1]!
    const res = await page.request.post(`/api/log/${antigua.id}/undo`)
    expect(res.ok(), await res.text()).toBeTruthy()

    // El panel sigue vivo y coherente.
    await page.reload()
    await page.waitForSelector('html[data-hydrated]')
    await expect(page.locator('.banca')).toBeVisible()
    await expect(page.locator('.team.is-t1')).toBeVisible()
  })
})
