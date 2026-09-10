# CopaPerso — Plan por fases con pruebas de cierre

Regla general: **una fase no se cierra hasta que sus pruebas pasan.**
Cada fase termina desplegada en Vercel (preview) contra el Supabase de staging.

Herramientas de prueba:
- **Unit / reglas**: Vitest (cálculo de LP, costos, validaciones).
- **Integración / API**: Vitest + Supabase local (`supabase start`), base sembrada y reseteada por test.
- **E2E**: Playwright (flujos del host de punta a punta).
- **Manual**: guion de humo que se ejecuta a mano antes de cerrar cada fase.

---

## Fase 0 — Especificación y wireframes  *(1 semana)*

**Entregables**
- Wireframes validados de: CCTM Manager, registro/autocomplete, panel aleatorio, swap, negociación,
  Blue Shell, resultado de partida, roster, tier manager, home, login y vista pública en vivo.
- ~~Tabla oficial de costos~~ **cerrado:** rigen los valores de §13.
- ~~Diccionario cárcel / cementerio / reingreso~~ **cerrado:** son tres cosas distintas.
- ~~Interés de préstamos~~ **cerrado:** 10 % del monto original por día, lineal.
- ~~Equivalencia bits ↔ subs~~ **cerrado:** no hay tipo de cambio; 1 sub NA/EUW o 2 LATAM valen cualquier
  recompensa y lo decide el streamer.
- ~~¿Las recompensas ejecutan la acción?~~ **cerrado:** no. El host mueve a los participantes a mano.

**Pruebas de cierre**
1. Recorrido en voz alta de una CopaPerso completa señalando cada pantalla; ninguna acción del stream se
   queda sin pantalla donde ejecutarse.
2. Prueba del "caso raro": llega un jugador a mitad de la partida 2, paga con 1 sub LATAM y quiere entrar
   off-role al Team 2 sacando a alguien a la banca → se puede describir con las pantallas existentes.
3. Todos los campos del modelo de datos tienen una pantalla que los escribe y una que los lee.

---

## Fase 1 — Fundaciones  ·  ✅ CERRADA (9 de septiembre de 2026)

**Entregables**

- ✅ Repo git + Nuxt 4 + TypeScript + ESLint/Prettier + CI en GitHub Actions.
- ✅ Proyecto Supabase en producción, con el esquema aplicado desde las migraciones versionadas.
- ✅ Login del host: sesión de Supabase **y** comprobación de `app_user` en el servidor.
- ✅ Storage con recorte cuadrado 512×512 hecho en el servidor.
- ✅ Identidad visual aplicada + pipeline `assets/` → `public/` (5 MB → 748 kB).
- ✅ Historial de acciones con payload inverso, listo para el "deshacer" de la Fase 3.
- ✅ Desplegado en Vercel.

**Pruebas de cierre — 10 unitarias y 10 de punta a punta, todas en verde**

| # | Prueba | Resultado |
|---|---|---|
| 1 | `lint`, `typecheck`, `test` y `build` | ✅ verde |
| 2 | Anónimo en `/host` → login; entrar; salir; vuelve a bloquear | ✅ |
| 3 | Con la llave pública, `INSERT`/`SELECT` sobre `player` y `ledger_account` fallan; las vistas públicas se leen | ✅ |
| 4 | Foto apaisada de 4,3 MB → 512×512 webp publicada, y registrada en el log | ✅ 4,3 MB → 47 kB |
| 5 | Las migraciones levantan el esquema desde cero | ✅ 25 tablas, 3 vistas, 2 buckets, catálogo sembrado |
| 6 | Realtime: un cambio llega a otro espectador en menos de 2 s | ✅ **60 ms** |

Comprobación rápida de cualquier entorno: `npm run db:check`.

**Lo que se corrigió durante las pruebas**

- `serverSupabaseUser()` devuelve los claims del JWT, donde el id va en `sub`, no en `id`
  (corregido en `05652d9`).
- Los e2e pulsaban botones antes de que Vue hidratara. La app marca ahora
  `<html data-hydrated>` y los tests lo esperan: sin eso, fallaban sin que nada estuviera roto.
- La navegación tenía enlaces a secciones aún no construidas. Ahora existen como páginas que
  dicen en qué fase llegan, en vez de dar 404.

---

## Fase 2 — Jugadores, periodos y sesiones  ·  ✅ CERRADA (9 de septiembre de 2026)

**Entregables**

- ✅ Perfiles permanentes con slug único y detección de duplicados.
- ✅ Parser de la línea del stream: `Target Mid/Jg Challenger`, con sinónimos en español.
- ✅ Autocomplete que propone perfiles existentes y caza erratas.
- ✅ Periodos: abrir mes, cerrar el anterior, sembrar el catálogo de recompensas.
- ✅ Sesiones numeradas por periodo, con sus dos equipos creados de entrada.
- ✅ Participaciones con 100 LP, y baja que no toca el perfil permanente.

**Pruebas de cierre — 25 unitarias nuevas y 4 de punta a punta**

| # | Prueba | Resultado |
|---|---|---|
| 1 | Parser, 12 casos mínimo | ✅ **19 casos** |
| 2 | Duplicados: Target / Taget / Targte / TARGET proponen el mismo perfil | ✅ 10 casos |
| 3 | Registrar nuevo → teclear el principio → elegirlo: 1 perfil y 1 participación | ✅ |
| 4 | Mes nuevo vacío; quien vuelve entra con 100 LP y el mes anterior no cambia | ✅ |
| 5 | Quitar del periodo no borra el perfil permanente | ✅ |
| extra | Cinco registros seguidos con Enter sin perder ninguno | ✅ |

Total acumulado: **44 unitarias + 15 de punta a punta**.

**Lo que se corrigió durante las pruebas**

- **Zona horaria en la apertura de mes.** `new Date('2026-10-01')` se interpreta como medianoche UTC,
  que en México es todavía el 30 de septiembre: abrir el mes la noche del día 1 habría creado el
  periodo del mes anterior. Las fechas se construyen ahora en local (`shared/period.ts`, con test).
- **Sesión perdida en el servidor.** El middleware usaba `$fetch`, que no reenvía las cookies del
  navegador cuando corre en SSR; cualquier navegación completa dentro de `/host` rebotaba al login.
  Ahora usa `useRequestFetch`.
- **El aviso de "registrado" se borraba al instante**, porque vaciar el campo disparaba el mismo
  watch que limpia los mensajes. El host nunca habría visto la confirmación.
- **Borrar a un moderador era imposible**: el historial lo referenciaba y la base lo impedía.
  La migración `20260909000005` deja el autor a NULL en vez de bloquear, así el historial nunca se pierde.

---

## Fase 3 — CCTM Manager  *(3–3.5 semanas, la fase más grande)*

### 3A — Banca, equipos y asignación  *(1.5 sem)*
Registro en vivo, banca de jugadores, asignación directa, drag & drop, swap, roles, eliminar de sesión,
devolver a banca, panel aleatorio.

**Pruebas de cierre 3A**
1. Unit del aleatorio: solo elige jugadores en estado `bench`; con 200 tiradas sobre 10 jugadores la
   distribución no se desvía más de ±15 % de lo uniforme; con banca vacía devuelve error controlado.
2. E2E drag & drop: arrastrar de banca a Team 1 / MID; recargar la página; sigue ahí.
3. E2E swap: Target (T1/MID) ↔ PlayerA (T2/ADC) → intercambian equipo y **conservan su rol** (§11);
   el log registra dos movimientos.
4. Integración: el mismo jugador no puede estar en dos equipos; rol duplicado según lo que se defina.
5. E2E: eliminar de la sesión → desaparece del panel, el `player` y su histórico siguen existiendo.
6. Manual (cronometrada): registrar 10 jugadores desde cero y formar 2 equipos completos en **menos de 3 minutos**.

### 3B — Economía y estados  *(1 sem — se reduce: no hay motor de acciones)*
Banco de bits/subs, donadores externos, catálogo de recompensas como lista de precios, bitácora de
recompensas reclamadas, préstamos, cárcel, cementerio, restricciones, notas, extras.

**Principio de esta entrega:** ninguna recompensa ejecuta cambios. El host cumple la recompensa moviendo él
mismo a los participantes con las herramientas de 3A; el sistema solo deja constancia.

### Timer de negociación *(añadido en septiembre de 2026)*

En el stream el host abre un cronómetro de 15 minutos (escribible: puede poner 10, 20 o los que quiera).
Al agotarse, **los precios de todas las recompensas se triplican** y empieza un tiempo extra.

- Cronómetro en la barra superior del CCTM, con duración escribible, iniciar / pausar / reiniciar.
  **Los tramos son libres:** el host lo reinicia cuantas veces quiera con la duración que quiera.
- Al llegar a cero, aviso emergente con dos botones: **«Triplicar precios»** y **«Solo cerrar»**.
- El ×3 es **fijo** y se aplica **una sola vez por sesión**. Si el cronómetro vuelve a agotarse estando
  ya triplicado, el aviso lo dice y no vuelve a ofrecerlo.
- Botón para **deshacer la triplicación** y volver a precio normal.
- El multiplicador vive en la sesión, no en el catálogo: los precios de los meses siguientes no se tocan
  (ver `docs/02-modelo-de-datos.md`, A7).
- Todo el panel muestra el precio ya multiplicado, con una marca visible de que está en ×3.
- **El cronómetro también se ve en la vista pública en vivo** (Fase 4B), con aviso sonoro sutil y un
  control de silencio: el navegador no deja sonar audio si el espectador no ha interactuado antes.

**El aviso no bloquea.** Si salta a mitad de una asignación, el host lo cierra y sigue; el cronómetro
nunca congela el panel ni impide registrar a nadie.

**Pruebas de cierre 3B**
1. Unit del catálogo sembrado con §13: cupo (entrar en lugar de alguien) 200, cambio de Team 150,
   sacar de banca 200, cambio de rol y reingreso 300, sacar del cementerio 300, Blue Shell 500. Cada costo
   se lee del catálogo, nunca de una constante en el código.
2. Integración: cambiar el costo de "cambio de Team" no altera las negociaciones ya registradas.
3. **Test de "no automatismo":** registrar la recompensa "cambio de Team" para Target → la bitácora la
   guarda, y los equipos, los roles y el saldo del banco quedan **exactamente igual** que antes. Si algo se
   movió solo, el test falla.
4. E2E: crear un supporter que no juega, darle 1000 bits, registrar un Blue Shell reclamado a su nombre y
   ajustar el saldo a mano → el banco muestra 500 y hay dos asientos en el historial.
5. E2E del cupo: alguien del cementerio entra en lugar de un jugador ya seleccionado; el host lo mueve a mano
   y el desplazado vuelve a la banca; la bitácora registra 200 bits.
6. Integración: los saldos del banco sobreviven al cierre de sesión y al cambio de periodo (§14).
7. Unit de préstamos con la regla real (10 % lineal por día sobre el monto original):
   400 bits → día 1 = 440, día 2 = 480, día 3 = 520, día 12 = 880. Más un caso de préstamo saldado.
8. E2E de los estados, que son distintos: **cárcel** (castigo del host), **cementerio** (no alcanzó a
   inscribirse, con el draft ya arrancado) y **cambio de rol y reingreso** de alguien ya sorteado. Cada uno
   deja su propio rastro en el log.

### 3C — Log y deshacer  *(1 sem)*
Historial cronológico, undo de acciones reversibles.

**Pruebas de cierre 3C**
1. Integración: cada mutación de la API escribe exactamente **una** entrada de log con actor, timestamp y payload inverso.
2. Integración: `undo` de asignación, de swap, de cambio de rol, de negociación, de asiento del banco y de
   resultado de partida deja la base **idénticamente** igual que antes (comparación de snapshot de tablas).
3. Integración: `undo` dos veces sobre la misma acción no aplica el efecto dos veces (idempotencia).
4. Integración: las acciones no reversibles (cierre de sesión, cierre de periodo) rechazan el undo con un
   mensaje claro.
5. Manual: 30 acciones seguidas y deshacer 5 salteadas sin dejar el panel en un estado imposible.

---

## Fase 4 — Partidas, resultados y LP  *(1.5 semanas)*

**Entregables**
- Iniciar partida (snapshot de equipos), finalizar con ganador, asignar MVP / ACE / Off Role,
  Blue Shell con ruleta, cálculo de LP, volver a jugar, devolver equipos a banca, varias partidas por sesión.

**Pruebas de cierre**
1. Unit de LP, tabla completa: victoria +15, derrota −15, MVP +5, ACE +10, off-role +2, doble derrota −30
   con 2 derrotas; y el combinado victoria + MVP + off-role = +22.
2. Integración del snapshot (§28): iniciar partida → mover a un jugador de equipo → finalizar. El resultado
   se aplica a la composición **congelada al inicio**, no a la actual.
3. Integración: jugador en la banca al iniciar la partida no recibe LP ni aparece en el roster de esa partida.
4. Integración: doble derrota de un jugador del equipo ganador → el equipo gana, ese jugador registra
   derrota y −30 LP.
5. Unit de la ruleta del Blue Shell: los 4 resultados salen en 400 tiradas; "girar de nuevo" no guarda nada;
   "cancelar" no deja rastro; "guardar" crea el evento.
6. E2E: sesión con 3 partidas, negociación entre la 1 y la 2, "devolver equipos a banca" antes de la 3 →
   el LP acumulado de un jugador que jugó las 3 es correcto y los saldos de bits no cambiaron (§26).
7. Integración: deshacer el resultado de la partida 2 recalcula el LP de los 10 jugadores.

---

## Fase 4B — Vista pública en vivo  *(1 semana)*

Entra al MVP por decisión del host, por eso Realtime se habilita ya en la Fase 1.

**Entregables**
- Ruta pública `/en-vivo`: equipos en formación, estado de la sesión, marcador de partidas y última acción.
- **Cronómetro de negociación visible**, con aviso sonoro sutil al agotarse y control de silencio que
  recuerda la elección del espectador.
- Suscripción Realtime con reconexión automática y estado "sin conexión" visible.
- Modo overlay opcional (`?overlay=1`, fondo transparente) por si algún día se pone en OBS.

**Pruebas de cierre**
1. Integración: el payload de `/en-vivo` **no contiene** bits, saldos, préstamos, cárcel, restricciones ni
   notas. Test que falla si alguno de esos campos aparece en la respuesta.
2. E2E: el host asigna un jugador a Team 1 → la vista pública lo refleja en menos de 2 s sin recargar.
3. E2E: cortar la conexión de la vista pública 30 s → al volver se resincroniza sola con el estado correcto.
4. Carga: 200 espectadores simultáneos sobre la misma sesión sin degradar el panel del host.
5. Manual: con la sesión cerrada, la ruta muestra "no hay sesión en vivo", no una pantalla rota.

---

## Fase 5 — Roster e histórico  *(1 semana)*

**Entregables**
- Vista por periodo con W, L, WR, LP, MVP, ACE, off-role; filtros, búsqueda, orden, exportar CSV;
  ficha de jugador con su histórico entre periodos.

**Pruebas de cierre**
1. Integración: sembrar 3 sesiones con resultados conocidos → cada número del roster coincide con el
   cálculo hecho a mano (fixture con valores esperados escritos a mano).
2. Integración: WR redondeado igual en la UI y en el CSV; jugador con 0 partidas muestra `—`, no `NaN` ni 0 %.
3. Integración: cambiar de periodo no mezcla estadísticas; el mes anterior queda congelado.
4. E2E: exportar CSV y verificar cabeceras y número de filas.
5. Rendimiento: roster de 60 jugadores y 20 sesiones responde en menos de 500 ms.

---

## Fase 6 — Tier Ranking Manager  *(1 semana)*

**Entregables**
- Tiers D/C/B/A/S/S+, drag & drop entre tiers, foto, edición de datos, publicar edición, histórico de ediciones.

**Pruebas de cierre**
1. E2E: mover un jugador de A a S+, publicar, y verlo reflejado en la Home pública.
2. Integración: publicar una edición nueva no modifica las anteriores; la Home siempre muestra `is_current`.
3. Integración: un jugador sin foto usa el avatar por defecto sin romper el layout.
4. Manual: ordenar 40 jugadores en 6 tiers sin lag perceptible.

---

## Fase 7 — Home pública  *(1.5 semanas)*

**Entregables**
- Hero, qué es CopaPerso, modos de juego, cómo participar, reglas, premios, Tier Ranking público,
  enlace a la vista en vivo, Twitch, redes, clips, patrocinadores. Responsive y SEO.

**Pruebas de cierre**
1. Lighthouse en móvil: Performance ≥ 90, Accesibilidad ≥ 95, SEO ≥ 95.
2. Visual: 360 px, 768 px, 1440 px sin scroll horizontal ni texto cortado.
3. E2E: usuario anónimo no puede alcanzar ninguna ruta `/host/*` ni ningún endpoint de escritura (403).
4. Integración: la Home no expone datos privados (bits, préstamos, cárcel, notas) en el HTML ni en el payload.
5. Manual: og-image correcta al pegar el enlace en Discord, X y WhatsApp.

---

## Fase 8 — Prueba real en stream  *(1 sesión + 1 semana de ajustes)*

**Entregables**
- Una CopaPerso completa operada **solo** con la aplicación, con el Excel abierto al lado como red de seguridad.

**Pruebas de cierre**
1. Ensayo previo con 10 jugadores falsos: sesión completa de 3 partidas sin tocar la base a mano.
2. Simulacro de caída: cortar el wifi 30 s a mitad de una asignación → al volver, no se perdió ni se duplicó nada.
3. Durante el stream real: cero intervenciones manuales en la base de datos.
4. La vista pública en vivo aguantó la audiencia real sin cortarse.
5. Al terminar: el roster de la app coincide con lo que habría dado el Excel.
6. Bitácora de excepciones encontradas, priorizada, con cada caso convertido en issue.

---

## Resumen de tiempos

| Fase | Duración estimada |
|---|---|
| 0 · Especificación | 1 sem |
| 1 · Fundaciones (incluye Realtime) | 1 sem |
| 2 · Jugadores y sesiones | 1 sem |
| 3 · CCTM Manager (3A/3B/3C) | 3–3.5 sem |
| 4 · Partidas y LP | 1.5 sem |
| 4B · Vista pública en vivo | 1 sem |
| 5 · Roster | 1 sem |
| 6 · Tier Manager | 1 sem |
| 7 · Home pública | 1.5 sem |
| 8 · Prueba real | 1 sesión + 1 sem |
| **Total** | **≈ 11.5–13.5 semanas** |

**Camino corto si hay prisa por usarlo en la próxima CopaPerso:** Fases 1 → 2 → 3A → 4 (unas 6 semanas)
ya permiten operar el torneo en vivo; economía (3B), vista pública, roster, tier y home pueden seguir en
Excel o en el stream mientras tanto.
