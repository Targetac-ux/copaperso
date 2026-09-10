import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

const body = z.object({
  participation_id: z.string().uuid(),
  /** Directo a un equipo, sin pasar por la banca (§7). */
  team_number: z.union([z.literal(1), z.literal(2)]).optional(),
  role: z.enum(['TOP', 'JG', 'MID', 'ADC', 'SUP']).optional(),
})

/** Mete a un participante del periodo en la banca de esta sesión (§8). */
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const sessionId = getRouterParam(event, 'id')!
  const input = body.parse(await readBody(event))
  const db = serverSupabaseServiceRole<Database>(event)

  const { data: participation } = await db
    .from('participation')
    .select('id, roles, player(display_name)')
    .eq('id', input.participation_id)
    .maybeSingle()

  if (!participation) {
    throw createError({ statusCode: 404, statusMessage: 'Esa participación no existe.' })
  }

  const nombre =
    (participation.player as unknown as { display_name: string } | null)?.display_name ?? 'Alguien'

  const { data: yaEsta } = await db
    .from('session_participant')
    .select('id, state')
    .eq('session_id', sessionId)
    .eq('participation_id', input.participation_id)
    .maybeSingle()

  let spId = yaEsta?.id

  if (yaEsta) {
    // Si estaba fuera, vuelve a la banca en vez de fallar.
    if (yaEsta.state === 'removed') {
      await db.from('session_participant').update({ state: 'bench' }).eq('id', yaEsta.id)
    }
  } else {
    const { data, error } = await db
      .from('session_participant')
      .insert({ session_id: sessionId, participation_id: input.participation_id, state: 'bench' })
      .select('id')
      .single()

    if (error) throw createError({ statusCode: 500, statusMessage: error.message })
    spId = data.id

    await logAction(event, {
      actor: staff.user_id,
      sessionId,
      actionType: 'session.join',
      summary: `${nombre} entra a la banca`,
      payload: { session_participant_id: spId },
      inversePayload: { op: 'remove', session_participant_id: spId },
    })
  }

  return { ok: true, session_participant_id: spId, draft: await loadDraftState(event, sessionId) }
})
