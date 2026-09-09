-- ============================================================================
-- CopaPerso · esquema base
-- Referencia: docs/02-modelo-de-datos.md
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "unaccent";

-- ---------------------------------------------------------------- enums ----
create type app_role          as enum ('host','moderator');
create type player_role       as enum ('TOP','JG','MID','ADC','SUP');
create type elo_tier          as enum ('IRON','BRONZE','SILVER','GOLD','PLATINUM','EMERALD','DIAMOND','MASTER','GRANDMASTER','CHALLENGER');
create type period_status     as enum ('draft','active','closed');
create type session_mode      as enum ('perso','tryhard','random','analisis','aram_afk');
create type session_status    as enum ('open','live','closed');
create type participant_state as enum ('bench','team','jail','graveyard','removed');
create type match_status      as enum ('draft','live','finished','void');
create type match_result      as enum ('win','loss','double_loss');
create type lp_event_type     as enum ('WIN','LOSS','MVP','ACE','OFF_ROLE','DOUBLE_LOSS','MANUAL');
create type match_event_type  as enum ('VICTORY','DEFEAT','MVP','ACE','OFF_ROLE','DOUBLE_LOSS','BLUE_SHELL');
create type account_kind      as enum ('player','supporter');
create type paid_with         as enum ('bits','sub_na','sub_latam');
create type state_kind        as enum ('jail','graveyard');
create type loan_status       as enum ('open','settled','forgiven');
create type restriction_kind  as enum ('no_role','no_team','custom');
create type extra_kind        as enum ('bonus','penalty','prize','condition');
create type note_scope        as enum ('session','participation','team');
create type tier_name         as enum ('D','C','B','A','S','S_PLUS');
create type blue_shell_outcome as enum ('NO_FLASH','DOUBLE_LOSS','RANDOM_CHAMPION','SPECIFIC_BUILD');

-- ------------------------------------------------------------ utilidades ----
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- Slug para el anti-duplicados (§4): sin acentos, sin símbolos, minúsculas.
create or replace function player_slug(name text) returns text
language sql immutable as $$
  select regexp_replace(lower(unaccent(coalesce(name,''))), '[^a-z0-9]', '', 'g');
$$;

-- ----------------------------------------------------------- app_user ----
-- El host y sus moderadores. Se enlaza con auth.users de Supabase.
create table app_user (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role         app_role not null default 'host',
  created_at   timestamptz not null default now()
);

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from app_user where user_id = auth.uid());
$$;

-- ------------------------------------------------------------- player ----
-- Perfil permanente. Solo existe para evitar duplicados (§4).
create table player (
  id            uuid primary key default gen_random_uuid(),
  display_name  text not null,
  slug          text not null generated always as (player_slug(display_name)) stored,
  photo_url     text,
  twitch_handle text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index player_slug_key on player(slug);
create trigger player_updated before update on player
  for each row execute function set_updated_at();

-- ------------------------------------------------------------- period ----
create table period (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,           -- "SEP-2026"
  starts_at  date not null,
  ends_at    date,
  status     period_status not null default 'active',
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------ participation ----
-- Participación de un jugador en UN PERIODO (no en una sesión): aquí vive el LP.
create table participation (
  id             uuid primary key default gen_random_uuid(),
  player_id      uuid not null references player(id) on delete cascade,
  period_id      uuid not null references period(id) on delete cascade,
  elo            elo_tier,
  roles          player_role[] not null default '{}',
  initial_lp     integer not null default 100,
  current_lp     integer not null default 100,   -- caché recalculable desde lp_event
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (player_id, period_id)
);
create index participation_period_idx on participation(period_id);
create trigger participation_updated before update on participation
  for each row execute function set_updated_at();

-- ------------------------------------------------------------ session ----
create table session (
  id         uuid primary key default gen_random_uuid(),
  period_id  uuid not null references period(id) on delete cascade,
  number     integer not null,
  mode       session_mode not null default 'perso',
  status     session_status not null default 'open',
  started_at timestamptz not null default now(),
  closed_at  timestamptz,
  unique (period_id, number)
);
create index session_period_idx on session(period_id);

-- ------------------------------------------- session_participant (banca) ----
create table session_participant (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references session(id) on delete cascade,
  participation_id uuid not null references participation(id) on delete cascade,
  state            participant_state not null default 'bench',
  joined_at        timestamptz not null default now(),
  unique (session_id, participation_id)
);
create index session_participant_session_idx on session_participant(session_id, state);

-- --------------------------------------------------------------- team ----
create table team (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references session(id) on delete cascade,
  team_number smallint not null check (team_number in (1,2)),
  name        text,
  unique (session_id, team_number)
);

create table team_member (
  id                     uuid primary key default gen_random_uuid(),
  team_id                uuid not null references team(id) on delete cascade,
  session_participant_id uuid not null references session_participant(id) on delete cascade,
  role                   player_role not null,
  is_off_role            boolean not null default false,
  created_at             timestamptz not null default now(),
  unique (team_id, session_participant_id)
);
create index team_member_team_idx on team_member(team_id);

-- -------------------------------------------------------------- match ----
create table match (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references session(id) on delete cascade,
  match_number   integer not null,
  status         match_status not null default 'draft',
  winner_team_id uuid references team(id),
  started_at     timestamptz,
  finished_at    timestamptz,
  created_at     timestamptz not null default now(),
  unique (session_id, match_number)
);

-- Snapshot congelado al iniciar la partida: es la fuente de verdad (§28).
create table match_player (
  id               uuid primary key default gen_random_uuid(),
  match_id         uuid not null references match(id) on delete cascade,
  participation_id uuid not null references participation(id) on delete cascade,
  team_number      smallint not null check (team_number in (1,2)),
  role             player_role not null,
  is_off_role      boolean not null default false,
  result           match_result,
  is_mvp           boolean not null default false,
  is_ace           boolean not null default false,
  unique (match_id, participation_id)
);
create index match_player_match_idx on match_player(match_id);

create table match_event (
  id              uuid primary key default gen_random_uuid(),
  match_id        uuid not null references match(id) on delete cascade,
  match_player_id uuid references match_player(id) on delete cascade,
  type            match_event_type not null,
  value           jsonb not null default '{}',
  created_at      timestamptz not null default now()
);

-- ----------------------------------------------------------- lp_event ----
-- Fuente de verdad del LP. current_lp = 100 + suma de deltas no revertidos.
create table lp_event (
  id               uuid primary key default gen_random_uuid(),
  participation_id uuid not null references participation(id) on delete cascade,
  match_id         uuid references match(id) on delete cascade,
  type             lp_event_type not null,
  delta            integer not null,
  note             text,
  reverted_at      timestamptz,
  created_by       uuid references app_user(user_id),
  created_at       timestamptz not null default now()
);
create index lp_event_participation_idx on lp_event(participation_id) where reverted_at is null;

create or replace function recalc_participation_lp(p_participation_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare total integer;
begin
  select coalesce(p.initial_lp,100) + coalesce(sum(e.delta),0) into total
  from participation p
  left join lp_event e on e.participation_id = p.id and e.reverted_at is null
  where p.id = p_participation_id
  group by p.initial_lp;

  update participation set current_lp = total where id = p_participation_id;
  return total;
end;
$$;

-- ---------------------------------------------------- action_catalog ----
-- Lista de precios de consulta. NO ejecuta nada (decisión del host).
create table action_catalog (
  id         uuid primary key default gen_random_uuid(),
  period_id  uuid not null references period(id) on delete cascade,
  code       text not null,
  label      text not null,
  cost_bits  integer not null,
  sort_order smallint not null default 0,
  active     boolean not null default true,
  unique (period_id, code)
);

-- Costos vigentes según §13 del plan.
create or replace function seed_action_catalog(p_period_id uuid)
returns void language sql as $$
  insert into action_catalog (period_id, code, label, cost_bits, sort_order) values
    (p_period_id,'SPOT_TAKEOVER',      'Cupo: entrar en lugar de alguien ya seleccionado', 200, 1),
    (p_period_id,'TEAM_CHANGE',        'Cambio de Team',                                   150, 2),
    (p_period_id,'BENCH_PULL',         'Sacar a alguien de la banca',                      200, 3),
    (p_period_id,'ROLE_CHANGE_REENTRY','Cambio de rol y reingreso',                        300, 4),
    (p_period_id,'GRAVEYARD_EXIT',     'Sacar del cementerio',                             300, 5),
    (p_period_id,'BLUE_SHELL',         'Blue Shell',                                       500, 6)
  on conflict (period_id, code) do nothing;
$$;

-- ------------------------------------------------------- reward_claim ----
-- Bitácora: registra lo reclamado. No mueve jugadores ni descuenta saldos.
create table reward_claim (
  id                          uuid primary key default gen_random_uuid(),
  session_id                  uuid not null references session(id) on delete cascade,
  action_code                 text not null,
  cost_bits                   integer not null,
  paid_with                   paid_with not null default 'bits',
  beneficiary_participation_id uuid references participation(id) on delete set null,
  payer_account_id            uuid,
  note                        text,
  created_by                  uuid references app_user(user_id),
  created_at                  timestamptz not null default now()
);
create index reward_claim_session_idx on reward_claim(session_id);

-- ------------------------------------------------ banco de bits/subs ----
create table ledger_account (
  id             uuid primary key default gen_random_uuid(),
  player_id      uuid references player(id) on delete set null,
  display_name   text not null,
  kind           account_kind not null default 'player',
  balance_bits   integer not null default 0,
  balance_subs   integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index ledger_account_player_key on ledger_account(player_id) where player_id is not null;
create trigger ledger_account_updated before update on ledger_account
  for each row execute function set_updated_at();

alter table reward_claim
  add constraint reward_claim_payer_fk foreign key (payer_account_id)
  references ledger_account(id) on delete set null;

create table ledger_entry (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references ledger_account(id) on delete cascade,
  delta_bits  integer not null default 0,
  delta_subs  integer not null default 0,
  reason      text not null,
  session_id  uuid references session(id) on delete set null,
  created_by  uuid references app_user(user_id),
  created_at  timestamptz not null default now()
);
create index ledger_entry_account_idx on ledger_entry(account_id, created_at desc);

-- ------------------------------------------ cárcel / cementerio / etc ----
create table state_record (
  id                     uuid primary key default gen_random_uuid(),
  session_participant_id uuid not null references session_participant(id) on delete cascade,
  kind                   state_kind not null,
  reason                 text,
  entered_at             timestamptz not null default now(),
  released_at            timestamptz
);

create table restriction (
  id               uuid primary key default gen_random_uuid(),
  participation_id uuid not null references participation(id) on delete cascade,
  kind             restriction_kind not null,
  value            text,
  note             text,
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);

-- Interés lineal del 10 % diario sobre el monto original.
create table loan (
  id             uuid primary key default gen_random_uuid(),
  person_name    text not null,
  player_id      uuid references player(id) on delete set null,
  principal_bits integer not null check (principal_bits > 0),
  daily_rate     numeric(4,2) not null default 0.10,
  lent_at        date not null default current_date,
  status         loan_status not null default 'open',
  settled_at     date,
  settled_amount integer,
  note           text,
  created_at     timestamptz not null default now()
);

create or replace function loan_amount_due(p_loan loan, p_on date default current_date)
returns integer language sql immutable as $$
  select (p_loan.principal_bits
        + p_loan.principal_bits * p_loan.daily_rate
        * greatest(0, (coalesce(p_loan.settled_at, p_on) - p_loan.lent_at)))::integer;
$$;

create table note (
  id         uuid primary key default gen_random_uuid(),
  scope      note_scope not null,
  ref_id     uuid not null,
  body       text not null,
  created_by uuid references app_user(user_id),
  created_at timestamptz not null default now()
);

create table extra (
  id         uuid primary key default gen_random_uuid(),
  scope      note_scope not null,
  ref_id     uuid not null,
  kind       extra_kind not null,
  body       text not null,
  created_at timestamptz not null default now()
);

create table blue_shell_result (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references session(id) on delete cascade,
  match_id         uuid references match(id) on delete set null,
  participation_id uuid not null references participation(id) on delete cascade,
  outcome          blue_shell_outcome not null,
  spun_at          timestamptz not null default now(),
  created_by       uuid references app_user(user_id)
);

-- --------------------------------------------------------- action_log ----
-- Cada mutación deja una entrada con su payload inverso: eso permite deshacer.
create table action_log (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid references session(id) on delete cascade,
  actor           uuid references app_user(user_id),
  action_type     text not null,
  summary         text not null,
  payload         jsonb not null default '{}',
  inverse_payload jsonb,
  reversible      boolean not null default true,
  undone_at       timestamptz,
  created_at      timestamptz not null default now()
);
create index action_log_session_idx on action_log(session_id, created_at desc);

-- ---------------------------------------------------------- tier list ----
create table tier_list (
  id           uuid primary key default gen_random_uuid(),
  period_id    uuid references period(id) on delete set null,
  title        text,
  published_at timestamptz,
  is_current   boolean not null default false,
  created_at   timestamptz not null default now()
);
create unique index tier_list_current_key on tier_list(is_current) where is_current;

create table tier_entry (
  id           uuid primary key default gen_random_uuid(),
  tier_list_id uuid not null references tier_list(id) on delete cascade,
  player_id    uuid not null references player(id) on delete cascade,
  tier         tier_name not null,
  points       integer,
  main_role    player_role,
  elo          elo_tier,
  rank_order   smallint not null default 0,
  unique (tier_list_id, player_id)
);
