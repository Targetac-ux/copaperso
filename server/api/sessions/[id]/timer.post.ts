import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import { clampSeconds, DEFAULT_SECONDS } from '#shared/timer'
import type { Database } from '#shared/types/database.types'

const body = z.object({
  action: z.enum(['start', 'pause', 'reset', 'set']),
  seconds: z.number().int().optional(),
})

/**
 * Cronómetro de negociación. Los tramos son libres: el host lo arranca, lo
 * pausa y lo reinicia con la duración que quiera, las veces que quiera.
 *
 * La hora de fin se guarda en el servidor para que el host y los espectadores
 * vean lo mismo aunque sus relojes no coincidan.
 */
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const sessionId = getRouterParam(event, 'id')!
  const input = body.parse(await readBody(event))
  const db = serverSupabaseServiceRole<Database>(event)

  const { data: sesion } = await db
    .from('session')
    .select('id, timer_seconds, timer_ends_at, timer_running')
    .eq('id', sessionId)
    .maybeSingle()

  if (!sesion) throw createError({ statusCode: 404, statusMessage: 'Esa sesión no existe.' })

  const segundos = clampSeconds(input.seconds ?? sesion.timer_seconds ?? DEFAULT_SECONDS)

  type PatchTimer = {
    timer_seconds?: number
    timer_ends_at?: string | null
    timer_running?: boolean
  }
  let patch: PatchTimer

  switch (input.action) {
    case 'start': {
      // Si estaba pausado a mitad, sigue desde donde quedó.
      const restantes =
        !sesion.timer_running && sesion.timer_ends_at
          ? Math.max(0, Math.ceil((new Date(sesion.timer_ends_at).getTime() - Date.now()) / 1000))
          : 0
      const cuenta = restantes > 0 ? restantes : segundos
      patch = {
        timer_seconds: segundos,
        timer_ends_at: new Date(Date.now() + cuenta * 1000).toISOString(),
        timer_running: true,
      }
      break
    }
    case 'pause':
      patch = { timer_running: false }
      break
    case 'reset':
      patch = { timer_seconds: segundos, timer_ends_at: null, timer_running: false }
      break
    case 'set':
      patch = { timer_seconds: segundos }
      break
  }

  const { data, error } = await db
    .from('session')
    .update(patch)
    .eq('id', sessionId)
    .select('timer_seconds, timer_ends_at, timer_running')
    .single()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  // El log solo recoge arrancar y reiniciar: pausar es ruido.
  if (input.action === 'start' || input.action === 'reset') {
    await logAction(event, {
      actor: staff.user_id,
      sessionId,
      actionType: `timer.${input.action}`,
      summary:
        input.action === 'start'
          ? `Cronómetro en marcha (${Math.round(segundos / 60)} min)`
          : `Cronómetro reiniciado a ${Math.round(segundos / 60)} min`,
      payload: { seconds: segundos },
      reversible: false,
    })
  }

  return data
})
