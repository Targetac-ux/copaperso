import type { H3Event } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { esAccionPublica } from '#shared/live'
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

  // Una acción, una entrada en el historial, un aviso al público. Engancharlo
  // aquí en vez de en cada endpoint evita el fallo de olvidarse en uno: si algo
  // se registra y cambia lo que se ve, el público se entera.
  //
  // **Sin esperar a que salga.** Armar el estado público y publicarlo cuesta
  // más de un segundo, y hacerlo dentro de la petición se lo cobraba al host:
  // cada asignación en directo tardaba el doble por avisar a la grada. El
  // espectador puede esperar ese segundo; quien está arrastrando jugadores con
  // diez personas mirando, no.
  // Sin exigir `sessionId`: el banco y el catálogo se tocan desde pantallas
  // que no cuelgan de una copa —Economía, Ajustes— y desde que sus paneles se
  // ven, esos cambios también tienen que llegar a la grada. `cargarEnVivo`
  // busca la sesión abierta por su cuenta, así que no le hace falta el id; si
  // no hay ninguna, devuelve el vacío y no se publica nada de interés.
  if (esAccionPublica(input.actionType)) {
    const tarea = publicarEnVivo(event, input.actionType, input.summary)

    // En Vercel la función se congela al responder, así que hay que pedir que
    // la mantenga viva. En local no existe y basta con dejar correr la promesa.
    const seguir = (event as { waitUntil?: (p: Promise<unknown>) => void }).waitUntil
    if (typeof seguir === 'function') seguir.call(event, tarea)
    else void tarea
  }
}
