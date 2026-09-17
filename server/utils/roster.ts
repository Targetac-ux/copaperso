import type { H3Event } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { contar } from '#shared/roster'
import type { AgregadoHistorico, FilaRoster, ResultadoDeJugador } from '#shared/roster'
import type { Database, EloTierDb, PlayerRoleDb } from '#shared/types/database.types'

export interface RosterCargado {
  period: { id: string; name: string }
  filas: FilaRoster[]
}

type FilaParticipacion = AgregadoHistorico & {
  id: string
  elo: EloTierDb | null
  roles: PlayerRoleDb[]
  current_lp: number
  imported_from: string | null
  player: { id: string; display_name: string; photo_url: string | null } | null
}

/**
 * El roster de un periodo.
 *
 * Los meses que vinieron del CCPR Roster no tienen ni una partida: llegaron
 * como totales, y esos totales viven en la propia `participation`. `contar`
 * los suma a lo jugado, así que un mes importado y uno jugado se leen igual.
 *
 * Solo cuentan las partidas **terminadas**: una en juego, o una cuyo resultado
 * se deshizo, no suma para nadie. Por eso se filtra por el estado de la partida
 * y no solo por el resultado del jugador.
 *
 * Va en dos consultas y la cuenta se hace aquí, no en SQL. Con el tamaño real
 * —decenas de jugadores, decenas de partidas al mes— son unos cientos de filas,
 * y a cambio la fórmula vive en `shared/roster.ts`, donde se puede comprobar
 * sin base de datos y la usa también el CSV.
 */
export async function cargarRoster(event: H3Event, periodId?: string): Promise<RosterCargado> {
  const db = serverSupabaseServiceRole<Database>(event)

  // Con el periodo ya elegido, las tres consultas salen a la vez: solo hay que
  // esperar al periodo cuando no se sabe cuál es. Es la diferencia entre una
  // ida y vuelta y dos, y esta pantalla se abre muchas veces al cerrar el mes.
  const idConocido = periodId
    ? periodId
    : (
        await db
          .from('period')
          .select('id')
          .eq('status', 'active')
          .order('starts_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      ).data?.id

  if (!idConocido) {
    throw createError({ statusCode: 404, statusMessage: 'No hay ningún periodo abierto.' })
  }

  const [{ data: periodo }, { data: participaciones, error }, { data: jugadas, error: errJ }] =
    await Promise.all([
      db.from('period').select('id, name').eq('id', idConocido).maybeSingle(),
      db
        .from('participation')
        .select(
          'id, elo, roles, current_lp, imported_from, historic_wins, historic_losses, historic_mvps, historic_aces, historic_off_roles, player(id, display_name, photo_url)',
        )
        .eq('period_id', idConocido),
      db
        .from('match_player')
        .select(
          'participation_id, result, is_mvp, is_ace, is_off_role, match!inner(status), participation!inner(period_id)',
        )
        .eq('match.status', 'finished')
        .eq('participation.period_id', idConocido),
    ])

  if (!periodo) {
    throw createError({ statusCode: 404, statusMessage: 'No hay ningún periodo con ese id.' })
  }
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  if (errJ) throw createError({ statusCode: 500, statusMessage: errJ.message })

  const filasP = (participaciones ?? []) as unknown as FilaParticipacion[]
  if (!filasP.length) return { period: periodo, filas: [] }

  const porParticipacion = new Map<string, ResultadoDeJugador[]>()
  for (const j of (jugadas ?? []) as unknown as {
    participation_id: string
    result: ResultadoDeJugador['result']
    is_mvp: boolean
    is_ace: boolean
    is_off_role: boolean
  }[]) {
    const lista = porParticipacion.get(j.participation_id) ?? []
    lista.push({
      result: j.result,
      isMvp: j.is_mvp,
      isAce: j.is_ace,
      isOffRole: j.is_off_role,
    })
    porParticipacion.set(j.participation_id, lista)
  }

  const filas: FilaRoster[] = filasP.map((p) => ({
    playerId: p.player?.id ?? '',
    participationId: p.id,
    displayName: p.player?.display_name ?? 'Sin nombre',
    photoUrl: p.player?.photo_url ?? null,
    elo: p.elo,
    roles: p.roles ?? [],
    lp: p.current_lp,
    importadoDe: p.imported_from,
    ...contar(porParticipacion.get(p.id) ?? [], p),
  }))

  return { period: periodo, filas }
}
