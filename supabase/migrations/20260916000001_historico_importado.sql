-- ============================================================================
-- CopaPerso · el histórico que viene de los Excel
--
-- Los ocho meses del CCPR Roster son **totales del mes**, no partidas. La base
-- cuenta victorias, derrotas, MVP y ACE desde `match_player`, así que traerlos
-- exigía elegir: o inventar partidas que cuadraran esos totales, o guardarlos
-- como lo que son.
--
-- Se guardan como lo que son. Inventar partidas habría metido en la base
-- equipos y rivales que nunca existieron —y encima no cuadran: en FEB hay 247
-- victorias contra 217 derrotas, que no se emparejan de ninguna manera—.
--
-- `null` no es `0`: significa «este mes no vino de un Excel». Por eso las
-- columnas son nullables y no llevan `default 0`; un mes contado por la
-- aplicación tiene que distinguirse de uno importado con todo a cero.
-- ============================================================================

alter table participation
  add column if not exists historic_wins      integer,
  add column if not exists historic_losses    integer,
  add column if not exists historic_mvps      integer,
  add column if not exists historic_aces      integer,
  add column if not exists historic_off_roles integer,
  add column if not exists imported_from      text;

comment on column participation.historic_wins is
  'Victorias del Excel. null = este mes lo contó la aplicación, no un Excel.';
comment on column participation.historic_losses is
  'Derrotas del Excel. La doble derrota ya venía contada por dos en la hoja.';
comment on column participation.imported_from is
  'De dónde salió la fila: "CCPR Roster · FEB-2026". null si nació en la aplicación.';

-- ------------------------------------------------------------------------
-- public_roster suma las dos fuentes.
--
-- Se recrea con `drop` + `create view`, y no con `create or replace view`,
-- porque `tests/unit/public-views.test.ts` busca literalmente
-- `create view <nombre> as` para leer el cuerpo vigente: con un
-- `create or replace` seguiría validando la definición vieja, que es
-- exactamente el descuido que ese test existe para cazar.
--
-- `max()` y no `sum()` sobre las columnas históricas: están en
-- `participation`, que el join con `match_player` multiplica por cada partida.
-- Sumarlas contaría el histórico tantas veces como partidas tenga el mes.
-- ------------------------------------------------------------------------
drop view if exists public_roster;

create view public_roster as
select
  pe.name as period_name,
  pl.display_name,
  pl.photo_url,
  pa.current_lp,
  count(*) filter (where mp.result = 'win')
    + coalesce(max(pa.historic_wins), 0)                                as wins,
  count(*) filter (where mp.result = 'loss')
    + 2 * count(*) filter (where mp.result = 'double_loss')
    + coalesce(max(pa.historic_losses), 0)                              as losses,
  count(*) filter (where mp.is_mvp)
    + coalesce(max(pa.historic_mvps), 0)                                as mvps,
  count(*) filter (where mp.is_ace)
    + coalesce(max(pa.historic_aces), 0)                                as aces
from participation pa
join player pl on pl.id = pa.player_id
join period pe on pe.id = pa.period_id
left join match_player mp on mp.participation_id = pa.id
left join match m on m.id = mp.match_id and m.status = 'finished'
group by pe.name, pl.display_name, pl.photo_url, pa.current_lp;

grant select on public_roster to anon, authenticated;
