-- ============================================================================
-- CopaPerso · seguridad
--
-- Modelo (§35 del plan):
--   anon           → nada directo. Solo las vistas públicas de más abajo.
--   authenticated  → si está en app_user: SELECT en todo. Nunca escribe.
--   service_role   → bypasea RLS. Es el único que escribe, desde server/api/*.
-- ============================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'app_user','player','period','participation','session','session_participant',
    'team','team_member','match','match_player','match_event','lp_event',
    'action_catalog','reward_claim','ledger_account','ledger_entry','state_record',
    'restriction','loan','note','extra','blue_shell_result','action_log',
    'tier_list','tier_entry'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on table %I from anon, authenticated', t);
    -- Lectura para el staff autenticado (el panel del host y su Realtime).
    execute format('grant select on table %I to authenticated', t);
    execute format($f$
      create policy "staff_read" on %I for select to authenticated using (is_staff())
    $f$, t);
  end loop;
end $$;

-- app_user también necesita leerse a sí mismo antes de que is_staff() resuelva.
drop policy "staff_read" on app_user;
create policy "self_read" on app_user for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Vistas públicas
--
-- Se crean con security_invoker OFF (el default): corren con los permisos del
-- creador y por eso atraviesan el RLS de las tablas base. Es intencional: son
-- la ÚNICA superficie que ve el público, y exponen solo columnas públicas.
-- Nunca añadir aquí bits, saldos, préstamos, cárcel, restricciones ni notas.
-- ---------------------------------------------------------------------------

create view public_tier_ranking as
select
  te.tier,
  te.rank_order,
  te.points,
  te.main_role,
  te.elo,
  p.display_name,
  p.photo_url,
  tl.title       as edition_title,
  tl.published_at
from tier_entry te
join tier_list tl on tl.id = te.tier_list_id
join player p     on p.id  = te.player_id
where tl.is_current and tl.published_at is not null;

create view public_roster as
select
  pe.name as period_name,
  pl.display_name,
  pl.photo_url,
  pa.current_lp,
  count(*) filter (where mp.result = 'win')                            as wins,
  count(*) filter (where mp.result = 'loss')
    + 2 * count(*) filter (where mp.result = 'double_loss')            as losses,
  count(*) filter (where mp.is_mvp)                                    as mvps,
  count(*) filter (where mp.is_ace)                                    as aces
from participation pa
join player pl on pl.id = pa.player_id
join period pe on pe.id = pa.period_id
left join match_player mp on mp.participation_id = pa.id
left join match m on m.id = mp.match_id and m.status = 'finished'
group by pe.name, pl.display_name, pl.photo_url, pa.current_lp;

create view public_session_live as
select
  s.id            as session_id,
  s.number,
  s.mode,
  s.status,
  t.team_number,
  tm.role,
  tm.is_off_role,
  pl.display_name,
  pl.photo_url
from session s
join team t              on t.session_id = s.id
left join team_member tm on tm.team_id = t.id
left join session_participant sp on sp.id = tm.session_participant_id
left join participation pa on pa.id = sp.participation_id
left join player pl on pl.id = pa.player_id
where s.status = 'live';

grant select on public_tier_ranking, public_roster, public_session_live to anon, authenticated;
