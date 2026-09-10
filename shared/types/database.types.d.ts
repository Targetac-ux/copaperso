/**
 * Tipos de la base de datos.
 *
 * Escritos a mano para las tablas que usa la Fase 1. En cuanto exista el
 * proyecto de Supabase, este archivo se REGENERA COMPLETO con:
 *
 *   npm run db:types
 *
 * No lo edites a mano a partir de entonces.
 */

export type AppRole = 'host' | 'moderator'
export type PlayerRoleDb = 'TOP' | 'JG' | 'MID' | 'ADC' | 'SUP'
export type EloTierDb =
  | 'IRON' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM'
  | 'EMERALD' | 'DIAMOND' | 'MASTER' | 'GRANDMASTER' | 'CHALLENGER'
export type PeriodStatus = 'draft' | 'active' | 'closed'

type PlayerRow = {
  id: string
  display_name: string
  slug: string
  photo_url: string | null
  twitch_handle: string | null
  created_at: string
  updated_at: string
}

type AppUserRow = {
  user_id: string
  display_name: string
  role: AppRole
  created_at: string
}

type PeriodRow = {
  id: string
  name: string
  starts_at: string
  ends_at: string | null
  status: PeriodStatus
  created_at: string
}

type ParticipationRow = {
  id: string
  player_id: string
  period_id: string
  elo: EloTierDb | null
  roles: PlayerRoleDb[]
  initial_lp: number
  current_lp: number
  created_at: string
  updated_at: string
}

export type SessionMode = 'perso' | 'tryhard' | 'random' | 'analisis' | 'aram_afk'
export type SessionStatus = 'open' | 'live' | 'closed'
export type ParticipantState = 'bench' | 'team' | 'jail' | 'graveyard' | 'removed'

type SessionRow = {
  id: string
  period_id: string
  number: number
  mode: SessionMode
  status: SessionStatus
  started_at: string
  closed_at: string | null
}

type SessionParticipantRow = {
  id: string
  session_id: string
  participation_id: string
  state: ParticipantState
  joined_at: string
}

export type StateKind = 'jail' | 'graveyard'

type StateRecordRow = {
  id: string
  session_participant_id: string
  kind: StateKind
  reason: string | null
  entered_at: string
  released_at: string | null
}

type TeamMemberRow = {
  id: string
  team_id: string
  session_participant_id: string
  role: PlayerRoleDb
  is_off_role: boolean
  created_at: string
}

type TeamRow = {
  id: string
  session_id: string
  team_number: number
  name: string | null
}

type ActionLogRow = {
  id: string
  session_id: string | null
  actor: string | null
  action_type: string
  summary: string
  payload: Record<string, unknown>
  inverse_payload: Record<string, unknown> | null
  reversible: boolean
  undone_at: string | null
  created_at: string
}

export type Database = {
  public: {
    Tables: {
      player: {
        Row: PlayerRow
        Insert: {
          id?: string
          display_name: string
          photo_url?: string | null
          twitch_handle?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          display_name?: string
          photo_url?: string | null
          twitch_handle?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      app_user: {
        Row: AppUserRow
        Insert: { user_id: string; display_name: string; role?: AppRole; created_at?: string }
        Update: { display_name?: string; role?: AppRole }
        Relationships: []
      }
      period: {
        Row: PeriodRow
        Insert: {
          id?: string
          name: string
          starts_at: string
          ends_at?: string | null
          status?: PeriodStatus
          created_at?: string
        }
        Update: {
          name?: string
          starts_at?: string
          ends_at?: string | null
          status?: PeriodStatus
        }
        Relationships: []
      }
      participation: {
        Row: ParticipationRow
        Insert: {
          id?: string
          player_id: string
          period_id: string
          elo?: EloTierDb | null
          roles?: PlayerRoleDb[]
          initial_lp?: number
          current_lp?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          elo?: EloTierDb | null
          roles?: PlayerRoleDb[]
          initial_lp?: number
          current_lp?: number
          updated_at?: string
        }
        Relationships: []
      }
      session: {
        Row: SessionRow
        Insert: {
          id?: string
          period_id: string
          number: number
          mode?: SessionMode
          status?: SessionStatus
          started_at?: string
          closed_at?: string | null
        }
        Update: { mode?: SessionMode; status?: SessionStatus; closed_at?: string | null }
        Relationships: []
      }
      session_participant: {
        Row: SessionParticipantRow
        Insert: {
          id?: string
          session_id: string
          participation_id: string
          state?: ParticipantState
          joined_at?: string
        }
        Update: { state?: ParticipantState }
        Relationships: []
      }
      team: {
        Row: TeamRow
        Insert: { id?: string; session_id: string; team_number: number; name?: string | null }
        Update: { name?: string | null }
        Relationships: []
      }
      team_member: {
        Row: TeamMemberRow
        Insert: {
          id?: string
          team_id: string
          session_participant_id: string
          role: PlayerRoleDb
          is_off_role?: boolean
          created_at?: string
        }
        Update: { team_id?: string; role?: PlayerRoleDb; is_off_role?: boolean }
        Relationships: []
      }
      state_record: {
        Row: StateRecordRow
        Insert: {
          id?: string
          session_participant_id: string
          kind: StateKind
          reason?: string | null
          entered_at?: string
          released_at?: string | null
        }
        Update: { released_at?: string | null; reason?: string | null }
        Relationships: []
      }
      action_log: {
        Row: ActionLogRow
        Insert: {
          id?: string
          session_id?: string | null
          actor?: string | null
          action_type: string
          summary: string
          payload?: Record<string, unknown>
          inverse_payload?: Record<string, unknown> | null
          reversible?: boolean
          undone_at?: string | null
          created_at?: string
        }
        Update: { undone_at?: string | null }
        Relationships: []
      }
    }
    Views: {
      public_tier_ranking: {
        Row: {
          tier: 'D' | 'C' | 'B' | 'A' | 'S' | 'S_PLUS'
          rank_order: number
          points: number | null
          main_role: PlayerRoleDb | null
          elo: EloTierDb | null
          display_name: string
          photo_url: string | null
          edition_title: string | null
          published_at: string | null
        }
        Relationships: []
      }
      public_roster: {
        Row: {
          period_name: string
          display_name: string
          photo_url: string | null
          current_lp: number
          wins: number
          losses: number
          mvps: number
          aces: number
        }
        Relationships: []
      }
      public_session_live: {
        Row: {
          session_id: string
          number: number
          mode: string
          status: string
          team_number: number
          role: PlayerRoleDb | null
          is_off_role: boolean | null
          display_name: string | null
          photo_url: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      recalc_participation_lp: { Args: { p_participation_id: string }; Returns: number }
      seed_action_catalog: { Args: { p_period_id: string }; Returns: undefined }
      is_staff: { Args: Record<string, never>; Returns: boolean }
    }
    Enums: {
      app_role: AppRole
      player_role: PlayerRoleDb
      elo_tier: EloTierDb
      period_status: PeriodStatus
      session_mode: SessionMode
      session_status: SessionStatus
      participant_state: ParticipantState
    }
    CompositeTypes: Record<string, never>
  }
}
