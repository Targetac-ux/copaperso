import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import { checkAssignment, findMember, importanLosRoles, isOffRole } from '#shared/draft'
import type { Database } from '#shared/types/database.types'

const body = z.object({
  session_participant_id: z.string().uuid(),
  team_number: z.union([z.literal(1), z.literal(2)]),
  role: z.enum(['TOP', 'JG', 'MID', 'ADC', 'SUP']),
  /** El host ya vio los avisos y quiere seguir igual. */
  force: z.boolean().default(false),
})

/**
 * Pone a alguien en un equipo con un rol (§10). Sirve para las tres formas de
 * llegar ahí: arrastrar desde la banca, el panel aleatorio y el menú del jugador.
 *
 * Si ya estaba en un equipo, esto lo mueve: no se duplica.
 */
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const sessionId = getRouterParam(event, 'id')!
  const input = body.parse(await readBody(event))
  const db = serverSupabaseServiceRole<Database>(event)

  const state = await loadDraftState(event, sessionId)
  const check = checkAssignment(state, input.session_participant_id, input.team_number, input.role)

  if (check.errors.length) {
    throw createError({ statusCode: 409, statusMessage: check.errors[0]!.message })
  }
  // Los avisos frenan la primera vez; con force el host manda (§1).
  if (check.warnings.length && !input.force) {
    setResponseStatus(event, 409)
    return { ok: false, warnings: check.warnings }
  }

  const anterior = findMember(state, input.session_participant_id)
  const jugador = state.bench.find((b) => b.sessionParticipantId === input.session_participant_id)
  // En ARAM AFK nadie va off-role: no hay posiciones que respetar, así que
  // tampoco hay +2 LP por jugar fuera de la tuya.
  const offRole =
    importanLosRoles(state.mode) && isOffRole(jugador?.roles ?? [], input.role)
  const ids = await teamIds(event, sessionId)

  if (anterior) {
    const { error } = await db
      .from('team_member')
      .update({ team_id: ids[input.team_number], role: input.role, is_off_role: offRole })
      .eq('session_participant_id', input.session_participant_id)
    if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  } else {
    const { error } = await db.from('team_member').insert({
      team_id: ids[input.team_number],
      session_participant_id: input.session_participant_id,
      role: input.role,
      is_off_role: offRole,
    })
    if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  }

  await db
    .from('session_participant')
    .update({ state: 'team' })
    .eq('id', input.session_participant_id)

  const nombre = jugador?.displayName ?? 'Alguien'
  await logAction(event, {
    actor: staff.user_id,
    sessionId,
    actionType: anterior ? 'draft.move' : 'draft.assign',
    summary: `${nombre} → Team ${input.team_number} / ${input.role}${offRole ? ' (off-role)' : ''}`,
    payload: {
      session_participant_id: input.session_participant_id,
      team_number: input.team_number,
      role: input.role,
    },
    inversePayload: anterior
      ? {
          op: 'assign',
          session_participant_id: input.session_participant_id,
          team_number: anterior.team.teamNumber,
          role: anterior.member.role,
        }
      : { op: 'bench', session_participant_id: input.session_participant_id },
  })

  return { ok: true, draft: await loadDraftState(event, sessionId) }
})
