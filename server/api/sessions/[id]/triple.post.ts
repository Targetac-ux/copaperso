import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

const body = z.object({ tripled: z.boolean() })

/**
 * Triplica los precios de la sesión, o lo deshace.
 *
 * Es un sí/no y se aplica una sola vez: el ×3 es fijo y, una vez activado, se
 * mantiene hasta el final de la sesión. El catálogo del periodo no se toca,
 * así que las sesiones siguientes y el mes que viene siguen a precio normal.
 */
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const sessionId = getRouterParam(event, 'id')!
  const { tripled } = body.parse(await readBody(event))
  const db = serverSupabaseServiceRole<Database>(event)

  const { data: sesion } = await db
    .from('session')
    .select('id, number, prices_tripled')
    .eq('id', sessionId)
    .maybeSingle()

  if (!sesion) throw createError({ statusCode: 404, statusMessage: 'Esa sesión no existe.' })

  if (sesion.prices_tripled === tripled) {
    return { prices_tripled: tripled, changed: false }
  }

  const { data, error } = await db
    .from('session')
    .update({ prices_tripled: tripled, tripled_at: tripled ? new Date().toISOString() : null })
    .eq('id', sessionId)
    .select('prices_tripled, tripled_at')
    .single()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  await logAction(event, {
    actor: staff.user_id,
    sessionId,
    actionType: tripled ? 'prices.triple' : 'prices.restore',
    summary: tripled
      ? 'Precios triplicados: empieza el tiempo extra'
      : 'Precios de vuelta a la normalidad',
    payload: { prices_tripled: tripled },
    inversePayload: { op: 'triple', prices_tripled: !tripled },
  })

  return { ...data, changed: true }
})
