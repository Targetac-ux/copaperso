# CopaPerso

Plataforma del torneo comunitario 5v5 de League of Legends: sustituye los dos Excel
(_CCTM Manager_ y _CCPR Roster_) por una consola que el host opera en directo durante
el stream.

El **CCTM Manager** es el corazón del producto: una sola pantalla desde la que se
registra gente, se arman equipos, se negocia con bits y se registran resultados sin
cambiar de módulo.

## Estado

| Fase | Qué incluye                                                         | Estado                  |
| ---- | ------------------------------------------------------------------- | ----------------------- |
| 1    | Fundaciones: repo, base de datos, acceso del host, fotos, identidad | ✅ cerrada              |
| 2    | Jugadores, periodos y sesiones                                      | ✅ cerrada              |
| 3    | CCTM: banca, draft, equipos, economía, estados, timer, deshacer     | ✅ cerrada              |
| 4    | Partidas, resultados y LP                                           | ✅ cerrada              |
| 4B   | Vista pública en vivo                                               | ✅ cerrada              |
| 5    | Roster e histórico                                                  | ✅ cerrada              |
| 6    | Tier Ranking Manager                                                | ✅ cerrada              |
| 7    | Home pública                                                        | construida · sin cerrar |
| —    | Importación del histórico de los dos Excel                          | ✅ en producción        |
| 8    | Prueba real en stream                                               | pendiente               |

La 7 está en pie y en uso, pero no cerrada: falta decidir el formato de los premios
—la página lo dice— y el Rendimiento de Lighthouse se queda en 73 de los 90 exigidos,
porque el cliente de Supabase viaja en todas las páginas aunque ninguna pública lo use.
Las dos cosas y su estado están en `docs/03-plan-por-fases.md`.

**Objetivo: empezar a usarlo en octubre de 2026.** Todo lo que hace falta para dirigir
una CopaPerso en directo está construido y probado; lo que queda es usarlo de verdad.

El plan completo, con las pruebas que cierran cada fase, está en
[`docs/03-plan-por-fases.md`](docs/03-plan-por-fases.md).

## Arrancar

```bash
npm install
cp .env.example .env    # y rellena las llaves de Supabase
npm run dev
```

Los pasos completos —crear el proyecto de Supabase, aplicar las migraciones, darte de
alta como host— están en [`docs/07-puesta-en-marcha.md`](docs/07-puesta-en-marcha.md).

## Las pantallas

**Públicas**, sin cuenta: la portada (`/`), la vista en vivo (`/en-vivo`), el Tier
Ranking (`/tier-ranking`), el histórico mes a mes (`/historico`), las reglas
(`/reglas`), los patch notes (`/patch-notes`) y los premios (`/premios`).

`/en-vivo?overlay=1` es la misma vista sin fondo ni cabecera, para meterla en OBS.

**Del host**, detrás de login, bajo `/host`: la sesión en marcha (el CCTM), jugadores,
periodos, roster, Tier Manager, clips, patch notes y ajustes.

## Comandos

| Comando             | Qué hace                                           |
| ------------------- | -------------------------------------------------- |
| `npm run dev`       | Servidor de desarrollo                             |
| `npm run build`     | Compilación de producción                          |
| `npm run lint`      | ESLint                                             |
| `npm run typecheck` | Tipos                                              |
| `npm test`          | Unitarios (Vitest) — 328 en verde                  |
| `npm run test:e2e`  | Punta a punta (Playwright)                         |
| `npm run assets`    | Regenera `public/` desde `assets/`                 |
| `npm run db:check`  | Comprueba que un entorno tiene el esquema completo |
| `npm run db:types`  | Regenera los tipos desde el esquema                |

## Estructura

```
app/            interfaz: páginas, layouts, componentes
server/api/     el backend: aquí se valida y se escribe
shared/         reglas de dominio que usan cliente y servidor (LP, draft, roster…)
supabase/       migraciones versionadas del esquema
scripts/        utilidades de una sola vez: limpiar la base, importar el histórico
assets/         imágenes originales (las genera el host)
public/         derivados listos para web — no editar a mano
docs/           plan, modelo de datos, wireframes, prompts
tests/          unit + e2e
graphify-out/   grafo de conocimiento del repo (ver CLAUDE.md)
```

Las cuentas —LP, winrate, reparto del draft— viven en `shared/` y no en la pantalla:
la misma fila se pinta en el panel, se exporta a CSV y sale en la web pública, y si
cada sitio hiciera su propio redondeo acabarían diciendo cosas distintas del mismo
jugador.

## Versiones

El número que sale en el pie (`v2.0`) es el de `package.json`, expuesto por
`runtimeConfig.public.version`. Se muestra `major.minor`: semver obliga a tres
números y el tercero no le dice nada a quien visita la página. Empieza en 2.0
porque la versión 1 del torneo eran los dos Excel que esto sustituye.

**No es la versión de los patch notes.** Esa la escribe el host en
`/host/patch-notes` y cuenta cómo cambian _las reglas_, no el sitio.

## El histórico de los Excel

Los ocho meses anteriores a octubre de 2026 vivían en dos `.xlsm` del host: **476
participaciones de 223 jugadores**, ya importadas a producción. Se traen en dos pasos,
después de dejar la base en blanco:

```bash
node scripts/limpiar-datos.mjs --hazlo
node scripts/leer-excel.mjs "CCPR Roster.xlsm" "CCTM Manager.xlsm"
node scripts/importar-historico.mjs --hazlo
```

El primero convierte los libros a JSON dentro de `scripts/historico/` —los
`.xlsm` no entran al repo— y deja un informe de nombres repetidos para que el
host diga quién es quién. Sus respuestas viven en `alias.json`: `fusiones` dice
qué nick es cuál, y `nombres` con cuál se queda la persona, porque al fundir
varias grafías la más reciente no siempre es la buena. El segundo escribe, y con
`--comprobar` relee la base y la cuadra fila a fila contra el JSON. Sin
`--hazlo` ninguno toca nada.

Lo que el Excel no traía —partidas, roles y elo— no se inventa: los totales
mensuales van a las columnas `historic_*` de `participation`. Está explicado en
`docs/02-modelo-de-datos.md`, apartado A10.

## Cómo está protegido

El navegador **nunca** escribe en la base de datos. Toda mutación pasa por
`server/api/*`, que verifica sesión y pertenencia a `app_user` antes de tocar nada
(`server/utils/guard.ts`).

- La llave publicable solo alcanza seis vistas de lectura (`public_tier_ranking`,
  `public_roster`, `public_session_live`, `public_clips`, `public_patch_notes`,
  `public_site_links`). Hay un test que falla si alguien mete ahí una columna privada
  o concede una vista más.
- Todas las tablas tienen RLS activado y sin políticas de escritura.
- La llave secreta vive solo en el servidor.

**La vista en vivo no lee tablas.** El servidor arma el estado público y lo publica por
un canal de broadcast, así que el espectador nunca consulta la base: ni un fallo de RLS
podría enseñarle algo que no esté en ese objeto. Lo que sale está **declarado** en
`FORMA_PUBLICA` (`shared/live.ts`) y lo que no esté ahí no se publica, se llame como se
llame.

Desde el 17 de septiembre de 2026, y por decisión del host, ese objeto **sí incluye los
precios de las recompensas, el banco entero, la cárcel y las restricciones**: los
paneles son para que los jugadores negocien, y en el Excel el banco salía en pantalla
igualmente. Siguen fuera **los préstamos, las notas del host y el historial de
canjeos**. El porqué de cada uno está en `docs/02-modelo-de-datos.md`, apartado A11.
