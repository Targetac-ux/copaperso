import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import { findMember } from '#shared/draft'
import type { Database } from '#shared/types/database.types'

const body = z.object({
  state: z.enum(['bench', 'jail', 'graveyard', 'removed']),
  reason: z.string().trim().max(200).optional(),
})

const ETIQUETA = {
  bench: 'vuelve a la banca',
  jail: 'va a la cárcel',
  graveyard: 'va al cementerio',
  removed: 'sale de la sesión',
} as const

/**
 * Cambia el estado de un participante dentro de la sesión (§27).
 *
 * Sacar de la sesión **no borra el perfil permanente** ni su participación del
 * mes: solo lo aparta de esta noche.
 */
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const sessionId = getRouterParam(event, 'id')!
  const spId = getRouterParam(event, 'spId')!
  const input = body.parse(await readBody(event))
  const db = serverSupabaseServiceRole<Database>(event)

  const state = await loadDraftState(event, sessionId)
  const jugador = state.bench.find((b) => b.sessionParticipantId === spId)
  if (!jugador) {
    throw createError({ statusCode: 404, statusMessage: 'Ese jugador no está en la sesión.' })
  }

  const enEquipo = findMember(state, spId)

  // Salir de un equipo es implícito: no se puede estar en la cárcel y de MID.
  if (enEquipo && input.state !== 'bench') {
    await db.from('team_member').delete().eq('session_participant_id', spId)
  } else if (enEquipo && input.state === 'bench') {
    await db.from('team_member').delete().eq('session_participant_id', spId)
  }

  const { error } = await db
    .from('session_participant')
    .update({ state: input.state })
    .eq('id', spId)

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  if (input.state === 'jail' || input.state === 'graveyard') {
    await db.from('state_record').insert({
      session_participant_id: spId,
      kind: input.state === 'jail' ? 'jail' : 'graveyard',
      reason: input.reason ?? null,
    })
  }

  await logAction(event, {
    actor: staff.user_id,
    sessionId,
    actionType: `session.${input.state}`,
    summary: `${jugador.displayName} ${ETIQUETA[input.state]}`,
    payload: { session_participant_id: spId, state: input.state, reason: input.reason },
    inversePayload: enEquipo
      ? {
          op: 'assign',
          session_participant_id: spId,
          team_number: enEquipo.team.teamNumber,
          role: enEquipo.member.role,
        }
      : { op: 'state', session_participant_id: spId, state: jugador.state },
  })

  return { ok: true, draft: await loadDraftState(event, sessionId) }
})
