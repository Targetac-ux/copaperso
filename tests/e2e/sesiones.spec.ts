import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { ESPERA_REGISTRO, gotoHydrated, registrarLinea } from './helpers'

/**
 * Abrir, cerrar y cambiar de sesión, y las reglas del modo ARAM AFK.
 *
 * Las dos cosas van en el mismo fichero porque comparten el montaje: hace falta
 * una sesión ARAM AFK recién abierta para comprobar que ahí los roles no
 * cuentan, y abrirla ya obliga a cerrar la que hubiera.
 *
 * **La sesión abierta del host se aparta y se devuelve.** Este spec trabaja
 * sobre una suya; al terminar, la que estuviera abierta vuelve a estarlo.
 */
const email = process.env.E2E_HOST_EMAIL
const password = process.env.E2E_HOST_PASSWORD
const url = process.env.SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY

const sello = Date.now()
const db = () => createClient(url!, secret!, { auth: { persistSession: false } })
const DEMONS = [`AramA${sello}`, `AramB${sello}`]

test.describe.serial('sesiones y ARAM AFK', () => {
  test.skip(!email || !password || !secret, 'Necesita credenciales de host y llave secreta')
  test.setTimeout(90_000)

  /** La que tuviera abierta el host, para devolvérsela al final. */
  let previa: string | null = null
  let nuestra: string | null = null

  test.beforeEach(async ({ page }) => {
    await gotoHydrated(page, '/host/login')
    await page.getByLabel('Correo').fill(email!)
    await page.getByLabel('Contraseña').fill(password!)
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    await expect(page).toHaveURL(/\/host$/)
  })

  test.afterAll(async () => {
    const c = db()
    if (nuestra) {
      await c.from('match').delete().eq('session_id', nuestra)
      await c.from('session').delete().eq('id', nuestra)
    }
    const { data: jugadores } = await c.from('player').select('id').in('display_name', DEMONS)
    if (jugadores?.length) {
      await c.from('player').delete().in('id', jugadores.map((j) => j.id))
    }
    if (previa) await c.from('session').update({ status: 'open', closed_at: null }).eq('id', previa)
    await c
      .from('action_log')
      .delete()
      .in('action_type', ['session.close', 'session.reopen', 'session.create'])
      .is('session_id', null)
  })

  test('preparar: apartar la sesión que tuviera abierta el host', async () => {
    const c = db()
    const { data } = await c.from('session').select('id').neq('status', 'closed').maybeSingle()
    previa = data?.id ?? null
    if (previa) {
      await c.from('session').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', previa)
    }
  })

  test('el CCTM abre la sesión en el modo que se elige', async ({ page }) => {
    await gotoHydrated(page, '/host')

    await page.getByLabel('Modo').selectOption('aram_afk')
    // El panel avisa de que ahí las reglas de rol no se aplican, antes de abrir.
    await expect(page.locator('.vacio__nota')).toContainText('off-role')

    await page.getByRole('button', { name: 'Abrir sesión' }).click()
    await expect(page.getByText(/Sesión #\d+/)).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('.barra')).toContainText('Copa ARAM AFK')

    const { data } = await db().from('session').select('id, mode').neq('status', 'closed').single()
    nuestra = data!.id
    expect(data!.mode).toBe('aram_afk')
  })

  test('con una abierta, no se puede abrir otra', async ({ page }) => {
    const res = await page.request.post('/api/sessions', { data: { mode: 'perso' } })
    expect(res.status()).toBe(409)
    expect(await res.text()).toContain('Ciérrala')
  })

  // La regla del modo: sin líneas ni posiciones, los Demon no se reparten.
  test('en ARAM AFK, dos Demon en el mismo equipo no avisan', async ({ page }) => {
    await gotoHydrated(page, '/host')
    await page.getByLabel('Registrar participante').waitFor()

    for (const nombre of DEMONS) {
      await registrarLinea(page, `${nombre} JG Demon`)
      await expect(page.locator('.banca li').filter({ hasText: nombre })).toBeVisible(ESPERA_REGISTRO)
    }

    const acc = page.locator('.acc')
    for (const [i, nombre] of DEMONS.entries()) {
      // Ojo: volver a pulsar al ya seleccionado lo deselecciona, así que se
      // elige una sola vez por jugador.
      await page.locator('.banca li').filter({ hasText: nombre }).click()

      if (i === 0) {
        // Aquí no se elige rol: el panel ni siquiera lo ofrece.
        await expect(acc.locator('.sin-roles')).toBeVisible()
        await expect(acc.getByRole('button', { name: 'JG', exact: true })).toHaveCount(0)
      }

      await acc.getByRole('button', { name: 'Team 1' }).click()
      await acc.getByRole('button', { name: 'Asignar', exact: true }).click()
      await expect(page.locator('.team.is-t1')).toContainText(nombre, ESPERA_REGISTRO)
    }

    // Ni aviso de desequilibrio, ni de rol repetido: los dos son JG.
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    // Y el recuento de Demon no se pinta, porque la regla no aplica aquí.
    await expect(page.locator('.team.is-t1 .demons')).toHaveCount(0)

    // Los dos se ven: con la rejilla de cinco roles, el segundo JG desaparecía.
    await expect(page.locator('.team.is-t1 li.is-filled')).toHaveCount(2)
  })

  test('en ARAM AFK nadie queda marcado como off-role', async ({ page }) => {
    await gotoHydrated(page, '/host')

    // Se registraron como JG. En cualquier otro modo, el panel ofrecería
    // ponerlos de SUP y avisaría de off-role; aquí ni se plantea.
    const acc = page.locator('.acc')
    await page.locator('.team.is-t1 li').filter({ hasText: DEMONS[1]! }).click()
    await acc.getByRole('button', { name: 'Team 2' }).click()
    await acc.getByRole('button', { name: 'Mover aquí' }).click()
    await expect(page.locator('.team.is-t2')).toContainText(DEMONS[1]!, ESPERA_REGISTRO)

    await expect(page.locator('.team.is-t2 .off')).toHaveCount(0)

    // Y en la base tampoco: de ahí salen los +2 LP al cerrar la partida.
    const { data } = await db()
      .from('team_member')
      .select('is_off_role, team!inner(session_id)')
      .eq('team.session_id', nuestra!)

    expect(data!.every((m) => !m.is_off_role), 'nadie va off-role en ARAM AFK').toBe(true)
  })

  test('con una partida en juego, la sesión no se cierra', async ({ page }) => {
    const c = db()
    const { data: partida } = await c
      .from('match')
      .insert({ session_id: nuestra!, match_number: 99, status: 'live' })
      .select('id')
      .single()

    const res = await page.request.post(`/api/sessions/${nuestra}/close`, { data: {} })
    expect(res.status()).toBe(409)
    expect(await res.text()).toContain('sigue en juego')

    await c.from('match').delete().eq('id', partida!.id)
  })

  test('cerrar la sesión deja el panel listo para la siguiente', async ({ page }) => {
    await gotoHydrated(page, '/host')
    page.on('dialog', (d) => d.accept())

    // «Cerrar la copa», que es distinto de «Cerrar sesión» (salir del panel).
    await page.getByRole('button', { name: 'Cerrar la copa' }).click()
    await expect(page.getByRole('button', { name: 'Abrir sesión' })).toBeVisible({ timeout: 15_000 })

    const { data } = await db().from('session').select('status, closed_at').eq('id', nuestra!).single()
    expect(data!.status).toBe('closed')
    expect(data!.closed_at, 'queda la hora de cierre').not.toBeNull()
  })

  test('reabrir desde Periodos la devuelve al panel', async ({ page }) => {
    await gotoHydrated(page, '/host/periodos')

    // La lista va de la más nueva a la más vieja, así que la nuestra es la primera.
    const fila = page.locator('.sesiones li').first()
    await expect(fila).toContainText('Cerrada', { timeout: 15_000 })
    await fila.getByRole('button', { name: 'Reabrir' }).click()

    await expect
      .poll(
        async () => (await db().from('session').select('status').eq('id', nuestra!).single()).data?.status,
        { timeout: 15_000 },
      )
      .toBe('open')

    await gotoHydrated(page, '/host')
    await expect(page.getByText(/Sesión #\d+/)).toBeVisible()
  })
})
