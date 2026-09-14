import type { PlayerRoleDb, EloTierDb } from './types/database.types'

/**
 * Reglas del draft (§9, §10, §11).
 *
 * Lógica pura, sin base de datos: se puede probar a fondo y el servidor la usa
 * antes de escribir nada. La idea de fondo es la del plan (§1): el host manda.
 * Casi todo son AVISOS, no prohibiciones. Solo se bloquea lo que dejaría la
 * sesión en un estado imposible de arreglar.
 */

export const ROLES: PlayerRoleDb[] = ['TOP', 'JG', 'MID', 'ADC', 'SUP']
export const TEAM_SIZE = 5

export interface DraftMember {
  sessionParticipantId: string
  participationId: string
  displayName: string
  role: PlayerRoleDb
  isOffRole: boolean
}

export interface DraftTeam {
  teamNumber: 1 | 2
  members: DraftMember[]
}

export interface BenchPlayer {
  sessionParticipantId: string
  participationId: string
  displayName: string
  roles: PlayerRoleDb[]
  elo: EloTierDb | null
  state: 'bench' | 'team' | 'jail' | 'graveyard' | 'removed'
}

export interface DraftState {
  bench: BenchPlayer[]
  teams: [DraftTeam, DraftTeam]
}

/** Algo que impide la acción. */
export interface DraftError {
  code: 'not_in_session' | 'team_full' | 'slot_taken' | 'same_player' | 'not_on_team'
  message: string
}

/** Algo raro que el host puede querer de todas formas. */
export interface DraftWarning {
  code: 'duplicate_role' | 'off_role' | 'not_available' | 'demon_balance'
  message: string
}

export interface DraftCheck {
  errors: DraftError[]
  warnings: DraftWarning[]
}

const teamOf = (state: DraftState, n: 1 | 2) => state.teams.find((t) => t.teamNumber === n)!

/** Roles sin cubrir en un equipo. */
export function emptyRoles(team: DraftTeam): PlayerRoleDb[] {
  const taken = new Set(team.members.map((m) => m.role))
  return ROLES.filter((r) => !taken.has(r))
}

/** Dónde está ahora mismo un participante, si es que está en algún equipo. */
export function findMember(
  state: DraftState,
  sessionParticipantId: string,
): { team: DraftTeam; member: DraftMember } | null {
  for (const team of state.teams) {
    const member = team.members.find((m) => m.sessionParticipantId === sessionParticipantId)
    if (member) return { team, member }
  }
  return null
}

/**
 * Balance de Demons (§ añadido en septiembre de 2026).
 *
 * El elo Demon lo pone el host a quien ha llegado a rank 1 o es demasiado
 * bueno, y la regla del torneo es repartirlos **1:1** entre los dos equipos.
 *
 * Durante el draft se pasa por estados desbalanceados sin remedio: el primer
 * Demon que se asigna deja un 1-0 hasta que llega su pareja. Por eso no se
 * mira si están igualados, sino **cuánto se separan**: dos de diferencia ya no
 * es un paso intermedio, es un desequilibrio.
 */
export function isDemon(elo: EloTierDb | null | undefined): boolean {
  return elo === 'DEMON'
}

/** Cuántos Demon tiene un equipo ahora mismo. */
export function demonCount(state: DraftState, teamNumber: 1 | 2): number {
  const team = state.teams.find((t) => t.teamNumber === teamNumber)
  if (!team) return 0
  return team.members.filter((m) => {
    const jugador = state.bench.find((b) => b.sessionParticipantId === m.sessionParticipantId)
    return isDemon(jugador?.elo)
  }).length
}

export interface DemonBalance {
  t1: number
  t2: number
  diff: number
  /** Si hay algún Demon en la sesión; si no, el recuento no se enseña. */
  any: boolean
}

export function demonBalance(state: DraftState): DemonBalance {
  const t1 = demonCount(state, 1)
  const t2 = demonCount(state, 2)
  const enBanca = state.bench.some((b) => isDemon(b.elo))
  return { t1, t2, diff: Math.abs(t1 - t2), any: t1 + t2 > 0 || enBanca }
}

/** Cuánto se separarían los equipos si se asigna a alguien a `teamNumber`. */
function demonDiffTrasAsignar(
  state: DraftState,
  sessionParticipantId: string,
  teamNumber: 1 | 2,
): { diff: number; destino: number; otro: number } {
  const jugador = state.bench.find((b) => b.sessionParticipantId === sessionParticipantId)
  const actual = findMember(state, sessionParticipantId)

  let t1 = demonCount(state, 1)
  let t2 = demonCount(state, 2)

  if (isDemon(jugador?.elo)) {
    // Si ya estaba en un equipo, primero sale de ahí.
    if (actual?.team.teamNumber === 1) t1--
    if (actual?.team.teamNumber === 2) t2--
    if (teamNumber === 1) t1++
    else t2++
  }

  return {
    diff: Math.abs(t1 - t2),
    destino: teamNumber === 1 ? t1 : t2,
    otro: teamNumber === 1 ? t2 : t1,
  }
}

/**
 * Comprueba si se puede asignar a alguien a un equipo y rol.
 *
 * Mover a alguien que ya está en un equipo es válido: es un cambio de equipo o
 * de rol, no un duplicado.
 */
export function checkAssignment(
  state: DraftState,
  sessionParticipantId: string,
  teamNumber: 1 | 2,
  role: PlayerRoleDb,
): DraftCheck {
  const errors: DraftError[] = []
  const warnings: DraftWarning[] = []

  const bench = state.bench.find((p) => p.sessionParticipantId === sessionParticipantId)
  const current = findMember(state, sessionParticipantId)

  if (!bench && !current) {
    errors.push({ code: 'not_in_session', message: 'Ese jugador no está en la sesión.' })
    return { errors, warnings }
  }

  if (bench && bench.state !== 'bench' && !current) {
    const donde = bench.state === 'jail' ? 'la cárcel' : bench.state === 'graveyard' ? 'el cementerio' : 'fuera de la sesión'
    warnings.push({ code: 'not_available', message: `Está en ${donde}: sacarlo de ahí lo mete al equipo igual.` })
  }

  const target = teamOf(state, teamNumber)
  const yaEstaAqui = current?.team.teamNumber === teamNumber

  if (!yaEstaAqui && target.members.length >= TEAM_SIZE) {
    errors.push({ code: 'team_full', message: `El Team ${teamNumber} ya tiene ${TEAM_SIZE} jugadores.` })
  }

  const ocupando = target.members.filter(
    (m) => m.role === role && m.sessionParticipantId !== sessionParticipantId,
  )
  if (ocupando.length) {
    warnings.push({
      code: 'duplicate_role',
      message: `${ocupando[0]!.displayName} ya juega ${role} en el Team ${teamNumber}.`,
    })
  }

  const roles = bench?.roles ?? []
  if (roles.length && !roles.includes(role)) {
    warnings.push({ code: 'off_role', message: `${role} no es rol suyo: cuenta como off-role.` })
  }

  // Los Demon van 1:1. Un 1-0 es un paso normal del draft; dos de diferencia no.
  const demons = demonDiffTrasAsignar(state, sessionParticipantId, teamNumber)
  if (demons.diff >= 2) {
    const otroEquipo = teamNumber === 1 ? 2 : 1
    warnings.push({
      code: 'demon_balance',
      message:
        `El Team ${teamNumber} tendría ${demons.destino} Demon y el Team ${otroEquipo} ` +
        `${demons.otro === 0 ? 'ninguno' : demons.otro}. Deberían ir 1:1.`,
    })
  }

  return { errors, warnings }
}

/** ¿Es off-role para este jugador? Vale +2 LP al terminar la partida (§23). */
export function isOffRole(roles: PlayerRoleDb[], role: PlayerRoleDb): boolean {
  return roles.length > 0 && !roles.includes(role)
}

/**
 * Comprueba un swap (§11): dos jugadores intercambian equipo **conservando su
 * rol**. Los roles no se tocan; eso lo decide el host después.
 */
export function checkSwap(state: DraftState, aId: string, bId: string): DraftCheck {
  const errors: DraftError[] = []

  if (aId === bId) {
    errors.push({ code: 'same_player', message: 'Hay que elegir dos jugadores distintos.' })
    return { errors, warnings: [] }
  }

  const a = findMember(state, aId)
  const b = findMember(state, bId)

  if (!a) errors.push({ code: 'not_on_team', message: 'El primer jugador no está en ningún equipo.' })
  if (!b) errors.push({ code: 'not_on_team', message: 'El segundo jugador no está en ningún equipo.' })
  if (errors.length) return { errors, warnings: [] }

  const warnings: DraftWarning[] = []
  if (a!.team.teamNumber === b!.team.teamNumber) {
    warnings.push({
      code: 'duplicate_role',
      message: 'Están en el mismo equipo: el swap solo les cambia el rol entre ellos.',
    })
  }

  return { errors, warnings }
}

/**
 * Sortea un jugador de la banca (§9).
 *
 * Solo entran los que están disponibles: quien está en la cárcel, en el
 * cementerio, fuera de la sesión o ya en un equipo no puede salir sorteado.
 */
export function pickRandomFromBench(
  bench: BenchPlayer[],
  rng: () => number = Math.random,
): BenchPlayer | null {
  const disponibles = bench.filter((p) => p.state === 'bench')
  if (!disponibles.length) return null
  const i = Math.floor(rng() * disponibles.length)
  return disponibles[Math.min(i, disponibles.length - 1)] ?? null
}

/** Cuántos huecos quedan por cubrir en toda la sesión. */
export function remainingSlots(state: DraftState): number {
  return state.teams.reduce((total, t) => total + (TEAM_SIZE - t.members.length), 0)
}
