import type { H3Event } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { JugadorDeSnapshot, PartidaCargada } from '#shared/match'
import type { Database, MatchResultDb, PlayerRoleDb } from '#shared/types/database.types'

type FilaJugador = {
  id: string
  participation_id: string
  team_number: number
  role: PlayerRoleDb
  is_off_role: boolean
  result: MatchResultDb | null
  is_mvp: boolean
  is_ace: boolean
  participation: { player: { display_name: string } | null } | null
}

/**
 * Las partidas de una sesión, con su alineación.
 *
 * La alineación sale de `match_player`, no de los equipos actuales: es el
 * snapshot congelado al iniciar (§28). Si el host mueve a alguien de equipo a
 * mitad de partida, esto sigue diciendo con quién se jugó de verdad.
 */
export async function cargarPartidas(
  event: H3Event,
  sessionId: string,
): Promise<PartidaCargada[]> {
  const db = serverSupabaseServiceRole<Database>(event)

  const { data: partidas, error } = await db
    .from('match')
    .select('id, match_number, status, winner_team_id, started_at, finished_at')
    .eq('session_id', sessionId)
    .order('match_number')

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  if (!partidas?.length) return []

  const { data: equipos } = await db
    .from('team')
    .select('id, team_number')
    .eq('session_id', sessionId)

  const numeroPorTeamId = new Map<string, 1 | 2>()
  for (const t of equipos ?? []) numeroPorTeamId.set(t.id, t.team_number as 1 | 2)

  const { data: jugadores, error: errJ } = await db
    .from('match_player')
    .select(
      'id, match_id, participation_id, team_number, role, is_off_role, result, is_mvp, is_ace, participation(player(display_name))',
    )
    .in(
      'match_id',
      partidas.map((m) => m.id),
    )

  if (errJ) throw createError({ statusCode: 500, statusMessage: errJ.message })

  const porPartida = new Map<string, JugadorDeSnapshot[]>()
  for (const fila of (jugadores ?? []) as unknown as (FilaJugador & { match_id: string })[]) {
    const lista = porPartida.get(fila.match_id) ?? []
    lista.push({
      matchPlayerId: fila.id,
      participationId: fila.participation_id,
      displayName: fila.participation?.player?.display_name ?? 'Sin nombre',
      teamNumber: fila.team_number as 1 | 2,
      role: fila.role,
      isOffRole: fila.is_off_role,
      result: fila.result,
      isMvp: fila.is_mvp,
      isAce: fila.is_ace,
    })
    porPartida.set(fila.match_id, lista)
  }

  return partidas.map((m) => ({
    id: m.id,
    matchNumber: m.match_number,
    status: m.status,
    winnerTeam: m.winner_team_id ? (numeroPorTeamId.get(m.winner_team_id) ?? null) : null,
    startedAt: m.started_at,
    finishedAt: m.finished_at,
    players: (porPartida.get(m.id) ?? []).sort(
      (a, b) => a.teamNumber - b.teamNumber || ORDEN_ROL[a.role] - ORDEN_ROL[b.role],
    ),
  }))
}

const ORDEN_ROL: Record<PlayerRoleDb, number> = { TOP: 0, JG: 1, MID: 2, ADC: 3, SUP: 4 }

/**
 * Vuelve a calcular el `current_lp` de cada participación tocada.
 *
 * `current_lp` es una caché (A3): la verdad son los `lp_event`. Después de
 * cualquier escritura de eventos hay que pedirle a la base que rehaga la suma,
 * porque hacerla aquí a mano es justo el error que el modelo evita.
 */
export async function recalcularLp(event: H3Event, participationIds: string[]) {
  const db = serverSupabaseServiceRole<Database>(event)
  const unicos = [...new Set(participationIds)]

  // En paralelo: son diez llamadas independientes y encadenarlas convertía el
  // cierre de una partida en varios segundos de espera en directo.
  const fallos = await Promise.all(
    unicos.map(async (id) => {
      const { error } = await db.rpc('recalc_participation_lp', { p_participation_id: id })
      return error ? `${id}: ${error.message}` : null
    }),
  )

  for (const f of fallos) if (f) console.error('[lp] no se pudo recalcular', f)
}
