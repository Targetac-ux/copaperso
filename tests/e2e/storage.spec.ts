import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { gotoHydrated } from './helpers'

/**
 * Prueba de cierre 4 de la Fase 1: subir una foto pesada, verla publicada y
 * borrarla. La imagen entra apaisada y de 4 MB; tiene que salir cuadrada de
 * 512x512 y pesar una fracción de eso.
 */
const email = process.env.E2E_HOST_EMAIL
const password = process.env.E2E_HOST_PASSWORD
const url = process.env.SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY

test.describe('subida de fotos', () => {
  test.skip(!email || !password || !secret, 'Necesita credenciales de host y llave secreta')

  let playerId: string | null = null
  const nombre = `FotoTest${Date.now()}`

  test.afterAll(async () => {
    if (!playerId) return
    const db = createClient(url!, secret!, { auth: { persistSession: false } })
    const { data: files } = await db.storage.from('players').list(nombre.toLowerCase())
    if (files?.length) {
      await db.storage
        .from('players')
        .remove(files.map((f) => `${nombre.toLowerCase()}/${f.name}`))
    }
    await db.from('action_log').delete().eq('payload->>player_id', playerId)
    await db.from('player').delete().eq('id', playerId)
  })

  test('una foto apaisada de 4 MB sale cuadrada y ligera', async ({ page }) => {
    // 1. Entrar al panel: a partir de aquí page.request lleva la sesión.
    await gotoHydrated(page, '/host/login')
    await page.getByLabel('Correo').fill(email!)
    await page.getByLabel('Contraseña').fill(password!)
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    await expect(page).toHaveURL(/\/host$/)

    // 2. Crear el jugador de prueba.
    const creado = await page.request.post('/api/players', { data: { display_name: nombre } })
    expect(creado.ok()).toBeTruthy()
    playerId = (await creado.json()).player.id

    // 3. Una imagen apaisada, ruidosa (para que no comprima) y de unos 4 MB:
    // por debajo del límite de 5 MB del endpoint, pero bien pesada.
    const ancho = 1600
    const alto = 900
    const ruido = Buffer.alloc(ancho * alto * 3)
    for (let i = 0; i < ruido.length; i++) ruido[i] = Math.floor(Math.random() * 256)
    const grande = await sharp(ruido, { raw: { width: ancho, height: alto, channels: 3 } })
      .png({ compressionLevel: 0 })
      .toBuffer()
    expect(grande.length).toBeGreaterThan(4 * 1024 * 1024)
    expect(grande.length).toBeLessThan(5 * 1024 * 1024)

    // 4. Subirla.
    const subida = await page.request.post(`/api/players/${playerId}/photo`, {
      multipart: {
        file: { name: 'foto.png', mimeType: 'image/png', buffer: grande },
      },
    })
    expect(subida.ok(), await subida.text()).toBeTruthy()
    const { photo_url, bytes } = await subida.json()

    // 5. La imagen publicada es cuadrada de 512 y pesa muchísimo menos.
    expect(bytes).toBeLessThan(grande.length / 5)
    const descarga = await page.request.get(photo_url)
    expect(descarga.ok()).toBeTruthy()
    const meta = await sharp(await descarga.body()).metadata()
    expect(meta.width).toBe(512)
    expect(meta.height).toBe(512)
    expect(meta.format).toBe('webp')

    // 6. Y quedó registrada en el historial.
    const db = createClient(url!, secret!, { auth: { persistSession: false } })
    const { data: log } = await db
      .from('action_log')
      .select('action_type, summary')
      .eq('payload->>player_id', playerId!)
      .eq('action_type', 'player.photo')
    expect(log?.length).toBe(1)
  })

  test('rechaza lo que no es imagen', async ({ page }) => {
    await gotoHydrated(page, '/host/login')
    await page.getByLabel('Correo').fill(email!)
    await page.getByLabel('Contraseña').fill(password!)
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    await expect(page).toHaveURL(/\/host$/)

    const res = await page.request.post(`/api/players/${playerId}/photo`, {
      multipart: {
        file: { name: 'notas.txt', mimeType: 'text/plain', buffer: Buffer.from('hola') },
      },
    })
    expect(res.status()).toBe(415)
  })
})
