import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

/**
 * Deshace una acción del historial (§21).
 *
 * Se marca como deshecha **antes** de ejecutar la reversión: si el host pulsa
 * dos veces seguidas, la segunda encuentra la entrada ya marcada y no repite
 * el efecto.
 */
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const id = getRouterParam(event, 'id')!
  const db = serverSupabaseServiceRole<Database>(event)

  const { data: entrada } = await db
    .from('action_log')
    .select('id, session_id, action_type, summary, inverse_payload, reversible, undone_at')
    .eq('id', id)
    .maybeSingle()

  if (!entrada) throw createError({ statusCode: 404, statusMessage: 'Esa acción no existe.' })

  if (entrada.undone_at) {
    throw createError({ statusCode: 409, statusMessage: 'Esa acción ya estaba deshecha.' })
  }

  if (!entrada.reversible) {
    throw createError({
      statusCode: 422,
      statusMessage: `«${entrada.summary}» no se puede deshacer.`,
    })
  }

  if (!entrada.inverse_payload) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Esta acción no guardó cómo deshacerse.',
    })
  }

  // Marcar primero: es lo que hace que pulsar dos veces no duplique nada.
  const { error: marcaError } = await db
    .from('action_log')
    .update({ undone_at: new Date().toISOString() })
    .eq('id', id)
    .is('undone_at', null)

  if (marcaError) throw createError({ statusCode: 500, statusMessage: marcaError.message })

  try {
    await runUndo(event, entrada.inverse_payload as Record<string, unknown>, entrada.session_id)
  } catch (e) {
    // Si la reversión falla, la entrada vuelve a quedar disponible.
    await db.from('action_log').update({ undone_at: null }).eq('id', id)
    throw e
  }

  await logAction(event, {
    actor: staff.user_id,
    sessionId: entrada.session_id,
    actionType: 'undo',
    summary: `Deshecho: ${entrada.summary}`,
    payload: { undone_log_id: id },
    reversible: false,
  })

  return { ok: true, undone: entrada.summary }
})
