import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { ESPERA_REGISTRO, gotoHydrated } from './helpers'

/**
 * El caso de uso real: el host registra a diez personas seguidas mientras el
 * chat las va diciendo. Entre una y otra no mira la pantalla, así que el campo
 * tiene que quedar listo para la siguiente sin que se pierda nada.
 */
const email = process.env.E2E_HOST_EMAIL
const password = process.env.E2E_HOST_PASSWORD
const url = process.env.SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY

const sello = Date.now()
const LINEAS = [
  `Uno${sello} TOP Challenger`,
  `Dos${sello} ADC Master`,
  `Tres${sello} Jungla Challenger`,
  `Cuatro${sello} Sup/Mid Diamante`,
  `Cinco${sello} MID GM`,
]

test.describe('registro seguido', () => {
  test.skip(!email || !password || !secret, 'Necesita credenciales de host y llave secreta')

  const db = () => createClient(url!, secret!, { auth: { persistSession: false } })

  test.afterAll(async () => {
    const c = db()
    const { data } = await c.from('player').select('id').ilike('display_name', `%${sello}%`)
    for (const p of data ?? []) {
      await c.from('participation').delete().eq('player_id', p.id)
      await c.from('player').delete().eq('id', p.id)
    }
  })

  test('cinco registros seguidos sin perder ninguno', async ({ page }) => {
    await gotoHydrated(page, '/host/login')
    await page.getByLabel('Correo').fill(email!)
    await page.getByLabel('Contraseña').fill(password!)
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    await expect(page).toHaveURL(/\/host$/)

    await gotoHydrated(page, '/host/jugadores')
    const campo = page.getByLabel('Registrar participante')
    await campo.waitFor()

    for (const linea of LINEAS) {
      await campo.fill(linea)
      // Enter, como lo haría el host: sin soltar el teclado.
      await campo.press('Enter')
      await expect(page.getByRole('row', { name: new RegExp(linea.split(' ')[0]!) })).toBeVisible(ESPERA_REGISTRO)
      await expect(campo).toHaveValue('')
    }

    const c = db()
    const { data } = await c.from('player').select('id').ilike('display_name', `%${sello}%`)
    expect(data, 'los cinco tienen que estar').toHaveLength(5)
  })
})
