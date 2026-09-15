-- ============================================================================
-- CopaPerso · Fase 7: clips de la Home
--
-- Se guarda el **slug** del clip, que es lo único que Twitch necesita para
-- incrustarlo, y no la URL entera: la URL cambia de forma según de dónde la
-- copies (clips.twitch.tv/SLUG, twitch.tv/canal/clip/SLUG…) y guardarla tal
-- cual obligaría a volver a interpretarla en cada visita.
--
-- Nada de esto sale de Twitch: ni título ni portada. No hay credenciales de la
-- API de Twitch en el proyecto y no hace falta que las haya, porque el
-- reproductor incrustado ya enseña su propio fotograma. El título lo escribe el
-- host, que es quien sabe qué pasó en ese clip.
-- ============================================================================

create table clip (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  title      text not null,
  -- "CopaPerso #12", "La del ARAM AFK"… De qué edición salió, en palabras del
  -- host. Es texto libre a propósito: las copas viejas no están en la base.
  edition    text,
  sort_order smallint not null default 0,
  -- Esconder sin borrar: un clip que se pasó de moda pero puede volver.
  visible    boolean not null default true,
  created_at timestamptz not null default now()
);

create index clip_orden on clip (sort_order, created_at);

comment on column clip.slug is
  'El identificador del clip en Twitch. Se incrusta con clips.twitch.tv/embed?clip=<slug>&parent=<dominio>';

alter table clip enable row level security;
revoke all on table clip from anon, authenticated;
grant select on table clip to authenticated;
create policy "staff_read" on clip for select to authenticated using (is_staff());

-- La superficie pública: solo los visibles y solo estas columnas.
create view public_clips as
select slug, title, edition, sort_order
from clip
where visible;

grant select on public_clips to anon, authenticated;
