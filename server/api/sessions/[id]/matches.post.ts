import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database, PlayerRoleDb } from '#shared/types/database.types'

/**
 * Inicia una partida: congela los equipos (§28).
 *
 * Este es el momento en que la composición deja de ser editable *para esta
 * partida*. A partir de aquí el host puede seguir moviendo gente en la mesa —a
 * veces hay que hacerlo, alguien se cae y entra otro— y nada de eso cambia con
 * quién se jugó: el resultado se aplicará sobre lo que se copió aquí.
 *
 * No exige equipos completos. Si se juega 4v5 el host lo sabe mejor que el
 * sistema; al cerrar se le avisa de con cuántos jugó, y ya está (§1).
 */
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const sessionId = getRouterParam(event, 'id')!
  const db = serverSupabaseServiceRole<Database>(event)

  const { data: sesion } = await db
    .from('session')
    .select('id, number, status')
    .eq('id', sessionId)
    .maybeSingle()

  if (!sesion) throw createError({ statusCode: 404, statusMessage: 'Esa sesión no existe.' })
  if (sesion.status === 'closed') {
    throw createError({ statusCode: 409, statusMessage: 'Esa sesión ya está cerrada.' })
  }

  const { data: enCurso } = await db
    .from('match')
    .select('id, match_number')
    .eq('session_id', sessionId)
    .eq('status', 'live')
    .maybeSingle()

  if (enCurso) {
    throw createError({
      statusCode: 409,
      statusMessage: `La partida ${enCurso.match_number} sigue en juego. Ciérrala antes de empezar otra.`,
    })
  }

  const { data: equipos } = await db
    .from('team')
    .select('id, team_number, team_member(session_participant_id, role, is_off_role)')
    .eq('session_id', sessionId)
    .order('team_number')

  type Miembro = { session_participant_id: string; role: PlayerRoleDb; is_off_role: boolean }
  const plantilla: { spId: string; team: 1 | 2; role: PlayerRoleDb; offRole: boolean }[] = []

  for (const t of equipos ?? []) {
    for (const m of (t.team_member ?? []) as unknown as Miembro[]) {
      plantilla.push({
        spId: m.session_participant_id,
        team: t.team_number as 1 | 2,
        role: m.role,
        offRole: m.is_off_role,
      })
    }
  }

  if (!plantilla.length) {
    throw createError({
      statusCode: 409,
      statusMessage: 'No hay nadie en los equipos: no hay partida que empezar.',
    })
  }

  // De session_participant a participation: el LP vive en la participación del
  // mes, no en el paso por esta sesión.
  const { data: participantes } = await db
    .from('session_participant')
    .select('id, participation_id')
    .in(
      'id',
      plantilla.map((p) => p.spId),
    )

  const participacionPorSp = new Map<string, string>()
  for (const sp of participantes ?? []) participacionPorSp.set(sp.id, sp.participation_id)

  const { data: ultima } = await db
    .from('match')
    .select('match_number')
    .eq('session_id', sessionId)
    .order('match_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  const numero = (ultima?.match_number ?? 0) + 1

  const { data: partida, error } = await db
    .from('match')
    .insert({
      session_id: sessionId,
      match_number: numero,
      status: 'live',
      started_at: new Date().toISOString(),
    })
    .select('id, match_number, status, started_at')
    .single()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  const filas = plantilla
    .map((p) => ({
      match_id: partida.id,
      participation_id: participacionPorSp.get(p.spId)!,
      team_number: p.team,
      role: p.role,
      is_off_role: p.offRole,
    }))
    .filter((f) => f.participation_id)

  const { error: errSnap } = await db.from('match_player').insert(filas)

  if (errSnap) {
    // Sin alineación no hay partida: mejor deshacerla que dejar una vacía.
    await db.from('match').delete().eq('id', partida.id)
    throw createError({ statusCode: 500, statusMessage: errSnap.message })
  }

  await logAction(event, {
    actor: staff.user_id,
    sessionId,
    actionType: 'match.start',
    summary: `Empieza la partida ${numero} (${filas.filter((f) => f.team_number === 1).length}v${filas.filter((f) => f.team_number === 2).length})`,
    payload: { match_id: partida.id, match_number: numero },
    inversePayload: { op: 'match_start', match_id: partida.id },
  })

  return { ...partida, players: filas.length }
})
