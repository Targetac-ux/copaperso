# CopaPerso

Plataforma del torneo comunitario 5v5 de League of Legends: sustituye los dos Excel
(*CCTM Manager* y *CCPR Roster*) por una consola que el host opera en directo durante
el stream.

El **CCTM Manager** es el corazón del producto: una sola pantalla desde la que se
registra gente, se arman equipos, se negocia con bits y se registran resultados sin
cambiar de módulo.

## Estado

| Fase | Qué incluye | Estado |
|---|---|---|
| 1 | Fundaciones: repo, base de datos, acceso del host, fotos, identidad | ✅ cerrada |
| 2 | Jugadores, periodos y sesiones | ✅ cerrada |
| 3A | CCTM: banca, draft, equipos y swap | ✅ cerrada |
| 3B | CCTM: economía, estados y timer | ✅ cerrada |
| 3C | CCTM: historial y deshacer | ✅ cerrada |
| 4 | Partidas, resultados y LP | — |
| 4B | Vista pública en vivo | — |
| 5 | Roster histórico | — |
| 6 | Tier Ranking Manager | — |
| 7 | Home pública | — |
| 8 | Prueba real en stream | — |

El plan completo, con las pruebas que cierran cada fase, está en
[`docs/03-plan-por-fases.md`](docs/03-plan-por-fases.md).

## Arrancar

```bash
npm install
cp .env.example .env    # y rellena las llaves de Supabase
npm run dev
```

Los pasos completos —crear el proyecto de Supabase, aplicar el esquema, darte de alta
como host— están en [`docs/07-puesta-en-marcha.md`](docs/07-puesta-en-marcha.md).

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación de producción |
| `npm run lint` | ESLint |
| `npm run typecheck` | Tipos |
| `npm test` | Unitarios (Vitest) |
| `npm run test:e2e` | Punta a punta (Playwright) |
| `npm run assets` | Regenera `public/` desde `assets/` |
| `npm run db:check` | Comprueba que un entorno tiene el esquema completo |
| `npm run db:types` | Regenera los tipos desde el esquema |

## Estructura

```
app/            interfaz: páginas, layouts, componentes
server/api/     el backend: aquí se valida y se escribe
shared/types/   tipos compartidos entre cliente y servidor
supabase/       migraciones versionadas del esquema
scripts/        utilidades de una sola vez: limpiar la base, importar el histórico
assets/         imágenes originales (las genera el host)
public/         derivados listos para web — no editar a mano
docs/           plan, modelo de datos, wireframes, prompts
tests/          unit + e2e
```

## Versiones

El número que sale en el pie (`v2.0`) es el de `package.json`, expuesto por
`runtimeConfig.public.version`. Se muestra `major.minor`: semver obliga a tres
números y el tercero no le dice nada a quien visita la página. Empieza en 2.0
porque la versión 1 del torneo eran los dos Excel que esto sustituye.

**No es la versión de los patch notes.** Esa la escribe el host en
`/host/patch-notes` y cuenta cómo cambian *las reglas*, no el sitio.

## El histórico de los Excel

Los ocho meses anteriores a octubre de 2026 vivían en dos `.xlsm` del host. Se
traen en dos pasos, después de dejar la base en blanco:

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

- La llave publicable solo alcanza tres vistas (`public_tier_ranking`,
  `public_roster`, `public_session_live`), que no exponen bits, préstamos, cárcel
  ni notas. Hay un test que falla si alguien mete ahí una columna privada.
- Todas las tablas tienen RLS activado y sin políticas de escritura.
- La llave secreta vive solo en el servidor.
