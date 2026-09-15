import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

/**
 * Cierra la CopaPerso del día.
 *
 * Cerrar es lo que deja sitio para la siguiente: el CCTM trabaja siempre sobre
 * **la sesión abierta**, y mientras haya una no se puede abrir otra. Sin esto
 * la primera sesión se quedaba puesta para siempre.
 *
 * **Con una partida en juego no se cierra.** Esa partida todavía no ha repartido
 * LP y cerrar la sesión la dejaría colgada para siempre, sin forma de terminarla
 * desde el panel. Se avisa y no se hace nada; si el host quiere, la anula o la
 * cierra antes.
 *
 * Nada se borra: el roster, la bitácora y las partidas siguen donde estaban. Y
 * si se cierra por error, se reabre desde Periodos.
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
  if (sesion.status === 'closed') {
    throw createError({ statusCode: 409, statusMessage: 'Esa sesión ya está cerrada.' })
  }

  const { data: enJuego } = await db
    .from('match')
    .select('match_number')
    .eq('session_id', sessionId)
    .eq('status', 'live')
    .maybeSingle()

  if (enJuego) {
    throw createError({
      statusCode: 409,
      statusMessage:
        `La partida ${enJuego.match_number} sigue en juego. Ciérrala o anúlala antes de ` +
        'cerrar la sesión.',
    })
  }

  const { error } = await db
    .from('session')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', sessionId)

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  await logAction(event, {
    actor: staff.user_id,
    sessionId,
    actionType: 'session.close',
    summary: `Sesión #${sesion.number} cerrada`,
    payload: { session_id: sessionId },
    // No se deshace desde la bitácora: al cerrar, el CCTM deja de enseñar esta
    // sesión y el botón de deshacer se queda fuera de alcance. Para volver
    // atrás está «Reabrir» en Periodos, que sí se puede pulsar.
    reversible: false,
  })

  return { ok: true }
})
