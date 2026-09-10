import type { PlayerRoleDb } from './types/database.types'

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
  code: 'duplicate_role' | 'off_role' | 'not_available'
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
