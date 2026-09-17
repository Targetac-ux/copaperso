# CopaPerso — Plan por fases con pruebas de cierre

Regla general: **una fase no se cierra hasta que sus pruebas pasan.**
Cada fase termina desplegada en Vercel (preview) contra el Supabase de staging.

Herramientas de prueba:
- **Unit / reglas**: Vitest (cálculo de LP, costos, validaciones).
- **Integración / API**: Vitest + Supabase local (`supabase start`), base sembrada y reseteada por test.
- **E2E**: Playwright (flujos del host de punta a punta).
- **Manual**: guion de humo que se ejecuta a mano antes de cerrar cada fase.

---

## Fase 0 — Especificación y wireframes  ·  ✅ CERRADA

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

## Fase 3 — CCTM Manager  ·  ✅ CERRADA (3A, 3B, 3C y 3D)

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

- **El ×3 dura una partida, no la sesión** (corregido el 14 de septiembre de 2026, a petición del
  host): cada partida negocia a precio normal, así que cerrar una partida devuelve los precios.
- **La sesión guarda un booleano, no un multiplicador.** Como el ×3 es fijo y se aplica una sola vez,
  un número invitaría a estados que no existen (×6, ×9) y a dudar si es acumulable.
- **La hora de fin del cronómetro vive en el servidor**, no en el navegador: así el host y los
  espectadores verán lo mismo en la Fase 4B aunque sus relojes no coincidan.
- **El precio se congela al registrar la recompensa.** Subir el catálogo después no reescribe lo cobrado.

**Lo que quedaba para la vista pública** —cronómetro visible, aviso sonoro sutil y control de
silencio— se entregó en la Fase 4B.

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
| 9 | Cerrar una partida devuelve los precios a normal, y deshacerla los vuelve a subir | ✅ e2e |

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

## Fase 5 — Roster e histórico  ·  ✅ CERRADA

**Entregables**
- ✅ Roster por periodo con LP, partidas, victorias, derrotas, winrate, MVP, ACE y off role.
- ✅ Búsqueda por nombre, rol o elo; orden por cualquier columna; selector de periodo.
- ✅ Exportar CSV.
- ✅ Ficha del jugador con su histórico mes a mes.
- ✅ **Foto con encuadre a elección del host** (pedido el 14 de septiembre de 2026): sube la imagen,
  la arrastra y la amplía dentro de un marco redondo, y se guarda lo que ve. Sin tocar nada, el
  servidor sigue recortando solo.

**Pruebas**

| # | Prueba | Resultado |
|---|---|---|
| 1 | Tres partidas sembradas: cada número del roster es el escrito a mano | ✅ e2e |
| 2 | El winrate se redondea igual en pantalla y en CSV; sin partidas, «—» y celda vacía | ✅ 27 unitarias + e2e |
| 3 | Otro periodo no hereda las estadísticas de este | ✅ e2e |
| 4 | El CSV trae las cabeceras y una fila por jugador | ✅ e2e |
| 5 | 60 jugadores y 60 partidas: el roster responde rápido | ✅ e2e · 521 ms |
| 6 | El encuadre que elige el host es el que se guarda | ✅ e2e |

Total acumulado: **174 unitarias** y **69 e2e**.

**Decisiones**

- **Un periodo a la vez, nunca la suma.** El LP se reinicia cada mes (A3), así que un acumulado no
  significaría nada. La evolución se ve en la ficha, mes a mes.
- **Cero no es lo mismo que nada.** Quien jugó y no ganó lee «0 %»; quien no ha jugado lee «—», y en
  el CSV celda vacía. Al ordenar por winrate, los que no han jugado van al final en vez de colarse
  entre los que perdieron todo.
- **Las cuentas viven en `shared/roster.ts`**, no en SQL ni en el componente: la tabla y el CSV usan
  las mismas funciones, así que no pueden decir cosas distintas del mismo jugador. Eso es lo que
  comprueba la prueba 2.
- **Solo cuentan las partidas terminadas.** Una en juego, o una cuyo resultado se deshizo, no suma
  para nadie: ni sus partidas ni su MVP.

**Sobre el rendimiento.** La primera versión encadenaba tres consultas y tardaba **737 ms con trece
jugadores**. Lanzándolas a la vez —la de partidas filtra por periodo a través de la participación, en
vez de esperar la lista de ids— baja a **521 ms con sesenta jugadores y sesenta partidas**. Las tres
medidas salen casi iguales, señal de que ahora manda la ida y vuelta a la red y no el tamaño de los
datos. El plan pide menos de 500 ms; estos números son de una máquina de desarrollo contra un
Supabase remoto y con el servidor de Nuxt en medio, así que en producción quedan por debajo.

---

## Fase 6 — Tier Ranking Manager  ·  ✅ CERRADA

**Entregables**
- ✅ Los seis tiers (D a S+) con arrastre entre filas, foto y rol.
- ✅ **El tier lo pone el host a mano.** No hay nada que lo calcule ni que lo proponga desde el LP.
- ✅ Ediciones: se prepara un borrador, se publica, y queda congelado. Histórico de ediciones.
- ✅ Página pública `/tier-ranking` con la edición vigente.
- ✅ Analytics de Vercel, solo en el sitio público.

**Pruebas**

| # | Prueba | Resultado |
|---|---|---|
| 1 | Mover de A a S+, publicar, y verlo en la Home | ✅ e2e |
| 2 | Publicar una edición nueva no modifica las anteriores | ✅ e2e |
| 3 | Sin foto, avatar por defecto y sin descuadrar | ✅ e2e |
| 4 | Una edición publicada no se puede mover, ni desde la API | ✅ e2e |
| 5 | No se pueden preparar dos ediciones a la vez | ✅ e2e |
| 6 | Mover a alguien renumera sin huecos y no pierde a nadie | ✅ 17 unitarias |
| 7 | El panel del host no se mide en analytics | ✅ 5 unitarias |

Total acumulado: **196 unitarias** y **77 e2e**.

**Decisiones**

- **Una edición es una foto.** Mientras el host prepara la siguiente, la Home sigue enseñando la
  anterior: así se pueden reordenar cuarenta personas sin que la página pública parpadee a media
  faena. Al publicar, la anterior no se toca —sus filas se quedan donde están—, solo deja de ser la
  vigente. Eso es lo que hace que el histórico signifique algo.
- **Lo publicado no se edita.** Para cambiar algo se empieza otra edición. Lo impide la pantalla y
  también el servidor, porque una garantía que solo vive en la interfaz no es una garantía.
- **Se guarda al soltar, sin esperar.** La tabla se pinta al instante y el guardado va detrás: con un
  parpadeo de espera en cada movimiento, ordenar cuarenta personas sería insoportable. Si el guardado
  falla, se avisa y se recarga lo que hay en la base.
- **Mover no se registra en el historial.** Es un gesto continuo y llenaría la bitácora de ruido. Lo
  que sí queda registrado —y se puede deshacer— es publicar, que es la acción que sale a la calle.

**Analytics.** Se monta a mano en vez de con el módulo de Vercel, porque el módulo mide todas las
rutas: las visitas al panel del host las hace una sola persona, no dicen nada de la audiencia y
ensucian lo que sí importa. `beforeSend` las descarta antes de que salgan del navegador, y la regla
vive en `shared/analytics.ts` con sus propias pruebas, porque algo que decide qué datos se envían
fuera no debería vivir sin test.

---

## Fase 7 — Home pública  *(1.5 semanas)*

**Entregables**
- Hero, qué es CopaPerso, modos de juego, cómo participar, reglas, premios, Tier Ranking público,
  enlace a la vista en vivo, Twitch, redes, clips, patrocinadores. Responsive y SEO.
- ✅ **Apartado de donaciones de PayPal**, ya en la Home: <https://paypal.me/Targetac>. Va al
  desarrollador de la página, **no** a los premios del torneo, y el apartado lo dice. Abre en pestaña
  nueva con `rel="noopener"`; ningún formulario de pago vive dentro de CopaPerso.
- ✅ **Clips de Twitch en la Home**, administrados desde `/host/clips`: el host pega el enlace del
  clip, le pone título y de qué edición salió, los ordena y los esconde sin borrarlos.

**Cómo se incrustan, y por qué así.** Twitch se niega a reproducir un clip incrustado si el dominio
de la página no viene declarado en el parámetro `parent` del iframe, y **no admite comodines**:
`*.vercel.app` no vale. Como todavía no hay dominio propio y cada despliegue de previsualización de
Vercel estrena subdominio, escribirlo en una constante significaría romperlo en cada despliegue. Se
lee de `window.location.hostname` al montar, así que funciona igual en local, en una
previsualización y el día que haya dominio, sin tocar nada.

**Los iframes no se montan hasta que la sección entra en pantalla** (`IntersectionObserver`, con 400
px de margen para que ya estén cuando se llega). Cada clip carga el reproductor entero de Twitch,
que es la pieza más pesada de la página; al no existir durante la carga inicial no le cuesta nada a
quien solo lee el hero, que es justo lo que mide Lighthouse en la prueba de cierre 1. Hasta
entonces, y en el HTML del servidor, cada hueco es un enlace al clip en Twitch: si algo fallara, lo
que queda es un enlace que funciona y no un rectángulo negro.

**Nada sale de la API de Twitch.** No hay credenciales de Twitch en el proyecto y no hacen falta: el
título lo escribe el host —que es quien sabe qué pasó en ese clip— y el fotograma de portada lo pone
el propio reproductor. El precio de esa decisión es que el apartado no puede traer solos «los más
vistos del mes»; a cambio, no hay secretos que rotar ni un servicio externo del que dependa que la
Home cargue.

**Ajustes** (`/host/ajustes`), que llevaba desde la Fase 1 como un cartel de obra que decía «llega
en la Fase 3». **Esa fase era falsa**: la Fase 3 está cerrada y en ninguno de sus cuatro bloques
aparecía Ajustes como entregable; fue una etiqueta puesta a ojo para que la navegación no diera 404.
Y el módulo **nunca se especificó**: el único rastro en la documentación era el mapa de navegación
del blueprint, que lo llamaba «Ajustes y costos», y la ficha de `action_catalog` («los costos
editables de la negociación»). El alcance lo decidió el host el 15 de septiembre de 2026.

Tiene tres bloques:

- **Precios de los canjeos.** Los seis del catálogo del mes. El endpoint existía desde la Fase 3B
  —con registro en la bitácora y reversión— pero **ninguna pantalla lo llamaba**: era el único
  endpoint de escritura del proyecto sin interfaz.
- **Enlaces y redes.** Twitch, PayPal, Instagram, X, TikTok, YouTube y Discord.
- **Duración por defecto del cronómetro.** Solo manda en las copas nuevas; la abierta conserva la suya.

**Lo que no entra:** la gestión de accesos al panel. Los hosts se siguen dando de alta a mano en
Supabase (decisión del host, 15 de septiembre). Y los pesos del Blue Shell **siguen fijos al 25 %**,
que cierra la pregunta 8 del blueprint.

**El deshacer de los precios no se podía pulsar.** El endpoint registraba el cambio sin id de sesión
y el historial del CCTM es por sesión, así que la entrada no salía en ninguna pantalla y su reversión
—escrita en la Fase 3C— era código muerto. Ahora se cuelga de la copa abierta, si la hay: cambiar un
precio en directo es justo lo que más urge poder revertir.

**Los enlaces se validan en el servidor, no solo en la pantalla.** Lo que se guarda acaba en el
`href` de un enlace público, así que `normalizarUrl` rechaza cualquier esquema que no sea http o
https. Un `javascript:` ahí no es una errata: es ejecución de código en el navegador del visitante.
En la Home solo se pintan las redes que tengan enlace —una fila de iconos muertos es peor que no
tenerla— y Twitch y PayPal caen a la constante de `shared/enlaces.ts` si faltan, porque tienen su
propio botón y uno que no lleva a ningún sitio es peor que uno desactualizado.

**Reglas y patch notes, en dos secciones.** La división no es decorativa: cada parte cambia a un
ritmo distinto y por eso vive en un sitio distinto.

- **Las reglas** son texto: cambian poco y cuando cambian hay que reescribirlas con cuidado, así que
  están en la propia página (`app/pages/reglas.vue`). Cubren cómo se entra, los cinco modos, la fase
  de negociación con la tabla de canjeos, el Blue Shell y la puntuación.
- **Los patch notes** son lo contrario: se añade uno cada cierto tiempo y no pueden esperar a un
  despliegue, así que los administra el host desde `/host/patch-notes`.

Empezaron como una pestaña dentro de Reglas y **se mudaron a `/patch-notes`** el 15 de septiembre de
2026, ocupando en el menú el sitio de «Modos»: van a ser muchos, y las reglas son un texto que se lee
una vez mientras que los parches son una lista que crece. Los modos no desaparecen —están explicados
dentro de las reglas— y `/modos` redirige ahí con un 301, para no dar un 404 a quien tenga la
dirección guardada. Al final de las reglas queda el enlace a los parches, porque quien termina de
leerlas es justo quien quiere saber qué ha cambiado desde entonces.

**Cada parche lleva un vídeo.** El host lo graba y lo explica ahí, así que lo escrito es el resumen
para leer de un vistazo y el vídeo es la versión completa. Es opcional: un parche de dos líneas no
necesita uno.

- Se guarda **el id de YouTube y no la URL**: la URL cambia de forma según de dónde la copies
  (`watch?v=`, `youtu.be/`, `/shorts/`) y del id salen tanto el reproductor como la miniatura.
- **El reproductor no se carga hasta que alguien le da al play.** Se enseña la portada y un botón;
  con varios parches en la página, montar todos los reproductores de golpe sería la parte más pesada
  de la web y la mayoría no se verían.
- Va por `youtube-nocookie.com`, que no deja cookies hasta que empieza la reproducción — y aquí el
  play siempre lo da la persona.

**El formato de un parche.** El cuerpo es texto suelto, una línea por cambio: `+ ` es algo que entra,
`- ` es algo que sale, y el resto es texto normal. Es la convención de los changelogs de siempre y no
obliga al host a aprender nada. **Se exige el espacio tras el signo** a propósito: sin él, una línea
como «-15 LP por derrota» se pintaría en rojo como una regla eliminada. Hay un test para ese caso.

Un parche **nace sin publicar** y no sale de la base hasta que se publica. A diferencia de una
edición del Tier Ranking —que es una foto y por eso queda congelada— un parche es un texto: si trae
una errata se corrige donde está, sin abrir otro.

**Premios queda en construcción** a propósito, hasta que se decida el formato (decisión del host, 15
de septiembre de 2026). La página lo dice y enseña las tres medallas, que sí existen: los puestos no
están en duda, solo qué se llevan.

**Las reglas, con las ilustraciones grandes** (15 de septiembre de 2026). Los iconos entraron a
24 px acompañando al texto; ahí eran una marca, no una ilustración, y la página desaprovechaba el
ancho. Ahora:

- **Los modos van en dos columnas, 2-2-1.** Con los cinco en una sola columna cada icono tenía que
  ser diminuto para que la sección no se alargara media pantalla; en dos caben al triple de tamaño
  en el mismo alto. El quinto ocupa la fila entera en vez de dejar un hueco a su lado.
- **Las tarjetas con ilustración se parten en dos**, texto en una mitad y el dibujo a 230 px en la
  otra, y **el lado alterna**: «Cómo se entra» a la izquierda, negociación a la derecha, Blue Shell a
  la izquierda, puntuación a la derecha. Al bajar la página no parece la misma tarjeta repetida.
- El trofeo que protagonizaba el hero antes del key art es la ilustración de «Cómo se entra»: se
  había quedado sin usar y ahí vuelve a tener sitio.
- El volteo lo hace `order`, que **cambia el orden visual y no el del documento**: quien la lee con
  un lector de pantalla oye siempre el texto antes que la ilustración, que es la que no dice nada.
- En móvil se apilan y **el texto va siempre primero**, también en las volteadas: si no, la volteada
  empujaba su encabezado media pantalla hacia abajo.

**Añadir y quitar recompensas** desde Ajustes (15 de septiembre de 2026). El catálogo solo se podía
editar en el precio; ahora se crean recompensas nuevas y se quitan las que no se usan.

- **Quitar no borra.** Pone `active: false`: la recompensa desaparece de la mesa y de las reglas, y
  se queda en Ajustes apagada con un botón para volver a ponerla. Un canjeo viejo de esa recompensa
  sigue explicándose solo en el historial, que guardó su código y su precio.
- **El código se deriva del nombre una sola vez** (`codigoDeRecompensa`, en `shared/economy.ts`) y no
  cambia aunque luego se le cambie el nombre: es lo que guarda cada canjeo, y si cambiara, los
  canjeos viejos dejarían de saber a qué se referían. Si choca con uno que ya existe, se le añade un
  sufijo.
- **Y el catálogo se hereda al abrir mes.** Esto es lo que hace útil lo anterior: `action_catalog`
  cuelga del periodo, y hasta ahora cada mes nuevo volvía a sembrar los seis de siempre, así que
  cualquier precio ajustado o recompensa añadida se perdía en silencio — y el host lo habría
  descubierto en mitad de una copa. Ahora se copia el catálogo del mes anterior entero, y
  `seed_action_catalog` solo actúa cuando no hay mes anterior.

**Limpieza de la base** (`scripts/limpiar-datos.mjs`). Para arrancar de verdad antes de importar el
histórico. Borra todo lo del torneo —jugadores, participaciones, sesiones, partidas, economía,
bitácora, periodos y su catálogo— y **nunca toca `app_user` ni las cuentas de acceso**, que son lo
único que no se recupera. Sin `--hazlo` solo enseña lo que borraría, y con él pide escribir `BORRAR`
a mano: un flag se teclea sin pensar y esto no.

**Página de error propia** (`app/error.vue`). Un enlace roto enseñaba la pantalla gris de Nuxt: sin
marca, sin menú y sin forma de volver. Ahora sale el escudo, el código, una explicación y dos
salidas. **No usa el layout público** a propósito: el layout carga los enlaces del sitio desde la
base, y si lo que ha fallado es la base, el error se pintaría con la misma pieza rota. Devuelve un
404 de verdad y se sirve desde el servidor, así que un buscador no lo indexa como página buena.

**Menú en móvil.** Por debajo de 760 px la fila de enlaces no cabe junto al logo y al botón de
Twitch, y antes simplemente se escondía sin que la sustituyera nada: desde un teléfono solo se
llegaba a la portada. Ahora se pliega detrás de un botón, que se cierra solo al cambiar de página y
con Escape. El botón de Twitch se queda en la barra, con el logo pero sin texto.

**Los logotipos de Twitch y PayPal** van en línea (`AppBrandIcon.vue`), no como `<img>`: así heredan
el color del texto con `currentColor` y el mismo icono sirve sobre el morado del botón principal y
sobre el gris del pie. Los trazos son los oficiales, copiados de `simple-icons` (v16.31.0) y anotados
en el componente; el paquete no queda como dependencia porque son miles de iconos para usar dos.
El canal (`twitch.tv/madhusito`) vive en `shared/enlaces.ts`, en un sitio y no repartido por cinco
plantillas: ya estuvo apuntando a `twitch.tv` a secas en la cabecera y en el hero a la vez.

> **Pendiente de la primera prueba en el despliegue:** que Twitch acepte el `parent` del dominio de
> Vercel. Desde esta máquina no hay red hacia Twitch, así que está comprobado todo lo que es
> responsabilidad de la aplicación —qué enlaces se aceptan, que el iframe lleve el dominio correcto,
> que no se cargue antes de tiempo— pero no el apretón de manos final. La previsualización de
> `/host/clips` lo enseña de un vistazo: si ahí se ve el clip, en la Home también.

**Pruebas de cierre**
1. Lighthouse en móvil: Performance ≥ 90, Accesibilidad ≥ 95, SEO ≥ 95.

   **Medido el 15 de septiembre de 2026** sobre la compilación de producción (no sobre el servidor
   de desarrollo, que no mide nada): **Accesibilidad 100 · SEO 100 · Buenas prácticas 96 ·
   Rendimiento 73.**

   *Accesibilidad, de 91 a 100.* Tres arreglos reales, no maquillaje:
   - El botón de Twitch de la barra **se quedaba sin nombre en móvil**, porque ahí el texto se
     esconde para que quepa junto al menú y el icono es decorativo. Lleva `aria-label`.
   - El violeta **fallaba el contraste por los dos lados**: 4,36 con el blanco del botón y 4,08 como
     texto sobre un panel, cuando el mínimo es 4,5. Como fondo tiene que ser más oscuro y como texto
     más claro, así que ahora son dos tokens: `--violet` y `--violet-txt`.
   - `--dim` se quedaba en 3,95 sobre `--panel`. Aclarado.

   *Buenas prácticas 96:* lo único que falla es un 404 de `/_vercel/insights/script.js`, que **solo
   ocurre fuera de Vercel** —ese archivo lo sirve la plataforma— y un aviso de caché de navegación
   que Lighthouse marca como «no accionable».

   *Rendimiento 73, y la causa está aislada.* El primer pintado observado es de **606 ms**; los 4,0 s
   son la simulación de 4G lento, donde lo que manda son los bytes. De los **665 kB** de la portada,
   **328 son el cliente de Supabase** —autenticación y realtime— que el módulo `@nuxtjs/supabase`
   registra como plugin global y por tanto viaja en todas las páginas. **Ninguna página pública lo
   usa**: el middleware sale antes si la ruta no empieza por `/host`, y lo público lee por
   `server/api/public/*`. Solo lo necesitan `/host/*` y `/en-vivo`.

   Bajar de ahí exige que ese cliente deje de ser global —cargarlo bajo demanda solo donde hace
   falta—, lo que significa sustituir el cableado de sesión del módulo. **Es un cambio de
   arquitectura sobre un login que funciona, y queda como decisión del host.** Lo que sí se hizo, por
   ser correcto de todas formas: el escudo y los iconos de los modos pasan de SVG vectorizado a webp
   al tamaño en que se pintan (de 106 kB a 50), porque a 34 y 52 px el vector no aportaba nada.
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

## Importación del histórico  *(fuera de fase)*

El 16 de septiembre de 2026 el host entrega los dos Excel al día, que es lo que
`05-preguntas-abiertas.md` dejaba pendiente de fecha. No es una fase: es un trasvase que se hace una
vez, después de dejar la base en blanco con `scripts/limpiar-datos.mjs`.

**Va en dos pasos, y a propósito.**

`node scripts/leer-excel.mjs <roster.xlsm> <cctm.xlsm>` convierte los libros a JSON dentro del repo
(`scripts/historico/`). Los `.xlsm` no entran —llevan macros y datos personales—, así que sin este
paso la importación dependería para siempre de dos ficheros sueltos en el Descargas de alguien. Con
el JSON dentro, lo que se va a escribir se revisa en un diff y se puede repetir dentro de un año
obteniendo lo mismo. El lector **no trae dependencias**: un `.xlsm` es un ZIP con XML, y leerlo a
mano son cien líneas frente a meter un paquete de hojas de cálculo para usarlo una vez.

`node scripts/importar-historico.mjs` escribe. Mismo molde que `limpiar-datos.mjs`: enseña el
proyecto lo primero, ensaya en seco por defecto, pide escribir `IMPORTAR` a mano, y `--comprobar`
relee la base y la cuadra fila a fila contra el JSON. Se puede volver a lanzar: todo va por las
claves naturales y lo que no tiene clave se busca antes de insertarlo.

**Lo que entra:** ocho periodos (ENE a SEP de 2026, sin JUN, que no está en el libro), 223 perfiles
—los 252 nicks distintos del Excel menos los 29 que `alias.json` funde en otro—,
476 participaciones con su LP, las 43 cuentas del banco con su asiento, el préstamo y los precios
vigentes. **SEP-2026 queda abierto** para que al abrir octubre desde el panel
`POST /api/periods` herede de él el catálogo corregido en vez de resembrar los seis de siempre.

**Los castigos van aparte.** La cárcel y las restricciones del CCTM son estado de ahora, no
historia, y cuelgan de un mes: ninguno de los seis castigados jugó en SEP-2026, así que la
importación normal los deja fuera y los enumera con la pista del nick largo que les corresponde. Se
ponen con `--castigos-en=OCT-2026` cuando ese mes exista, y ahí sí se registra al castigado, porque
entrar al mes que se va a jugar es lo que el host iba a hacer igualmente. Lo que no se hace nunca es
meter a alguien en un mes cerrado para poder colgarle una restricción.

**Lo que no entra, y por qué:** ver A10 del modelo de datos. En corto: los totales del Excel no son
partidas y no se fabrican; no hay roles ni elo en ninguna hoja; ENE no tiene LP; y el bloque EXTRA
del CCTM son recordatorios de una copa ya jugada, que sin sesión a la que engancharlos no los leería
nadie.

**Los precios ya no eran los del código.** El Excel vigente dice Blue Shell **499** —no 500— y trae
un **OTP OPEN** de 500 que nunca existió. El importador siembra primero el catálogo de siempre y
luego aplica esas dos diferencias, así que «sacar a alguien de la banca» sigue puesta: el Excel ya
no la nombra, pero de que el host la haya retirado a propósito no hay constancia, y apagarla es un
clic reversible en Ajustes.

**Migración de esta importación:** `20260916000001_historico_importado.sql`. Añade las seis columnas
de A10 y recrea `public_roster` sumando las dos fuentes. La recrea con `drop` + `create view` y no
con `create or replace`, porque `tests/unit/public-views.test.ts` busca literalmente
`create view <nombre> as` para leer el cuerpo vigente: un `create or replace` habría dejado el test
validando la definición vieja, que es el descuido que ese test existe para cazar.

---

## Después de la importación  ·  17 de septiembre de 2026

**`v2.0` en el pie.** Sale de `package.json` por `runtimeConfig.public.version`, que es donde un
desarrollador lo busca y lo sube al publicar: nada de una constante aparte que se desincronice. Se
pinta `major.minor`. Empieza en 2.0 porque la versión 1 del torneo eran los dos Excel.

**El histórico, ahora público** (`/historico`). Los ocho meses llevaban una semana en producción sin
que nadie de fuera pudiera verlos: la vista `public_roster` existía, estaba concedida a `anon` y ya
sumaba las columnas `historic_*`, pero no había endpoint ni página. Ahora hay las dos, con selector
de mes y las mismas cifras que ve el host.

- Los porcentajes salen de `winratePct` y `formatWinrate` de `shared/roster.ts`, las mismas que usan
  el panel y el CSV. Una fórmula propia aquí acabaría diciendo un número distinto del mismo jugador.
- **La página pública no avisa de qué meses vienen del Excel**, y es decisión del host: al
  espectador le da igual de dónde salió la cifra, y la advertencia solo ocupaba sitio. El aviso
  sigue en `/host/roster`, que es donde importa — quien revisa un mes sí tiene que saber si esas
  victorias son totales de una hoja o partidas registradas aquí.
- Por eso `imported_from` tampoco se consulta: al quitarse el aviso, la consulta que lo alimentaba
  se quedó sin para qué y salió con él. La vista `public_roster` nunca llegó a tocarse.

**Tier rankings de meses pasados.** `POST /api/tiers` acepta `period_id` y el panel tiene un
selector junto a «Empezar desde el mes». Con los 476 históricos ya en la base, la edición de marzo
tiene de dónde sembrarse. Publicándolas de la más vieja a la más nueva, la vigente acaba siendo la
del mes más reciente.

**Rendimiento: hecho el paso 1 de tres, y el 2 queda parado a propósito.**

Medido sobre la compilación de hoy: el chunk de entrada son **338 kB** y lo carga toda página. Dentro
están GoTrue y realtime — es el cliente de Supabase, que `@nuxtjs/supabase` registra como plugin
**global**. Ninguna página pública lo usa.

- ✅ **`/en-vivo` deja de depender del módulo.** `useEnVivo` ya no llama a `useSupabaseClient()`:
  importa `@supabase/supabase-js` bajo demanda dentro de `onMounted` y crea un cliente pelado con la
  llave publicable, que es lo único que necesita para escuchar el canal. Por sí solo no baja la
  portada, pero deja `/host/*` como único consumidor, que es lo que hace viable el paso siguiente.
- ⏸ **Quitar el plugin global.** Es lo que bajaría el entry de 338 kB a la decena larga. Exige
  sustituir el cableado de sesión del módulo —el puente que mete la sesión en una cookie para que
  `guard.ts` la lea— por uno propio que importe el cliente bajo demanda solo en `/host/*`.

  **Está parado porque no hay red de seguridad.** Las pruebas de login de `tests/e2e/auth.spec.ts`
  viven dentro de un `test.skip(!email || !password)` y hoy **no se ejecutan**: no hay
  `E2E_HOST_EMAIL` ni `E2E_HOST_PASSWORD` en el entorno. Reescribir la sesión a ciegas sobre un login
  que funciona, en la semana de arrancar, no compensa los 300 kB. Primero esas variables, después el
  cambio.

  Buena noticia para cuando se haga: el `useSupabaseUser()` del middleware es **cosmético** —su
  propio comentario lo dice, la comprobación de verdad está en `server/utils/guard.ts`— así que
  puede salir sin pensarlo. Lo único que de verdad necesita el cliente es el par
  `signInWithPassword` / `signOut` de dos páginas.

---

## Resumen de tiempos

| Fase | Estimado | Estado |
|---|---|---|
| 0 · Especificación | 1 sem | ✅ cerrada |
| 1 · Fundaciones (incluye Realtime) | 1 sem | ✅ cerrada |
| 2 · Jugadores y sesiones | 1 sem | ✅ cerrada |
| 3 · CCTM Manager (3A/3B/3C/3D) | 3–3.5 sem | ✅ cerrada |
| 4 · Partidas y LP | 1.5 sem | ✅ cerrada |
| 4B · Vista pública en vivo | 1 sem | ✅ cerrada |
| 5 · Roster | 1 sem | ✅ cerrada |
| 6 · Tier Manager | 1 sem | ✅ cerrada |
| 7 · Home pública | 1.5 sem | pendiente · donaciones y medallas ya resueltas |
| 8 · Prueba real | 1 sesión + 1 sem | pendiente |
| **Total** | **≈ 11.5–13.5 semanas** | |

**Lo construido hasta hoy:** 196 pruebas unitarias y 77 de punta a punta, todas en verde.

**Camino corto si hay prisa por usarlo en la próxima CopaPerso:** Fases 1 → 2 → 3A → 4 (unas 6 semanas)
ya permiten operar el torneo en vivo; economía (3B), vista pública, roster, tier y home pueden seguir en
Excel o en el stream mientras tanto.
