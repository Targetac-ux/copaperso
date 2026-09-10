import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { gotoHydrated } from './helpers'

/**
 * Pruebas de cierre de la Fase 3A: la mesa de control.
 *
 * Trabaja sobre una sesión de verdad y la limpia al terminar.
 */
const email = process.env.E2E_HOST_EMAIL
const password = process.env.E2E_HOST_PASSWORD
const url = process.env.SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY

const sello = Date.now()
const NOMBRES = ['Uno', 'Dos', 'Tres', 'Cuatro'].map((n) => `${n}${sello}`)

const db = () => createClient(url!, secret!, { auth: { persistSession: false } })

test.describe.serial('CCTM · banca, draft y swap', () => {
  test.skip(!email || !password || !secret, 'Necesita credenciales de host y llave secreta')

  let sessionId: string | null = null
  /** Si la sesión ya existía (es del host, no del test), no se borra al terminar. */
  let sessionEraNuestra = false

  test.beforeEach(async ({ page }) => {
    await gotoHydrated(page, '/host/login')
    await page.getByLabel('Correo').fill(email!)
    await page.getByLabel('Contraseña').fill(password!)
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    await expect(page).toHaveURL(/\/host$/)
  })

  test.afterAll(async () => {
    const c = db()
    if (sessionId) {
      // Quitar de la sesión solo a los jugadores que creó el test.
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

  test('abrir sesión, llenar la banca y asignar arrastrando', async ({ page }) => {
    // 1. Registrar a cuatro personas en el periodo.
    await gotoHydrated(page, '/host/jugadores')
    const campo = page.getByLabel('Registrar participante')
    await campo.waitFor()
    for (const nombre of NOMBRES) {
      await campo.fill(`${nombre} MID`)
      await campo.press('Enter')
      await expect(page.getByRole('row', { name: new RegExp(nombre) })).toBeVisible()
    }

    // 2. Trabajar sobre la sesión abierta. Si no hay ninguna, la creamos
    //    nosotros; si ya la había, es del host y no se toca al limpiar.
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

    // 3. Meterlos en la banca desde "registrados este mes".
    for (const nombre of NOMBRES) {
      await page.getByRole('button', { name: `+ ${nombre}` }).click()
      await expect(page.getByRole('button', { name: `+ ${nombre}` })).toHaveCount(0)
    }
    // Los cuatro están en la banca. Se comprueban por nombre y no por el
    // contador: otros tests pueden haber dejado gente en la misma sesión.
    for (const nombre of NOMBRES) {
      await expect(page.locator('.banca li').filter({ hasText: nombre })).toBeVisible()
    }

    // 4. Arrastrar de la banca al puesto de MID del Team 1.
    const enBanca = page.locator('.banca li').filter({ hasText: NOMBRES[0]! })
    const slotMid = page.locator('.team.is-t1 li').filter({ hasText: 'MID' })
    await enBanca.dragTo(slotMid)
    await expect(slotMid).toContainText(NOMBRES[0]!)

    // 5. Y sigue ahí después de recargar: se guardó de verdad.
    await page.reload()
    await page.waitForSelector('html[data-hydrated]')
    await expect(page.locator('.team.is-t1 li').filter({ hasText: 'MID' })).toContainText(NOMBRES[0]!)
  })

  test('registrar en vivo desde el propio CCTM, a la banca y directo a un equipo', async ({
    page,
  }) => {
    // El caso real: el chat dice un nombre y el host lo teclea sin salir de la mesa (§7).
    await gotoHydrated(page, '/host')
    await expect(page.getByText(/Sesión #\d+/)).toBeVisible()

    const campo = page.getByLabel('Registrar participante')
    await campo.waitFor()

    // 1. A la banca, que es el destino por defecto.
    const aBanca = `Vivo${sello}`
    await campo.fill(`${aBanca} SUP Master`)
    await campo.press('Enter')
    await expect(page.locator('.banca li').filter({ hasText: aBanca })).toBeVisible()

    // 2. Directo a un equipo, sin pasar por la banca.
    const aEquipo = `Directo${sello}`
    await page.locator('.destino').getByRole('button', { name: 'Team 2' }).click()
    await page.locator('.destino').getByRole('button', { name: 'SUP', exact: true }).click()
    await campo.fill(`${aEquipo} SUP Diamante`)
    await campo.press('Enter')

    await expect(page.locator('.team.is-t2 li').filter({ hasText: 'SUP' })).toContainText(aEquipo)
    await expect(page.locator('.banca li').filter({ hasText: aEquipo })).toHaveCount(0)

    // 3. Y quedaron registrados en el mes, no solo en la sesión.
    const c = db()
    const { data } = await c.from('player').select('id').in('display_name', [aBanca, aEquipo])
    expect(data).toHaveLength(2)
  })

  test('el swap intercambia equipo y conserva el rol', async ({ page }) => {
    await gotoHydrated(page, '/host')
    await expect(page.getByText(/Sesión #\d+/)).toBeVisible()

    // Poner al segundo en el Team 2 como ADC.
    const segundo = page.locator('.banca li').filter({ hasText: NOMBRES[1]! })
    await segundo.click()
    // Acotado al panel de acciones: el registro en vivo también tiene botones de rol.
    const acciones = page.locator('.acc')
    await acciones.getByRole('button', { name: 'ADC', exact: true }).click()
    await acciones.getByRole('button', { name: 'Team 2' }).click()
    await acciones.getByRole('button', { name: 'Asignar', exact: true }).click()
    // Es off-role (lo registramos como MID), así que avisa: confirmamos.
    await page.getByRole('button', { name: 'Hacerlo igual' }).click()
    await expect(page.locator('.team.is-t2 li').filter({ hasText: 'ADC' })).toContainText(NOMBRES[1]!)

    // Swap entre el MID del Team 1 y el ADC del Team 2.
    await page.locator('.team.is-t1 li').filter({ hasText: NOMBRES[0]! }).click()
    await page.locator('.acc').getByRole('button', { name: 'Swap' }).click()
    await page.locator('.team.is-t2 li').filter({ hasText: NOMBRES[1]! }).click()

    // Cada uno acaba en el equipo del otro, con su rol intacto.
    await expect(page.locator('.team.is-t2 li').filter({ hasText: 'MID' })).toContainText(NOMBRES[0]!)
    await expect(page.locator('.team.is-t1 li').filter({ hasText: 'ADC' })).toContainText(NOMBRES[1]!)

    // Y el historial registra los dos movimientos.
    const c = db()
    const { data: log } = await c
      .from('action_log')
      .select('summary')
      .eq('session_id', sessionId!)
      .eq('action_type', 'draft.swap')
    expect(log).toHaveLength(2)
  })

  test('el mismo jugador no puede estar en dos equipos', async ({ page }) => {
    await gotoHydrated(page, '/host')
    // NOMBRES[0] está en Team 2 tras el swap; lo mandamos al Team 1.
    await page.locator('.team.is-t2 li').filter({ hasText: NOMBRES[0]! }).click()
    const acc = page.locator('.acc')
    await acc.getByRole('button', { name: 'Team 1' }).click()
    await acc.getByRole('button', { name: 'Mover aquí' }).click()

    const c = db()
    const { data: sps } = await c
      .from('session_participant')
      .select('id, participation(player(display_name))')
      .eq('session_id', sessionId!)
    const sp = (sps ?? []).find(
      (x) =>
        (x.participation as unknown as { player: { display_name: string } })?.player
          ?.display_name === NOMBRES[0],
    )
    const { data: filas } = await c
      .from('team_member')
      .select('id')
      .eq('session_participant_id', sp!.id)
    expect(filas, 'una persona solo puede ocupar un puesto').toHaveLength(1)
  })

  test('devolver equipos a banca los vacía sin sacar a nadie de la sesión', async ({ page }) => {
    await gotoHydrated(page, '/host')
    await page.getByRole('button', { name: 'Devolver equipos a banca' }).click()

    await expect(page.locator('.team.is-t1 .is-filled')).toHaveCount(0)
    await expect(page.locator('.team.is-t2 .is-filled')).toHaveCount(0)

    // Los cuatro del test vuelven a estar disponibles en la banca. Se comprueban
    // por nombre y no por el total: otros tests pueden haber sumado gente.
    for (const nombre of NOMBRES.slice(0, 3)) {
      await expect(page.locator('.banca li').filter({ hasText: nombre })).toBeVisible()
    }

    const c = db()
    const { data: players } = await c.from('player').select('id').ilike('display_name', `%${sello}%`)
    const ids = (players ?? []).map((p) => p.id)
    const { data: parts } = await c.from('participation').select('id').in('player_id', ids)
    const { data: sps } = await c
      .from('session_participant')
      .select('id, state')
      .eq('session_id', sessionId!)
      .in('participation_id', (parts ?? []).map((p) => p.id))

    expect(sps?.length, 'siguen siendo participantes de la sesión').toBeGreaterThanOrEqual(4)
    expect(sps?.every((sp) => sp.state !== 'team'), 'ninguno sigue en un equipo').toBe(true)
  })

  test('sacar de la sesión no borra el perfil ni la participación', async ({ page }) => {
    await gotoHydrated(page, '/host')
    await page.locator('.banca li').filter({ hasText: NOMBRES[3]! }).click()
    await page.locator('.acc').getByRole('button', { name: 'Sacar de la sesión' }).click()
    await expect(page.locator('.banca li').filter({ hasText: NOMBRES[3]! })).toHaveCount(0)

    const c = db()
    const { data: player } = await c
      .from('player')
      .select('id')
      .eq('display_name', NOMBRES[3]!)
      .maybeSingle()
    expect(player, 'el perfil permanente sigue').not.toBeNull()

    const { data: parts } = await c
      .from('participation')
      .select('id')
      .eq('player_id', player!.id)
    expect(parts, 'la participación del mes sigue').toHaveLength(1)
  })
})
