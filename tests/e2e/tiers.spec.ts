import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { gotoHydrated } from './helpers'

/**
 * Pruebas de cierre de la Fase 6: el Tier Ranking Manager.
 *
 * Lo que se comprueba es la garantía que sostiene el histórico: **publicar una
 * edición nueva no modifica las anteriores**. Si eso se rompiera, el ranking de
 * cada mes dejaría de ser una foto y pasaría a ser una sola tabla reescrita.
 */
const email = process.env.E2E_HOST_EMAIL
const password = process.env.E2E_HOST_PASSWORD
const url = process.env.SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY

const sello = Date.now()
const db = () => createClient(url!, secret!, { auth: { persistSession: false } })

const GENTE = ['Ada', 'Bruno', 'Cleo', 'Dante'] as const
const nombre = (n: string) => `${n}${sello}`

test.describe.serial('tier ranking', () => {
  test.skip(!email || !password || !secret, 'Necesita credenciales de host y llave secreta')
  test.setTimeout(90_000)

  let listaVieja: string | null = null
  let listaNueva: string | null = null
  const players: string[] = []
  /** La edición que estuviera publicada antes del test, para devolverla. */
  let vigentePrevia: string | null = null

  test.beforeEach(async ({ page }) => {
    await gotoHydrated(page, '/host/login')
    await page.getByLabel('Correo').fill(email!)
    await page.getByLabel('Contraseña').fill(password!)
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    await expect(page).toHaveURL(/\/host$/)
  })

  test.afterAll(async () => {
    const c = db()
    for (const id of [listaNueva, listaVieja]) {
      if (id) await c.from('tier_list').delete().eq('id', id)
    }
    if (players.length) await c.from('player').delete().in('id', players)
    if (vigentePrevia) {
      await c.from('tier_list').update({ is_current: true }).eq('id', vigentePrevia)
    }
    await c.from('action_log').delete().eq('action_type', 'tier.publish').is('session_id', null)
  })

  test('preparar: cuatro jugadores y una edición ya publicada', async () => {
    const c = db()

    const { data: previa } = await c.from('tier_list').select('id').eq('is_current', true).maybeSingle()
    vigentePrevia = previa?.id ?? null
    if (previa) await c.from('tier_list').update({ is_current: false }).eq('id', previa.id)

    for (const n of GENTE) {
      const { data: pl } = await c.from('player').insert({ display_name: nombre(n) }).select('id').single()
      players.push(pl!.id)
    }

    // Una edición vieja, publicada: todos en A.
    const { data: vieja } = await c
      .from('tier_list')
      .insert({ title: `Vieja ${sello}`, published_at: new Date('2026-08-01').toISOString(), is_current: true })
      .select('id')
      .single()
    listaVieja = vieja!.id

    await c.from('tier_entry').insert(
      players.map((pid, i) => ({
        tier_list_id: listaVieja!,
        player_id: pid,
        tier: 'A' as const,
        main_role: 'MID' as const,
        rank_order: i,
      })),
    )
  })

  test('la Home enseña la edición publicada', async ({ page }) => {
    await gotoHydrated(page, '/tier-ranking')
    await expect(page.locator('.tier__cab h1')).toContainText(`Vieja ${sello}`)
    await expect(page.locator('.fila.is-a')).toContainText(nombre('Ada'))
  })

  test('empezar una edición nueva copia la vigente sin tocarla', async ({ page }) => {
    await gotoHydrated(page, '/host/tiers')
    await page.getByRole('button', { name: 'Nueva edición' }).click()

    await expect(page.locator('.edicion .borrador')).toBeVisible({ timeout: 15_000 })
    // Los cuatro llegan en A, como estaban.
    await expect(page.locator('.fila.is-a .jugador')).toHaveCount(4)

    const c = db()
    const { data: borrador } = await c
      .from('tier_list')
      .select('id')
      .is('published_at', null)
      .maybeSingle()
    listaNueva = borrador!.id

    // Y la vieja sigue siendo la que ve la Home.
    const { data: vieja } = await c.from('tier_list').select('is_current').eq('id', listaVieja!).single()
    expect(vieja!.is_current, 'la vieja sigue publicada mientras se prepara la nueva').toBe(true)
  })

  // Prueba 1 de cierre: mover, publicar, y verlo en la Home.
  test('mover a alguien de A a S+ y publicarlo llega a la Home', async ({ page }) => {
    await gotoHydrated(page, '/host/tiers')
    await expect(page.locator('.fila.is-a .jugador')).toHaveCount(4, { timeout: 15_000 })

    const ada = page.locator('.jugador').filter({ hasText: nombre('Ada') })
    await ada.dragTo(page.locator('.fila.is-s_plus .fila__gente'))
    await page.waitForTimeout(1500)

    await expect(page.locator('.fila.is-s_plus')).toContainText(nombre('Ada'))
    await expect(page.locator('.fila.is-a .jugador')).toHaveCount(3)

    // Se guardó de verdad: sigue ahí tras recargar.
    const tras = await page.request.get('/api/tiers')
    const { entradas } = (await tras.json()) as { entradas: { tier: string; displayName: string }[] }
    expect(
      entradas.find((e) => e.displayName === nombre('Ada'))?.tier,
      'el movimiento se guardó en el servidor, no solo en la pantalla',
    ).toBe('S_PLUS')

    await page.reload()
    await page.waitForSelector('html[data-hydrated]')
    await expect(page.locator('.fila.is-s_plus')).toContainText(nombre('Ada'))

    // Antes de publicar, la Home sigue con la vieja.
    const antes = await page.request.get('/api/public/tier-ranking')
    expect((await antes.json()).edicion.title).toBe(`Vieja ${sello}`)

    await page.locator('.cab').getByRole('button', { name: 'Publicar' }).click()
    await expect(page.locator('.edicion .viva')).toBeVisible({ timeout: 15_000 })

    await gotoHydrated(page, '/tier-ranking')
    await expect(page.locator('.fila.is-s_plus')).toContainText(nombre('Ada'))
    await expect(page.locator('.fila.is-a')).toContainText(nombre('Bruno'))
  })

  // Prueba 2 de cierre: la anterior no se modifica.
  test('publicar no reescribe la edición anterior', async () => {
    const c = db()

    const { data: entradasViejas } = await c
      .from('tier_entry')
      .select('tier, player_id')
      .eq('tier_list_id', listaVieja!)

    expect(entradasViejas).toHaveLength(4)
    expect(
      entradasViejas!.every((e) => e.tier === 'A'),
      'en la edición vieja Ada sigue en A',
    ).toBe(true)

    // Y solo una edición puede ser la vigente.
    const { data: vigentes } = await c.from('tier_list').select('id').eq('is_current', true)
    expect(vigentes).toHaveLength(1)
    expect(vigentes![0]!.id).toBe(listaNueva)
  })

  test('una edición publicada ya no se puede mover', async ({ page }) => {
    await gotoHydrated(page, '/host/tiers')
    await expect(page.locator('.edicion .viva')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('.pista')).toContainText('no se toca')

    // Ni por la puerta de atrás: el servidor también lo rechaza.
    const c = db()
    const { data: entrada } = await c
      .from('tier_entry')
      .select('id')
      .eq('tier_list_id', listaNueva!)
      .limit(1)
      .single()

    const res = await page.request.patch(`/api/tiers/${listaNueva}/entries`, {
      data: { cambios: [{ id: entrada!.id, tier: 'D', rankOrder: 0 }] },
    })
    expect(res.status()).toBe(409)
  })

  // Prueba 3 de cierre: sin foto, avatar por defecto.
  test('quien no tiene foto sale con el avatar por defecto', async ({ page }) => {
    await gotoHydrated(page, '/tier-ranking')
    const img = page.locator('.fila__gente img').first()
    await expect(img).toHaveAttribute('src', /avatar-default/)

    // Y la ficha no se descuadra: todas miden lo mismo.
    const alturas = await page.locator('.fila__gente img').evaluateAll((els) =>
      els.map((e) => (e as HTMLImageElement).clientHeight),
    )
    expect(new Set(alturas).size, 'todas las fotos miden igual').toBe(1)
  })

  test('no se puede preparar dos ediciones a la vez', async ({ page }) => {
    await gotoHydrated(page, '/host/tiers')
    await page.getByRole('button', { name: 'Nueva edición' }).click()
    await expect(page.locator('.edicion .borrador')).toBeVisible({ timeout: 15_000 })

    const res = await page.request.post('/api/tiers', { data: { desde: 'actual' } })
    expect(res.status()).toBe(409)

    // Se borra el borrador para no dejarlo a medias.
    const c = db()
    const { data: borrador } = await c.from('tier_list').select('id').is('published_at', null).maybeSingle()
    if (borrador) await c.from('tier_list').delete().eq('id', borrador.id)
  })

  test('el histórico enseña las dos ediciones', async ({ page }) => {
    await gotoHydrated(page, '/host/tiers')
    const historico = page.locator('.historico')
    await expect(historico).toContainText(`Vieja ${sello}`, { timeout: 15_000 })
    await expect(historico.locator('li.is-current')).toHaveCount(1)
  })
})
