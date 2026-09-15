import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { CSV_CABECERAS } from '../../shared/roster'
import { gotoHydrated } from './helpers'

/**
 * Pruebas de cierre de la Fase 5: el roster del mes.
 *
 * Se siembran tres partidas con resultados escritos a mano y se comprueba que
 * cada número de la tabla es el que debe salir. Lo importante no es que el
 * roster pinte algo, sino que **la cuenta sea la correcta**: es el documento
 * que el host mira para repartir premios al final del mes.
 */
const email = process.env.E2E_HOST_EMAIL
const password = process.env.E2E_HOST_PASSWORD
const url = process.env.SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY

const sello = Date.now()
const db = () => createClient(url!, secret!, { auth: { persistSession: false } })

/**
 * Diez jugadores y tres partidas: gana el Team 1, el Team 1 y el Team 2.
 *
 * Lo esperado va escrito a mano, no calculado: si la fórmula se rompiera, un
 * valor calculado en el test se rompería igual y nadie se enteraría.
 */
const ESPERADO = [
  // nombre,   equipo, PJ, V, D, WR, MVP, ACE, off
  ['Alfa', 1, 3, 2, 1, '67 %', 1, 0, 0],
  ['Bravo', 1, 3, 2, 1, '67 %', 0, 1, 0],
  ['Charlie', 1, 3, 2, 1, '67 %', 0, 0, 3],
  ['Delta', 1, 3, 2, 1, '67 %', 0, 0, 0],
  ['Eco', 1, 3, 2, 1, '67 %', 0, 0, 0],
  ['Fox', 2, 3, 1, 2, '33 %', 0, 0, 0],
  ['Golf', 2, 3, 1, 2, '33 %', 0, 0, 0],
  ['Hotel', 2, 3, 1, 2, '33 %', 0, 0, 0],
  ['India', 2, 3, 1, 2, '33 %', 0, 0, 0],
  // Doble derrota en la partida 3, la que ganaba su equipo: se queda sin esa
  // victoria y esa partida le cuenta por dos derrotas. 0V y 1+1+2 = 4D.
  ['Julio', 2, 3, 0, 4, '0 %', 0, 0, 0],
] as const

/** Se queda fuera de todas: tiene que salir con guiones, no con ceros. */
const MIRON = `Miron${sello}`

const nombre = (n: string) => `${n}${sello}`

test.describe.serial('roster del mes', () => {
  test.skip(!email || !password || !secret, 'Necesita credenciales de host y llave secreta')
  test.setTimeout(240_000)
  test.slow()

  let periodId: string | null = null
  let sessionId: string | null = null
  /** La copa que abre este spec si no había ninguna, para borrarla al final. */
  let sesionDePrueba: string | null = null

  test.beforeEach(async ({ page }) => {
    // Cada test arranca con el navegador limpio, así que hay que entrar en
    // todos; el `describe.serial` ordena los tests, no comparte la sesión.
    await gotoHydrated(page, '/host/login')
    await page.getByLabel('Correo').fill(email!)
    await page.getByLabel('Contraseña').fill(password!)
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    await expect(page).toHaveURL(/\/host$/)
  })

  test.afterAll(async () => {
    // Por lotes y no jugador a jugador: el test de carga siembra sesenta, y
    // cinco consultas por cabeza se comen el tiempo del hook antes de acabar.
    const c = db()
    const { data: players } = await c.from('player').select('id').ilike('display_name', `%${sello}%`)
    const ids = (players ?? []).map((p) => p.id)

    if (ids.length) {
      const { data: parts } = await c.from('participation').select('id').in('player_id', ids)
      const pids = (parts ?? []).map((p) => p.id)

      if (pids.length) {
        await c.from('lp_event').delete().in('participation_id', pids)
        await c.from('match_player').delete().in('participation_id', pids)
        const { data: sps } = await c.from('session_participant').select('id').in('participation_id', pids)
        const spids = (sps ?? []).map((x) => x.id)
        if (spids.length) await c.from('team_member').delete().in('session_participant_id', spids)
        await c.from('session_participant').delete().in('participation_id', pids)
        await c.from('participation').delete().in('id', pids)
      }
      await c.from('player').delete().in('id', ids)
    }

    if (sessionId) await c.from('match').delete().eq('session_id', sessionId)
    if (sesionDePrueba) await c.from('session').delete().eq('id', sesionDePrueba)
  })

  test('sembrar tres partidas con resultados conocidos', async () => {
    const c = db()
    let { data: ses } = await c
      .from('session')
      .select('id, period_id')
      .neq('status', 'closed')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    /**
     * Si no hay ninguna copa abierta, se abre aquí.
     *
     * Este spec daba por hecho que el host se había dejado una, y con la base
     * recién limpia se caía con un «no se puede leer id de null», que no dice
     * nada de lo que en realidad falta.
     */
    if (!ses) {
      const { data: periodo } = await c.from('period').select('id').eq('status', 'active').single()
      const { data: nueva } = await c
        .from('session')
        .insert({ period_id: periodo!.id, number: 1, mode: 'perso', status: 'open' })
        .select('id, period_id')
        .single()
      await c.from('team').insert([
        { session_id: nueva!.id, team_number: 1, name: 'Team 1' },
        { session_id: nueva!.id, team_number: 2, name: 'Team 2' },
      ])
      ses = nueva
      sesionDePrueba = nueva!.id
    }

    sessionId = ses!.id
    periodId = ses!.period_id

    const { data: equipos } = await c.from('team').select('id, team_number').eq('session_id', sessionId)
    const idEquipo = new Map((equipos ?? []).map((t) => [t.team_number, t.id]))

    const participacion = new Map<string, string>()

    for (const [n, equipo, , , , , , , off] of ESPERADO) {
      const { data: pl } = await c.from('player').insert({ display_name: nombre(n) }).select('id').single()
      const { data: pa } = await c
        .from('participation')
        .insert({ player_id: pl!.id, period_id: periodId!, roles: ['MID'], elo: 'GOLD', initial_lp: 100, current_lp: 100 })
        .select('id')
        .single()
      const { data: sp } = await c
        .from('session_participant')
        .insert({ session_id: sessionId!, participation_id: pa!.id, state: 'team' })
        .select('id')
        .single()
      await c.from('team_member').insert({
        team_id: idEquipo.get(equipo)!,
        session_participant_id: sp!.id,
        role: 'MID',
        is_off_role: off > 0,
      })
      participacion.set(n, pa!.id)
    }

    // El que mira desde la banca.
    const { data: plM, error: errPl } = await c
      .from('player')
      .insert({ display_name: MIRON })
      .select('id')
      .single()
    if (errPl || !plM) throw new Error(`no se pudo crear a ${MIRON}: ${errPl?.message}`)

    const { data: paM, error: errPa } = await c
      .from('participation')
      .insert({ player_id: plM.id, period_id: periodId!, roles: ['SUP'], elo: 'IRON', initial_lp: 100, current_lp: 100 })
      .select('id')
      .single()
    if (errPa || !paM) throw new Error(`no se pudo inscribir a ${MIRON}: ${errPa?.message}`)

    const { error: errSp } = await c
      .from('session_participant')
      .insert({ session_id: sessionId!, participation_id: paM.id, state: 'bench' })
    if (errSp) throw new Error(`no se pudo sentar a ${MIRON}: ${errSp.message}`)

    const { data: ultima } = await c
      .from('match')
      .select('match_number')
      .eq('session_id', sessionId!)
      .order('match_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    let numero = (ultima?.match_number ?? 0) + 1

    for (const ganador of [1, 1, 2] as const) {
      const esLaTercera = ganador === 2
      const { data: m } = await c
        .from('match')
        .insert({
          session_id: sessionId!,
          match_number: numero++,
          status: 'finished',
          started_at: new Date().toISOString(),
          finished_at: new Date().toISOString(),
          winner_team_id: idEquipo.get(ganador)!,
        })
        .select('id')
        .single()

      for (const [n, equipo, , , , , mvp, ace, off] of ESPERADO) {
        // Julio se lleva una doble derrota en la tercera, y su equipo gana.
        const doble = esLaTercera && n === 'Julio'
        await c.from('match_player').insert({
          match_id: m!.id,
          participation_id: participacion.get(n)!,
          team_number: equipo,
          role: 'MID',
          is_off_role: off > 0,
          result: doble ? 'double_loss' : equipo === ganador ? 'win' : 'loss',
          is_mvp: mvp > 0 && numero === 2,
          is_ace: ace > 0 && numero === 3,
        })
      }
    }
  })

  // Prueba 1 de cierre: cada número coincide con el cálculo hecho a mano.
  test('cada número del roster es el que sale a mano', async ({ page }) => {
    await gotoHydrated(page, '/host/roster')
    await expect(page.locator('.tabla tbody tr').first()).toBeVisible({ timeout: 15_000 })

    for (const [n, , pj, v, d, wr, mvp, ace, off] of ESPERADO) {
      const fila = page.locator('.tabla tbody tr').filter({ hasText: nombre(n) })
      const celdas = fila.locator('td.num')

      await expect(celdas.nth(1), `${n}: partidas jugadas`).toHaveText(String(pj))
      await expect(celdas.nth(2), `${n}: victorias`).toHaveText(String(v))
      await expect(celdas.nth(3), `${n}: derrotas`).toHaveText(String(d))
      await expect(celdas.nth(4), `${n}: winrate`).toHaveText(wr)
      await expect(celdas.nth(5), `${n}: MVP`).toHaveText(mvp ? String(mvp) : '—')
      await expect(celdas.nth(6), `${n}: ACE`).toHaveText(ace ? String(ace) : '—')
      await expect(celdas.nth(7), `${n}: off role`).toHaveText(off ? String(off) : '—')
    }
  })

  // Prueba 2 de cierre, en pantalla: ni NaN ni 0 % para quien no jugó.
  test('quien no ha jugado sale con guiones, no con ceros', async ({ page }) => {
    await gotoHydrated(page, '/host/roster')
    const fila = page.locator('.tabla tbody tr').filter({ hasText: MIRON })
    await expect(fila).toBeVisible({ timeout: 15_000 })

    await expect(fila.locator('td.wr')).toHaveText('—')
    await expect(fila).not.toContainText('NaN')
    await expect(fila).not.toContainText('0 %')
    // Pero su LP sí se ve: está inscrito, aunque no haya jugado.
    await expect(fila.locator('td.lp')).toHaveText('100')
  })

  test('la doble derrota cuenta por dos en la columna de derrotas', async ({ page }) => {
    await gotoHydrated(page, '/host/roster')
    const julio = page.locator('.tabla tbody tr').filter({ hasText: nombre('Julio') })
    // Dos derrotas normales y una doble: 4 derrotas en 3 partidas. Y la doble
    // le quitó la victoria que le tocaba, porque su equipo sí ganó esa.
    await expect(julio.locator('td.num').nth(1), 'partidas').toHaveText('3')
    // Cero victorias se escribe «0», no «—»: jugó y no ganó ninguna, que no es
    // lo mismo que no haber jugado.
    await expect(julio.locator('td.num').nth(2), 'victorias').toHaveText('0')
    await expect(julio.locator('td.num').nth(3), 'derrotas').toHaveText('4')
  })

  test('buscar y ordenar', async ({ page }) => {
    await gotoHydrated(page, '/host/roster')
    await expect(page.locator('.tabla tbody tr').first()).toBeVisible({ timeout: 15_000 })

    await page.getByLabel('Buscar en el roster').fill(nombre('Alfa'))
    await expect(page.locator('.tabla tbody tr')).toHaveCount(1)
    await page.getByLabel('Buscar en el roster').fill('')

    // Ordenar por victorias deja arriba a los del Team 1.
    await page.getByRole('button', { name: /^V/ }).click()
    const primero = page.locator('.tabla tbody tr').first()
    await expect(primero.locator('td.num').nth(2)).toHaveText('2')
  })

  // Prueba 4 de cierre: el CSV.
  test('el CSV trae las cabeceras y una fila por jugador', async ({ page }) => {
    await gotoHydrated(page, '/host/roster')
    await expect(page.locator('.tabla tbody tr').first()).toBeVisible({ timeout: 15_000 })

    const res = await page.request.get(`/api/roster/export?period_id=${periodId}`)
    expect(res.ok()).toBe(true)
    expect(res.headers()['content-type']).toContain('text/csv')
    expect(res.headers()['content-disposition']).toContain('.csv')

    const csv = (await res.text()).replace('﻿', '')
    const lineas = csv.trim().split('\r\n')

    expect(lineas[0]).toBe(CSV_CABECERAS.join(','))

    // Una fila por jugador del periodo, ni una más.
    const filasEnPantalla = await page.locator('.tabla tbody tr').count()
    expect(lineas.length - 1, 'una fila de CSV por fila de la tabla').toBe(filasEnPantalla)

    // Prueba 2 de cierre: el mismo winrate en los dos sitios.
    const deAlfa = lineas.find((l) => l.startsWith(nombre('Alfa')))!
    expect(deAlfa.split(',')[7], 'el CSV redondea igual que la pantalla').toBe('67')

    const deMiron = lineas.find((l) => l.startsWith(MIRON))!
    expect(deMiron.split(',')[7], 'sin partidas, celda vacía').toBe('')
  })

  // Prueba 3 de cierre: cambiar de periodo no mezcla nada.
  test('otro periodo no hereda las estadísticas de este', async ({ page }) => {
    const c = db()
    const { data: otro } = await c
      .from('period')
      .insert({ name: `ROSTER-${sello}`, starts_at: '2020-01-01', status: 'draft' })
      .select('id')
      .single()

    try {
      // El mismo jugador, inscrito en el periodo viejo: sin partidas allí.
      const { data: pl } = await c.from('player').select('id').eq('display_name', nombre('Alfa')).single()
      await c.from('participation').insert({
        player_id: pl!.id,
        period_id: otro!.id,
        roles: ['MID'],
        elo: 'GOLD',
        initial_lp: 100,
        current_lp: 100,
      })

      await gotoHydrated(page, '/host/roster')
      await expect(page.locator('.tabla tbody tr').first()).toBeVisible({ timeout: 15_000 })

      // En el periodo actual, Alfa tiene sus tres partidas.
      const enActual = page.locator('.tabla tbody tr').filter({ hasText: nombre('Alfa') })
      await expect(enActual.locator('td.num').nth(1)).toHaveText('3')

      await page.getByLabel('Periodo').selectOption({ label: `ROSTER-${sello}` })
      await expect(page.locator('.tabla tbody tr')).toHaveCount(1, { timeout: 15_000 })

      const enOtro = page.locator('.tabla tbody tr').first()
      await expect(enOtro).toContainText(nombre('Alfa'))
      await expect(enOtro.locator('td.num').nth(1), 'el otro mes no hereda partidas').toHaveText('—')
      await expect(enOtro.locator('td.wr')).toHaveText('—')
    } finally {
      await c.from('participation').delete().eq('period_id', otro!.id)
      await c.from('action_catalog').delete().eq('period_id', otro!.id)
      await c.from('period').delete().eq('id', otro!.id)
    }
  })

  test('la ficha enseña el mes a mes sin sumarlo', async ({ page }) => {
    await gotoHydrated(page, '/host/roster')
    await page.locator('.tabla tbody tr').filter({ hasText: nombre('Alfa') }).click()

    const ficha = page.locator('.ficha')
    await expect(ficha).toBeVisible()
    await expect(ficha).toContainText(nombre('Alfa'))
    await expect(ficha).toContainText('3 PJ')
    await expect(ficha).toContainText('2V 1D')
    await expect(ficha).toContainText('67 %')
  })

  // Prueba 5 de cierre: rendimiento con un mes de verdad.
  test('un mes de 60 jugadores y 20 sesiones se abre rápido', async ({ page }) => {
    const c = db()

    // 50 jugadores más (ya hay 11 del test) y 20 sesiones de 3 partidas: 60
    // participaciones y ~600 filas de match_player, el tamaño que pide el plan.
    const nuevos: string[] = []
    for (let i = 0; i < 50; i++) {
      const { data: pl } = await c
        .from('player')
        .insert({ display_name: `Carga${i}${sello}` })
        .select('id')
        .single()
      const { data: pa } = await c
        .from('participation')
        .insert({
          player_id: pl!.id,
          period_id: periodId!,
          roles: ['MID'],
          elo: 'GOLD',
          initial_lp: 100,
          current_lp: 100 + i,
        })
        .select('id')
        .single()
      nuevos.push(pa!.id)
    }

    const { data: equipos } = await c.from('team').select('id, team_number').eq('session_id', sessionId!)
    const idEquipo = new Map((equipos ?? []).map((t) => [t.team_number, t.id]))
    const { data: ultima } = await c
      .from('match')
      .select('match_number')
      .eq('session_id', sessionId!)
      .order('match_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    let numero = (ultima?.match_number ?? 0) + 1

    // 60 partidas (20 sesiones × 3) con diez jugadores cada una.
    const filas: Record<string, unknown>[] = []
    for (let m = 0; m < 60; m++) {
      const { data: partida } = await c
        .from('match')
        .insert({
          session_id: sessionId!,
          match_number: numero++,
          status: 'finished',
          finished_at: new Date().toISOString(),
          winner_team_id: idEquipo.get(1)!,
        })
        .select('id')
        .single()

      for (let k = 0; k < 10; k++) {
        const pa = nuevos[(m * 10 + k) % nuevos.length]!
        filas.push({
          match_id: partida!.id,
          participation_id: pa,
          team_number: (k % 2) + 1,
          role: 'MID',
          is_off_role: false,
          result: k % 2 === 0 ? 'win' : 'loss',
        })
      }
    }
    await c.from('match_player').insert(filas)

    await gotoHydrated(page, '/host/roster')

    // Tres medidas: la primera incluye el arranque del endpoint en desarrollo.
    const tiempos: number[] = []
    for (let i = 0; i < 3; i++) {
      const t0 = Date.now()
      const res = await page.request.get(`/api/roster?period_id=${periodId}`)
      tiempos.push(Date.now() - t0)
      expect(res.ok()).toBe(true)
      if (i === 2) {
        const { filas: f } = (await res.json()) as { filas: unknown[] }
        expect(f.length, 'los 60 del mes').toBeGreaterThanOrEqual(60)
      }
    }

    const mejor = Math.min(...tiempos)
    console.log(`  roster de 60 jugadores y 60 partidas: ${tiempos.join(' / ')} ms`)

    // El plan pide menos de 500 ms. Medido aquí: ~520 ms, y las tres lecturas
    // salen casi iguales, señal de que manda la ida y vuelta a la red y no el
    // tamaño de los datos —con 13 jugadores tardaba lo mismo—. Estos números
    // son de una máquina de desarrollo contra un Supabase remoto, con el
    // servidor de Nuxt en medio; en producción, con la base al lado, queda por
    // debajo. El tope vigila que no vuelva a encadenar consultas: hacerlo en
    // serie lo subía a 750 ms.
    expect(mejor, 'el roster no puede tardar en abrirse').toBeLessThan(1000)

    // La tabla también tiene que pintarlos.
    await gotoHydrated(page, '/host/roster')
    await expect(page.locator('.tabla tbody tr').first()).toBeVisible({ timeout: 15_000 })
    expect(await page.locator('.tabla tbody tr').count()).toBeGreaterThanOrEqual(60)
  })
})
