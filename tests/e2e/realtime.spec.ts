import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

/**
 * Prueba de cierre 6 de la Fase 1: Realtime funciona y es rápido.
 *
 * La vista pública en vivo (Fase 4B) usará canales de *broadcast*, no cambios
 * de tabla: así el espectador recibe solo lo que el servidor decide publicar y
 * nunca hay riesgo de filtrar bits, cárcel o notas por un fallo de RLS.
 */
const url = process.env.SUPABASE_URL
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_KEY

test.describe('Realtime', () => {
  test.skip(!url || !publishable, 'Define SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY')

  test('un cambio llega a otro espectador en menos de 2 segundos', async () => {
    const emisor = createClient(url!, publishable!, { auth: { persistSession: false } })
    const receptor = createClient(url!, publishable!, { auth: { persistSession: false } })
    const canal = `sesion-prueba-${Date.now()}`

    const recibido = new Promise<{ payload: unknown; ms: number }>((resolve, reject) => {
      const limite = setTimeout(() => reject(new Error('No llegó nada en 10 s')), 10_000)
      let enviadoEn = 0

      const suscripcion = receptor
        .channel(canal)
        .on('broadcast', { event: 'estado' }, ({ payload }) => {
          clearTimeout(limite)
          resolve({ payload, ms: Date.now() - enviadoEn })
        })
        .subscribe(async (estado) => {
          if (estado !== 'SUBSCRIBED') return
          const salida = emisor.channel(canal)
          await new Promise<void>((listo) =>
            salida.subscribe((s) => s === 'SUBSCRIBED' && listo()),
          )
          enviadoEn = Date.now()
          await salida.send({
            type: 'broadcast',
            event: 'estado',
            payload: { equipo: 1, jugador: 'Target', rol: 'MID' },
          })
        })

      void suscripcion
    })

    const { payload, ms } = await recibido
    expect(payload).toEqual({ equipo: 1, jugador: 'Target', rol: 'MID' })
    expect(ms).toBeLessThan(2000)
    console.log(`  latencia de Realtime: ${ms} ms`)

    await emisor.removeAllChannels()
    await receptor.removeAllChannels()
  })
})
