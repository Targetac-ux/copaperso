import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import { findMember } from '#shared/draft'
import type { Database } from '#shared/types/database.types'

const body = z.object({
  /** Sin id: devuelve los dos equipos enteros a la banca (§26). */
  session_participant_id: z.string().uuid().optional(),
})

/**
 * Devuelve gente a la banca. Los saldos de bits no se tocan (§26) y nadie se
 * vuelve a registrar: siguen siendo los mismos participantes de la sesión.
 */
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const sessionId = getRouterParam(event, 'id')!
  const input = body.parse((await readBody(event)) ?? {})
  const db = serverSupabaseServiceRole<Database>(event)

  const state = await loadDraftState(event, sessionId)

  if (input.session_participant_id) {
    const actual = findMember(state, input.session_participant_id)
    if (!actual) {
      throw createError({ statusCode: 409, statusMessage: 'Ese jugador no está en ningún equipo.' })
    }

    await db.from('team_member').delete().eq('session_participant_id', input.session_participant_id)
    await db
      .from('session_participant')
      .update({ state: 'bench' })
      .eq('id', input.session_participant_id)

    await logAction(event, {
      actor: staff.user_id,
      sessionId,
      actionType: 'draft.bench',
      summary: `${actual.member.displayName} vuelve a la banca`,
      payload: { session_participant_id: input.session_participant_id },
      inversePayload: {
        op: 'assign',
        session_participant_id: input.session_participant_id,
        team_number: actual.team.teamNumber,
        role: actual.member.role,
      },
    })

    return { ok: true, draft: await loadDraftState(event, sessionId) }
  }

  // Devolver los dos equipos completos.
  const antes = state.teams.flatMap((t) =>
    t.members.map((m) => ({
      session_participant_id: m.sessionParticipantId,
      team_number: t.teamNumber,
      role: m.role,
    })),
  )

  if (!antes.length) {
    throw createError({ statusCode: 409, statusMessage: 'Los equipos ya están vacíos.' })
  }

  const ids = await teamIds(event, sessionId)
  await db.from('team_member').delete().in('team_id', [ids[1], ids[2]])
  await db
    .from('session_participant')
    .update({ state: 'bench' })
    .eq('session_id', sessionId)
    .eq('state', 'team')

  await logAction(event, {
    actor: staff.user_id,
    sessionId,
    actionType: 'draft.bench_all',
    summary: `Los dos equipos vuelven a la banca (${antes.length} jugadores)`,
    payload: { count: antes.length },
    inversePayload: { op: 'restore_teams', members: antes },
  })

  return { ok: true, draft: await loadDraftState(event, sessionId) }
})
