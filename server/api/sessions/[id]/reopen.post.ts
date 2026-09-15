import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

/**
 * Vuelve a abrir una sesión cerrada.
 *
 * Existe porque cerrar es un clic y equivocarse también: sin esto, un cierre a
 * destiempo en mitad del stream dejaría la copa a medias sin salida. No es una
 * papelera de reciclaje —la sesión nunca se borró— sino deshacer el cierre.
 *
 * **Solo si no hay otra abierta.** El CCTM trabaja sobre una sola sesión; con
 * dos abiertas no sabría cuál enseñar.
 */
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const sessionId = getRouterParam(event, 'id')!
  const db = serverSupabaseServiceRole<Database>(event)

  const { data: sesion } = await db
    .from('session')
    .select('id, number, status')
    .eq('id', sessionId)
    .maybeSingle()

  if (!sesion) throw createError({ statusCode: 404, statusMessage: 'Esa sesión no existe.' })
  if (sesion.status !== 'closed') {
    throw createError({ statusCode: 409, statusMessage: 'Esa sesión no está cerrada.' })
  }

  const { data: abierta } = await db
    .from('session')
    .select('number')
    .neq('status', 'closed')
    .limit(1)
    .maybeSingle()

  if (abierta) {
    throw createError({
      statusCode: 409,
      statusMessage: `La sesión #${abierta.number} está abierta. Ciérrala antes de reabrir esta.`,
    })
  }

  const { error } = await db
    .from('session')
    .update({ status: 'open', closed_at: null })
    .eq('id', sessionId)

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  await logAction(event, {
    actor: staff.user_id,
    sessionId,
    actionType: 'session.reopen',
    summary: `Sesión #${sesion.number} reabierta`,
    payload: { session_id: sessionId },
    reversible: false,
  })

  return { ok: true }
})
