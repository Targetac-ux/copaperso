-- ============================================================================
-- CopaPerso · pausar el cronómetro de verdad
--
-- Pausar solo marcaba la sesión como "no corriendo", pero dejaba intacta la
-- hora de fin. Como los segundos restantes se calculan desde esa hora, el
-- número seguía bajando en pantalla y el tiempo de la pausa se perdía.
--
-- Ahora al pausar se guarda aquí lo que quedaba y se borra la hora de fin, así
-- que timer_seconds vuelve a significar solo una cosa: la duración que escribió
-- el host, que es a lo que vuelve "Reiniciar".
-- ============================================================================

alter table session add column if not exists timer_remaining_seconds integer;

comment on column session.timer_remaining_seconds is
  'Segundos congelados al pausar. Null si el cronómetro corre o está a cero.';
