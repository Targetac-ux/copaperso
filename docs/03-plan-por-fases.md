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

### 3A — Banca, equipos y asignación  ·  ✅ CERRADA (10 de septiembre de 2026)

**Entregables**

- ✅ Mesa de control en `/host`: barra de sesión, banca, los dos equipos y panel de acciones.
- ✅ **Registro en vivo desde la propia mesa** (§7): se teclea la línea del chat y entra a la banca,
  o directo a un equipo con su rol, sin salir de la pantalla.
- ✅ Banca de jugadores con búsqueda, y alta desde los registrados del mes.
- ✅ Arrastrar y soltar de la banca a cualquiera de los diez puestos.
- ✅ Panel Aleatorio: sortea, pero **no asigna**; el host elige rol y equipo.
- ✅ Swap conservando el rol, con dos líneas en el historial.
- ✅ Cárcel, cementerio, devolver a la banca y sacar de la sesión.
- ✅ Devolver los dos equipos a la banca de golpe.
- ✅ Historial de la sesión en vivo.

**Pruebas de cierre — 19 unitarias nuevas y 6 de punta a punta**

| # | Prueba | Resultado |
|---|---|---|
| 1 | Aleatorio: solo saca gente disponible; reparto parejo en 200 tiradas; banca vacía da error controlado | ✅ 8 casos |
| 2 | Arrastrar de banca a Team 1 / MID, recargar, sigue ahí | ✅ |
| 3 | Swap: intercambian equipo **conservando el rol**, dos entradas en el log | ✅ |
| 4 | El mismo jugador no puede ocupar dos puestos | ✅ |
| 5 | Sacar de la sesión no borra el perfil ni la participación del mes | ✅ |
| 6 | Diez jugadores desde cero a 5v5 | ✅ **64 s** automatizado (límite: 3 min) |
| 7 | Registrar en vivo desde el CCTM, a la banca y directo a un equipo | ✅ |

Total acumulado: **63 unitarias + 22 de punta a punta**.

**Decisiones que se tomaron construyendo**

- **Casi nada se prohíbe.** El plan dice que el host manda (§1), así que rol repetido en un equipo y
  off-role son **avisos** con un «Hacerlo igual», no bloqueos. Solo se impide lo que dejaría la sesión
  rota: sexto jugador en un equipo, o alguien en dos equipos a la vez.
- **El sorteo no asigna.** Enseña quién salió y espera; rol y equipo los decide el host (§9).
- **Cada acción devuelve el estado entero** recalculado por el servidor, y la pantalla lo reemplaza. En
  directo vale más una pantalla que siempre dice la verdad que una rápida que puede desincronizarse.

**Observación de rendimiento:** cada acción cuesta uno o dos segundos de ida y vuelta a Supabase. Con
veinte acciones son unos 30 s solo de latencia. Si en el uso real se nota lento, la salida es pintar el
cambio en la pantalla antes de que conteste el servidor (actualización optimista) y revertir si falla.

---

### 3B — Economía y estados  ·  ✅ CERRADA (10 de septiembre de 2026)

**Entregables**

- ✅ **Cronómetro de negociación** en la barra del CCTM: 15 min por defecto, duración escribible
  (`5`, `10 min`, `12:30`, `90s`), iniciar / pausar / reiniciar las veces que haga falta.
- ✅ **Aviso al agotarse** con «Triplicar precios» y «Solo cerrar», enseñando el antes y el después.
  No bloquea el panel, y si ya estaban en ×3 lo dice en vez de volver a ofrecerlo.
- ✅ Lista de precios con el ×3 aplicado y botón para deshacerlo.
- ✅ Bitácora de recompensas reclamadas, con el costo efectivo y si estaba triplicado.
- ✅ Banco de bits/subs con donadores externos y movimientos manuales.
- ✅ Préstamos con interés lineal del 10 % diario.
- ✅ Paneles de cárcel y cementerio.
- ✅ Notas, extras (bonus, penalización, premio, condición) y restricciones por jugador.

**Pruebas de cierre — 23 unitarias nuevas y 8 de punta a punta**

| # | Prueba | Resultado |
|---|---|---|
| 1 | Catálogo sembrado con §13; los costos se leen del catálogo, nunca de constantes | ✅ |
| 2 | **Registrar una recompensa no mueve a nadie ni descuenta saldo** | ✅ |
| 3 | Cambiar un precio no altera lo ya registrado | ✅ |
| 4 | Triplicar sube los precios de la sesión y **el catálogo del mes no se toca** | ✅ |
| 5 | Deshacer el ×3 devuelve los precios sin reescribir lo cobrado | ✅ |
| 6 | El aviso salta una sola vez y no bloquea el panel | ✅ |
| 7 | Con los precios ya en ×3, el aviso no vuelve a ofrecerlo | ✅ |
| 8 | Cronómetro: 15:00 por defecto, duración escribible, arranca y pausa | ✅ |
| 9 | Préstamo de 400 bits a 12 días | ✅ **880** |
| 10 | Notas, extras y restricciones sobreviven a recargar | ✅ |

Total acumulado: **86 unitarias + 30 de punta a punta**.

**Decisiones que se tomaron construyendo**

- **La sesión guarda un booleano, no un multiplicador.** Como el ×3 es fijo y se aplica una sola vez,
  un número invitaría a estados que no existen (×6, ×9) y a dudar si es acumulable.
- **La hora de fin del cronómetro vive en el servidor**, no en el navegador: así el host y los
  espectadores verán lo mismo en la Fase 4B aunque sus relojes no coincidan.
- **El precio se congela al registrar la recompensa.** Subir el catálogo después no reescribe lo cobrado.

**Pendiente para la vista pública (Fase 4B):** el cronómetro con aviso sonoro sutil y control de silencio.

---

### 3C — Historial y deshacer  ·  ✅ CERRADA (10 de septiembre de 2026)

**Entregables**

- ✅ Historial de la sesión con hora, actor y qué pasó, en tres columnas bajo la mesa.
- ✅ Botón **«Deshacer lo último»** y un ↶ por entrada, para deshacer una concreta.
- ✅ Lo deshecho se queda **tachado** en el historial, no desaparece.
- ✅ Ejecutor de reversión con 19 operaciones: draft, estados, banco, préstamos, catálogo,
  recompensas, notas, restricciones, perfiles y participaciones.

**Pruebas de cierre — 7 de punta a punta**

| # | Prueba | Resultado |
|---|---|---|
| 1 | Cada mutación deja **exactamente una** entrada, con actor y payload inverso | ✅ |
| 2 | Tras deshacer, la base queda **idéntica** (retrato de tablas antes/después) | ✅ |
| 3 | Deshacer dos veces la misma acción no repite el efecto | ✅ 409 |
| 4 | Lo irreversible se rechaza con un mensaje claro | ✅ 422 |
| 5 | Deshacer un movimiento del banco devuelve el saldo | ✅ |
| 6 | Deshacer una acción antigua con otras encima no rompe el panel | ✅ |
| 7 | Lo deshecho queda tachado y no se puede volver a deshacer | ✅ |

Total acumulado: **86 unitarias + 37 de punta a punta**.

**El fallo que encontraron las pruebas**

«Deshacer lo último» resolvía en la pantalla cuál era la última acción. Pero el historial del cliente
puede ir un instante por detrás —basta que la petición anterior siga en vuelo— y entonces el botón
deshacía **una acción distinta de la que el host acababa de hacer**: en la prueba, deshizo el registro
de un jugador en vez de su asignación. En directo, ese es el tipo de error que nadie nota hasta que el
roster no cuadra.

Ahora el botón no manda ningún id: pide al servidor deshacer la última, y es el servidor quien decide
cuál es en ese instante. Los ↶ individuales sí mandan id, porque ahí no hay ambigüedad.

**Decisiones que se tomaron construyendo**

- **La entrada se marca como deshecha ANTES de revertir.** Es lo que hace que pulsar dos veces seguidas
  no aplique el efecto dos veces. Si la reversión falla, se desmarca.
- **El ejecutor es tolerante.** El host puede deshacer algo antiguo con diez acciones encima; si lo que
  había que revertir ya no existe, se da por hecho en vez de reventar a mitad del stream.
- **El banco se corrige, no se reescribe.** Deshacer un movimiento anota el asiento contrario en vez de
  borrar el original: el rastro del dinero nunca se pierde.
- **Un perfil que ya jugó no se borra al deshacer su alta**, porque se llevaría su histórico por delante.

---

### 3D — Ajustes tras la primera prueba  ·  ✅ CERRADA

Salidos de usar el CCTM de punta a punta por primera vez.

**Entregables**

- ✅ Elo **Demon** con su regla de balance 1:1, aviso al llegar a dos de diferencia y recuento en la
  cabecera de cada equipo.
- ✅ El sorteo pasa a la columna central, **justo debajo de Team 1 y Team 2**, que es donde sobraba
  sitio; los **Canjeos en bits** (antes «Recompensas») pasan a la columna derecha, en su propio panel.
- ✅ Roles de los equipos más grandes y con un color por rol, según la convención de LoL.
- ✅ **Pausar el cronómetro para de verdad.** Antes solo se marcaba como parado y el número seguía
  bajando; ahora se congela lo que quedaba y reanudar sigue desde ahí.
- ✅ El cronómetro acepta **tiempos cortos** (`10s`): el mínimo baja de 30 a 5 segundos.
- ✅ **Tic-tac** mientras corre, generado con la Web Audio API —sin archivos de sonido—, más rápido
  en el último minuto y silenciable con memoria entre recargas.

**Pruebas**

| # | Prueba | Resultado |
|---|---|---|
| 1 | El balance de Demons avisa a 2 de diferencia y no antes | ✅ 8 unitarias |
| 2 | `Target MID Demon` se lee como elo Demon | ✅ |
| 3 | Pausado, el cronómetro no sigue bajando | ✅ unitaria + e2e |
| 4 | Reanudar sigue desde donde se quedó; reiniciar vuelve a la duración configurada | ✅ |
| 5 | `10s` da 00:10, no 00:30 | ✅ |
| 6 | El segundo Demon en el mismo equipo avisa, y «Hacerlo igual» lo aplica | ✅ e2e |
| 7 | Diez jugadores a dos equipos completos, arrastrando | ✅ e2e · 58 s |

Total acumulado: **100 unitarias** y **40 e2e**, todas en verde con las dos migraciones aplicadas.

**Dos cosas que salieron al correr los e2e de cierre, y que no venían en el plan:**

- **Los equipos se colocaban debajo de toda la banca.** Mientras el sorteo estuvo anclado a la
  columna 1, el flujo automático del grid empujaba el cursor a la fila 2 y los equipos —que ocupaban
  dos filas— se colocaban ahí en vez de al lado de la banca: con la banca llena quedaban fuera de la
  pantalla y no se podía arrastrar a nadie sin hacer scroll. Al mudar el sorteo a la columna central
  la mesa vuelve a ser de una sola fila y el problema desaparece de raíz.
- **Los e2e corrían en cinco procesos a la vez.** `fullyParallel: false` solo ordena los tests
  *dentro* de cada fichero: los ficheros seguían en paralelo, y todos trabajan sobre la misma sesión
  abierta del host. De ahí los fallos intermitentes de las fases anteriores, que nunca se
  reproducían al lanzar un spec suelto. Ahora `workers: 1`.

**Migraciones de esta fase** (aplicadas): `20260914000001_elo_demon.sql` y
`20260914000002_timer_pausa.sql`. Van separadas porque Postgres no deja usar un valor de enum recién
creado en la misma transacción.

---

## Fase 4 — Partidas, resultados y LP  ·  ✅ CERRADA

**Entregables**
- ✅ Iniciar partida congelando la alineación (§28), finalizar con ganador, MVP, ACE, off role y doble
  derrota, cálculo de LP por eventos, varias partidas por sesión y deshacer el resultado entero.
- ✅ Ruleta del Blue Shell: gira en pantalla y solo guarda si el host guarda.
- ✅ Control de partida en la barra de la sesión, con el marcador, y lista de partidas jugadas en la
  columna central.

**Pruebas**

| # | Prueba | Resultado |
|---|---|---|
| 1 | La tabla de LP entera, incluido victoria + MVP + off role = +22 | ✅ 21 unitarias |
| 2 | El resultado se aplica a la alineación congelada, no a los equipos de ahora | ✅ e2e |
| 3 | Quien se queda en la banca no entra en la alineación ni cobra LP | ✅ e2e |
| 4 | Doble derrota a alguien del equipo ganador: el equipo gana, él registra −30 | ✅ e2e |
| 5 | La ruleta saca los 4 resultados; girar y cancelar no dejan rastro | ✅ 6 unitarias + e2e |
| 6 | Tres partidas en una sesión; los saldos de bits no se tocan (§26) | ✅ e2e |
| 7 | Deshacer el resultado revierte el LP de los diez, sin borrar los eventos | ✅ e2e |
| 8 | Cerrar la partida no puede volverse lento | ✅ e2e · 1,8 s |

Total acumulado: **127 unitarias** y **51 e2e**.

**Lo que se decidió sobre la marcha**, porque el plan no lo fijaba:

- **El ACE** se asigna a mano como el MVP, uno por partida, y puede recaer en el mismo jugador
  (victoria + MVP + ACE son +30). No hay regla automática que lo deduzca.
- **La ruleta reparte los cuatro resultados por igual** (25 % cada uno). El plan no da pesos; el
  reparto está en un solo sitio (`shared/blueshell.ts`) por si algún día hay que torcerlo.
- **Se puede empezar y cerrar con equipos incompletos.** Manda el host (§1): al cerrar se avisa de
  con cuántos se jugó, y ya está.
- **Las reglas de LP son las mismas en todos los modos.** Cuando la Copa Tryhard o la Random tengan
  las suyas, entran en `shared/lp.ts`.
- **Guardar el Blue Shell no ejecuta el castigo**, igual que los canjeos (A6-bis): si sale doble
  derrota, viene marcada al cerrar la partida y el host decide.

**Un arreglo que salió de las pruebas:** cerrar una partida tardaba **4,4 s** porque escribía jugador
a jugador —diez idas y vueltas para la alineación y otras diez para recalcular el LP—. Agrupando las
escrituras por resultado y lanzando los recálculos a la vez baja a **1,8 s**. Es la acción más
apurada de la noche, así que hay un test que falla si vuelve a pasar de 6 s.

**Queda para 4B:** `session.status` nunca pasa a `live`, y la vista pública `public_session_live`
filtra justo por eso, así que hoy sale vacía. La tabla `match_event` tampoco se escribe: `match_player`
ya es la fuente de verdad de las estadísticas (§28) y duplicarlo solo daba dos sitios que mantener.

---

## Fase 4B — Vista pública en vivo  ·  ✅ CERRADA

**Entregables**
- ✅ Ruta pública `/en-vivo`: equipos en formación, banca, marcador, partida en curso y último
  movimiento.
- ✅ Cronómetro de negociación visible, con aviso sonoro sutil al agotarse y silenciador que recuerda
  la elección del espectador (aparte del que usa el host: silenciar el panel no calla la vista).
- ✅ Realtime con reconexión automática y un «Sin conexión» bien visible.
- ✅ Modo overlay (`?overlay=1`): sin cabecera y con fondo transparente, para OBS.

**Cómo llega el estado al público, y por qué así**

Por un canal de **broadcast**, no por cambios de tabla. El espectador no tiene cuenta, así que todo
lo que llegue a su navegador es público para siempre. Escuchando tablas, un permiso mal puesto
enseñaría bits, cárcel o notas; escuchando un canal, el espectador **solo recibe el objeto que el
servidor decide publicar** y no consulta la base ni una vez.

Ese objeto (`shared/live.ts`) pasa una auditoría antes de salir: si alguien añade un campo con
`bits`, `saldo`, `jail`, `restriction`… no se publica. Y el texto del «último movimiento» sale de una
lista blanca de acciones, porque los resúmenes están escritos para el host —«Movimiento en el banco:
−200 bits»— y publicarlos todos filtraría justo lo que esta vista esconde. Deshacer avisa al público
pero sin repetir el texto de lo deshecho.

**Pruebas**

| # | Prueba | Resultado |
|---|---|---|
| 1 | El payload no lleva bits, saldos, préstamos, cárcel, restricciones ni notas | ✅ 20 unitarias + e2e |
| 2 | El host asigna y la pantalla pública lo refleja sin recargar | ✅ e2e · 1,8 s |
| 3 | Se corta la red del espectador, el host mueve, y al volver se resincroniza sola | ✅ e2e |
| 4 | 200 espectadores a la vez | ✅ ver abajo |
| 5 | Sin sesión abierta lo dice, no una pantalla rota | ✅ e2e |
| 6 | El overlay se queda sin cabecera y sin fondo | ✅ e2e |

Total acumulado: **147 unitarias** y **57 e2e**.

**La prueba de carga, y un techo que conviene saber** (`node scripts/carga-en-vivo.mjs 200`)

Los 200 espectadores conectan y **todos** reciben el aviso: 174 ms de mediana, 198 ms el último. El
panel del host no se entera, porque publicar cuesta lo mismo con uno que con doscientos: es un POST,
y el reparto lo hace Supabase.

Pero 200 es **justo el techo** del plan de Supabase contratado, no un número con margen: con esos 200
puestos, el espectador 201 ya no conecta y su pantalla se queda en «Sin conexión». Falla de forma
visible y no rompe nada, pero si la grada puede pasar de 200 hay que subir de plan.

**Un arreglo que salió de las pruebas:** avisar al público costaba **1,9 s a cada acción del host**,
porque armar y publicar el estado se hacía dentro de su petición. Ahora se lanza sin esperarlo
(`waitUntil` donde la plataforma lo ofrece): la acción del host vuelve a ser suya y el público se
entera un cuarto de segundo después de que el host vea su propio cambio.

**Decisiones:**

- **La página se pinta en el navegador** (`ssr: false`). Todo lo que enseña cambia cada pocos
  segundos, así que el HTML del servidor nacía caducado: solo aportaba un parpadeo al hidratar y un
  cronómetro con la hora del servidor.
- **La vista `public_session_live` se queda sin usar.** Se escribió en la Fase 1 pensando en que el
  público leyera tablas; al elegir broadcast dejó de hacer falta. Se conserva porque los tests que
  vigilan que las vistas públicas no filtren nada siguen cubriéndola, y porque `session.status`
  tampoco pasa a `live` hoy.

---

## Disposición de la mesa (cambios del host)

La colocación de las cards la ha ido ajustando el host al usarla en directo. Estado actual:

| Zona | Qué lleva |
|---|---|
| Columna 1 | Banca de jugadores, con el registro en vivo |
| Columna 2 | Team 1 y Team 2, y debajo el sorteo |
| Columna 3 | Canjeos en bits, y debajo las acciones del jugador seleccionado |
| Fila 2, columnas 2-3 | **Banco de bits**, card propia |
| Banda inferior | Partidas · Préstamos · Estados · Notas, en pestañas · Historial |

El banco salió de las pestañas porque es lo que más se consulta durante la negociación —quién tiene
saldo para pujar— y estaba al final de la página. Las partidas ocuparon su hueco en las pestañas: se
miran de vez en cuando, no en mitad de un draft.

**Un intento que hubo que descartar:** para que la columna del centro terminase justo a la altura de
los canjeos se probó a estirar la card del sorteo (`flex: 1`, y también `justify-content:
space-between` en la columna). **Las dos rompen el arrastre de la banca a los equipos** de forma
reproducible: el hueco sigue visible y sin nada encima —comprobado con `elementFromPoint`— pero el
drop deja de registrarse. No hizo falta: como las dos columnas viven en la misma fila del grid, la
segunda fila ya arranca por debajo de la más alta y el banco queda alineado solo.

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
