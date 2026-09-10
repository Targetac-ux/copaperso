import type { H3Event } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { DraftState, DraftTeam, BenchPlayer, DraftMember } from '#shared/draft'
import type { Database, PlayerRoleDb } from '#shared/types/database.types'

/**
 * Carga la mesa de control entera de una sesión: quién está en la banca y cómo
 * están formados los dos equipos. Es lo que consume tanto la pantalla del host
 * como las validaciones del servidor, para que ambos miren exactamente lo mismo.
 */
export async function loadDraftState(event: H3Event, sessionId: string): Promise<DraftState> {
  const db = serverSupabaseServiceRole<Database>(event)

  const { data: participantes, error: errP } = await db
    .from('session_participant')
    .select(
      'id, state, participation_id, participation(id, roles, elo, current_lp, player(id, display_name, photo_url))',
    )
    .eq('session_id', sessionId)
    .order('joined_at')

  if (errP) throw createError({ statusCode: 500, statusMessage: errP.message })

  const { data: equipos, error: errT } = await db
    .from('team')
    .select('id, team_number, team_member(id, session_participant_id, role, is_off_role)')
    .eq('session_id', sessionId)
    .order('team_number')

  if (errT) throw createError({ statusCode: 500, statusMessage: errT.message })

  type ParticipacionAnidada = {
    id: string
    roles: PlayerRoleDb[]
    player: { id: string; display_name: string; photo_url: string | null } | null
  }

  const nombrePorSp = new Map<string, string>()
  const bench: BenchPlayer[] = (participantes ?? []).map((sp) => {
    const part = sp.participation as unknown as ParticipacionAnidada | null
    const nombre = part?.player?.display_name ?? 'Sin nombre'
    nombrePorSp.set(sp.id, nombre)
    return {
      sessionParticipantId: sp.id,
      participationId: sp.participation_id,
      displayName: nombre,
      roles: part?.roles ?? [],
      state: sp.state,
    }
  })

  const teams = [1, 2].map((n) => {
    const fila = (equipos ?? []).find((t) => t.team_number === n)
    const miembros = (fila?.team_member ?? []) as unknown as {
      id: string
      session_participant_id: string
      role: PlayerRoleDb
      is_off_role: boolean
    }[]

    const members: DraftMember[] = miembros.map((m) => {
      const sp = bench.find((b) => b.sessionParticipantId === m.session_participant_id)
      return {
        sessionParticipantId: m.session_participant_id,
        participationId: sp?.participationId ?? '',
        displayName: nombrePorSp.get(m.session_participant_id) ?? 'Sin nombre',
        role: m.role,
        isOffRole: m.is_off_role,
      }
    })

    return { teamNumber: n as 1 | 2, members }
  }) as [DraftTeam, DraftTeam]

  return { bench, teams }
}

/** Los ids de los dos equipos de una sesión, para no repetir la consulta. */
export async function teamIds(event: H3Event, sessionId: string): Promise<Record<1 | 2, string>> {
  const db = serverSupabaseServiceRole<Database>(event)
  const { data, error } = await db
    .from('team')
    .select('id, team_number')
    .eq('session_id', sessionId)

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  const mapa = {} as Record<1 | 2, string>
  for (const t of data ?? []) mapa[t.team_number as 1 | 2] = t.id
  if (!mapa[1] || !mapa[2]) {
    throw createError({ statusCode: 409, statusMessage: 'Esta sesión no tiene sus dos equipos.' })
  }
  return mapa
}
