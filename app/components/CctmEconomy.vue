<script setup lang="ts">
import type { BenchPlayer } from '#shared/draft'
import type { PartidaCargada } from '#shared/match'

/**
 * Los paneles de consulta de la sesión (§13–§19).
 *
 * Todo es de consulta y administración: aquí no se ejecuta nada por su cuenta.
 * Lo que se toca a menudo tiene card propia arriba —canjeos y banco—; aquí
 * queda lo que se mira de vez en cuando.
 */
interface Prestamo {
  id: string
  person_name: string
  principal_bits: number
  lent_at: string
  status: 'open' | 'settled' | 'forgiven'
  amount_due: number
  interest: number
}
const props = defineProps<{
  matches: PartidaCargada[]
  loans: Prestamo[]
  jailed: BenchPlayer[]
  graveyard: BenchPlayer[]
  notes: { id: string; body: string }[]
  extras: { id: string; kind: string; body: string }[]
  restrictions: { id: string; player_name: string; kind: string; value: string | null; note: string | null }[]
  players: BenchPlayer[]
  busy: boolean
}>()

const emit = defineEmits<{
  newLoan: [payload: { person_name: string; principal_bits: number }]
  settleLoan: [id: string]
  freePlayer: [id: string]
  addNote: [payload: { type: 'note' | 'extra'; kind?: string; body: string }]
  addRestriction: [payload: { participation_id: string; kind: 'no_role'; value: string }]
  liftRestriction: [id: string]
}>()

const pestana = ref<'partidas' | 'prestamos' | 'estados' | 'notas'>('partidas')

const ETIQUETA_EXTRA: Record<string, string> = {
  bonus: 'Bonus',
  penalty: 'Penalización',
  prize: 'Premio',
  condition: 'Condición',
}
const ROLES_RESTRINGIBLES = ['TOP', 'JG', 'MID', 'ADC', 'SUP']

const nuevaNota = ref('')
const nuevoExtra = reactive({ kind: 'condition', body: '' })
const nuevaRestriccion = reactive({ jugador: '', rol: 'MID' })

function anotarNota() {
  if (!nuevaNota.value.trim()) return
  emit('addNote', { type: 'note', body: nuevaNota.value.trim() })
  nuevaNota.value = ''
}

function anotarExtra() {
  if (!nuevoExtra.body.trim()) return
  emit('addNote', { type: 'extra', kind: nuevoExtra.kind, body: nuevoExtra.body.trim() })
  nuevoExtra.body = ''
}

function anotarRestriccion() {
  if (!nuevaRestriccion.jugador) return
  emit('addRestriction', {
    participation_id: nuevaRestriccion.jugador,
    kind: 'no_role',
    value: nuevaRestriccion.rol,
  })
  nuevaRestriccion.jugador = ''
}

// --- préstamos ---
const nuevoPrestamo = reactive({ persona: '', bits: '' })

function crearPrestamo() {
  const bits = Number(nuevoPrestamo.bits)
  if (!nuevoPrestamo.persona.trim() || !bits) return
  emit('newLoan', { person_name: nuevoPrestamo.persona.trim(), principal_bits: bits })
  nuevoPrestamo.persona = ''
  nuevoPrestamo.bits = ''
}

const prestamosAbiertos = computed(() => props.loans.filter((l) => l.status === 'open'))

/** MVP, ACE y dobles derrotas de una partida, en una línea. */
function premios(m: PartidaCargada) {
  const out: string[] = []
  const mvp = m.players.find((p) => p.isMvp)
  const ace = m.players.find((p) => p.isAce)
  if (mvp) out.push(`MVP ${mvp.displayName}`)
  if (ace) out.push(`ACE ${ace.displayName}`)
  for (const d of m.players.filter((p) => p.result === 'double_loss')) {
    out.push(`doble derrota ${d.displayName}`)
  }
  return out
}
</script>

<template>
  <section class="eco">
    <nav class="tabs">
      <button :class="{ on: pestana === 'partidas' }" @click="pestana = 'partidas'">
        Partidas <span class="cnt">{{ matches.length }}</span>
      </button>
      <button :class="{ on: pestana === 'prestamos' }" @click="pestana = 'prestamos'">
        <CopaIcon name="prestamo" :size="16" />
        Préstamos <span class="cnt">{{ prestamosAbiertos.length }}</span>
      </button>
      <button :class="{ on: pestana === 'estados' }" @click="pestana = 'estados'">
        Estados <span class="cnt">{{ jailed.length + graveyard.length }}</span>
      </button>
      <button :class="{ on: pestana === 'notas' }" @click="pestana = 'notas'">
        Notas <span class="cnt">{{ notes.length + extras.length + restrictions.length }}</span>
      </button>
    </nav>

    <!-- ------------------------------------------------------- partidas -->
    <div v-if="pestana === 'partidas'" class="cuerpo">
      <div class="col ancha">
        <h3>Jugadas esta sesión</h3>
        <ol v-if="matches.length" class="partidas">
          <li v-for="m in matches" :key="m.id" :class="`is-${m.status}`">
            <span class="num">{{ m.matchNumber }}</span>
            <span v-if="m.status === 'live'" class="estado">en juego</span>
            <span v-else-if="m.winnerTeam" class="gana" :class="`is-t${m.winnerTeam}`">
              gana Team {{ m.winnerTeam }}
            </span>
            <span v-else class="estado">sin resultado</span>
            <span class="premio">{{ premios(m).join(' · ') }}</span>
            <span class="cuantos">{{ m.players.length }} jugadores</span>
          </li>
        </ol>
        <p v-else class="vacio">Todavía no se ha jugado ninguna.</p>
        <p class="nota">
          La alineación es la que se congeló al empezar cada partida, no los equipos de ahora.
        </p>
      </div>
    </div>

    <!-- ------------------------------------------------------ préstamos -->
    <div v-else-if="pestana === 'prestamos'" class="cuerpo">
      <div class="col ancha">
        <h3>Abiertos · 10 % del original por día</h3>
        <ul v-if="prestamosAbiertos.length" class="lista">
          <li v-for="l in prestamosAbiertos" :key="l.id">
            <span>{{ l.person_name }}</span>
            <em>{{ l.principal_bits }} el {{ l.lent_at }}</em>
            <b>debe {{ l.amount_due }}</b>
            <button class="btn btn--ghost mini" :disabled="busy" @click="emit('settleLoan', l.id)">
              Saldar
            </button>
          </li>
        </ul>
        <p v-else class="vacio">Nadie debe nada ahora mismo.</p>
      </div>

      <div class="col">
        <h3>Nuevo préstamo</h3>
        <input v-model="nuevoPrestamo.persona" type="text" placeholder="A quién">
        <input v-model="nuevoPrestamo.bits" type="number" placeholder="Cuántos bits">
        <button class="btn btn--primary" :disabled="busy" @click="crearPrestamo">Prestar</button>
        <p class="nota">400 bits el día 1 son 440; al día 12, 880.</p>
      </div>
    </div>

    <!-- ---------------------------------------------------------- notas -->
    <div v-else-if="pestana === 'notas'" class="cuerpo">
      <div class="col">
        <h3>Notas de la sesión</h3>
        <ul v-if="notes.length" class="lista">
          <li v-for="n in notes" :key="n.id"><span>{{ n.body }}</span></li>
        </ul>
        <p v-else class="vacio">Sin notas.</p>
        <input
          v-model="nuevaNota"
          type="text"
          placeholder="Escribir una nota…"
          @keydown.enter="anotarNota"
        >
      </div>

      <div class="col">
        <h3>Extras y condiciones</h3>
        <ul v-if="extras.length" class="lista">
          <li v-for="e in extras" :key="e.id">
            <em>{{ ETIQUETA_EXTRA[e.kind] ?? e.kind }}</em>
            <span>{{ e.body }}</span>
          </li>
        </ul>
        <p v-else class="vacio">Sin extras.</p>
        <select v-model="nuevoExtra.kind" aria-label="Tipo de extra">
          <option v-for="(label, key) in ETIQUETA_EXTRA" :key="key" :value="key">{{ label }}</option>
        </select>
        <input
          v-model="nuevoExtra.body"
          type="text"
          placeholder="Premio, penalización, condición…"
          @keydown.enter="anotarExtra"
        >
      </div>

      <div class="col">
        <h3>Restricciones</h3>
        <ul v-if="restrictions.length" class="lista">
          <li v-for="r in restrictions" :key="r.id">
            <span>{{ r.player_name }}: no puede {{ r.value }}</span>
            <button class="btn btn--ghost mini" :disabled="busy" @click="emit('liftRestriction', r.id)">
              Levantar
            </button>
          </li>
        </ul>
        <p v-else class="vacio">Nadie tiene restricciones.</p>
        <select v-model="nuevaRestriccion.jugador" aria-label="Jugador">
          <option value="">Elegir jugador…</option>
          <option v-for="p in players" :key="p.participationId" :value="p.participationId">
            {{ p.displayName }}
          </option>
        </select>
        <div class="chips">
          <button
            v-for="r in ROLES_RESTRINGIBLES"
            :key="r"
            class="chip"
            :class="{ on: nuevaRestriccion.rol === r }"
            @click="nuevaRestriccion.rol = r"
          >
            {{ r }}
          </button>
        </div>
        <button class="btn btn--ghost" :disabled="!nuevaRestriccion.jugador || busy" @click="anotarRestriccion">
          No puede {{ nuevaRestriccion.rol }}
        </button>
      </div>
    </div>

    <!-- -------------------------------------------------------- estados -->
    <div v-else class="cuerpo">
      <div class="col">
        <h3><CopaIcon name="carcel" :size="18" />Cárcel</h3>
        <ul v-if="jailed.length" class="lista">
          <li v-for="p in jailed" :key="p.sessionParticipantId">
            <span>{{ p.displayName }}</span>
            <button
              class="btn btn--ghost mini"
              :disabled="busy"
              @click="emit('freePlayer', p.sessionParticipantId)"
            >
              Soltar
            </button>
          </li>
        </ul>
        <p v-else class="vacio">Nadie está castigado.</p>
      </div>

      <div class="col">
        <h3><CopaIcon name="cementerio" :size="18" />Cementerio</h3>
        <ul v-if="graveyard.length" class="lista">
          <li v-for="p in graveyard" :key="p.sessionParticipantId">
            <span>{{ p.displayName }}</span>
            <button
              class="btn btn--ghost mini"
              :disabled="busy"
              @click="emit('freePlayer', p.sessionParticipantId)"
            >
              Sacar
            </button>
          </li>
        </ul>
        <p v-else class="vacio">El cementerio está vacío.</p>
        <p class="nota">No alcanzaron a inscribirse. Salir cuesta 300 bits.</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.eco {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--r);
  overflow: hidden;
}

.tabs {
  display: flex;
  gap: 2px;
  padding: 8px 10px 0;
  border-bottom: 1px solid var(--line);
  flex-wrap: wrap;
}

.tabs button {
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: 0;
  border-bottom: 2px solid transparent;
  padding: 7px 12px;
  font-family: var(--f-display);
  font-size: 13px;
  font-weight: 600;
  color: var(--dim);
}

.tabs button:hover {
  color: var(--muted);
}

.tabs button.on {
  color: var(--text);
  border-bottom-color: var(--violet);
}

.cnt,
.x3 {
  font-family: var(--f-mono);
  font-size: 9.5px;
  border: 1px solid var(--line);
  border-radius: 20px;
  padding: 1px 6px;
  color: var(--dim);
}

.x3 {
  color: var(--gold);
  border-color: rgba(243, 185, 77, 0.4);
}

.cuerpo {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 18px;
  padding: 14px;
}

.col {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-width: 0;
}

.col.ancha {
  grid-column: span 2;
}

h3 {
  display: flex;
  align-items: center;
  gap: 7px;
  font-family: var(--f-mono);
  font-size: 9.5px;
  letter-spacing: 0.13em;
  text-transform: uppercase;
  color: var(--dim);
  font-weight: 500;
}

.precios,
.lista {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 168px;
  overflow-y: auto;
}

.precios li,
.lista li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  padding: 4px 0;
  border-bottom: 1px solid var(--line-soft);
}

.precios b,
.lista b {
  margin-left: auto;
  font-family: var(--f-mono);
  font-size: 12px;
  color: var(--gold);
  font-weight: 500;
  flex: none;
}

.precios b.alto {
  color: var(--warn);
}

.precios em,
.lista em {
  font-family: var(--f-mono);
  font-size: 9.5px;
  font-style: normal;
  color: var(--dim);
  flex: none;
}

.lista time {
  font-family: var(--f-mono);
  font-size: 10px;
  color: var(--dim);
  flex: none;
}

.lista span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

select,
input {
  font: inherit;
  font-size: 13px;
  color: var(--text);
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  padding: 7px 9px;
  width: 100%;
}

select:focus,
input:focus {
  border-color: var(--violet);
  outline: none;
}

.chips {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.chip {
  font-family: var(--f-mono);
  font-size: 10px;
  padding: 4px 8px;
  border-radius: 20px;
  border: 1px solid var(--line);
  background: transparent;
  color: var(--muted);
}

.chip.on {
  background: var(--violet);
  border-color: var(--violet);
  color: #fff;
}

.mini {
  font-size: 10.5px;
  padding: 3px 8px;
  margin-left: auto;
  flex: none;
}

.nota {
  margin: auto 0 0;
  font-family: var(--f-mono);
  font-size: 9.5px;
  line-height: 1.7;
  color: var(--dim);
}

.nota.aviso {
  color: var(--warn);
}

.nota b {
  color: var(--warn);
}

.vacio {
  margin: 0;
  font-size: 12.5px;
  color: var(--dim);
}

.partidas {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.partidas li {
  display: flex;
  align-items: center;
  gap: 9px;
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  padding: 5px 9px;
  font-size: 12px;
}

.partidas li.is-live {
  border-color: var(--ok);
}

.partidas .num {
  font-family: var(--f-mono);
  font-size: 12px;
  color: var(--dim);
  width: 14px;
}

.partidas .gana {
  font-family: var(--f-mono);
  font-size: 10.5px;
  letter-spacing: 0.04em;
}

.partidas .gana.is-t1 {
  color: var(--team-1);
}

.partidas .gana.is-t2 {
  color: var(--team-2);
}

.partidas .estado {
  font-family: var(--f-mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ok);
}

.partidas li:not(.is-live) .estado {
  color: var(--dim);
}

.partidas .premio {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--gold);
  font-size: 11.5px;
}

.partidas .cuantos {
  font-family: var(--f-mono);
  font-size: 10px;
  color: var(--dim);
}
</style>
