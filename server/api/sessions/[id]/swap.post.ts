import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import { checkSwap, findMember } from '#shared/draft'
import type { Database } from '#shared/types/database.types'

const body = z.object({
  a: z.string().uuid(),
  b: z.string().uuid(),
  force: z.boolean().default(false),
})

/**
 * SWAP (§11): dos jugadores intercambian equipo **conservando su rol**.
 *
 * Los roles no se cambian solos a propósito: el plan dice que eso lo decide el
 * host después. Si Target jugaba MID en el Team 1, llega al Team 2 como MID.
 */
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const sessionId = getRouterParam(event, 'id')!
  const input = body.parse(await readBody(event))
  const db = serverSupabaseServiceRole<Database>(event)

  const state = await loadDraftState(event, sessionId)
  const check = checkSwap(state, input.a, input.b)

  if (check.errors.length) {
    throw createError({ statusCode: 409, statusMessage: check.errors[0]!.message })
  }
  if (check.warnings.length && !input.force) {
    setResponseStatus(event, 409)
    return { ok: false, warnings: check.warnings }
  }

  const a = findMember(state, input.a)!
  const b = findMember(state, input.b)!
  const ids = await teamIds(event, sessionId)

  // Cada uno se va al equipo del otro; el rol viaja con la persona.
  const { error: e1 } = await db
    .from('team_member')
    .update({ team_id: ids[b.team.teamNumber] })
    .eq('session_participant_id', input.a)
  if (e1) throw createError({ statusCode: 500, statusMessage: e1.message })

  const { error: e2 } = await db
    .from('team_member')
    .update({ team_id: ids[a.team.teamNumber] })
    .eq('session_participant_id', input.b)
  if (e2) throw createError({ statusCode: 500, statusMessage: e2.message })

  // Dos movimientos, dos líneas en el historial: es lo que el host ve que pasó.
  await logAction(event, {
    actor: staff.user_id,
    sessionId,
    actionType: 'draft.swap',
    summary: `${a.member.displayName} → Team ${b.team.teamNumber} / ${a.member.role}`,
    payload: { session_participant_id: input.a, team_number: b.team.teamNumber },
    inversePayload: {
      op: 'assign',
      session_participant_id: input.a,
      team_number: a.team.teamNumber,
      role: a.member.role,
    },
  })
  await logAction(event, {
    actor: staff.user_id,
    sessionId,
    actionType: 'draft.swap',
    summary: `${b.member.displayName} → Team ${a.team.teamNumber} / ${b.member.role}`,
    payload: { session_participant_id: input.b, team_number: a.team.teamNumber },
    inversePayload: {
      op: 'assign',
      session_participant_id: input.b,
      team_number: b.team.teamNumber,
      role: b.member.role,
    },
  })

  return { ok: true, draft: await loadDraftState(event, sessionId) }
})
