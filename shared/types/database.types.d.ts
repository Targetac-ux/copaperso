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
  | 'EMERALD' | 'DIAMOND' | 'MASTER' | 'GRANDMASTER' | 'CHALLENGER' | 'DEMON'
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
  prices_tripled: boolean
  tripled_at: string | null
  timer_ends_at: string | null
  timer_seconds: number
  timer_running: boolean
  timer_remaining_seconds: number | null
}

export type PaidWithDb = 'bits' | 'sub_na' | 'sub_latam'
export type AccountKind = 'player' | 'supporter'
export type LoanStatus = 'open' | 'settled' | 'forgiven'
export type RestrictionKind = 'no_role' | 'no_team' | 'custom'
export type NoteScope = 'session' | 'participation' | 'team'
export type ExtraKind = 'bonus' | 'penalty' | 'prize' | 'condition'

type ActionCatalogRow = {
  id: string
  period_id: string
  code: string
  label: string
  cost_bits: number
  sort_order: number
  active: boolean
}

type RewardClaimRow = {
  id: string
  session_id: string
  action_code: string
  cost_bits: number
  paid_with: PaidWithDb
  tripled: boolean
  beneficiary_participation_id: string | null
  payer_account_id: string | null
  note: string | null
  created_by: string | null
  created_at: string
}

type LedgerAccountRow = {
  id: string
  player_id: string | null
  display_name: string
  kind: AccountKind
  balance_bits: number
  balance_subs: number
  created_at: string
  updated_at: string
}

type LedgerEntryRow = {
  id: string
  account_id: string
  delta_bits: number
  delta_subs: number
  reason: string
  session_id: string | null
  created_by: string | null
  created_at: string
}

type LoanRow = {
  id: string
  person_name: string
  player_id: string | null
  principal_bits: number
  daily_rate: number
  lent_at: string
  status: LoanStatus
  settled_at: string | null
  settled_amount: number | null
  note: string | null
  created_at: string
}

type RestrictionRow = {
  id: string
  participation_id: string
  kind: RestrictionKind
  value: string | null
  note: string | null
  active: boolean
  created_at: string
}

type ExtraRow = {
  id: string
  scope: NoteScope
  ref_id: string
  kind: ExtraKind
  body: string
  created_at: string
}

type NoteRow = {
  id: string
  scope: NoteScope
  ref_id: string
  body: string
  created_by: string | null
  created_at: string
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

export type TierName = 'D' | 'C' | 'B' | 'A' | 'S' | 'S_PLUS'

type TierListRow = {
  id: string
  period_id: string | null
  title: string | null
  published_at: string | null
  is_current: boolean
  created_at: string
}

type TierEntryRow = {
  id: string
  tier_list_id: string
  player_id: string
  tier: TierName
  points: number | null
  main_role: PlayerRoleDb | null
  elo: EloTierDb | null
  rank_order: number
}

type ClipRow = {
  id: string
  slug: string
  title: string
  edition: string | null
  sort_order: number
  visible: boolean
  created_at: string
}

export type MatchStatus = 'draft' | 'live' | 'finished' | 'void'
export type MatchResultDb = 'win' | 'loss' | 'double_loss'
export type LpEventType = 'WIN' | 'LOSS' | 'MVP' | 'ACE' | 'OFF_ROLE' | 'DOUBLE_LOSS' | 'MANUAL'
export type MatchEventType =
  | 'VICTORY' | 'DEFEAT' | 'MVP' | 'ACE' | 'OFF_ROLE' | 'DOUBLE_LOSS' | 'BLUE_SHELL'
export type BlueShellOutcomeDb =
  | 'NO_FLASH' | 'DOUBLE_LOSS' | 'RANDOM_CHAMPION' | 'SPECIFIC_BUILD'

type MatchRow = {
  id: string
  session_id: string
  match_number: number
  status: MatchStatus
  winner_team_id: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string
}

type MatchPlayerRow = {
  id: string
  match_id: string
  participation_id: string
  team_number: number
  role: PlayerRoleDb
  is_off_role: boolean
  result: MatchResultDb | null
  is_mvp: boolean
  is_ace: boolean
}

type MatchEventRow = {
  id: string
  match_id: string
  match_player_id: string | null
  type: MatchEventType
  value: Record<string, unknown>
  created_at: string
}

type LpEventRow = {
  id: string
  participation_id: string
  match_id: string | null
  type: LpEventType
  delta: number
  note: string | null
  reverted_at: string | null
  created_by: string | null
  created_at: string
}

type BlueShellResultRow = {
  id: string
  session_id: string
  match_id: string | null
  participation_id: string
  outcome: BlueShellOutcomeDb
  spun_at: string
  created_by: string | null
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
        Update: {
          mode?: SessionMode
          status?: SessionStatus
          closed_at?: string | null
          prices_tripled?: boolean
          tripled_at?: string | null
          timer_ends_at?: string | null
          timer_seconds?: number
          timer_running?: boolean
          timer_remaining_seconds?: number | null
        }
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
      tier_list: {
        Row: TierListRow
        Insert: {
          id?: string
          period_id?: string | null
          title?: string | null
          published_at?: string | null
          is_current?: boolean
        }
        Update: {
          title?: string | null
          published_at?: string | null
          is_current?: boolean
        }
        Relationships: []
      }
      tier_entry: {
        Row: TierEntryRow
        Insert: {
          id?: string
          tier_list_id: string
          player_id: string
          tier: TierName
          points?: number | null
          main_role?: PlayerRoleDb | null
          elo?: EloTierDb | null
          rank_order?: number
        }
        Update: {
          tier?: TierName
          points?: number | null
          main_role?: PlayerRoleDb | null
          elo?: EloTierDb | null
          rank_order?: number
        }
        Relationships: []
      }
      clip: {
        Row: ClipRow
        Insert: {
          id?: string
          slug: string
          title: string
          edition?: string | null
          sort_order?: number
          visible?: boolean
        }
        Update: {
          title?: string
          edition?: string | null
          sort_order?: number
          visible?: boolean
        }
        Relationships: []
      }
      match: {
        Row: MatchRow
        Insert: {
          id?: string
          session_id: string
          match_number: number
          status?: MatchStatus
          winner_team_id?: string | null
          started_at?: string | null
          finished_at?: string | null
        }
        Update: {
          status?: MatchStatus
          winner_team_id?: string | null
          started_at?: string | null
          finished_at?: string | null
        }
        Relationships: []
      }
      match_player: {
        Row: MatchPlayerRow
        Insert: {
          id?: string
          match_id: string
          participation_id: string
          team_number: number
          role: PlayerRoleDb
          is_off_role?: boolean
          result?: MatchResultDb | null
          is_mvp?: boolean
          is_ace?: boolean
        }
        Update: {
          result?: MatchResultDb | null
          is_mvp?: boolean
          is_ace?: boolean
        }
        Relationships: []
      }
      match_event: {
        Row: MatchEventRow
        Insert: {
          id?: string
          match_id: string
          match_player_id?: string | null
          type: MatchEventType
          value?: Record<string, unknown>
        }
        Update: { value?: Record<string, unknown> }
        Relationships: []
      }
      lp_event: {
        Row: LpEventRow
        Insert: {
          id?: string
          participation_id: string
          match_id?: string | null
          type: LpEventType
          delta: number
          note?: string | null
          reverted_at?: string | null
          created_by?: string | null
        }
        Update: { reverted_at?: string | null; note?: string | null }
        Relationships: []
      }
      blue_shell_result: {
        Row: BlueShellResultRow
        Insert: {
          id?: string
          session_id: string
          match_id?: string | null
          participation_id: string
          outcome: BlueShellOutcomeDb
          spun_at?: string
          created_by?: string | null
        }
        Update: { outcome?: BlueShellOutcomeDb }
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
      action_catalog: {
        Row: ActionCatalogRow
        Insert: {
          id?: string
          period_id: string
          code: string
          label: string
          cost_bits: number
          sort_order?: number
          active?: boolean
        }
        Update: { label?: string; cost_bits?: number; active?: boolean; sort_order?: number }
        Relationships: []
      }
      reward_claim: {
        Row: RewardClaimRow
        Insert: {
          id?: string
          session_id: string
          action_code: string
          cost_bits: number
          paid_with?: PaidWithDb
          tripled?: boolean
          beneficiary_participation_id?: string | null
          payer_account_id?: string | null
          note?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: { note?: string | null }
        Relationships: []
      }
      ledger_account: {
        Row: LedgerAccountRow
        Insert: {
          id?: string
          player_id?: string | null
          display_name: string
          kind?: AccountKind
          balance_bits?: number
          balance_subs?: number
        }
        Update: { display_name?: string; balance_bits?: number; balance_subs?: number }
        Relationships: []
      }
      ledger_entry: {
        Row: LedgerEntryRow
        Insert: {
          id?: string
          account_id: string
          delta_bits?: number
          delta_subs?: number
          reason: string
          session_id?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: { reason?: string }
        Relationships: []
      }
      loan: {
        Row: LoanRow
        Insert: {
          id?: string
          person_name: string
          player_id?: string | null
          principal_bits: number
          daily_rate?: number
          lent_at?: string
          status?: LoanStatus
          note?: string | null
        }
        Update: {
          status?: LoanStatus
          settled_at?: string | null
          settled_amount?: number | null
          note?: string | null
        }
        Relationships: []
      }
      restriction: {
        Row: RestrictionRow
        Insert: {
          id?: string
          participation_id: string
          kind: RestrictionKind
          value?: string | null
          note?: string | null
          active?: boolean
        }
        Update: { active?: boolean; note?: string | null; value?: string | null }
        Relationships: []
      }
      note: {
        Row: NoteRow
        Insert: {
          id?: string
          scope: NoteScope
          ref_id: string
          body: string
          created_by?: string | null
        }
        Update: { body?: string }
        Relationships: []
      }
      extra: {
        Row: ExtraRow
        Insert: {
          id?: string
          scope: NoteScope
          ref_id: string
          kind: ExtraKind
          body: string
        }
        Update: { body?: string; kind?: ExtraKind }
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
      public_clips: {
        Row: {
          slug: string
          title: string
          edition: string | null
          sort_order: number
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
