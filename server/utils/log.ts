import type { H3Event } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

export interface LogInput {
  actor: string
  actionType: string
  summary: string
  sessionId?: string | null
  payload?: Record<string, unknown>
  /** Lo necesario para revertir la acción. Sin esto, no se puede deshacer. */
  inversePayload?: Record<string, unknown> | null
  reversible?: boolean
}

/**
 * Escribe una entrada en el historial (§21). Una acción, una entrada.
 * Nunca hace fallar la petición: perder una línea de log es molesto, pero
 * tumbar una asignación a mitad del stream es peor.
 */
export async function logAction(event: H3Event, input: LogInput) {
  const db = serverSupabaseServiceRole<Database>(event)
  const { error } = await db.from('action_log').insert({
    session_id: input.sessionId ?? null,
    actor: input.actor,
    action_type: input.actionType,
    summary: input.summary,
    payload: input.payload ?? {},
    inverse_payload: input.inversePayload ?? null,
    reversible: input.reversible ?? true,
  })

  if (error) console.error('[action_log] no se pudo registrar:', error.message)
}
