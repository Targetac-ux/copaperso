import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

/**
 * Deshace la última acción deshacible de la sesión.
 *
 * Cuál es "la última" lo decide el servidor en el momento de pulsar, no la
 * pantalla. Si lo resolviera el cliente, un historial recién desactualizado
 * —basta que la petición anterior siga en vuelo— haría que el botón deshaga
 * una acción distinta de la que el host acaba de hacer. En directo, eso es
 * exactamente el tipo de error que nadie nota hasta que el roster no cuadra.
 */
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const sessionId = getRouterParam(event, 'id')!
  const db = serverSupabaseServiceRole<Database>(event)

  const { data: entrada } = await db
    .from('action_log')
    .select('id, session_id, summary, inverse_payload, reversible, undone_at')
    .eq('session_id', sessionId)
    .eq('reversible', true)
    .is('undone_at', null)
    .not('inverse_payload', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!entrada) {
    throw createError({ statusCode: 409, statusMessage: 'No queda nada que deshacer.' })
  }

  const { error: marcaError } = await db
    .from('action_log')
    .update({ undone_at: new Date().toISOString() })
    .eq('id', entrada.id)
    .is('undone_at', null)

  if (marcaError) throw createError({ statusCode: 500, statusMessage: marcaError.message })

  try {
    await runUndo(event, entrada.inverse_payload as Record<string, unknown>, sessionId)
  } catch (e) {
    await db.from('action_log').update({ undone_at: null }).eq('id', entrada.id)
    throw e
  }

  await logAction(event, {
    actor: staff.user_id,
    sessionId,
    actionType: 'undo',
    summary: `Deshecho: ${entrada.summary}`,
    payload: { undone_log_id: entrada.id },
    reversible: false,
  })

  return { ok: true, undone: entrada.summary }
})
