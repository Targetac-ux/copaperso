import { serverSupabaseServiceRole } from '#supabase/server'
import { contar } from '#shared/roster'
import type { ResultadoDeJugador } from '#shared/roster'
import type { Database, EloTierDb, PlayerRoleDb } from '#shared/types/database.types'

/**
 * La ficha de un jugador: un bloque por periodo en el que participó.
 *
 * Cada mes va por separado y **no se suman entre sí**: el LP se reinicia cada
 * periodo (A3), así que un total acumulado sería un número que no significa
 * nada. Lo que sí tiene sentido es ver la evolución mes a mes.
 */
export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const playerId = getRouterParam(event, 'id')!
  const db = serverSupabaseServiceRole<Database>(event)

  const { data: player } = await db
    .from('player')
    .select('id, display_name, slug, photo_url, twitch_handle')
    .eq('id', playerId)
    .maybeSingle()

  if (!player) throw createError({ statusCode: 404, statusMessage: 'Ese jugador no existe.' })

  type FilaPart = {
    id: string
    elo: EloTierDb | null
    roles: PlayerRoleDb[]
    current_lp: number
    initial_lp: number
    period: { id: string; name: string; starts_at: string } | null
  }

  const { data: parts } = await db
    .from('participation')
    .select('id, elo, roles, current_lp, initial_lp, period(id, name, starts_at)')
    .eq('player_id', playerId)

  const participaciones = (parts ?? []) as unknown as FilaPart[]
  if (!participaciones.length) return { player, periodos: [] }

  const { data: jugadas } = await db
    .from('match_player')
    .select('participation_id, result, is_mvp, is_ace, is_off_role, match!inner(status)')
    .in('participation_id', participaciones.map((p) => p.id))
    .eq('match.status', 'finished')

  const porParticipacion = new Map<string, ResultadoDeJugador[]>()
  for (const j of (jugadas ?? []) as unknown as {
    participation_id: string
    result: ResultadoDeJugador['result']
    is_mvp: boolean
    is_ace: boolean
    is_off_role: boolean
  }[]) {
    const lista = porParticipacion.get(j.participation_id) ?? []
    lista.push({ result: j.result, isMvp: j.is_mvp, isAce: j.is_ace, isOffRole: j.is_off_role })
    porParticipacion.set(j.participation_id, lista)
  }

  const periodos = participaciones
    .filter((p) => p.period)
    .map((p) => ({
      periodId: p.period!.id,
      periodName: p.period!.name,
      startsAt: p.period!.starts_at,
      elo: p.elo,
      roles: p.roles ?? [],
      lp: p.current_lp,
      lpInicial: p.initial_lp,
      ...contar(porParticipacion.get(p.id) ?? []),
    }))
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))

  return { player, periodos }
})
