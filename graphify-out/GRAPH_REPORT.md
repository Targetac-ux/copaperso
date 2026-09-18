# Graph Report - copaperso  (2026-09-18)

## Corpus Check
- Large corpus: 317 files · ~1,358,174 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 1398 nodes · 2049 edges · 114 communities (79 shown, 35 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 70 edges (avg confidence: 0.87)
- Token cost: 158,841 input · 0 output

## Community Hubs (Navigation)
- E2E Playwright Test Suite
- Core Database Schema
- Generated Supabase Types
- Historical Excel Import
- Host Control Panel State
- Shared Domain Utilities
- Public & Ledger API Routes
- CCTM Economy Panel
- Host Settings & Layout
- LP & Match Domain Logic
- Clips & Roster Host Pages
- Zod Validated API Bodies
- Tier Manager Page
- Draft Team Assignment
- Roster & Name Matching
- Excel Spreadsheet Reader
- Settings Links & Timer
- Host Player Photo Card
- Server Utility Loaders
- Player Line Input
- Nuxt Project Dependencies
- Live Public Projection
- Economy Loans & Pricing
- Session Participants API
- Blue Shell Roulette
- Patch Notes Host Page
- NPM Scripts
- Match & LP Data Rules
- Settings & Timer API
- Session & Timer Design Notes
- Tier List Domain Logic
- Live Realtime Channel
- Host Match Actions
- Public Visibility Design
- Dev Tooling Dependencies
- Asset Optimization Script
- CCTM Composable
- Periods Host Page
- Economy Data Model Docs
- Settings & Links Docs
- Shared Domain Models
- CCTM Timer Component
- Live Public Page
- Host Login Page
- Brand Assets & Accessibility
- CCTM Bank Panel
- CCTM Player Actions
- CCTM Team Slots
- Catalog & Loans API
- Staff Session & Players Page
- Host Economy Actions
- Participation & Period Docs
- Runtime Dependencies
- Live Load Testing Script
- Free Tier Constraints
- CCTM Reward Claims
- Foundational Tech Decisions
- Roster Loading & Export
- Schema Check Script
- CCTM Bench
- CCTM Random Assignment
- Timer Sound Composable
- Tier Manager & URL Docs
- E2E Test User Script
- Tier Entries API
- Host Layout & Logout
- Public History Page
- Roster Phase Docs
- Prettier Configuration
- Public Views Unit Test
- Patch Notes Migrations
- Clips Embed Component
- Drag Player Composable
- Error Page
- Public Patch Notes Page
- Patch Notes API
- Undo Executor
- Shared External Links
- Match Finish API
- Clips Migration
- Host Drag And Drop
- Analytics Plugin
- ESLint Configuration
- Dependency Overrides
- Periods API
- Player Photo Upload API
- TypeScript Configuration
- App Root Component
- Brand Icon Component
- Time Up Component
- CCTM Warnings Component
- Copa Icon Component
- Generated Types Workflow
- Vitest Configuration
- Sentry Decision

## God Nodes (most connected - your core abstractions)
1. `zod` - 37 edges
2. `@playwright/test` - 22 edges
3. `vitest` - 20 edges
4. `gotoHydrated()` - 18 edges
5. `scripts` - 16 edges
6. `recargar()` - 15 edges
7. `participation` - 14 edges
8. `cargarEconomia()` - 13 edges
9. `importar()` - 11 edges
10. `session` - 11 edges

## Surprising Connections (you probably didn't know these)
- `Convencion de uso de graphify en el proyecto` --references--> `CopaPerso (plataforma del torneo 5v5)`  [INFERRED]
  CLAUDE.md → README.md
- `Estructura de carpetas del repo` --implements--> `Un solo proyecto Nuxt 4 en vez de front y back separados`  [INFERRED]
  README.md → docs/01-decisiones-tecnicas.md
- `libro()` --calls--> `abrirLibro()`  [EXTRACTED]
  tests/unit/leer-excel.test.ts → scripts/leer-excel.mjs
- `Workflow CI (lint, tipos, tests, build)` --conceptually_related_to--> `Deploy en Vercel con GitHub Actions`  [INFERRED]
  .github/workflows/ci.yml → docs/01-decisiones-tecnicas.md
- `Workflow CI (lint, tipos, tests, build)` --implements--> `Una fase no se cierra hasta que sus pruebas pasan`  [INFERRED]
  .github/workflows/ci.yml → docs/03-plan-por-fases.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Flujo de importacion del historico de los Excel** — scripts_limpiar_datos, scripts_leer_excel, scripts_importar_historico, docs_03_plan_por_fases_alias_json, docs_02_modelo_de_datos_historico_excel, docs_02_modelo_de_datos_contar_roster [EXTRACTED 1.00]
- **Capas que deciden que ve el publico** — docs_02_modelo_de_datos_forma_publica, docs_02_modelo_de_datos_auditar_en_vivo, docs_02_modelo_de_datos_acciones_publicas, docs_03_plan_por_fases_canal_broadcast, docs_01_decisiones_tecnicas_rls_vistas_publicas, readme_proteccion [EXTRACTED 1.00]
- **Fase de negociacion: cronometro, x3 y precios** — docs_02_modelo_de_datos_prices_tripled, docs_02_modelo_de_datos_timer_remaining_seconds, docs_02_modelo_de_datos_cronometro_informativo, docs_02_modelo_de_datos_action_catalog, docs_02_modelo_de_datos_reward_claim, docs_02_modelo_de_datos_recompensas_no_ejecutan [EXTRACTED 1.00]

## Communities (114 total, 35 thin omitted)

### Community 0 - "E2E Playwright Test Suite"
Cohesion: 0.06
Nodes (37): @playwright/test, ref_supabase_supabase_js, DESDE, REDES_TOCADAS, sello, NOMBRES, sello, JUGADORES (+29 more)

### Community 1 - "Core Database Schema"
Cohesion: 0.07
Nodes (54): auth, auth.users, action_catalog, action_log, action_log_session_idx, app_user, blue_shell_result, extra (+46 more)

### Community 2 - "Generated Supabase Types"
Cohesion: 0.04
Nodes (50): AccountKind, ActionCatalogRow, ActionLogRow, AppRole, AppUserRow, BlueShellOutcomeDb, BlueShellResultRow, ClipRow (+42 more)

### Community 3 - "Historical Excel Import"
Cohesion: 0.06
Nodes (44): Workflow CI (lint, tipos, tests, build), Convencion de uso de graphify en el proyecto, Proyecto Supabase separado para staging, Deploy en Vercel con GitHub Actions, A10: el historico de los Excel no son partidas, RESTRICTION y STATE_RECORD (castigos), scripts/historico/alias.json (fusiones de nicks), Una fase no se cierra hasta que sus pruebas pasan (+36 more)

### Community 4 - "Host Control Panel State"
Cohesion: 0.04
Nodes (45): activa, blueShellAbierto, candidatosBlueShell, cctm, cerrando, cerrandoAbierto, conRoles, creando (+37 more)

### Community 5 - "Shared Domain Utilities"
Cohesion: 0.07
Nodes (35): vitest, slugify(), seMide(), BLUE_SHELL_DESC, BLUE_SHELL_LABEL, BLUE_SHELL_OUTCOMES, BlueShellOutcome, esBlueShellOutcome() (+27 more)

### Community 6 - "Public & Ledger API Routes"
Cohesion: 0.08
Nodes (12): ref_shared_types_database_types, ref_supabase_server, body, body, body, Fila, Fila, Fila (+4 more)

### Community 7 - "CCTM Economy Panel"
Cohesion: 0.06
Nodes (33): anotarExtra(), anotarNota(), anotarRestriccion(), crearPrestamo(), emit, ETIQUETA_EXTRA, nuevaNota, nuevaRestriccion (+25 more)

### Community 8 - "Host Settings & Layout"
Cohesion: 0.06
Nodes (33): abierto, nav, ruta, { twitch, sociales }, version, Ajustes, alternarRecompensa(), bitsNuevos (+25 more)

### Community 9 - "LP & Match Domain Logic"
Cohesion: 0.09
Nodes (28): ref_types_database_types, AvisoDeCierre, avisosDeCierre(), CierreDePartida, cuentaDerrotas(), cuentaVictorias(), deltaDe(), EventoLp (+20 more)

### Community 10 - "Clips & Roster Host Pages"
Cohesion: 0.07
Nodes (28): anadir(), cambiar(), { data, refresh, error: errorCarga }, dominio, edicion, error, llamar(), ocupado (+20 more)

### Community 11 - "Zod Validated API Bodies"
Cohesion: 0.07
Nodes (16): ref_shared_similarity, zod, body, body, body, query, body, body (+8 more)

### Community 12 - "Tier Manager Page"
Cohesion: 0.07
Nodes (17): arrastrado, { data: ediciones, refresh: refrescarEdiciones }, { data: periodos }, { data, refresh }, EdicionListada, editable, error, grupos (+9 more)

### Community 13 - "Draft Team Assignment"
Cohesion: 0.13
Nodes (24): BenchPlayer, checkAssignment(), checkSwap(), demonBalance, demonCount(), demonDiffTrasAsignar(), DraftCheck, DraftError (+16 more)

### Community 14 - "Roster & Name Matching"
Cohesion: 0.13
Nodes (24): AgregadoHistorico, CampoOrden, celda(), contar(), CSV_CABECERAS, filaCsv(), FilaRoster, filtrar() (+16 more)

### Community 15 - "Excel Spreadsheet Reader"
Cohesion: 0.17
Nodes (24): ref_node_os, ref_node_zlib, abrirLibro(), abrirZip(), CAMPOS, celdaCsv(), columna(), desescapar() (+16 more)

### Community 16 - "Settings Links & Timer"
Cohesion: 0.16
Nodes (20): CLAVES, DefinicionDeRed, enlaceDe(), EnlaceDeSitio, esRedConocida(), leerSegundos(), normalizarUrl(), POR_RED (+12 more)

### Community 17 - "Host Player Photo Card"
Cohesion: 0.10
Nodes (20): alCargar(), archivo, cancelar(), { data, refresh, status }, desde, emit, errorFoto, escala (+12 more)

### Community 18 - "Server Utility Loaders"
Cohesion: 0.10
Nodes (7): ref_h3, ref_shared_clips, body, StaffUser, LogInput, FilaJugador, ORDEN_ROL

### Community 19 - "Player Line Input"
Cohesion: 0.12
Nodes (19): alBajar(), aviso, campo, destino, elegido, elegir(), emit, entendido (+11 more)

### Community 20 - "Nuxt Project Dependencies"
Cohesion: 0.10
Nodes (18): name, private, type, version, eslint, happy-dom, nuxt, @nuxt/eslint (+10 more)

### Community 21 - "Live Public Projection"
Cohesion: 0.14
Nodes (17): ACCIONES_PUBLICAS, auditarEnVivo(), revisar(), CastigoEnVivo, CronometroEnVivo, CuentaEnVivo, EN_VIVO_VACIO, EnVivo (+9 more)

### Community 22 - "Economy Loans & Pricing"
Cohesion: 0.19
Nodes (17): balanceAfter(), CatalogAction, codigoDeRecompensa(), codigoLibre(), daysBetween(), effectiveCost(), Loan, loanAmountDue() (+9 more)

### Community 23 - "Session Participants API"
Cohesion: 0.12
Nodes (10): ref_shared_draft, ref_shared_parser, body, ELOS, ROLES, body, body, body (+2 more)

### Community 24 - "Blue Shell Roulette"
Cohesion: 0.14
Nodes (14): emit, girando, guardar(), marquesina, nombreVictima, pararAnimacion(), props, resultado (+6 more)

### Community 25 - "Patch Notes Host Page"
Cohesion: 0.15
Nodes (13): abierto, borrador, borrar(), crear(), { data, refresh, error: errorCarga }, error, guardar(), idVideo (+5 more)

### Community 26 - "NPM Scripts"
Cohesion: 0.12
Nodes (16): scripts, assets, build, db:check, db:reset, db:types, dev, generate (+8 more)

### Community 27 - "Match & LP Data Rules"
Cohesion: 0.14
Nodes (15): ACTION_LOG con payload inverso, Elo Demon y la regla del 1:1, importanLosRoles(mode) en shared/draft.ts, MATCH_PLAYER como fuente de verdad del resultado, Las recompensas no ejecutan nada: el host mueve a mano, Tabla de reglas de LP, Snapshot congelado de la alineacion, Ruleta del Blue Shell (+7 more)

### Community 28 - "Settings & Timer API"
Cohesion: 0.13
Nodes (8): ref_shared_ajustes, ref_shared_timer, body, PatchTimer, body, body, body, Ajustes

### Community 29 - "Session & Timer Design Notes"
Cohesion: 0.16
Nodes (14): Cementerio, cupo, reingreso y carcel son cosas distintas, El cronometro avisa, nunca bloquea, SESSION (una noche de copa), SESSION_PARTICIPANT (la banca de jugadores), timer_remaining_seconds (arreglo de la pausa), Una sola sesion abierta a la vez, AppBrandIcon.vue (logos en linea), CCTM Manager (mesa de control del host) (+6 more)

### Community 30 - "Tier List Domain Logic"
Cohesion: 0.25
Nodes (12): CambioDeOrden, cambios(), Edicion, EntradaTier, esTier(), mover(), porTier(), TIER_INSIGNIA (+4 more)

### Community 31 - "Live Realtime Channel"
Cohesion: 0.19
Nodes (8): EstadoConexion, useEnVivo(), ref_shared_live, CANAL_EN_VIVO, cargarEnVivo(), ORDEN_ROL, publicarEnVivo(), sanear()

### Community 32 - "Host Match Actions"
Cohesion: 0.19
Nodes (13): accionCronometro(), anotar(), cargarPartidas(), cerrarSesion(), confirmar(), deshacerUltimo(), finalizarPartida(), guardarBlueShell() (+5 more)

### Community 33 - "Public Visibility Design"
Cohesion: 0.19
Nodes (13): Un solo proyecto Nuxt 4 en vez de front y back separados, RLS y las tres vistas publicas, ACCIONES_PUBLICAS (lista blanca de avisos), auditarEnVivo: de lista negra a lista blanca, FORMA_PUBLICA en shared/live.ts, Vista public_session_live (sin usar), Broadcast en vez de escuchar tablas, Fase 4B - Vista publica en vivo (/en-vivo) (+5 more)

### Community 34 - "Dev Tooling Dependencies"
Cohesion: 0.15
Nodes (13): devDependencies, eslint, eslint-config-prettier, happy-dom, @nuxt/eslint, @nuxt/test-utils, @playwright/test, prettier (+5 more)

### Community 35 - "Asset Optimization Script"
Cohesion: 0.17
Nodes (12): ref_node_fs_promises, ref_node_url, svgo, jobs, kb(), MODOS, noPublicar, out (+4 more)

### Community 36 - "CCTM Composable"
Cohesion: 0.20
Nodes (6): Aviso, SessionInfo, useCctm(), assign(), call(), swap()

### Community 37 - "Periods Host Page"
Cohesion: 0.17
Nodes (7): activo, error, ESTADO, hoy, mes, modo, ocupado

### Community 38 - "Economy Data Model Docs"
Cohesion: 0.20
Nodes (12): ACTION_CATALOG (precios por periodo), A11: que ve el publico en vivo, Banco de bits y subs (LEDGER_ACCOUNT / LEDGER_ENTRY), Prestamos con interes lineal del 10 % diario, prices_tripled: un booleano, no un multiplicador, REWARD_CLAIM como bitacora, codigoDeRecompensa en shared/economy.ts, El catalogo se hereda al abrir mes (+4 more)

### Community 39 - "Settings & Links Docs"
Cohesion: 0.21
Nodes (12): SETTING (clave/valor), SITE_LINK (enlaces y redes), Modulo /host/ajustes, Clips de Twitch incrustados y el parametro parent, shared/enlaces.ts (canal y enlaces de respaldo), Fase 7 - Home publica, Pagina de error propia (app/error.vue), Patch notes en /patch-notes (+4 more)

### Community 40 - "Shared Domain Models"
Cohesion: 0.17
Nodes (11): ref_database_types, AppUser, DEMON, ELO_LABEL, ELO_TIERS, EloTier, MODE_LABEL, Player (+3 more)

### Community 41 - "CCTM Timer Component"
Cohesion: 0.22
Nodes (9): aplicarDuracion(), duracion, editando, emit, { enabled: sonido, play: tic, toggle: alternarSonido }, enRojo, props, refrescar() (+1 more)

### Community 42 - "Live Public Page"
Cohesion: 0.18
Nodes (8): castigos, conRoles, {
  enabled: sonido,
  chime,
  toggle: alternarSonido,
}, enRojo, { estado, conexion }, overlay, restante, route

### Community 43 - "Host Login Page"
Cohesion: 0.18
Nodes (9): email, error, { loadStaff }, password, pending, route, router, supabase (+1 more)

### Community 44 - "Brand Assets & Accessibility"
Cohesion: 0.18
Nodes (11): Arreglos de accesibilidad (91 a 100), Menu plegable en movil, isotipo.svg (el escudo), Key art 16:9 y cuadrado, Pipeline assets/ a public/, Los SVG vectorizados desde PNG pesan, Paleta oficial de CopaPerso, La IA nunca escribe texto en las piezas (+3 more)

### Community 45 - "CCTM Bank Panel"
Cohesion: 0.24
Nodes (9): abrirCuenta(), conSaldo, Cuenta, emit, movimiento, nuevaCuenta, props, registrarMovimiento() (+1 more)

### Community 46 - "CCTM Player Actions"
Cohesion: 0.20
Nodes (9): conRoles, emit, enEquipo, equipo, jugador, props, puedeAsignar, rol (+1 more)

### Community 47 - "CCTM Team Slots"
Cohesion: 0.22
Nodes (9): emit, encima, extras, libres, onDrop(), props, { read, end, dragging }, slots (+1 more)

### Community 48 - "Catalog & Loans API"
Cohesion: 0.20
Nodes (5): ref_shared_economy, query, body, body, body

### Community 49 - "Staff Session & Players Page"
Cohesion: 0.22
Nodes (5): useStaff(), { data: participaciones, refresh }, Participacion, quitando, ref_shared_types_models

### Community 50 - "Host Economy Actions"
Cohesion: 0.22
Nodes (9): abrirCuenta(), cargarEconomia(), deshacer(), levantarRestriccion(), nuevoPrestamo(), registrarReclamo(), restringir(), saldarPrestamo() (+1 more)

### Community 51 - "Participation & Period Docs"
Cohesion: 0.25
Nodes (9): LP_EVENT como fuente de verdad del LP, MATCH_EVENT: tabla que no se escribe, PARTICIPATION (por periodo), Entidad PERIOD (el mes), TIER_LIST y TIER_ENTRY, Una edicion del Tier Ranking es una foto, Fase 2 - Jugadores, periodos y sesiones, Insignias de tier (D a S+) (+1 more)

### Community 52 - "Runtime Dependencies"
Cohesion: 0.22
Nodes (9): dependencies, nuxt, @nuxt/fonts, @nuxtjs/supabase, sharp, @vercel/analytics, vue, vue-router (+1 more)

### Community 53 - "Live Load Testing Script"
Cohesion: 0.22
Nodes (7): aguantar, cuantos, e, emisor, espectadores, pct(), recibidos

### Community 54 - "Free Tier Constraints"
Cohesion: 0.29
Nodes (8): Workflow Backup (volcado semanal), Workflow Keepalive (ping semanal a /api/health), Limite de conexiones concurrentes de Realtime, Pausa del proyecto Free a los 7 dias, El plan Free no tiene Point-in-Time Recovery, Supabase (PostgreSQL) como base de datos, Prueba de carga de 200 espectadores, Secretos del repositorio (SITE_URL y SUPABASE_DB_URL)

### Community 55 - "CCTM Reward Claims"
Cohesion: 0.29
Nodes (6): Canjeo, elegido, emit, pagoCon, Precio, registrar()

### Community 56 - "Foundational Tech Decisions"
Cohesion: 0.29
Nodes (8): Migraciones versionadas con la CLI de Supabase, Modo offline defensivo del CCTM, Cada accion devuelve el estado entero recalculado, Fase 1 - Fundaciones, El CCTM lo usa una sola persona a la vez, Alta del host en app_user (la segunda puerta), npm run db:check, Wireframe 07 - Login del host

### Community 57 - "Roster Loading & Export"
Cohesion: 0.25
Nodes (4): ref_shared_roster, FilaPart, FilaParticipacion, RosterCargado

### Community 58 - "Schema Check Script"
Cohesion: 0.25
Nodes (6): COSTOS, db, env, nota(), TABLAS, VISTAS

### Community 59 - "CCTM Bench"
Cohesion: 0.33
Nodes (6): buscar, emit, onDrop(), props, { start, end, read, dragging }, visibles

### Community 60 - "CCTM Random Assignment"
Cohesion: 0.33
Nodes (6): asignar(), elegido, emit, equipo, listo, rol

### Community 61 - "Timer Sound Composable"
Cohesion: 0.43
Nodes (6): OpcionesSonido, useTicTac(), chime(), contexto(), play(), toggle()

### Community 62 - "Tier Manager & URL Docs"
Cohesion: 0.29
Nodes (7): normalizarUrl (validacion de enlaces en el servidor), Analytics con beforeSend en shared/analytics.ts, Fase 6 - Tier Ranking Manager, Bits y subs no tienen tipo de cambio, El Tier Ranking es manual, Las doce preguntas pendientes del blueprint, Wireframe 09 - Tier Ranking Manager

### Community 63 - "E2E Test User Script"
Cohesion: 0.29
Nodes (4): ref_node_crypto, ref_node_fs, db, env

### Community 64 - "Tier Entries API"
Cohesion: 0.29
Nodes (4): ref_shared_tiers, body, FilaEntrada, TablaCargada

### Community 65 - "Host Layout & Logout"
Cohesion: 0.33
Nodes (4): nav, router, { staff }, supabase

### Community 66 - "Public History Page"
Cohesion: 0.33
Nodes (5): { data }, elegido, Fila, Mes, totales

### Community 67 - "Roster Phase Docs"
Cohesion: 0.40
Nodes (6): contar() en shared/roster.ts, Vista public_roster, Foto del jugador con encuadre a eleccion del host, Fase 5 - Roster e historico, Historico publico en /historico, Wireframe 08 - Roster historico

### Community 68 - "Prettier Configuration"
Cohesion: 0.33
Nodes (5): printWidth, semi, singleQuote, trailingComma, vueIndentScriptAndStyle

### Community 69 - "Public Views Unit Test"
Cohesion: 0.33
Nodes (4): ref_node_path, dir, PRIVADO, sql

### Community 70 - "Patch Notes Migrations"
Cohesion: 0.47
Nodes (4): public_patch_notes, rule_patch, rule_patch_orden, public_patch_notes

### Community 71 - "Clips Embed Component"
Cohesion: 0.40
Nodes (3): cerca, dominio, raiz

### Community 73 - "Error Page"
Cohesion: 0.40
Nodes (3): esPerdida, props, ref_app

### Community 76 - "Undo Executor"
Cohesion: 0.50
Nodes (3): num(), Payload, runUndo()

### Community 77 - "Shared External Links"
Cohesion: 0.40
Nodes (4): CANAL_TWITCH, CANAL_TWITCH_NOMBRE, DISCORD_DEV, PAYPAL

### Community 78 - "Match Finish API"
Cohesion: 0.50
Nodes (3): ref_shared_lp, body, Fila

### Community 79 - "Clips Migration"
Cohesion: 0.83
Nodes (3): clip, clip_orden, public_clips

### Community 80 - "Host Drag And Drop"
Cohesion: 0.67
Nodes (3): alSeleccionar(), alSoltar(), tras()

### Community 83 - "Dependency Overrides"
Cohesion: 0.67
Nodes (3): overrides, @vercel/analytics, vue-router

## Knowledge Gaps
- **597 isolated node(s):** `semi`, `singleQuote`, `printWidth`, `trailingComma`, `vueIndentScriptAndStyle` (+592 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 749 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **35 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `Shared Domain Utilities` to `Public Views Unit Test`, `LP & Match Domain Logic`, `Draft Team Assignment`, `Roster & Name Matching`, `Excel Spreadsheet Reader`, `Settings Links & Timer`, `Nuxt Project Dependencies`, `Live Public Projection`, `Economy Loans & Pricing`, `Tier List Domain Logic`?**
  _High betweenness centrality (0.178) - this node is a cross-community bridge._
- **Why does `zod` connect `Zod Validated API Bodies` to `Tier Entries API`, `Public & Ledger API Routes`, `Patch Notes API`, `Match Finish API`, `Catalog & Loans API`, `Server Utility Loaders`, `Nuxt Project Dependencies`, `Periods API`, `Session Participants API`, `Settings & Timer API`?**
  _High betweenness centrality (0.090) - this node is a cross-community bridge._
- **Why does `@playwright/test` connect `E2E Playwright Test Suite` to `Nuxt Project Dependencies`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **What connects `semi`, `singleQuote`, `printWidth` to the rest of the system?**
  _597 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `E2E Playwright Test Suite` be split into smaller, more focused modules?**
  _Cohesion score 0.05962732919254658 - nodes in this community are weakly interconnected._
- **Should `Core Database Schema` be split into smaller, more focused modules?**
  _Cohesion score 0.07431693989071038 - nodes in this community are weakly interconnected._
- **Should `Generated Supabase Types` be split into smaller, more focused modules?**
  _Cohesion score 0.0392156862745098 - nodes in this community are weakly interconnected._