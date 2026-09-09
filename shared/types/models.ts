/**
 * Los tipos de datos vienen del esquema (database.types.d.ts); aquí solo
 * viven las listas y etiquetas que usa la interfaz.
 */
import type { PlayerRoleDb, EloTierDb, AppRole } from './database.types'

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

export const ELO_TIERS: EloTier[] = [
  'IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM',
  'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER',
]

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
}
