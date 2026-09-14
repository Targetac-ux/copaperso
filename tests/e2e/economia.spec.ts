import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { gotoHydrated } from './helpers'

/**
 * Pruebas de cierre de la Fase 3B: timer, precios ×3, banco y préstamos.
 *
 * Lo que más importa aquí es lo que **no** pasa: registrar una recompensa no
 * mueve a nadie ni descuenta saldos, y triplicar en una sesión no contagia al
 * resto del mes.
 */
const email = process.env.E2E_HOST_EMAIL
const password = process.env.E2E_HOST_PASSWORD
const url = process.env.SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY

const sello = Date.now()
const db = () => createClient(url!, secret!, { auth: { persistSession: false } })

test.describe.serial('economía y timer', () => {
  test.skip(!email || !password || !secret, 'Necesita credenciales de host y llave secreta')

  let sessionId: string | null = null
  let sessionEraNuestra = false
  let cuentaId: string | null = null

  test.beforeEach(async ({ page }) => {
    // Que ningún test herede el cronómetro vencido del anterior: el aviso
    // taparía los clics del siguiente.
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
    if (sessionId) {
      await c.from('reward_claim').delete().eq('session_id', sessionId)
      await c.from('action_log').delete().eq('session_id', sessionId)
      await c.from('session').update({ prices_tripled: false, tripled_at: null, timer_running: false, timer_ends_at: null }).eq('id', sessionId)
      if (sessionEraNuestra) {
        await c.from('session_participant').delete().eq('session_id', sessionId)
        await c.from('team').delete().eq('session_id', sessionId)
        await c.from('session').delete().eq('id', sessionId)
      }
    }
    if (cuentaId) {
      await c.from('ledger_entry').delete().eq('account_id', cuentaId)
      await c.from('ledger_account').delete().eq('id', cuentaId)
    }
    await c.from('loan').delete().ilike('person_name', `%${sello}%`)
  })

  test('el cronómetro acepta la duración que escriba el host', async ({ page }) => {
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

    // Dejar el cronómetro en un punto conocido: el test no puede asumir en qué
    // estado lo dejó la sesión (o la corrida anterior).
    await c
      .from('session')
      .update({ timer_seconds: 900, timer_ends_at: null, timer_running: false })
      .eq('id', sessionId)
    await page.reload()
    await page.waitForSelector('html[data-hydrated]')
    await expect(page.locator('.timer .reloj')).toHaveText('15:00')

    // Se cambia a 5 minutos escribiéndolo.
    await page.locator('.timer .reloj').click()
    await page.locator('.timer .dur').fill('5')
    await page.locator('.timer .dur').press('Enter')
    await expect(page.locator('.timer .reloj')).toHaveText('05:00')

    // Y arranca la cuenta atrás.
    await page.locator('.timer').getByRole('button', { name: 'Iniciar', exact: true }).click()
    await expect(page.locator('.timer').getByRole('button', { name: 'Pausar' })).toBeVisible()
    await expect
      .poll(async () => (await c.from('session').select('timer_running').eq('id', sessionId!).single()).data?.timer_running)
      .toBe(true)
  })

  test('pausar detiene la cuenta de verdad', async ({ page }) => {
    const c = db()
    await c
      .from('session')
      .update({ timer_seconds: 600, timer_ends_at: null, timer_running: false, timer_remaining_seconds: null })
      .eq('id', sessionId!)

    await gotoHydrated(page, '/host')
    const reloj = page.locator('.timer .reloj')

    await page.locator('.timer').getByRole('button', { name: 'Iniciar', exact: true }).click()
    await expect(page.locator('.timer').getByRole('button', { name: 'Pausar' })).toBeVisible()

    // Dejar correr y pausar.
    await page.waitForTimeout(2200)
    await page.locator('.timer').getByRole('button', { name: 'Pausar' }).click()
    await expect(page.locator('.timer').getByRole('button', { name: 'Iniciar', exact: true })).toBeVisible()

    const congelado = await reloj.innerText()

    // Este es el fallo que había: el número seguía bajando aunque estuviera pausado.
    await page.waitForTimeout(3200)
    expect(await reloj.innerText(), 'pausado no puede seguir bajando').toBe(congelado)

    // Y al reanudar sigue desde donde se quedó, no desde el principio.
    await page.locator('.timer').getByRole('button', { name: 'Iniciar', exact: true }).click()
    const [min, seg] = congelado.split(':').map(Number)
    const congeladoSeg = min! * 60 + seg!

    // El reloj solo cambia al cruzar un borde de segundo, así que se espera al
    // primer descenso en vez de leer en un instante fijo: con una espera seca
    // de 1,2 s la lectura caía justo en el borde y el test fallaba sin motivo.
    await expect
      .poll(
        async () => {
          const [m, s] = (await reloj.innerText()).split(':').map(Number)
          return m! * 60 + s!
        },
        { timeout: 5000, message: 'al reanudar tiene que volver a bajar' },
      )
      .toBeLessThan(congeladoSeg)

    // Y sigue desde donde se quedó: no ha vuelto a la duración configurada.
    const trasReanudar = (await reloj.innerText()).split(':').map(Number)
    expect(trasReanudar[0]! * 60 + trasReanudar[1]!).toBeGreaterThan(congeladoSeg - 10)

    await page.locator('.timer').getByRole('button', { name: 'Pausar' }).click()
  })

  test('acepta tiempos cortos para probar', async ({ page }) => {
    await gotoHydrated(page, '/host')
    await page.locator('.timer .reloj').click()
    await page.locator('.timer .dur').fill('10s')
    await page.locator('.timer .dur').press('Enter')
    // Antes el mínimo era 30 s y "10s" se convertía en 00:30.
    await expect(page.locator('.timer .reloj')).toHaveText('00:10')
  })

  test('triplicar sube los precios de esta sesión y solo de esta', async ({ page }) => {
    await gotoHydrated(page, '/host')
    const c = db()

    // Antes: Blue Shell a 500. ("Blue Shell" aparece también en el desplegable,
    // así que se busca dentro de la lista de precios del panel de canjeos.)
    const blueShell = page.locator('.canj .precios li').filter({ hasText: 'Blue Shell' })
    await expect(blueShell).toBeVisible()
    await expect(blueShell).toContainText('500')

    // Triplicar por API, que es lo que hace el botón del aviso.
    await page.evaluate(
      (id) => fetch(`/api/sessions/${id}/triple`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tripled: true }),
      }),
      sessionId!,
    )
    await page.reload()
    await page.waitForSelector('html[data-hydrated]')

    await expect(page.locator('.canj .precios li').filter({ hasText: 'Blue Shell' })).toContainText('1500')
    await expect(page.locator('.canj .precios li').filter({ hasText: 'Cupo' })).toContainText('600')

    // El catálogo del periodo sigue intacto: el mes que viene no hereda el ×3.
    const { data: catalogo } = await c
      .from('action_catalog')
      .select('code, cost_bits')
      .eq('code', 'BLUE_SHELL')
      .limit(1)
      .single()
    expect(catalogo!.cost_bits, 'el catálogo del mes no se toca').toBe(500)
  })

  test('registrar una recompensa no mueve a nadie ni descuenta saldo', async ({ page }) => {
    const c = db()

    // Una cuenta con saldo, para comprobar que no se toca.
    const { data: cuenta } = await c
      .from('ledger_account')
      .insert({ display_name: `Donador${sello}`, kind: 'supporter', balance_bits: 1000 })
      .select('id')
      .single()
    cuentaId = cuenta!.id

    const { data: equiposAntes } = await c.from('team_member').select('id, team_id, role')

    await gotoHydrated(page, '/host')
    await page.locator('.canj select').selectOption('BLUE_SHELL')
    await page.locator('.canj').getByRole('button', { name: 'Registrar canjeo' }).click()

    await expect(page.locator('.canj .hechos li').first()).toContainText('BLUE_SHELL')

    // Nada se movió y ningún saldo cambió.
    const { data: equiposDespues } = await c.from('team_member').select('id, team_id, role')
    expect(equiposDespues).toEqual(equiposAntes)

    const { data: saldo } = await c
      .from('ledger_account')
      .select('balance_bits')
      .eq('id', cuentaId!)
      .single()
    expect(saldo!.balance_bits, 'el banco no se toca solo').toBe(1000)

    // Y la bitácora guardó el precio triplicado que se cobró de verdad.
    const { data: claim } = await c
      .from('reward_claim')
      .select('cost_bits, tripled')
      .eq('session_id', sessionId!)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    expect(claim!.cost_bits).toBe(1500)
    expect(claim!.tripled).toBe(true)
  })

  test('deshacer el ×3 devuelve los precios sin tocar lo ya registrado', async ({ page }) => {
    await gotoHydrated(page, '/host')
    await page.locator('.canj').getByRole('button', { name: 'Deshacer el ×3' }).click()

    await expect(page.locator('.canj .precios li').filter({ hasText: 'Blue Shell' })).toContainText('500')

    // Lo cobrado en ×3 sigue diciendo 1500: no se reescribe la historia.
    const c = db()
    const { data: claim } = await c
      .from('reward_claim')
      .select('cost_bits')
      .eq('session_id', sessionId!)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    expect(claim!.cost_bits).toBe(1500)
  })

  test('al agotarse el tiempo salta el aviso, y no bloquea el panel', async ({ page }) => {
    const c = db()
    await c
      .from('session')
      .update({ prices_tripled: false, tripled_at: null })
      .eq('id', sessionId!)

    await gotoHydrated(page, '/host')

    // Un cronómetro de 30 s que ya venció: al cargar, el aviso salta solo.
    await c
      .from('session')
      .update({
        timer_seconds: 30,
        timer_ends_at: new Date(Date.now() - 1000).toISOString(),
        timer_running: true,
      })
      .eq('id', sessionId!)
    await page.reload()
    await page.waitForSelector('html[data-hydrated]')

    const aviso = page.getByRole('alertdialog')
    await expect(aviso).toBeVisible()
    await expect(aviso).toContainText('Se acabó la negociación')
    // Enseña el antes y el después.
    await expect(aviso).toContainText('500 → 1500')

    // No bloquea: con el aviso abierto se sigue pudiendo trabajar.
    await expect(page.locator('.banca')).toBeVisible()

    // "Solo cerrar" no toca ni un precio.
    await aviso.getByRole('button', { name: 'Solo cerrar' }).click()
    await expect(aviso).toHaveCount(0)
    const { data: sinTriplicar } = await c
      .from('session')
      .select('prices_tripled')
      .eq('id', sessionId!)
      .single()
    expect(sinTriplicar!.prices_tripled).toBe(false)

    // Y ahora sí, triplicar desde el aviso.
    await c
      .from('session')
      .update({ timer_ends_at: new Date(Date.now() - 1000).toISOString(), timer_running: true })
      .eq('id', sessionId!)
    await page.reload()
    await page.waitForSelector('html[data-hydrated]')
    await page.getByRole('alertdialog').getByRole('button', { name: 'Triplicar precios' }).click()

    await expect(page.locator('.canj .precios li').filter({ hasText: 'Blue Shell' })).toContainText('1500')
    await expect(page.locator('.timer')).toContainText('×3')
  })

  test('si ya están triplicados, el aviso no vuelve a ofrecerlo', async ({ page }) => {
    const c = db()
    await c.from('session').update({ prices_tripled: true }).eq('id', sessionId!)
    await c
      .from('session')
      .update({ timer_ends_at: new Date(Date.now() - 1000).toISOString(), timer_running: true })
      .eq('id', sessionId!)

    await gotoHydrated(page, '/host')
    const aviso = page.getByRole('alertdialog')
    await expect(aviso).toBeVisible()
    await expect(aviso).toContainText('ya están en ×3')
    await expect(aviso.getByRole('button', { name: 'Triplicar precios' })).toHaveCount(0)
  })

  test('notas, extras y restricciones quedan apuntadas', async ({ page }) => {
    await gotoHydrated(page, '/host')
    await page.getByRole('button', { name: /^Notas/ }).click()

    const nota = `Nota de prueba ${sello}`
    await page.getByPlaceholder('Escribir una nota…').fill(nota)
    await page.getByPlaceholder('Escribir una nota…').press('Enter')
    await expect(page.locator('.eco .lista').first()).toContainText(nota)

    const extra = `Premio extra ${sello}`
    await page.getByPlaceholder('Premio, penalización, condición…').fill(extra)
    await page.getByPlaceholder('Premio, penalización, condición…').press('Enter')
    await expect(page.locator('.eco')).toContainText(extra)

    // Y sobreviven a recargar: están en la base, no solo en pantalla.
    await page.reload()
    await page.waitForSelector('html[data-hydrated]')
    await page.getByRole('button', { name: /^Notas/ }).click()
    await expect(page.locator('.eco')).toContainText(nota)

    const c = db()
    await c.from('note').delete().ilike('body', `%${sello}%`)
    await c.from('extra').delete().ilike('body', `%${sello}%`)
  })

  test('un préstamo calcula el 10 % diario', async ({ page }) => {
    const c = db()
    // Prestado hace 12 días: 400 → 880.
    const hace12 = new Date()
    hace12.setDate(hace12.getDate() - 12)
    const fecha = `${hace12.getFullYear()}-${String(hace12.getMonth() + 1).padStart(2, '0')}-${String(hace12.getDate()).padStart(2, '0')}`

    await c.from('loan').insert({
      person_name: `Deudor${sello}`,
      principal_bits: 400,
      lent_at: fecha,
    })

    await gotoHydrated(page, '/host')
    await page.getByRole('button', { name: /^Préstamos/ }).click()
    await expect(page.locator('.eco .lista li').filter({ hasText: `Deudor${sello}` })).toContainText('880')
  })
})
