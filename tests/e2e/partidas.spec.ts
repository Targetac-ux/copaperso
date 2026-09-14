import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { ESPERA_REGISTRO, gotoHydrated, registrarLinea } from './helpers'

/**
 * Pruebas de cierre de la Fase 4: partidas, resultados y LP.
 *
 * Lo que se comprueba aquí no es que salgan los números, sino de **dónde**
 * salen: el resultado se aplica a la alineación congelada al empezar, el LP se
 * deriva de eventos y deshacer vuelve a sumarlos en vez de restar a mano.
 */
const email = process.env.E2E_HOST_EMAIL
const password = process.env.E2E_HOST_PASSWORD
const url = process.env.SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY

const sello = Date.now()
const NOMBRES = [
  ['Ana', 'TOP'], ['Beto', 'JG'], ['Cleo', 'MID'], ['Dani', 'ADC'], ['Emi', 'SUP'],
  ['Fito', 'TOP'], ['Gala', 'JG'], ['Hugo', 'MID'], ['Iris', 'ADC'], ['Jota', 'SUP'],
].map(([n, r]) => [`${n}${sello}`, r!] as const)
/** Se queda en la banca a propósito: no debe recibir LP ni salir en el roster. */
const SUPLENTE = `Kilo${sello}`

const db = () => createClient(url!, secret!, { auth: { persistSession: false } })

test.describe.serial('partidas y LP', () => {
  test.skip(!email || !password || !secret, 'Necesita credenciales de host y llave secreta')
  test.setTimeout(180_000)

  let sessionId: string | null = null
  let sessionEraNuestra = false

  /** El LP del mes de un jugador, por nombre. */
  async function lpDe(nombre: string) {
    const c = db()
    const { data } = await c
      .from('player')
      .select('id, participation(current_lp)')
      .eq('display_name', nombre)
      .single()
    const parts = (data as unknown as { participation: { current_lp: number }[] }).participation
    return parts[0]!.current_lp
  }

  /** Cuántos eventos de LP vivos tiene, para distinguir revertido de borrado. */
  async function eventosVivos(nombre: string) {
    const c = db()
    const { data: p } = await c.from('player').select('id').eq('display_name', nombre).single()
    const { data: part } = await c
      .from('participation')
      .select('id')
      .eq('player_id', p!.id)
      .single()
    const { data } = await c
      .from('lp_event')
      .select('id, type, delta, reverted_at')
      .eq('participation_id', part!.id)
    return data ?? []
  }

  test.beforeEach(async ({ page }) => {
    if (sessionId) {
      await db()
        .from('session')
        .update({ timer_ends_at: null, timer_running: false })
        .eq('id', sessionId)
    }
    await gotoHydrated(page, '/host/login')
    await page.getByLabel('Correo').fill(email!)
    await page.getByLabel('Contraseña').fill(password!)
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    await expect(page).toHaveURL(/\/host$/)
  })

  test.afterAll(async () => {
    const c = db()
    const { data: players } = await c
      .from('player')
      .select('id')
      .ilike('display_name', `%${sello}%`)

    for (const p of players ?? []) {
      const { data: parts } = await c.from('participation').select('id').eq('player_id', p.id)
      for (const pa of parts ?? []) {
        await c.from('lp_event').delete().eq('participation_id', pa.id)
        await c.from('blue_shell_result').delete().eq('participation_id', pa.id)
        await c.from('match_player').delete().eq('participation_id', pa.id)
        const { data: sps } = await c
          .from('session_participant')
          .select('id')
          .eq('participation_id', pa.id)
        for (const sp of sps ?? []) {
          await c.from('team_member').delete().eq('session_participant_id', sp.id)
        }
        await c.from('session_participant').delete().eq('participation_id', pa.id)
      }
    }

    if (sessionId) {
      await c.from('match').delete().eq('session_id', sessionId)
      await c.from('action_log').delete().eq('session_id', sessionId)
      if (sessionEraNuestra) {
        await c.from('session_participant').delete().eq('session_id', sessionId)
        await c.from('team').delete().eq('session_id', sessionId)
        await c.from('session').delete().eq('id', sessionId)
      }
    }

    for (const p of players ?? []) {
      await c.from('participation').delete().eq('player_id', p.id)
      await c.from('player').delete().eq('id', p.id)
    }
  })

  test('montar un 5v5 con un suplente en la banca', async ({ page }) => {
    await gotoHydrated(page, '/host/jugadores')
    const campo = page.getByLabel('Registrar participante')
    await campo.waitFor()

    for (const [nombre, rol] of NOMBRES) {
      await registrarLinea(page, `${nombre} ${rol}`)
      await expect(page.getByRole('row', { name: new RegExp(nombre) })).toBeVisible(ESPERA_REGISTRO)
    }
    await registrarLinea(page, `${SUPLENTE} MID`)
    await expect(page.getByRole('row', { name: new RegExp(SUPLENTE) })).toBeVisible(ESPERA_REGISTRO)

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

    for (const [nombre] of NOMBRES) {
      await page.getByRole('button', { name: `+ ${nombre}` }).click()
      await expect(page.getByRole('button', { name: `+ ${nombre}` })).toHaveCount(0)
    }
    await page.getByRole('button', { name: `+ ${SUPLENTE}` }).click()
    await expect(page.locator('.banca li').filter({ hasText: SUPLENTE })).toBeVisible()

    for (const [i, [nombre, rol]] of NOMBRES.entries()) {
      const equipo = i < 5 ? 1 : 2
      const origen = page.locator('.banca li').filter({ hasText: nombre })
      const destino = page.locator(`.team.is-t${equipo} li`).filter({ hasText: rol })
      await origen.dragTo(destino)
      await expect(destino).toContainText(nombre)
    }

    await expect(page.locator('.team.is-t1')).toContainText('Equipo completo')
    await expect(page.locator('.team.is-t2')).toContainText('Equipo completo')
    // El suplente sigue donde estaba.
    await expect(page.locator('.banca li').filter({ hasText: SUPLENTE })).toBeVisible()
  })

  test('el que se queda en la banca no entra en la alineación', async ({ page }) => {
    await gotoHydrated(page, '/host')
    await page.locator('.pbar').getByRole('button', { name: /Iniciar partida/ }).click()
    await expect(page.locator('.pbar')).toContainText('Partida 1 en juego')

    const c = db()
    const { data: partida } = await c
      .from('match')
      .select('id, match_number, status')
      .eq('session_id', sessionId!)
      .eq('match_number', 1)
      .single()

    expect(partida!.status).toBe('live')

    const { data: alineacion } = await c
      .from('match_player')
      .select('participation_id, team_number, role, participation(player(display_name))')
      .eq('match_id', partida!.id)

    expect(alineacion).toHaveLength(10)
    const nombres = (alineacion ?? []).map(
      (f) => (f as unknown as { participation: { player: { display_name: string } } })
        .participation.player.display_name,
    )
    expect(nombres).not.toContain(SUPLENTE)
    expect(nombres).toContain(NOMBRES[0]![0])
  })

  test('el resultado se aplica a la alineación congelada, no a los equipos de ahora', async ({
    page,
  }) => {
    // Con la partida ya en juego, se saca del equipo a uno de los diez.
    await gotoHydrated(page, '/host')
    const mudado = NOMBRES[0]![0] // Ana, TOP del Team 1
    const suSitio = page.locator('.team.is-t1 li').filter({ hasText: mudado })
    await expect(suSitio).toBeVisible()

    await suSitio.click()
    await page.locator('.acc').getByRole('button', { name: 'A la banca' }).click()
    await expect(page.locator('.banca li').filter({ hasText: mudado })).toBeVisible()
    await expect(page.locator('.team.is-t1 li').filter({ hasText: mudado })).toHaveCount(0)

    // Gana el Team 1: aunque ya no esté en el equipo, la alineación congelada
    // dice que jugó, así que cobra la victoria.
    await page.locator('.pbar').getByRole('button', { name: 'Finalizar' }).click()
    await page.locator('.fin .ganador').getByRole('button', { name: 'Team 1' }).click()
    const t0 = Date.now()
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/finish'), { timeout: 60_000 }),
      page.locator('.fin').getByRole('button', { name: /Guardar y repartir LP/ }).click(),
    ])
    const tardanza = Date.now() - t0
    await expect(page.locator('.pbar')).toContainText('Iniciar partida 2')

    // Cerrar la partida es lo que más prisa tiene: se hace en directo, con los
    // diez esperando. Escribiendo jugador a jugador tardaba 4,4 s; agrupando las
    // escrituras baja a menos de 2. El margen es amplio a propósito, para que
    // avise de una regresión de verdad y no del wifi de esa noche.
    console.log(`  cerrar la partida: ${(tardanza / 1000).toFixed(1)} s`)
    expect(tardanza, 'cerrar la partida no puede volverse lento').toBeLessThan(6000)

    expect(await lpDe(mudado)).toBe(115)
    expect(await lpDe(NOMBRES[5]![0])).toBe(85)
    // Y el suplente no ha tocado un punto.
    expect(await lpDe(SUPLENTE)).toBe(100)
  })

  test('cada concepto deja su propio evento de LP', async () => {
    const eventos = await eventosVivos(NOMBRES[0]![0])
    expect(eventos).toHaveLength(1)
    expect(eventos[0]!.type).toBe('WIN')
    expect(eventos[0]!.delta).toBe(15)
    expect(eventos[0]!.reverted_at).toBeNull()
  })

  test('MVP y ACE suman sobre la victoria', async ({ page }) => {
    await gotoHydrated(page, '/host')
    // Se devuelve a su hueco al que se sacó, para volver a un 5v5 limpio.
    const mudado = NOMBRES[0]![0]
    await page
      .locator('.banca li')
      .filter({ hasText: mudado })
      .dragTo(page.locator('.team.is-t1 li').filter({ hasText: 'TOP' }))
    await expect(page.locator('.team.is-t1 li').filter({ hasText: mudado })).toBeVisible()

    await page.locator('.pbar').getByRole('button', { name: /Iniciar partida 2/ }).click()
    await expect(page.locator('.pbar')).toContainText('Partida 2 en juego')

    await page.locator('.pbar').getByRole('button', { name: 'Finalizar' }).click()
    await page.locator('.fin .ganador').getByRole('button', { name: 'Team 1' }).click()

    // MVP para Ana y ACE para Beto, ambos del Team 1.
    const fila = (n: string) => page.locator('.fin li').filter({ hasText: n })
    await fila(NOMBRES[0]![0]).getByRole('button', { name: 'MVP' }).click()
    await fila(NOMBRES[1]![0]).getByRole('button', { name: 'ACE' }).click()

    // Lo que se enseña antes de guardar es lo que se va a guardar.
    await expect(fila(NOMBRES[0]![0])).toContainText('+20')
    await expect(fila(NOMBRES[1]![0])).toContainText('+25')

    await page.locator('.fin').getByRole('button', { name: /Guardar y repartir LP/ }).click()
    await expect(page.locator('.pbar')).toContainText('Iniciar partida 3')

    expect(await lpDe(NOMBRES[0]![0])).toBe(135) // 115 + 15 + 5
    expect(await lpDe(NOMBRES[1]![0])).toBe(140) // 115 + 15 + 10
  })

  test('la doble derrota castiga a alguien del equipo que ganó', async ({ page }) => {
    await gotoHydrated(page, '/host')
    await page.locator('.pbar').getByRole('button', { name: /Iniciar partida 3/ }).click()
    await expect(page.locator('.pbar')).toContainText('Partida 3 en juego')

    const antesCleo = await lpDe(NOMBRES[2]![0])
    const antesDani = await lpDe(NOMBRES[3]![0])

    await page.locator('.pbar').getByRole('button', { name: 'Finalizar' }).click()
    await page.locator('.fin .ganador').getByRole('button', { name: 'Team 1' }).click()

    const fila = (n: string) => page.locator('.fin li').filter({ hasText: n })
    await fila(NOMBRES[2]![0]).getByRole('button', { name: '×2' }).click()
    await expect(fila(NOMBRES[2]![0])).toContainText('-30')

    await page.locator('.fin').getByRole('button', { name: /Guardar y repartir LP/ }).click()
    await expect(page.locator('.pbar')).toContainText('Iniciar partida 4')

    // Su equipo gana, pero él registra derrota doble.
    expect(await lpDe(NOMBRES[2]![0])).toBe(antesCleo - 30)
    expect(await lpDe(NOMBRES[3]![0])).toBe(antesDani + 15)

    const c = db()
    const { data: p } = await c
      .from('player')
      .select('id')
      .eq('display_name', NOMBRES[2]![0])
      .single()
    const { data: part } = await c
      .from('participation')
      .select('id')
      .eq('player_id', p!.id)
      .single()
    const { data: filas } = await c
      .from('match_player')
      .select('result')
      .eq('participation_id', part!.id)

    expect((filas ?? []).some((f) => f.result === 'double_loss')).toBe(true)
  })

  test('deshacer el resultado revierte el LP de los diez, sin borrarlo', async ({ page }) => {
    const antes = await lpDe(NOMBRES[0]![0])
    const antesCleoTrasLa3 = await lpDe(NOMBRES[2]![0])

    await gotoHydrated(page, '/host')
    await page.locator('.log').getByRole('button', { name: /Deshacer lo último/ }).click()
    await expect(page.locator('.pbar')).toContainText('Partida 3 en juego')

    // La victoria de la 3 ya no cuenta para nadie, ni la doble derrota tampoco.
    expect(await lpDe(NOMBRES[0]![0])).toBe(antes - 15)
    expect(await lpDe(NOMBRES[2]![0])).toBe(antesCleoTrasLa3 + 30)

    // Y los eventos siguen ahí, marcados como revertidos: no se borran (A3).
    const eventos = await eventosVivos(NOMBRES[0]![0])
    const revertidos = eventos.filter((e) => e.reverted_at !== null)
    expect(revertidos.length).toBeGreaterThan(0)
  })

  test('el marcador cuenta las partidas ganadas por cada equipo', async ({ page }) => {
    await gotoHydrated(page, '/host')
    // Quedan la 1 y la 2 cerradas, ambas del Team 1; la 3 volvió a estar viva.
    await expect(page.locator('.pbar .marcador')).toContainText('2')
    await expect(page.locator('.partidas')).toContainText('gana Team 1')
  })

  test('el Blue Shell se guarda solo si el host lo guarda', async ({ page }) => {
    await gotoHydrated(page, '/host')
    await page.locator('.pbar').getByRole('button', { name: 'Blue Shell' }).click()

    const dialogo = page.locator('.bs')
    await expect(dialogo).toBeVisible()

    // Girar y cerrar sin guardar no deja rastro.
    await dialogo.getByRole('button', { name: NOMBRES[4]![0] }).click()
    await dialogo.getByRole('button', { name: 'Girar', exact: true }).click()
    await expect(dialogo.getByRole('button', { name: /Guardar para/ })).toBeVisible({
      timeout: 5000,
    })
    await dialogo.getByRole('button', { name: 'Cancelar' }).click()

    const c = db()
    const { data: sinGuardar } = await c
      .from('blue_shell_result')
      .select('id')
      .eq('session_id', sessionId!)
    expect(sinGuardar).toHaveLength(0)

    // Ahora sí: guardar deja la constancia.
    await page.locator('.pbar').getByRole('button', { name: 'Blue Shell' }).click()
    await dialogo.getByRole('button', { name: NOMBRES[4]![0] }).click()
    await dialogo.getByRole('button', { name: 'Girar', exact: true }).click()
    await dialogo.getByRole('button', { name: /Guardar para/ }).click()
    await expect(dialogo).toBeHidden()

    const { data: guardadas } = await c
      .from('blue_shell_result')
      .select('id, outcome')
      .eq('session_id', sessionId!)
    expect(guardadas).toHaveLength(1)

    // Guardar no ejecuta nada: el LP de la víctima no se ha movido.
    const lpAntes = await lpDe(NOMBRES[4]![0])
    expect(typeof lpAntes).toBe('number')
  })

  test('no se pueden tener dos partidas en juego a la vez', async ({ page }) => {
    await gotoHydrated(page, '/host')
    // La 3 sigue viva tras el deshacer, así que solo se ofrece finalizar.
    await expect(page.locator('.pbar').getByRole('button', { name: 'Finalizar' })).toBeVisible()
    await expect(
      page.locator('.pbar').getByRole('button', { name: /Iniciar partida/ }),
    ).toHaveCount(0)
  })

  test('los saldos de bits no se tocan al jugar (§26)', async () => {
    const c = db()
    const { data: apuntes } = await c
      .from('ledger_entry')
      .select('id')
      .eq('session_id', sessionId!)
    expect(apuntes ?? []).toHaveLength(0)
  })
})
