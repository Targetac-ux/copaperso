import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import { eventosDeCierre, resultadoDe } from '#shared/lp'
import type { CierreDePartida, JugadorDePartida } from '#shared/lp'
import type { Database, PlayerRoleDb } from '#shared/types/database.types'

const body = z.object({
  winner_team: z.union([z.literal(1), z.literal(2)]),
  mvp: z.string().uuid().nullable().optional(),
  ace: z.string().uuid().nullable().optional(),
  double_losses: z.array(z.string().uuid()).default([]),
})

/**
 * Cierra una partida y reparte el LP.
 *
 * El resultado se aplica sobre la alineación **congelada al iniciar**, no sobre
 * los equipos actuales (§28). Cada concepto deja su propio `lp_event` —victoria,
 * MVP, off role…— para que el historial explique de dónde sale cada punto y
 * para que deshacer sea revertir eventos, no restar a mano (A3).
 */
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const matchId = getRouterParam(event, 'id')!
  const input = body.parse(await readBody(event))
  const db = serverSupabaseServiceRole<Database>(event)

  const { data: partida } = await db
    .from('match')
    .select('id, session_id, match_number, status, session(prices_tripled)')
    .eq('id', matchId)
    .maybeSingle()

  if (!partida) throw createError({ statusCode: 404, statusMessage: 'Esa partida no existe.' })
  if (partida.status === 'finished') {
    throw createError({ statusCode: 409, statusMessage: 'Esa partida ya está cerrada.' })
  }

  type Fila = {
    id: string
    participation_id: string
    team_number: number
    role: PlayerRoleDb
    is_off_role: boolean
    participation: { player: { display_name: string } | null } | null
  }

  const { data: filas } = await db
    .from('match_player')
    .select(
      'id, participation_id, team_number, role, is_off_role, participation(player(display_name))',
    )
    .eq('match_id', matchId)

  const jugadoresDb = (filas ?? []) as unknown as Fila[]
  if (!jugadoresDb.length) {
    throw createError({ statusCode: 409, statusMessage: 'Esa partida no tiene alineación.' })
  }

  const jugadores: JugadorDePartida[] = jugadoresDb.map((f) => ({
    participationId: f.participation_id,
    displayName: f.participation?.player?.display_name ?? 'Sin nombre',
    teamNumber: f.team_number as 1 | 2,
    role: f.role,
    isOffRole: f.is_off_role,
  }))

  // Lo que llega de fuera tiene que referirse a gente de esta partida: un MVP
  // que no jugó sería LP regalado sin rastro de dónde salió.
  const enPartida = new Set(jugadores.map((j) => j.participationId))
  const comprobar = (id: string | null | undefined, que: string) => {
    if (id && !enPartida.has(id)) {
      throw createError({ statusCode: 422, statusMessage: `El ${que} no jugó esta partida.` })
    }
  }
  comprobar(input.mvp, 'MVP')
  comprobar(input.ace, 'ACE')
  for (const id of input.double_losses) comprobar(id, 'jugador con doble derrota')

  const cierre: CierreDePartida = {
    winnerTeam: input.winner_team,
    mvp: input.mvp ?? null,
    ace: input.ace ?? null,
    doubleLosses: input.double_losses,
  }

  // Los diez se escriben en dos o tres llamadas, no en diez. Cerrar la partida
  // es lo que más prisa tiene de la noche —el host lo hace en directo, con la
  // gente esperando— y una ida y vuelta por jugador se notaba.
  const grupos = new Map<string, string[]>()
  for (const f of jugadoresDb) {
    const jugador = jugadores.find((j) => j.participationId === f.participation_id)!
    const clave = [
      resultadoDe(jugador, cierre),
      cierre.mvp === f.participation_id,
      cierre.ace === f.participation_id,
    ].join('|')
    grupos.set(clave, [...(grupos.get(clave) ?? []), f.id])
  }

  const eventos = eventosDeCierre(jugadores, cierre)

  const [, errLp, equipoGanador] = await Promise.all([
    Promise.all(
      [...grupos.entries()].map(([clave, ids]) => {
        const [result, mvp, ace] = clave.split('|')
        return db
          .from('match_player')
          .update({
            result: result as ReturnType<typeof resultadoDe>,
            is_mvp: mvp === 'true',
            is_ace: ace === 'true',
          })
          .in('id', ids)
      }),
    ),
    db
      .from('lp_event')
      .insert(
        eventos.map((e) => ({
          participation_id: e.participationId,
          match_id: matchId,
          type: e.type,
          delta: e.delta,
          created_by: staff.user_id,
        })),
      )
      .then((r) => r.error),
    db
      .from('team')
      .select('id')
      .eq('session_id', partida.session_id)
      .eq('team_number', input.winner_team)
      .maybeSingle()
      .then((r) => r.data),
  ])

  if (errLp) throw createError({ statusCode: 500, statusMessage: errLp.message })

  await db
    .from('match')
    .update({
      status: 'finished',
      winner_team_id: equipoGanador?.id ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq('id', matchId)

  // Cada partida tiene su propia negociación, y empieza a precio normal: al
  // cerrar una, el ×3 de la anterior se cae. Decisión del host (14-09-2026).
  const estabaTriplicado =
    (partida.session as unknown as { prices_tripled: boolean } | null)?.prices_tripled ?? false

  if (estabaTriplicado) {
    await db
      .from('session')
      .update({ prices_tripled: false, tripled_at: null })
      .eq('id', partida.session_id)
  }

  // El recálculo va después de escribir los eventos: suma lo que acaba de quedar.
  await recalcularLp(
    event,
    jugadores.map((j) => j.participationId),
  )

  const mvp = jugadores.find((j) => j.participationId === cierre.mvp)
  await logAction(event, {
    actor: staff.user_id,
    sessionId: partida.session_id,
    actionType: 'match.finish',
    summary:
      `Partida ${partida.match_number}: gana el Team ${input.winner_team}` +
      (mvp ? `, MVP ${mvp.displayName}` : '') +
      (estabaTriplicado ? ' · los precios vuelven a la normalidad' : ''),
    payload: { match_id: matchId, winner_team: input.winner_team, lp_events: eventos.length },
    inversePayload: {
      op: 'match_finish',
      match_id: matchId,
      // Si al cerrar se cayó el ×3, deshacer la partida lo devuelve.
      prices_tripled: estabaTriplicado,
    },
  })

  return await cargarPartidas(event, partida.session_id)
})
