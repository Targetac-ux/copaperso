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
      const { data: sps } = await c.from('session_participant').select('id').eq('session_id', sessionId)
      for (const sp of sps ?? []) await c.from('team_member').delete().eq('session_participant_id', sp.id)
      await c.from('session_participant').delete().eq('session_id', sessionId)
      await c.from('action_log').delete().eq('session_id', sessionId)
      await c.from('team').delete().eq('session_id', sessionId)
      await c.from('session').delete().eq('id', sessionId)
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

    // 2. Abrir la sesión desde el propio CCTM.
    await gotoHydrated(page, '/host')
    await page.getByRole('button', { name: 'Abrir sesión' }).click()
    await expect(page.getByText(/Sesión #\d+/)).toBeVisible()

    const c = db()
    const { data: ses } = await c
      .from('session')
      .select('id')
      .order('started_at', { ascending: false })
      .limit(1)
      .single()
    sessionId = ses!.id

    // 3. Meterlos en la banca desde "registrados este mes".
    for (const nombre of NOMBRES) {
      await page.getByRole('button', { name: `+ ${nombre}` }).click()
      await expect(page.getByRole('button', { name: `+ ${nombre}` })).toHaveCount(0)
    }
    await expect(page.getByText('4 disponibles en la banca')).toBeVisible()

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

  test('el swap intercambia equipo y conserva el rol', async ({ page }) => {
    await gotoHydrated(page, '/host')
    await expect(page.getByText(/Sesión #\d+/)).toBeVisible()

    // Poner al segundo en el Team 2 como ADC.
    const segundo = page.locator('.banca li').filter({ hasText: NOMBRES[1]! })
    await segundo.click()
    await page.getByRole('button', { name: 'ADC', exact: true }).click()
    await page.getByRole('button', { name: 'Team 2' }).click()
    await page.getByRole('button', { name: 'Asignar', exact: true }).click()
    // Es off-role (lo registramos como MID), así que avisa: confirmamos.
    await page.getByRole('button', { name: 'Hacerlo igual' }).click()
    await expect(page.locator('.team.is-t2 li').filter({ hasText: 'ADC' })).toContainText(NOMBRES[1]!)

    // Swap entre el MID del Team 1 y el ADC del Team 2.
    await page.locator('.team.is-t1 li').filter({ hasText: NOMBRES[0]! }).click()
    await page.getByRole('button', { name: 'Swap' }).click()
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
    await page.getByRole('button', { name: 'Team 1' }).click()
    await page.getByRole('button', { name: 'Mover aquí' }).click()

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
    await expect(page.getByText('4 disponibles en la banca')).toBeVisible()

    const c = db()
    const { count } = await c
      .from('session_participant')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId!)
    expect(count, 'siguen siendo participantes de la sesión').toBe(4)
  })

  test('sacar de la sesión no borra el perfil ni la participación', async ({ page }) => {
    await gotoHydrated(page, '/host')
    await page.locator('.banca li').filter({ hasText: NOMBRES[3]! }).click()
    await page.getByRole('button', { name: 'Sacar de la sesión' }).click()
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
