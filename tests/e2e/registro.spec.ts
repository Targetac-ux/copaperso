import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { gotoHydrated } from './helpers'

/**
 * Pruebas de cierre 3, 4 y 5 de la Fase 2: el registro en directo, el
 * anti-duplicados y el reinicio mensual.
 */
const email = process.env.E2E_HOST_EMAIL
const password = process.env.E2E_HOST_PASSWORD
const url = process.env.SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY

const sello = Date.now()
const NOMBRE = `Targetest${sello}`

// En serie: el segundo y el tercero trabajan sobre el jugador que crea el primero.
test.describe.serial('registro de participantes', () => {
  test.skip(!email || !password || !secret, 'Necesita credenciales de host y llave secreta')

  const db = () => createClient(url!, secret!, { auth: { persistSession: false } })

  test.beforeEach(async ({ page }) => {
    await gotoHydrated(page, '/host/login')
    await page.getByLabel('Correo').fill(email!)
    await page.getByLabel('Contraseña').fill(password!)
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    await expect(page).toHaveURL(/\/host$/)
  })

  test.afterAll(async () => {
    const c = db()
    const { data } = await c.from('player').select('id').ilike('display_name', `%${sello}%`)
    for (const p of data ?? []) {
      await c.from('participation').delete().eq('player_id', p.id)
      await c.from('player').delete().eq('id', p.id)
    }
  })

  test('registrar a alguien nuevo y luego elegirlo del autocomplete no lo duplica', async ({
    page,
  }) => {
    await gotoHydrated(page, '/host/jugadores')

    // 1. Alta desde cero, con la línea completa.
    const campo = page.getByLabel('Registrar participante')
    await campo.fill(`${NOMBRE} Mid/Jg Challenger`)
    await expect(page.getByText('MID · JG')).toBeVisible()
    await page.getByRole('button', { name: 'Registrar' }).click()
    await expect(page.getByText(`${NOMBRE} registrado`)).toBeVisible()

    // Aparece en la lista con sus roles y sus 100 LP.
    const fila = page.getByRole('row', { name: new RegExp(NOMBRE) })
    await expect(fila).toContainText('MID')
    await expect(fila).toContainText('100')

    // 2. Ahora tecleando solo el principio: debe proponerlo, no crear otro.
    await campo.fill(NOMBRE.slice(0, 6))
    await expect(page.getByRole('button', { name: new RegExp(NOMBRE) })).toBeVisible()
    await page.getByRole('button', { name: new RegExp(NOMBRE) }).click()
    await page.getByRole('button', { name: 'Registrar' }).click()
    await expect(page.getByText('ya estaba registrado este mes')).toBeVisible()

    // 3. En la base hay exactamente un perfil y una participación.
    const c = db()
    const { data: players } = await c.from('player').select('id').eq('display_name', NOMBRE)
    expect(players).toHaveLength(1)

    const { data: parts } = await c
      .from('participation')
      .select('id, current_lp, initial_lp, roles, elo')
      .eq('player_id', players![0]!.id)
    expect(parts).toHaveLength(1)
    expect(parts![0]!.current_lp).toBe(100)
    expect(parts![0]!.initial_lp).toBe(100)
    expect(parts![0]!.roles).toEqual(['MID', 'JG'])
    expect(parts![0]!.elo).toBe('CHALLENGER')
  })

  test('una errata propone el perfil que ya existe', async ({ page }) => {
    await gotoHydrated(page, '/host/jugadores')
    const campo = page.getByLabel('Registrar participante')

    // "Targetest…" mal escrito: falta una letra.
    await campo.fill(NOMBRE.replace('rg', 'g'))
    await expect(page.getByText('¿será esta persona?')).toBeVisible()
    await expect(page.getByRole('button', { name: new RegExp(NOMBRE) })).toBeVisible()
  })

  test('quitar del periodo no borra el perfil permanente', async ({ page }) => {
    await gotoHydrated(page, '/host/jugadores')

    page.on('dialog', (d) => d.accept())
    const fila = page.getByRole('row', { name: new RegExp(NOMBRE) })
    await fila.getByRole('button', { name: 'Quitar' }).click()
    await expect(fila).toHaveCount(0)

    const c = db()
    const { data: players } = await c.from('player').select('id').eq('display_name', NOMBRE)
    expect(players, 'el perfil permanente debe seguir existiendo').toHaveLength(1)

    const { data: parts } = await c
      .from('participation')
      .select('id')
      .eq('player_id', players![0]!.id)
    expect(parts, 'la participación sí se borra').toHaveLength(0)
  })
})
