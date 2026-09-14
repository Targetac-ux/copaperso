-- ============================================================================
-- CopaPerso · elo "Demon"
--
-- Para quien ha llegado a rank 1 o es demasiado bueno. No es solo una etiqueta:
-- los Demon deben repartirse 1:1 entre los dos equipos, y el CCTM avisa cuando
-- una asignación deja dos de diferencia.
--
-- Va en su propia migración porque Postgres no deja usar un valor de enum
-- recién creado dentro de la misma transacción.
-- ============================================================================

alter type elo_tier add value if not exists 'DEMON' after 'CHALLENGER';
