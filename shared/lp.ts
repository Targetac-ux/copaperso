import type { LpEventType, MatchResultDb, PlayerRoleDb } from './types/database.types'

/**
 * Las reglas de LP (§23).
 *
 * Viven aquí, sin base de datos de por medio, para que se puedan comprobar una
 * a una. El servidor las usa para escribir los `lp_event`; la pantalla las usa
 * para enseñar el resultado antes de guardarlo. Ninguno de los dos improvisa.
 *
 * **El LP no es un contador.** Cada cambio es un evento con su delta, y el
 * total sale de sumarlos (A3). Deshacer una partida marca sus eventos como
 * revertidos y vuelve a sumar: nunca se resta a mano sobre un número guardado.
 */

/** Todo el mundo empieza el periodo con 100. */
export const LP_INICIAL = 100

export const LP_DELTA: Record<LpEventType, number> = {
  WIN: 15,
  LOSS: -15,
  MVP: 5,
  ACE: 10,
  OFF_ROLE: 2,
  /** Cuenta como dos derrotas, de ahí el doble castigo. */
  DOUBLE_LOSS: -30,
  /** Corrección a mano del host: el delta lo pone él y exige nota. */
  MANUAL: 0,
}

export const LP_LABEL: Record<LpEventType, string> = {
  WIN: 'Victoria',
  LOSS: 'Derrota',
  MVP: 'MVP',
  ACE: 'ACE',
  OFF_ROLE: 'Off role',
  DOUBLE_LOSS: 'Doble derrota',
  MANUAL: 'Ajuste del host',
}

/** Un jugador tal y como quedó congelado al iniciar la partida. */
export interface JugadorDePartida {
  participationId: string
  displayName: string
  teamNumber: 1 | 2
  role: PlayerRoleDb
  isOffRole: boolean
}

/** Lo que el host decide al cerrar la partida. */
export interface CierreDePartida {
  /** Equipo ganador. `null` anula la partida: no reparte nada. */
  winnerTeam: 1 | 2 | null
  mvp: string | null
  ace: string | null
  /** Quienes se llevan doble derrota, ganase su equipo o no (Blue Shell, §16). */
  doubleLosses: string[]
}

export interface EventoLp {
  participationId: string
  type: LpEventType
  delta: number
}

/**
 * El resultado individual de cada jugador.
 *
 * La doble derrota es individual y manda sobre el marcador: un jugador del
 * equipo ganador puede terminar con derrota (A4). Por eso el resultado real
 * vive en `match_player.result` y no se deduce del ganador.
 */
export function resultadoDe(
  jugador: JugadorDePartida,
  cierre: CierreDePartida,
): MatchResultDb {
  if (cierre.doubleLosses.includes(jugador.participationId)) return 'double_loss'
  return jugador.teamNumber === cierre.winnerTeam ? 'win' : 'loss'
}

/**
 * Todos los eventos de LP que genera cerrar una partida.
 *
 * Uno por concepto, no uno por jugador: quien gana siendo MVP y jugando fuera
 * de su rol deja tres eventos (+15, +5, +2). Así el historial dice *por qué*
 * subió, y deshacer uno solo es posible.
 */
export function eventosDeCierre(
  jugadores: JugadorDePartida[],
  cierre: CierreDePartida,
): EventoLp[] {
  if (cierre.winnerTeam === null) return []

  const eventos: EventoLp[] = []

  for (const j of jugadores) {
    const resultado = resultadoDe(j, cierre)
    const tipo: LpEventType =
      resultado === 'double_loss' ? 'DOUBLE_LOSS' : resultado === 'win' ? 'WIN' : 'LOSS'

    eventos.push({ participationId: j.participationId, type: tipo, delta: LP_DELTA[tipo] })

    if (j.isOffRole) {
      eventos.push({
        participationId: j.participationId,
        type: 'OFF_ROLE',
        delta: LP_DELTA.OFF_ROLE,
      })
    }
    if (cierre.mvp === j.participationId) {
      eventos.push({ participationId: j.participationId, type: 'MVP', delta: LP_DELTA.MVP })
    }
    if (cierre.ace === j.participationId) {
      eventos.push({ participationId: j.participationId, type: 'ACE', delta: LP_DELTA.ACE })
    }
  }

  return eventos
}

/** Lo que suma o resta la partida a un jugador concreto. Para enseñarlo antes de guardar. */
export function deltaDe(eventos: EventoLp[], participationId: string): number {
  return eventos
    .filter((e) => e.participationId === participationId)
    .reduce((t, e) => t + e.delta, 0)
}

/** `current_lp` según A3: el inicial más los deltas que siguen en pie. */
export function lpTotal(deltas: number[], inicial = LP_INICIAL): number {
  return deltas.reduce((t, d) => t + d, inicial)
}

/**
 * Las derrotas del roster.
 *
 * Una doble derrota cuenta por dos. Es la misma cuenta que hace la vista
 * `public_roster`, y se repite aquí para poder comprobarla sin base de datos.
 */
export function cuentaDerrotas(resultados: (MatchResultDb | null)[]): number {
  return resultados.reduce(
    (t, r) => t + (r === 'loss' ? 1 : r === 'double_loss' ? 2 : 0),
    0,
  )
}

/** Las victorias del roster: la doble derrota no resta victorias, solo no suma. */
export function cuentaVictorias(resultados: (MatchResultDb | null)[]): number {
  return resultados.filter((r) => r === 'win').length
}

/** Motivos por los que conviene avisar antes de cerrar. El host decide igualmente (§1). */
export interface AvisoDeCierre {
  code: 'mvp_perdedor' | 'sin_mvp' | 'equipo_incompleto'
  message: string
}

export function avisosDeCierre(
  jugadores: JugadorDePartida[],
  cierre: CierreDePartida,
): AvisoDeCierre[] {
  const avisos: AvisoDeCierre[] = []

  const mvp = jugadores.find((j) => j.participationId === cierre.mvp)
  if (mvp && cierre.winnerTeam !== null && mvp.teamNumber !== cierre.winnerTeam) {
    avisos.push({
      code: 'mvp_perdedor',
      message: `${mvp.displayName} es MVP pero su equipo perdió. ¿Seguro?`,
    })
  }

  if (!cierre.mvp) {
    avisos.push({ code: 'sin_mvp', message: 'No has marcado MVP en esta partida.' })
  }

  for (const n of [1, 2] as const) {
    const cuantos = jugadores.filter((j) => j.teamNumber === n).length
    if (cuantos < 5) {
      avisos.push({
        code: 'equipo_incompleto',
        message: `El Team ${n} jugó con ${cuantos} ${cuantos === 1 ? 'jugador' : 'jugadores'}.`,
      })
    }
  }

  return avisos
}
