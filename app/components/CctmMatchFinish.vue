<script setup lang="ts">
import { avisosDeCierre, deltaDe, eventosDeCierre, LP_LABEL } from '#shared/lp'
import type { CierreDePartida } from '#shared/lp'
import type { PartidaCargada } from '#shared/match'

/**
 * Cerrar la partida y repartir el LP.
 *
 * La regla de la casa es que el host manda (§1): esto no impide cerrar un 4v5
 * ni dar el MVP al equipo que perdió. Avisa, enseña cuánto LP se lleva cada
 * uno, y deja decidir.
 *
 * El LP se calcula aquí con las mismas funciones que usa el servidor para
 * escribirlo, así que lo que se ve antes de guardar es exactamente lo que se
 * guarda.
 */
const props = defineProps<{
  open: boolean
  match: PartidaCargada | null
  busy: boolean
  /** Tiradas de Blue Shell de esta partida, para no olvidar la doble derrota. */
  blueShells: { participationId: string; outcome: string; displayName: string }[]
}>()

const emit = defineEmits<{
  finish: [payload: CierreDePartida]
  close: []
}>()

const ganador = ref<1 | 2 | null>(null)
const mvp = ref<string | null>(null)
const ace = ref<string | null>(null)
const dobles = ref<string[]>([])

const jugadores = computed(() => props.match?.players ?? [])

/** Quien sacó doble derrota en la ruleta viene ya marcado, pero se puede quitar. */
const sugeridos = computed(() =>
  props.blueShells.filter((b) => b.outcome === 'DOUBLE_LOSS').map((b) => b.participationId),
)

watch(
  () => props.open,
  (abierto) => {
    if (!abierto) return
    ganador.value = null
    mvp.value = null
    ace.value = null
    dobles.value = [...sugeridos.value]
  },
)

const cierre = computed<CierreDePartida>(() => ({
  winnerTeam: ganador.value,
  mvp: mvp.value,
  ace: ace.value,
  doubleLosses: dobles.value,
}))

const eventos = computed(() => eventosDeCierre(jugadores.value, cierre.value))
const avisos = computed(() =>
  ganador.value === null ? [] : avisosDeCierre(jugadores.value, cierre.value),
)

function equipo(n: 1 | 2) {
  return jugadores.value.filter((j) => j.teamNumber === n)
}

function alternarDoble(id: string) {
  dobles.value = dobles.value.includes(id)
    ? dobles.value.filter((x) => x !== id)
    : [...dobles.value, id]
}

/** El desglose de un jugador: «Victoria +15 · MVP +5». */
function desglose(id: string) {
  return eventos.value
    .filter((e) => e.participationId === id)
    .map((e) => `${LP_LABEL[e.type]} ${e.delta > 0 ? '+' : ''}${e.delta}`)
    .join(' · ')
}

function guardar() {
  if (ganador.value === null) return
  emit('finish', cierre.value)
}
</script>

<template>
  <div v-if="open && match" class="capa" @click.self="emit('close')">
    <div class="fin" role="dialog" aria-labelledby="fin-titulo">
      <h2 id="fin-titulo">Finalizar la partida {{ match.matchNumber }}</h2>
      <p class="sub">
        Se reparte sobre los {{ jugadores.length }} que estaban al empezar, no sobre los equipos de
        ahora.
      </p>

      <fieldset class="ganador">
        <legend>¿Quién ganó?</legend>
        <button
          v-for="n in ([1, 2] as const)"
          :key="n"
          class="equipo"
          :class="[`is-t${n}`, { 'is-on': ganador === n }]"
          @click="ganador = n"
        >
          Team {{ n }}
        </button>
      </fieldset>

      <div v-if="ganador !== null" class="equipos">
        <section v-for="n in ([1, 2] as const)" :key="n" class="col" :class="`is-t${n}`">
          <h3>
            Team {{ n }}
            <span v-if="ganador === n" class="gana">gana</span>
          </h3>
          <ul>
            <li v-for="j in equipo(n)" :key="j.participationId">
              <div class="quien">
                <span class="rol">{{ j.role }}</span>
                <span class="nombre">{{ j.displayName }}</span>
                <span v-if="j.isOffRole" class="off" title="Jugó fuera de su rol">off</span>
              </div>

              <div class="premios">
                <button
                  class="tag"
                  :class="{ 'is-on': mvp === j.participationId }"
                  title="MVP: +5"
                  @click="mvp = mvp === j.participationId ? null : j.participationId"
                >
                  MVP
                </button>
                <button
                  class="tag"
                  :class="{ 'is-on': ace === j.participationId }"
                  title="ACE: +10"
                  @click="ace = ace === j.participationId ? null : j.participationId"
                >
                  ACE
                </button>
                <button
                  class="tag tag--mal"
                  :class="{ 'is-on': dobles.includes(j.participationId) }"
                  title="Doble derrota: −30 y cuenta dos derrotas"
                  @click="alternarDoble(j.participationId)"
                >
                  ×2
                </button>
                <b class="lp" :class="{ neg: deltaDe(eventos, j.participationId) < 0 }">
                  {{ deltaDe(eventos, j.participationId) > 0 ? '+' : ''
                  }}{{ deltaDe(eventos, j.participationId) }}
                </b>
              </div>

              <p v-if="desglose(j.participationId)" class="detalle">
                {{ desglose(j.participationId) }}
              </p>
            </li>
          </ul>
        </section>
      </div>

      <ul v-if="avisos.length" class="avisos">
        <li v-for="a in avisos" :key="a.code + a.message">{{ a.message }}</li>
      </ul>

      <div class="btns">
        <button
          class="btn btn--primary"
          :disabled="busy || ganador === null"
          @click="guardar"
        >
          {{ ganador === null ? 'Elige el ganador' : `Guardar y repartir LP` }}
        </button>
        <button class="btn btn--ghost" :disabled="busy" @click="emit('close')">Cancelar</button>
      </div>

      <p class="nota">
        Se puede deshacer entero desde el historial: los puntos se marcan como revertidos y el LP se
        vuelve a sumar.
      </p>
    </div>
  </div>
</template>

<style scoped>
.capa {
  position: fixed;
  inset: 0;
  z-index: 70;
  background: rgba(var(--ink-rgb), 0.7);
  display: grid;
  place-items: center;
  padding: 20px;
}

.fin {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 18px 20px 16px;
  width: min(760px, 100%);
  max-height: 88vh;
  overflow-y: auto;
}

h2 {
  font-size: 17px;
  margin: 0 0 3px;
  color: var(--text);
}

.sub {
  font-size: 12px;
  color: var(--muted);
  margin: 0 0 14px;
}

.ganador {
  border: 0;
  padding: 0;
  margin: 0 0 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.ganador legend {
  font-family: var(--f-mono);
  font-size: 9.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--dim);
  padding: 0 0 5px;
}

.equipo {
  flex: 1;
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 9px;
  font-family: var(--f-mono);
  font-size: 13px;
  letter-spacing: 0.06em;
  color: var(--muted);
}

.equipo.is-t1.is-on {
  border-color: var(--team-1);
  color: var(--team-1);
  background: rgba(76, 141, 255, 0.1);
}

.equipo.is-t2.is-on {
  border-color: var(--team-2);
  color: var(--team-2);
  background: rgba(255, 90, 110, 0.1);
}

.equipos {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.col h3 {
  font-family: var(--f-mono);
  font-size: 10.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin: 0 0 6px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.col.is-t1 h3 {
  color: var(--team-1);
}

.col.is-t2 h3 {
  color: var(--team-2);
}

.gana {
  font-size: 9px;
  color: var(--ok);
  border: 1px solid rgba(63, 214, 154, 0.4);
  border-radius: 20px;
  padding: 1px 7px;
}

.col ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.col li {
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: 7px;
  padding: 6px 8px;
}

.quien {
  display: flex;
  align-items: center;
  gap: 6px;
}

.rol {
  font-family: var(--f-mono);
  font-size: 10px;
  font-weight: 700;
  color: var(--dim);
  width: 30px;
}

.nombre {
  font-size: 12.5px;
  color: var(--text);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.off {
  font-family: var(--f-mono);
  font-size: 8.5px;
  text-transform: uppercase;
  color: var(--gold);
}

.premios {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 5px;
}

.tag {
  font-family: var(--f-mono);
  font-size: 9px;
  letter-spacing: 0.08em;
  background: var(--panel-3);
  border: 1px solid var(--line);
  border-radius: 20px;
  padding: 2px 8px;
  color: var(--dim);
}

.tag.is-on {
  border-color: var(--gold);
  color: var(--gold);
}

.tag--mal.is-on {
  border-color: var(--danger);
  color: var(--danger);
}

.lp {
  margin-left: auto;
  font-family: var(--f-mono);
  font-size: 12px;
  color: var(--ok);
}

.lp.neg {
  color: var(--danger);
}

.detalle {
  margin: 4px 0 0;
  font-family: var(--f-mono);
  font-size: 9.5px;
  color: var(--dim);
}

.avisos {
  list-style: none;
  margin: 12px 0 0;
  padding: 8px 10px;
  background: rgba(255, 196, 77, 0.08);
  border: 1px solid rgba(255, 196, 77, 0.35);
  border-radius: 8px;
  font-size: 12px;
  color: var(--warn);
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.btns {
  display: flex;
  gap: 8px;
  margin-top: 14px;
}

.btns .btn {
  flex: 1;
}

.nota {
  margin: 10px 0 0;
  font-size: 11px;
  color: var(--dim);
}

@media (max-width: 700px) {
  .equipos {
    grid-template-columns: 1fr;
  }
}
</style>
