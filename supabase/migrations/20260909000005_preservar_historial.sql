-- ============================================================================
-- CopaPerso · el historial sobrevive a quien lo escribió
--
-- Problema encontrado al probar la Fase 2: borrar a un moderador era imposible,
-- porque action_log.actor lo referenciaba y la base lo impedía. Y forzarlo
-- habría borrado el historial, que es justo lo que nunca se debe perder: es lo
-- que permite deshacer y auditar lo que pasó en una sesión.
--
-- Solución: al borrar a una persona, sus filas se quedan con el autor a NULL.
-- Las acciones siguen ahí, solo pierden el nombre de quien las hizo.
-- ============================================================================

alter table action_log        drop constraint if exists action_log_actor_fkey;
alter table action_log        add constraint action_log_actor_fkey
  foreign key (actor) references app_user(user_id) on delete set null;

alter table lp_event          drop constraint if exists lp_event_created_by_fkey;
alter table lp_event          add constraint lp_event_created_by_fkey
  foreign key (created_by) references app_user(user_id) on delete set null;

alter table reward_claim      drop constraint if exists reward_claim_created_by_fkey;
alter table reward_claim      add constraint reward_claim_created_by_fkey
  foreign key (created_by) references app_user(user_id) on delete set null;

alter table ledger_entry      drop constraint if exists ledger_entry_created_by_fkey;
alter table ledger_entry      add constraint ledger_entry_created_by_fkey
  foreign key (created_by) references app_user(user_id) on delete set null;

alter table note              drop constraint if exists note_created_by_fkey;
alter table note              add constraint note_created_by_fkey
  foreign key (created_by) references app_user(user_id) on delete set null;

alter table blue_shell_result drop constraint if exists blue_shell_result_created_by_fkey;
alter table blue_shell_result add constraint blue_shell_result_created_by_fkey
  foreign key (created_by) references app_user(user_id) on delete set null;
