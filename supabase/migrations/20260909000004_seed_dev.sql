-- ============================================================================
-- CopaPerso · datos de arranque (solo desarrollo / staging)
-- Crea el periodo actual y siembra el catálogo de recompensas con los
-- costos de §13. En producción, el periodo lo crea el host desde el panel.
-- ============================================================================

do $$
declare p_id uuid;
begin
  insert into period (name, starts_at, status)
  values (upper(to_char(current_date,'MON-YYYY')), date_trunc('month', current_date), 'active')
  on conflict (name) do nothing
  returning id into p_id;

  if p_id is null then
    select id into p_id from period where name = upper(to_char(current_date,'MON-YYYY'));
  end if;

  perform seed_action_catalog(p_id);
end $$;
