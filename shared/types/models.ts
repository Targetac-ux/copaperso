/**
 * Los tipos de datos vienen del esquema (database.types.d.ts); aquí solo
 * viven las listas y etiquetas que usa la interfaz.
 */
import type { PlayerRoleDb, EloTierDb, AppRole, SessionMode } from './database.types'

export type PlayerRole = PlayerRoleDb
export type EloTier = EloTierDb

export interface AppUser {
  user_id: string
  display_name: string
  role: AppRole
}

export interface Player {
  id: string
  display_name: string
  slug: string
  photo_url: string | null
  twitch_handle: string | null
  created_at: string
}

export const PLAYER_ROLES: PlayerRole[] = ['TOP', 'JG', 'MID', 'ADC', 'SUP']

/**
 * Los modos de la copa, en el orden en que se ofrecen. Estaban copiados en el
 * CCTM, en Periodos y en la vista pública; a la tercera copia se movieron aquí.
 */
export const SESSION_MODES: { value: SessionMode; label: string }[] = [
  { value: 'perso', label: 'Copa Perso' },
  { value: 'tryhard', label: 'Copa Tryhard' },
  { value: 'random', label: 'Copa Random' },
  { value: 'analisis', label: 'Copa Análisis' },
  { value: 'aram_afk', label: 'Copa ARAM AFK' },
]

export const MODE_LABEL: Record<SessionMode, string> = Object.fromEntries(
  SESSION_MODES.map((m) => [m.value, m.label]),
) as Record<SessionMode, string>

export const ELO_TIERS: EloTier[] = [
  'IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM',
  'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER', 'DEMON',
]

/**
 * Demon no es un rango de Riot: lo pone el host a quien ha llegado a rank 1 o
 * es demasiado bueno, y obliga a repartirlos 1:1 entre los dos equipos.
 */
export const DEMON: EloTier = 'DEMON'

/** Etiquetas cortas para la interfaz del host. */
export const ELO_LABEL: Record<EloTier, string> = {
  IRON: 'Hierro',
  BRONZE: 'Bronce',
  SILVER: 'Plata',
  GOLD: 'Oro',
  PLATINUM: 'Platino',
  EMERALD: 'Esmeralda',
  DIAMOND: 'Diamante',
  MASTER: 'Master',
  GRANDMASTER: 'Grandmaster',
  CHALLENGER: 'Challenger',
  DEMON: 'Demon',
}
