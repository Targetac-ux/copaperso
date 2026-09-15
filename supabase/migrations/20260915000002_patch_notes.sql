-- ============================================================================
-- CopaPerso · Fase 7: patch notes de las reglas
--
-- Las reglas cambian cada cierto tiempo. Reescribir la página en silencio deja
-- a la gente sin saber qué cambió, así que cada tanda se publica con su fecha,
-- como las notas de parche de un juego.
--
-- El cuerpo es texto suelto, una línea por cambio: las que empiezan por «+ » o
-- «- » se pintan como algo que entra o que sale. La convención de los
-- changelogs de siempre, sin obligar al host a aprender ningún formato.
--
-- Se guarda **sin publicar** hasta que el host pulsa publicar: un parche a
-- medio escribir no tiene por qué verse en la web.
-- ============================================================================

create table rule_patch (
  id           uuid primary key default gen_random_uuid(),
  -- "v3", "Parche de octubre"… Opcional: no todas las tandas tienen nombre.
  version      text,
  title        text not null,
  body         text not null default '',
  published_at timestamptz,
  created_at   timestamptz not null default now()
);

create index rule_patch_orden on rule_patch (published_at desc nulls first, created_at desc);

comment on column rule_patch.body is
  'Texto suelto, una línea por cambio. «+ » entra, «- » sale, el resto es texto.';

alter table rule_patch enable row level security;
revoke all on table rule_patch from anon, authenticated;
grant select on table rule_patch to authenticated;
create policy "staff_read" on rule_patch for select to authenticated using (is_staff());

-- La superficie pública: solo los publicados y solo estas columnas.
create view public_patch_notes as
select id, version, title, body, published_at
from rule_patch
where published_at is not null;

grant select on public_patch_notes to anon, authenticated;
