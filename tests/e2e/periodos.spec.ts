import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { gotoHydrated } from './helpers'

/**
 * Prueba de cierre 4 de la Fase 2: el mes nuevo empieza vacío y quien vuelve
 * lo hace con 100 LP, sin tocar lo que pasó el mes anterior (§5).
 *
 * El test abre un periodo de verdad —lo que cierra el que estuviera activo— y
 * lo deshace al terminar, dejando activo el que había. Si se interrumpe a
 * medias, revisa /host/periodos.
 */
const email = process.env.E2E_HOST_EMAIL
const password = process.env.E2E_HOST_PASSWORD
const url = process.env.SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY

const sello = Date.now()
const JUGADOR = `Veterano${sello}`
const PERIODO = `TEST-${sello}`

test.describe.serial('cambio de mes', () => {
  test.skip(!email || !password || !secret, 'Necesita credenciales de host y llave secreta')

  const db = () => createClient(url!, secret!, { auth: { persistSession: false } })

  let periodoAnterior: { id: string; name: string } | null = null
  let lpDelMesAnterior = 0

  test.afterAll(async () => {
    const c = db()
    // Borrar lo del test y devolver el periodo que estaba activo.
    const { data: players } = await c.from('player').select('id').ilike('display_name', `%${sello}%`)
    for (const p of players ?? []) {
      await c.from('lp_event').delete().eq('participation_id', p.id)
      await c.from('participation').delete().eq('player_id', p.id)
      await c.from('player').delete().eq('id', p.id)
    }
    const { data: nuevo } = await c.from('period').select('id').eq('name', PERIODO).maybeSingle()
    if (nuevo) {
      await c.from('participation').delete().eq('period_id', nuevo.id)
      await c.from('action_catalog').delete().eq('period_id', nuevo.id)
      await c.from('period').delete().eq('id', nuevo.id)
    }
    if (periodoAnterior) {
      await c.from('period').update({ status: 'active' }).eq('id', periodoAnterior.id)
    }
  })

  test('el mes nuevo arranca vacío y el anterior queda intacto', async ({ page }) => {
    const c = db()

    // 1. Entrar y registrar a alguien en el periodo actual.
    await gotoHydrated(page, '/host/login')
    await page.getByLabel('Correo').fill(email!)
    await page.getByLabel('Contraseña').fill(password!)
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    await expect(page).toHaveURL(/\/host$/)

    const { data: activo } = await c
      .from('period')
      .select('id, name')
      .eq('status', 'active')
      .maybeSingle()
    expect(activo, 'hace falta un periodo activo para esta prueba').not.toBeNull()
    periodoAnterior = activo!

    await gotoHydrated(page, '/host/jugadores')
    await page.getByLabel('Registrar participante').fill(`${JUGADOR} Top Master`)
    await page.getByRole('button', { name: 'Registrar' }).click()
    await expect(page.getByText(`${JUGADOR} registrado`)).toBeVisible()

    // 2. Le damos algo de historia: simulamos que ganó una partida.
    const { data: player } = await c
      .from('player')
      .select('id')
      .eq('display_name', JUGADOR)
      .single()
    const { data: participacionVieja } = await c
      .from('participation')
      .select('id')
      .eq('player_id', player!.id)
      .eq('period_id', activo!.id)
      .single()

    await c.from('lp_event').insert({
      participation_id: participacionVieja!.id,
      type: 'WIN',
      delta: 15,
    })
    const { data: recalculado } = await c.rpc('recalc_participation_lp', {
      p_participation_id: participacionVieja!.id,
    })
    lpDelMesAnterior = recalculado as unknown as number
    expect(lpDelMesAnterior).toBe(115)

    // 3. Abrir el mes siguiente desde el panel.
    await gotoHydrated(page, '/host/periodos')
    page.on('dialog', (d) => d.accept())
    const siguiente = new Date()
    siguiente.setMonth(siguiente.getMonth() + 1)
    const mes = `${siguiente.getFullYear()}-${String(siguiente.getMonth() + 1).padStart(2, '0')}`
    await page.getByLabel('Mes a abrir').fill(mes)
    await page.getByRole('button', { name: 'Abrir mes nuevo' }).click()
    await expect(page.locator('.alert--error')).toHaveCount(0)
    await expect.poll(async () => {
      const { data } = await c.from('period').select('id').eq('status', 'active').single()
      return data?.id
    }, { timeout: 10_000 }).not.toBe(activo!.id)

    // El endpoint lo nombra por el mes en curso; lo renombramos para poder limpiarlo.
    const { data: nuevo } = await c
      .from('period')
      .select('id, name')
      .eq('status', 'active')
      .single()
    expect(nuevo!.id).not.toBe(activo!.id)
    await c.from('period').update({ name: PERIODO }).eq('id', nuevo!.id)

    // 4. El mes nuevo está vacío.
    const { count } = await c
      .from('participation')
      .select('id', { count: 'exact', head: true })
      .eq('period_id', nuevo!.id)
    expect(count, 'un mes nuevo no arrastra a nadie').toBe(0)

    // 5. El mes anterior quedó cerrado y con su historia intacta.
    const { data: viejo } = await c
      .from('period')
      .select('status')
      .eq('id', activo!.id)
      .single()
    expect(viejo!.status).toBe('closed')

    const { data: sigueIgual } = await c
      .from('participation')
      .select('current_lp')
      .eq('id', participacionVieja!.id)
      .single()
    expect(sigueIgual!.current_lp).toBe(115)

    // 6. Reincorporar al mismo jugador: perfil reutilizado, LP a 100.
    await gotoHydrated(page, '/host/jugadores')
    await page.getByLabel('Registrar participante').fill(`${JUGADOR} Top Master`)
    await page.getByRole('button', { name: 'Registrar' }).click()
    await expect(page.getByText(`${JUGADOR} registrado`)).toBeVisible()

    const { data: perfiles } = await c.from('player').select('id').eq('display_name', JUGADOR)
    expect(perfiles, 'no se crea un perfil nuevo al volver').toHaveLength(1)

    const { data: nuevaParticipacion } = await c
      .from('participation')
      .select('current_lp, initial_lp')
      .eq('player_id', player!.id)
      .eq('period_id', nuevo!.id)
      .single()
    expect(nuevaParticipacion!.current_lp).toBe(100)
    expect(nuevaParticipacion!.initial_lp).toBe(100)

    // Y el catálogo de recompensas del mes nuevo se sembró solo.
    const { count: acciones } = await c
      .from('action_catalog')
      .select('id', { count: 'exact', head: true })
      .eq('period_id', nuevo!.id)
    expect(acciones).toBe(6)
  })
})
