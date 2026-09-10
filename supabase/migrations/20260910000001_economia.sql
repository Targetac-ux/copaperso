-- ============================================================================
-- CopaPerso · Fase 3B: timer de negociación y economía
--
-- El multiplicador de precios vive en la SESIÓN, no en el catálogo: el
-- catálogo es por periodo, así que triplicarlo dejaría los precios altos para
-- todas las sesiones siguientes y pisaría el histórico (docs/02, A7).
-- ============================================================================

-- El x3 es fijo y se aplica una sola vez, así que basta un sí/no. Un número
-- invitaría a estados que no existen (x6, x9) y a dudar si es acumulable.
alter table session add column if not exists prices_tripled boolean not null default false;
alter table session add column if not exists tripled_at     timestamptz;
alter table session add column if not exists timer_ends_at  timestamptz;
alter table session add column if not exists timer_seconds  integer not null default 900;
alter table session add column if not exists timer_running  boolean not null default false;

-- Para auditar meses después por qué alguien pagó 1500 por un Blue Shell.
alter table reward_claim add column if not exists tripled boolean not null default false;

-- Los préstamos ya tenían daily_rate; se documenta el valor acordado.
comment on column loan.daily_rate is
  '10 % del monto original por día, lineal: adeudo = principal + principal * 0.10 * días';

comment on column session.prices_tripled is
  'Una vez activado se mantiene toda la sesión. El precio mostrado es cost_bits * 3.';
