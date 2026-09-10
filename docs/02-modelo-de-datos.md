# CopaPerso — Modelo de datos revisado

Correcciones y ampliaciones sobre §3 del plan. Todo en PostgreSQL, ids `uuid`, timestamps `timestamptz`.

## A. Correcciones al modelo del plan

### A1. `PARTICIPATION` mezcla periodo y sesión (crítico)

El plan define `participation` con `period_id` **y** `session_id`. No pueden convivir: §5 dice que el LP
se reinicia por **mes** —confirmado por el host— y §29 dice que el Roster es **por periodo**, pero §24 dice
que un periodo tiene varias sesiones. Si la participación fuera por sesión, el LP se reiniciaría en cada
CopaPerso y el roster mensual sería imposible de calcular.

Se separa en dos entidades:

- `participation` → **por periodo (mes)**. Guarda elo, roles, LP inicial (100) y LP actual del mes.
  Todas las sesiones del mes acumulan sobre el mismo LP.
- `session_participant` → **por sesión**. Es literalmente la *Banca de jugadores* (§8): quién está
  disponible esa noche, y su estado (`bench` / `team` / `jail` / `graveyard` / `removed`).

### A2. Falta la entidad `PERIOD`

Está implícita en todo el plan (§5, §29) pero no declarada. Se agrega, con `status` para poder cerrar un mes
y congelar su roster.

### A3. El LP debe derivarse de eventos, no ser un contador suelto

§12 y §21 exigen **deshacer** acciones. Si `current_lp` es un número que se suma y se resta, un undo mal
aplicado lo corrompe en silencio y no hay forma de auditarlo. Solución: `lp_event` es la fuente de verdad
(cada uno con su delta y su origen), y `participation.current_lp` es una **caché recalculable**
(`SELECT SUM(delta)` + 100). Deshacer = marcar el evento como revertido y recalcular.

### A4. `MATCH.winner_team_id` no cubre todos los casos

La **doble derrota** del Blue Shell (§16) es individual: un jugador del equipo ganador puede terminar con
derrota. Y hace falta poder anular una partida. Por eso el resultado real vive en `match_player.result`
(`win` / `loss` / `double_loss`), y `winner_team_id` queda como dato de conveniencia.

### A5. Costos de acciones — RESUELTO: rigen los valores de §13

Confirmado por el host: la tabla vigente es la de §13, no la del wireframe. Aun así los costos **no van
hardcodeados**: viven en `action_catalog`, editables y versionados por periodo, para que subir un precio
no reescriba el histórico de negociaciones ya cobradas.

| Código | Acción | Costo |
|---|---|---|
| `SPOT_TAKEOVER` | Entrar tomando el cupo de alguien ya seleccionado | 200 bits |
| `TEAM_CHANGE` | Cambio de Team | 150 bits |
| `BENCH_PULL` | Sacar a alguien de la banca | 200 bits |
| `ROLE_CHANGE_REENTRY` | Cambio de rol y reingreso | 300 bits |
| `GRAVEYARD_EXIT` | Sacar del cementerio | 300 bits |
| `BLUE_SHELL` | Blue Shell | 500 bits |

**Subs:** no hay tipo de cambio con los bits. `1 sub NA/EUW` **o** `2 subs LATAM` equivalen a *cualquiera*
de las recompensas, y al final lo decide el streamer. En la tabla va como nota, no como columna calculada.

### A5-bis. Cementerio, cárcel y reingreso son tres cosas distintas

Aclarado por el host. No son sinónimos:

| Concepto | Qué es | Cómo se resuelve |
|---|---|---|
| **Cementerio** | Quien no alcanzó a inscribirse. Aplica **con el draft ya arrancado**. | `GRAVEYARD_EXIT` · 300 bits |
| **Cupo (tomar el lugar)** | Con los equipos ya hechos, alguien del cementerio entra **en lugar de** un jugador ya seleccionado: se salta el aleatorio. | `SPOT_TAKEOVER` · 200 bits |
| **Cambio de rol y reingreso** | Quien ya salió sorteado a un equipo pero quiere entrar con otro rol. | `ROLE_CHANGE_REENTRY` · 300 bits |
| **Cárcel** | Castigo que el host aplica manualmente (§17). | Decisión del host |

En el modelo: cementerio y cárcel son **estados** de `session_participant`; el reingreso con cambio de rol
es una `negotiation` que reescribe el `team_member` sin cambiar de estado.

Aclarado: los 200 bits de §13 son el **cupo** —entrar en lugar de alguien ya seleccionado, saltándose el
aleatorio— y los 300 son salir del cementerio para volver a estar disponible. El desplazado vuelve a la banca;
el host decide si le compensa algo.

### A6-bis. Las recompensas no ejecutan nada: el host mueve a mano

Decisión del host, y es la que más simplifica el sistema: **ninguna recompensa de bits/subs dispara un cambio
automático.** El catálogo es una lista de precios de consulta, y el host cumple la recompensa moviendo él
mismo a los participantes con las herramientas normales (arrastrar, asignar, swap, sacar de la banca).

Consecuencias en el modelo:

- No existe un motor de "ejecutar acción" que valide saldo, cobre y mueva jugadores.
- `reward_claim` es una **bitácora**: registra qué recompensa se reclamó, quién la pagó y a quién benefició,
  sin tocar equipos ni saldos. Sirve para el historial y para que el host no pierda la cuenta en vivo.
- El movimiento real queda en `action_log` como cualquier otro movimiento manual, y por lo tanto es
  deshacible con el mismo mecanismo.
- Los saldos del banco los ajusta el host a mano, igual que ya hacía en el Excel (§13, §14).

### A7. El timer de negociación multiplica los precios, no los reescribe

Añadido al plan en septiembre de 2026. En el stream el host abre un cronómetro (15 minutos por
defecto, pero escribible); cuando se agota, **los precios de todas las recompensas se triplican** y
empieza un tiempo extra.

La tentación sería reescribir `action_catalog` con los precios nuevos. Sería un error: el catálogo es
**por periodo**, así que triplicarlo dejaría los precios altos para todas las sesiones siguientes, y
además pisaría el histórico. El multiplicador vive en la **sesión**:

```text
SESSION  + price_multiplier   numeric, 1.00 por defecto
         + timer_ends_at      timestamptz, cuándo salta el aviso
         + timer_label        text, "Registro", "Tiempo extra"...
```

- El precio que se enseña en el panel es `action_catalog.cost_bits × session.price_multiplier`.
- `reward_claim` guarda el **costo efectivo ya multiplicado** más el multiplicador que se aplicó,
  para que dentro de un mes se sepa por qué alguien pagó 1500 por un Blue Shell.
- El cambio de multiplicador se escribe en `action_log` con su valor anterior: es deshacible como
  cualquier otra acción, por si el host lo pulsa sin querer.
- Un multiplicador de sesión también deja la puerta abierta a otros tramos (×2, ×9) sin tocar nada más.

```text
REWARD_CLAIM + multiplier_applied numeric   -- 1.00 o 3.00
```

El cronómetro es **informativo, nunca bloqueante**: al llegar a cero avisa, pero no congela el panel
ni impide registrar a nadie. El host sigue mandando (§2 del plan).

### A6. Banco de bits/subs: cuenta unificada

§14–§15 piden que un *supporter* que no juega tenga saldo. Se modela como `ledger_account` que apunta
opcionalmente a un `player` o tiene un nombre suelto (viewer de Twitch), con `ledger_entry` para el
historial. **El sistema no descuenta automáticamente** (§13); cada movimiento lo escribe el host, pero
queda registrado.

---

## B. Esquema

```text
PERIOD            id, name ("SEP-2026"), starts_at, ends_at, status
PLAYER            id, display_name, slug, photo_url, twitch_handle, created_at
PARTICIPATION     id, player_id, period_id, elo, roles[], initial_lp(100), current_lp, status
SESSION           id, period_id, number, mode, status, started_at, closed_at
SESSION_PARTICIPANT id, session_id, participation_id,
                  state(bench|team|jail|graveyard|removed), joined_at
TEAM              id, session_id, team_number(1|2), name
TEAM_MEMBER       id, team_id, session_participant_id, role, slot_active
MATCH             id, session_id, match_number, status(draft|live|finished|void), winner_team_id
MATCH_PLAYER      id, match_id, participation_id, team_number, role, result, is_off_role
MATCH_EVENT       id, match_id, match_player_id, type, value, created_at
LP_EVENT          id, participation_id, match_id?, type, delta, reverted_at, created_by
ACTION_CATALOG    id, period_id, code, label, cost_bits, cost_subs_na, cost_subs_latam, active
REWARD_CLAIM      id, session_id, action_code, beneficiary_participation_id, payer_account_id,
                  cost_bits, paid_with(bits|sub_na|sub_latam), note, created_by, created_at
                  -- bitácora: NO mueve jugadores ni descuenta saldos
LEDGER_ACCOUNT    id, player_id?, display_name, kind(player|supporter), balance_bits, balance_subs
LEDGER_ENTRY      id, account_id, delta_bits, delta_subs, reason, session_id?, created_by, created_at
STATE_RECORD      id, session_participant_id, kind(jail|graveyard), reason, entered_at, released_at
RESTRICTION       id, participation_id, kind(no_role|no_team|custom), value, active, note
LOAN              id, person_name, player_id?, principal_bits, lent_at, daily_rate(0.10),
                  status, settled_at, settled_amount
NOTE              id, scope(session|participation|team), ref_id, body, created_at
EXTRA             id, scope, ref_id, kind(bonus|penalty|prize|condition), body
BLUE_SHELL_RESULT id, session_id, match_id?, participation_id, outcome, spun_at, saved
ACTION_LOG        id, session_id, actor, action_type, payload, inverse_payload, undone_at, created_at
TIER_LIST         id, period_id, published_at, is_current
TIER_ENTRY        id, tier_list_id, player_id, tier(D|C|B|A|S|S+), points, rank_order, main_role, elo
```

### Reglas de LP (§23) implementadas como `lp_event.type`

| Evento | Delta | Origen |
|---|---|---|
| `WIN` | +15 | resultado de partida |
| `LOSS` | −15 | resultado de partida |
| `MVP` | +5 | asignado por el host |
| `ACE` | +10 | asignado por el host |
| `OFF_ROLE` | +2 | marcado al armar el equipo |
| `DOUBLE_LOSS` | −30 (y cuenta 2 derrotas) | Blue Shell |
| `MANUAL` | libre | corrección del host, requiere nota |

`current_lp = 100 + SUM(delta) WHERE reverted_at IS NULL`, reiniciado cada periodo.
Derrotas del roster = `COUNT(LOSS) + 2 * COUNT(DOUBLE_LOSS)`.

### Interés de los préstamos

Confirmado por el host: **10 % del monto original por cada día transcurrido**, lineal (no compuesto).

```text
adeudo = principal + principal * 0.10 * días
```

| Días | 400 bits |
|---|---|
| 0 | 400 |
| 1 | 440 |
| 2 | 480 |
| 3 | 520 |
| 12 | 880 |

El interés se muestra en vivo en el panel de préstamos; el cobro y el ajuste del banco los hace el host.

### Fuente de verdad de estadísticas (§28)

Al pasar una partida de `draft` a `live`, se congela un **snapshot**: se insertan las filas de
`match_player` a partir de `team_member`. Cambios posteriores en los equipos no afectan a esa partida.
Eso es exactamente el árbol de decisión de §28.

### RLS y vistas públicas

- `anon`: `SELECT` solo sobre `public_tier_ranking`, `public_roster` y `public_session_live`.
- `public_session_live` (para la vista en vivo del MVP) expone **solo**: número de sesión, estado, modo,
  composición de equipos con nombre/rol/elo, marcador de partidas y última acción. **Nunca** bits, saldos,
  préstamos, cárcel, restricciones ni notas.
- `authenticated` (host): sin escritura directa; todas las mutaciones pasan por `server/api/*` con
  `service_role`, que valida rol de host, reglas de negocio y escribe `action_log`.
