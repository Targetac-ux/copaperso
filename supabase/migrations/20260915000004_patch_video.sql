-- ============================================================================
-- CopaPerso · Patch notes: el vídeo del parche
--
-- El host graba cada parche y lo explica en un vídeo, así que **el vídeo es la
-- versión completa** y lo escrito aquí es el resumen para leer de un vistazo.
--
-- Se guarda el **id** de YouTube y no la URL: la URL cambia de forma según de
-- dónde la copies (watch?v=, youtu.be/, /shorts/…) y del id salen tanto el
-- reproductor como la miniatura. Lo interpreta shared/patchnotes.ts.
--
-- Es opcional: un parche de dos líneas no necesita vídeo.
-- ============================================================================

alter table rule_patch add column if not exists video_id text;

comment on column rule_patch.video_id is
  'Id de YouTube (11 caracteres), no la URL. Opcional.';

-- La vista pública se rehace para incluirlo.
drop view if exists public_patch_notes;

create view public_patch_notes as
select id, version, title, body, video_id, published_at
from rule_patch
where published_at is not null;

grant select on public_patch_notes to anon, authenticated;
