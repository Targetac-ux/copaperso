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

    // Arranca en 15:00.
    await expect(page.locator('.timer .reloj')).toHaveText('15:00')

    // Se cambia a 5 minutos escribiéndolo.
    await page.locator('.timer .reloj').click()
    await page.locator('.timer .dur').fill('5')
    await page.locator('.timer .dur').press('Enter')
    await expect(page.locator('.timer .reloj')).toHaveText('05:00')

    // Y arranca la cuenta atrás.
    await page.locator('.timer').getByRole('button', { name: 'Iniciar' }).click()
    await expect(page.locator('.timer').getByRole('button', { name: 'Pausar' })).toBeVisible()
    await expect
      .poll(async () => (await c.from('session').select('timer_running').eq('id', sessionId!).single()).data?.timer_running)
      .toBe(true)
  })

  test('triplicar sube los precios de esta sesión y solo de esta', async ({ page }) => {
    await gotoHydrated(page, '/host')
    const c = db()

    // Antes: Blue Shell a 500.
    await expect(page.getByText('Blue Shell')).toBeVisible()
    await expect(page.locator('.eco .precios li').filter({ hasText: 'Blue Shell' })).toContainText('500')

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

    await expect(page.locator('.eco .precios li').filter({ hasText: 'Blue Shell' })).toContainText('1500')
    await expect(page.locator('.eco .precios li').filter({ hasText: 'Cupo' })).toContainText('600')

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
    await page.getByRole('button', { name: /^Recompensas/ }).click()
    await page.locator('.eco select').first().selectOption('BLUE_SHELL')
    await page.locator('.eco').getByRole('button', { name: 'Registrar', exact: true }).click()

    await expect(page.locator('.eco .lista li').first()).toContainText('BLUE_SHELL')

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
    await page.getByRole('button', { name: /^Recompensas/ }).click()
    await page.locator('.eco').getByRole('button', { name: 'Deshacer el ×3' }).click()

    await expect(page.locator('.eco .precios li').filter({ hasText: 'Blue Shell' })).toContainText('500')

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
