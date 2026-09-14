import type { JugadorDePartida } from './lp'
import type { MatchResultDb, MatchStatus } from './types/database.types'

/**
 * La forma de una partida cargada, compartida por el servidor y la pantalla.
 *
 * Vive en `shared/` y no en `server/utils/` porque los componentes también la
 * necesitan: si el tipo viviera junto a la consulta, la pantalla tendría que
 * importar código de servidor solo para saber cómo es un objeto.
 */

export interface JugadorDeSnapshot extends JugadorDePartida {
  matchPlayerId: string
  result: MatchResultDb | null
  isMvp: boolean
  isAce: boolean
}

export interface PartidaCargada {
  id: string
  matchNumber: number
  status: MatchStatus
  winnerTeam: 1 | 2 | null
  startedAt: string | null
  finishedAt: string | null
  players: JugadorDeSnapshot[]
}

/** El marcador de la sesión: cuántas lleva ganadas cada equipo. */
export function marcadorDe(matches: PartidaCargada[]) {
  const acabadas = matches.filter((m) => m.status === 'finished')
  return {
    t1: acabadas.filter((m) => m.winnerTeam === 1).length,
    t2: acabadas.filter((m) => m.winnerTeam === 2).length,
    jugadas: acabadas.length,
  }
}

/** La que está en juego, si la hay. Solo puede haber una por sesión. */
export function partidaEnCurso(matches: PartidaCargada[]): PartidaCargada | null {
  return matches.find((m) => m.status === 'live') ?? null
}
