import type { PlayerRoleDb, EloTierDb } from './types/database.types'

/**
 * Interpreta la línea que el host teclea durante el stream (§4):
 *
 *   "Target Mid/Jg Challenger"  →  Target · MID, JG · CHALLENGER
 *
 * Se lee de derecha a izquierda: los roles y el elo van al final, así que en
 * cuanto aparece algo que no reconocemos, todo lo anterior es el nombre. Eso
 * permite nicks con espacios ("xX Player Xx TOP GM") sin obligar al host a
 * poner comas ni comillas mientras el chat le grita.
 *
 * Lo que no se reconoce se queda en el nombre, nunca se descarta: es preferible
 * que el host vea "Target FOO" y lo corrija a que el sistema tire información.
 */

export interface ParsedPlayerLine {
  name: string
  roles: PlayerRoleDb[]
  elo: EloTierDb | null
}

const ROLE_ALIASES: Record<string, PlayerRoleDb> = {
  top: 'TOP', toplane: 'TOP', superior: 'TOP',
  jg: 'JG', jgl: 'JG', jungle: 'JG', jungla: 'JG', jungler: 'JG', selva: 'JG',
  mid: 'MID', middle: 'MID', medio: 'MID', midlane: 'MID',
  adc: 'ADC', bot: 'ADC', bottom: 'ADC', botlane: 'ADC', tirador: 'ADC', ad: 'ADC',
  sup: 'SUP', supp: 'SUP', support: 'SUP', soporte: 'SUP', apoyo: 'SUP',
}

// Sin abreviaturas de una sola letra: "s" o "c" chocarían con demasiados nicks.
const ELO_ALIASES: Record<string, EloTierDb> = {
  iron: 'IRON', hierro: 'IRON',
  bronze: 'BRONZE', bronce: 'BRONZE',
  silver: 'SILVER', plata: 'SILVER',
  gold: 'GOLD', oro: 'GOLD',
  platinum: 'PLATINUM', platino: 'PLATINUM', plat: 'PLATINUM',
  emerald: 'EMERALD', esmeralda: 'EMERALD', eme: 'EMERALD',
  diamond: 'DIAMOND', diamante: 'DIAMOND', dia: 'DIAMOND',
  master: 'MASTER', maestro: 'MASTER',
  grandmaster: 'GRANDMASTER', granmaster: 'GRANDMASTER', gm: 'GRANDMASTER',
  challenger: 'CHALLENGER', challenguer: 'CHALLENGER', chall: 'CHALLENGER', challe: 'CHALLENGER',
  demon: 'DEMON', dem: 'DEMON', rank1: 'DEMON', demonio: 'DEMON',
}

/** Baja a minúsculas y quita acentos y símbolos, para comparar alias sin sorpresas. */
function fold(token: string): string {
  return token
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

interface Scan {
  roles: PlayerRoleDb[]
  elo: EloTierDb | null
  /** Índice del primer token que ya forma parte de los roles/elo. */
  cut: number
}

function scanFromEnd(tokens: string[]): Scan {
  const roles: PlayerRoleDb[] = []
  let elo: EloTierDb | null = null
  let cut = tokens.length

  for (let i = tokens.length - 1; i >= 0; i--) {
    const key = fold(tokens[i]!)
    if (!key) {
      cut = i
      continue
    }
    if (!elo && ELO_ALIASES[key]) {
      elo = ELO_ALIASES[key]
      cut = i
      continue
    }
    if (ROLE_ALIASES[key]) {
      const role = ROLE_ALIASES[key]!
      if (!roles.includes(role)) roles.unshift(role)
      cut = i
      continue
    }
    break
  }

  return { roles, elo, cut }
}

export function parsePlayerLine(input: string): ParsedPlayerLine | null {
  const clean = (input ?? '').replace(/\s+/g, ' ').trim()
  if (!clean) return null

  // "Mid/Jg" y "Mid, Jg" son una sola pieza para el host, pero dos tokens aquí.
  const tokens = clean
    .split(' ')
    .flatMap((t) => t.split(/[/,]/))
    .filter(Boolean)

  // Una línea que solo traía separadores ("/", ",") no nombra a nadie.
  if (!tokens.length) return null

  const scan = scanFromEnd(tokens)
  const cut = scan.cut
  let { roles, elo } = scan

  // Si todo se interpretó como rol o elo, es que el nick se llama como un rol
  // ("Mid MID", "Support SUP"). El primer token es el nombre y el resto, datos.
  if (cut === 0) {
    const rest = scanFromEnd(tokens.slice(1))
    roles = rest.roles
    elo = rest.elo
    return { name: tokens[0]!, roles, elo }
  }

  const name = tokens.slice(0, cut).join(' ').replace(/[\s,/]+$/, '').trim()
  if (!name) return null

  return { name, roles, elo }
}

/** Recompone la línea. Sirve para enseñarle al host lo que se entendió. */
export function formatPlayerLine(parsed: ParsedPlayerLine): string {
  return [parsed.name, parsed.roles.join('/'), parsed.elo ?? ''].filter(Boolean).join(' ')
}
