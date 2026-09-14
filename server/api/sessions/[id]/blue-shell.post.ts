import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import { BLUE_SHELL_LABEL, BLUE_SHELL_OUTCOMES } from '#shared/blueshell'
import type { Database } from '#shared/types/database.types'

const body = z.object({
  participation_id: z.string().uuid(),
  outcome: z.enum(BLUE_SHELL_OUTCOMES),
  match_id: z.string().uuid().nullable().optional(),
})

/**
 * Guarda una tirada del Blue Shell.
 *
 * La ruleta gira en el navegador y **girar no llama aquí**: el host puede
 * volver a girar o cancelar sin que quede rastro. Esto se llama solo al pulsar
 * «Guardar».
 *
 * Y guardar tampoco ejecuta el castigo. Igual que los canjeos (A6-bis), deja
 * constancia; la doble derrota se marca luego, al cerrar la partida, donde se
 * ve junto al resto del resultado.
 */
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const sessionId = getRouterParam(event, 'id')!
  const input = body.parse(await readBody(event))
  const db = serverSupabaseServiceRole<Database>(event)

  const { data: participacion } = await db
    .from('participation')
    .select('id, player(display_name)')
    .eq('id', input.participation_id)
    .maybeSingle()

  if (!participacion) {
    throw createError({ statusCode: 404, statusMessage: 'Ese jugador no existe.' })
  }

  const { data, error } = await db
    .from('blue_shell_result')
    .insert({
      session_id: sessionId,
      match_id: input.match_id ?? null,
      participation_id: input.participation_id,
      outcome: input.outcome,
      created_by: staff.user_id,
    })
    .select('id, participation_id, outcome, match_id, spun_at')
    .single()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  const nombre =
    (participacion.player as unknown as { display_name: string } | null)?.display_name ??
    'Sin nombre'

  await logAction(event, {
    actor: staff.user_id,
    sessionId,
    actionType: 'blue_shell.save',
    summary: `Blue Shell a ${nombre}: ${BLUE_SHELL_LABEL[input.outcome]}`,
    payload: { ...data },
    inversePayload: { op: 'delete_blue_shell', blue_shell_id: data.id },
  })

  return data
})
