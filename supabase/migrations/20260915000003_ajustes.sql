-- ============================================================================
-- CopaPerso · Fase 7: Ajustes
--
-- Lo que el host podía cambiar hasta ahora exigía un despliegue: los precios
-- de los canjeos (que sí tenían endpoint, pero ninguna pantalla lo llamaba),
-- los enlaces de las redes y la duración por defecto del cronómetro.
--
-- **Dos tablas, porque son dos formas de dato distintas.** Meter los enlaces en
-- la tabla clave/valor obligaría a inventar claves como «social_instagram_orden»,
-- que es una lista disfrazada de escalares.
-- ============================================================================

-- Escalares sueltos. Crece con lo que haga falta sin migrar nada más.
create table setting (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

create trigger setting_updated before update on setting
  for each row execute function set_updated_at();

comment on table setting is
  'Ajustes escalares del panel. Hoy solo timer_seconds; no se expone al público.';

-- Los enlaces son una lista con orden y visibilidad, no un escalar.
--
-- `network` es único: una cuenta por red. Es texto y no un enum a propósito —
-- añadir una red nueva no debería costar una migración, y la lista de las que
-- se saben pintar vive en shared/ajustes.ts, donde además están sus iconos.
create table site_link (
  id         uuid primary key default gen_random_uuid(),
  network    text not null unique,
  url        text not null,
  sort_order smallint not null default 0,
  visible    boolean not null default true,
  created_at timestamptz not null default now()
);

create index site_link_orden on site_link (sort_order, network);

comment on column site_link.url is
  'Siempre http(s): lo normaliza y lo valida shared/ajustes.ts antes de escribir.';

alter table setting enable row level security;
alter table site_link enable row level security;
revoke all on table setting, site_link from anon, authenticated;
grant select on table setting, site_link to authenticated;
create policy "staff_read" on setting   for select to authenticated using (is_staff());
create policy "staff_read" on site_link for select to authenticated using (is_staff());

-- La superficie pública: solo los enlaces visibles y solo estas columnas.
-- `setting` NO se expone: la duración del cronómetro es cosa del panel.
create view public_site_links as
select network, url, sort_order
from site_link
where visible;

grant select on public_site_links to anon, authenticated;
