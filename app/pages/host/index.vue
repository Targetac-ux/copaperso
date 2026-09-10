<script setup lang="ts">
import type { BenchPlayer } from '#shared/draft'
import type { PlayerRole, Player, PlayerRole as Rol } from '#shared/types/models'

definePageMeta({ layout: 'host' })
useSeoMeta({ title: 'CCTM Manager', robots: 'noindex' })

const MODOS: Record<string, string> = {
  perso: 'Copa Perso',
  tryhard: 'Copa Tryhard',
  random: 'Copa Random',
  analisis: 'Copa Análisis',
  aram_afk: 'Copa ARAM AFK',
}

interface Participacion {
  id: string
  roles: Rol[]
  player: Player
}
interface EntradaLog {
  id: string
  action_type: string
  summary: string
  created_at: string
  undone_at: string | null
  can_undo: boolean
}

// --- sesión activa ---------------------------------------------------------
const { data: sesiones, refresh: refrescarSesiones } = await useFetch('/api/sessions', {
  default: () => [],
})
const activa = computed(() => sesiones.value.find((s) => s.status !== 'closed') ?? null)
const sessionId = computed(() => activa.value?.id)

const cctm = useCctm(sessionId)
const {
  draft, busy, error, warnings, available, jailed, graveyard,
  load, assign, swap, toBench, benchAll, setState, roll,
  confirmWarnings, dismissWarnings,
} = cctm

// --- estado de la pantalla -------------------------------------------------
const seleccionado = ref<string | null>(null)
const swapDesde = ref<string | null>(null)
const sorteado = ref<BenchPlayer | null>(null)
const log = ref<EntradaLog[]>([])
const creando = ref(false)

// --- economía y cronómetro (Fase 3B) --------------------------------------
interface Precio { id: string; code: string; label: string; cost_bits: number; effective: number }
interface Cuenta { id: string; display_name: string; kind: 'player' | 'supporter'; balance_bits: number; balance_subs: number }
interface Prestamo { id: string; person_name: string; principal_bits: number; lent_at: string; status: 'open' | 'settled' | 'forgiven'; amount_due: number; interest: number }
interface Reclamo { id: string; action_code: string; cost_bits: number; tripled: boolean; paid_with: 'bits' | 'sub_na' | 'sub_latam'; created_at: string }

interface Nota { id: string; body: string }
interface Extra { id: string; kind: string; body: string }
interface Restriccion { id: string; player_name: string; kind: string; value: string | null; note: string | null }

const precios = ref<Precio[]>([])
const notas = ref<Nota[]>([])
const extras = ref<Extra[]>([])
const restricciones = ref<Restriccion[]>([])
const cuentas = ref<Cuenta[]>([])
const prestamos = ref<Prestamo[]>([])
const reclamos = ref<Reclamo[]>([])
const tiempoAgotado = ref(false)

const cronometro = computed(() => ({
  endsAt: activa.value?.timer_ends_at ?? null,
  seconds: activa.value?.timer_seconds ?? 900,
  running: activa.value?.timer_running ?? false,
}))

async function cargarEconomia() {
  if (!sessionId.value) return
  const [cat, banco, deudas, claims, apuntes] = await Promise.all([
    $fetch<{ tripled: boolean; actions: Precio[] }>('/api/catalog', {
      query: { session_id: sessionId.value },
    }),
    $fetch<Cuenta[]>('/api/ledger'),
    $fetch<Prestamo[]>('/api/loans'),
    $fetch<Reclamo[]>(`/api/sessions/${sessionId.value}/claims`),
    $fetch<{ notes: Nota[]; extras: Extra[]; restrictions: Restriccion[] }>(
      `/api/sessions/${sessionId.value}/notes`,
    ),
  ])
  precios.value = cat.actions
  cuentas.value = banco
  prestamos.value = deudas
  reclamos.value = claims
  notas.value = apuntes.notes
  extras.value = apuntes.extras
  restricciones.value = apuntes.restrictions
}

async function anotar(payload: { type: 'note' | 'extra'; kind?: string; body: string }) {
  if (!sessionId.value) return
  await $fetch(`/api/sessions/${sessionId.value}/notes`, { method: 'POST', body: payload })
  await Promise.all([cargarEconomia(), recargar()])
}

async function restringir(payload: { participation_id: string; kind: 'no_role'; value: string }) {
  if (!sessionId.value) return
  await $fetch(`/api/sessions/${sessionId.value}/notes`, {
    method: 'POST',
    body: { type: 'restriction', ...payload },
  })
  await cargarEconomia()
}

async function levantarRestriccion(id: string) {
  await $fetch(`/api/restrictions/${id}`, { method: 'DELETE' })
  await cargarEconomia()
}

async function accionCronometro(payload: { action: 'start' | 'pause' | 'reset'; seconds?: number }) {
  if (!sessionId.value) return
  await $fetch(`/api/sessions/${sessionId.value}/timer`, { method: 'POST', body: payload })
  await refrescarSesiones()
  await recargar()
}

async function triplicar(tripled: boolean) {
  if (!sessionId.value) return
  await $fetch(`/api/sessions/${sessionId.value}/triple`, { method: 'POST', body: { tripled } })
  tiempoAgotado.value = false
  await refrescarSesiones()
  await cargarEconomia()
}

async function registrarReclamo(payload: { action_code: string; paid_with: string; note?: string }) {
  if (!sessionId.value) return
  await $fetch(`/api/sessions/${sessionId.value}/claims`, { method: 'POST', body: payload })
  await Promise.all([cargarEconomia(), recargar()])
}

async function movimientoBanco(payload: { account_id: string; delta_bits: number; reason: string }) {
  await $fetch(`/api/ledger/${payload.account_id}/entries`, {
    method: 'POST',
    body: { delta_bits: payload.delta_bits, reason: payload.reason, session_id: sessionId.value },
  })
  await Promise.all([cargarEconomia(), recargar()])
}

async function abrirCuenta(payload: { display_name: string; balance_bits: number }) {
  await $fetch('/api/ledger', { method: 'POST', body: payload })
  await cargarEconomia()
}

async function nuevoPrestamo(payload: { person_name: string; principal_bits: number }) {
  await $fetch('/api/loans', { method: 'POST', body: payload })
  await cargarEconomia()
}

async function saldarPrestamo(id: string) {
  await $fetch(`/api/loans/${id}`, { method: 'PATCH', body: { status: 'settled' } })
  await cargarEconomia()
}

async function recargar() {
  if (!sessionId.value) return
  await load()
  log.value = await $fetch<EntradaLog[]>(`/api/sessions/${sessionId.value}/log`, {
    query: { limit: 20 },
  })
}

const errorUndo = ref('')
const deshaciendo = ref<string | null>(null)

/** Solo para saber si enseñar el botón; cuál se deshace lo decide el servidor. */
const hayQueDeshacer = computed(() => log.value.some((e) => e.can_undo))

/**
 * Deshacer lo último. No manda el id: el historial de la pantalla puede ir un
 * instante por detrás, y entonces el botón desharía la acción equivocada.
 */
async function deshacerUltimo() {
  if (!sessionId.value) return
  deshaciendo.value = 'ultimo'
  errorUndo.value = ''
  try {
    await $fetch(`/api/sessions/${sessionId.value}/undo-last`, { method: 'POST' })
    await Promise.all([recargar(), cargarEconomia()])
  } catch (e) {
    errorUndo.value = (e as { statusMessage?: string }).statusMessage ?? 'No se pudo deshacer.'
  } finally {
    deshaciendo.value = null
  }
}

async function deshacer(id: string) {
  deshaciendo.value = id
  errorUndo.value = ''
  try {
    await $fetch(`/api/log/${id}/undo`, { method: 'POST' })
    await Promise.all([recargar(), cargarEconomia()])
  } catch (e) {
    errorUndo.value = (e as { statusMessage?: string }).statusMessage ?? 'No se pudo deshacer.'
  } finally {
    deshaciendo.value = null
  }
}

watch(
  sessionId,
  async () => {
    await recargar()
    await cargarEconomia()
  },
  { immediate: true },
)

// Los participantes del mes que todavía no están en esta sesión.
const { data: participaciones } = await useFetch<Participacion[]>('/api/participations', {
  default: () => [],
})

const fuera = computed(() => {
  const dentro = new Set(draft.value?.bench.map((b) => b.participationId) ?? [])
  return participaciones.value.filter((p) => !dentro.has(p.id))
})

async function meterEnBanca(participationId: string) {
  if (!sessionId.value) return
  await $fetch(`/api/sessions/${sessionId.value}/participants`, {
    method: 'POST',
    body: { participation_id: participationId },
  })
  await recargar()
}

async function nuevaSesion() {
  creando.value = true
  try {
    await $fetch('/api/sessions', { method: 'POST', body: { mode: 'perso' } })
    await refrescarSesiones()
    await recargar()
  } finally {
    creando.value = false
  }
}

// --- acciones del draft ----------------------------------------------------
async function tras(accion: Promise<unknown>) {
  await accion
  await recargar()
}

function alSoltar(payload: { id: string; role: PlayerRole }, team: 1 | 2) {
  tras(assign(payload.id, team, payload.role))
}

function alSeleccionar(id: string) {
  // Con un swap a medias, el segundo clic elige la pareja.
  if (swapDesde.value && swapDesde.value !== id) {
    const desde = swapDesde.value
    swapDesde.value = null
    tras(swap(desde, id))
    return
  }
  seleccionado.value = seleccionado.value === id ? null : id
}

async function sortear() {
  sorteado.value = await roll()
}

async function confirmar() {
  await confirmWarnings()
  await recargar()
}

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
</script>

<template>
  <div>
    <!-- sin sesión abierta -->
    <section v-if="!activa" class="vacio">
      <p class="eyebrow">CCTM Manager</p>
      <h1>No hay ninguna CopaPerso abierta</h1>
      <p class="vacio__txt">
        Abre una sesión para empezar a registrar gente, sortear y formar los equipos.
      </p>
      <button class="btn btn--primary" :disabled="creando" @click="nuevaSesion">
        {{ creando ? 'Abriendo…' : 'Abrir sesión' }}
      </button>
    </section>

    <template v-else>
      <div class="barra">
        <span class="titulo">Sesión #{{ activa.number }}</span>
        <span class="chip" :class="`is-${activa.status}`">
          {{ activa.status === 'live' ? 'En vivo' : 'Abierta' }}
        </span>
        <span class="chip">{{ MODOS[activa.mode] ?? activa.mode }}</span>
        <span class="hueco" />
        <CctmTimer
          :timer="cronometro"
          :tripled="activa.prices_tripled"
          :busy="busy"
          @action="accionCronometro"
          @expired="tiempoAgotado = true"
        />
        <button class="btn btn--ghost" :disabled="busy" @click="tras(benchAll())">
          Devolver equipos a banca
        </button>
      </div>

      <p v-if="error" class="alert alert--error">{{ error }}</p>

      <div class="mesa">
        <CctmBench
          :players="draft?.bench ?? []"
          :selected="seleccionado"
          @select="alSeleccionar"
          @bench-drop="(id) => tras(toBench(id))"
        >
          <template #registro>
            <PlayerLineInput :session-id="activa.id" compact @registered="recargar" />
          </template>
        </CctmBench>

        <div class="centro">
          <div class="equipos">
            <CctmTeam
              v-for="t in draft?.teams ?? []"
              :key="t.teamNumber"
              :team="t"
              :selected="seleccionado"
              :swap-from="swapDesde"
              @drop="(p) => alSoltar(p, t.teamNumber)"
              @select="alSeleccionar"
            />
          </div>

          <section v-if="fuera.length" class="sumar">
            <h2>Registrados este mes que no están en la sesión</h2>
            <div class="sumar__lista">
              <button
                v-for="p in fuera"
                :key="p.id"
                class="btn btn--ghost"
                @click="meterEnBanca(p.id)"
              >
                + {{ p.player.display_name }}
              </button>
            </div>
          </section>
        </div>

        <div class="derecha">
          <CctmRandom
            v-model:picked="sorteado"
            :available="available.length"
            :busy="busy"
            @roll="sortear"
            @assign="(p) => tras(assign(p.id, p.team, p.role)).then(() => (sorteado = null))"
          />

          <CctmPlayerActions
            v-if="seleccionado && draft"
            :draft="draft"
            :selected-id="seleccionado"
            :swap-from="swapDesde"
            :busy="busy"
            @assign="(p) => tras(assign(p.id, p.team, p.role))"
            @bench="(id) => tras(toBench(id))"
            @state="(p) => tras(setState(p.id, p.state))"
            @start-swap="(id) => (swapDesde = id)"
            @cancel-swap="swapDesde = null"
            @close="seleccionado = null"
          />

        </div>
      </div>

      <CctmEconomy
        class="eco-panel"
        :prices="precios"
        :tripled="activa.prices_tripled"
        :accounts="cuentas"
        :loans="prestamos"
        :claims="reclamos"
        :jailed="jailed"
        :graveyard="graveyard"
        :notes="notas"
        :extras="extras"
        :restrictions="restricciones"
        :players="draft?.bench ?? []"
        :busy="busy"
        @claim="registrarReclamo"
        @entry="movimientoBanco"
        @open-account="abrirCuenta"
        @new-loan="nuevoPrestamo"
        @settle-loan="saldarPrestamo"
        @restore-prices="triplicar(false)"
        @free-player="(id) => tras(setState(id, 'bench'))"
        @add-note="anotar"
        @add-restriction="restringir"
        @lift-restriction="levantarRestriccion"
      />

      <section class="log">
        <header class="log__cab">
          <h2>Historial</h2>
          <button
            v-if="hayQueDeshacer"
            class="btn btn--ghost log__undo"
            :disabled="!!deshaciendo"
            @click="deshacerUltimo"
          >
            ↶ Deshacer lo último
          </button>
        </header>

        <p v-if="errorUndo" class="alert alert--error">{{ errorUndo }}</p>

        <ol v-if="log.length">
          <li v-for="e in log" :key="e.id" :class="{ 'is-undone': e.undone_at }">
            <time>{{ hora(e.created_at) }}</time>
            <span>{{ e.summary }}</span>
            <button
              v-if="e.can_undo"
              class="undo"
              :disabled="!!deshaciendo"
              :title="`Deshacer: ${e.summary}`"
              @click="deshacer(e.id)"
            >
              ↶
            </button>
          </li>
        </ol>
        <p v-else class="log__vacio">Todavía no ha pasado nada en esta sesión.</p>
      </section>
    </template>

    <CctmTimeUp
      :open="tiempoAgotado"
      :tripled="activa?.prices_tripled ?? false"
      :prices="precios"
      @triple="triplicar(true)"
      @close="tiempoAgotado = false"
    />

    <CctmWarnings :warnings="warnings" @confirm="confirmar" @cancel="dismissWarnings" />
  </div>
</template>

<style scoped>
.vacio {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  padding: 70px 0;
}

h1 {
  font-size: 28px;
  font-weight: 600;
  margin: 4px 0 0;
}

.vacio__txt {
  color: var(--muted);
  max-width: 52ch;
  margin: 0;
}

.barra {
  display: flex;
  align-items: center;
  gap: 9px;
  background: var(--panel-3);
  border-radius: var(--r);
  padding: 9px 13px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.titulo {
  font-family: var(--f-display);
  font-weight: 600;
  font-size: 15px;
}

.hueco {
  flex: 1;
}

.chip {
  font-family: var(--f-mono);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border: 1px solid var(--line);
  border-radius: 20px;
  padding: 3px 9px;
  color: var(--muted);
}

.chip.is-live {
  border-color: var(--danger);
  color: var(--danger);
}

.chip.is-open {
  border-color: var(--ok);
  color: var(--ok);
}

.mesa {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.6fr) minmax(0, 1.05fr);
  gap: 12px;
  /* Las tres columnas a la misma altura: si no, la de la derecha se estira
     sola y las otras dos dejan un hueco muerto debajo. */
  align-items: stretch;
  min-height: 62vh;
}

.centro {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.equipos > * {
  align-self: start;
}

.equipos {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.derecha {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.sumar,
.log {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--r);
  padding: 14px;
}

.sumar h2,
.log h2 {
  font-family: var(--f-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--dim);
  font-weight: 500;
  margin-bottom: 9px;
}

.sumar__lista {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.sumar__lista .btn {
  font-size: 12px;
  padding: 5px 10px;
}

.eco-panel {
  margin-top: 12px;
}

.log {
  margin-top: 12px;
}

.log ol {
  list-style: none;
  margin: 0;
  padding: 0;
  columns: 3;
  column-gap: 24px;
  font-family: var(--f-mono);
  font-size: 11px;
  color: var(--muted);
}

.log__cab {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 9px;
}

.log__cab h2 {
  margin: 0;
}

.log__undo {
  margin-left: auto;
  font-size: 11.5px;
  padding: 4px 10px;
}

.log li {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 2px 0;
  break-inside: avoid;
}

/* Lo deshecho no se borra: se tacha, para que se vea qué pasó. */
.log li.is-undone {
  color: var(--dim);
  text-decoration: line-through;
}

.undo {
  background: none;
  border: 0;
  color: var(--dim);
  font-size: 12px;
  padding: 0 3px;
  line-height: 1;
}

.undo:hover:not(:disabled) {
  color: var(--violet);
}

.undo:disabled {
  opacity: 0.4;
}

.log time {
  color: var(--dim);
  flex: none;
}

.log__vacio {
  margin: 0;
  font-size: 12.5px;
  color: var(--dim);
}

@media (max-width: 1100px) {
  .log ol {
    columns: 2;
  }
}

@media (max-width: 1300px) {
  .mesa {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
  }

  .derecha {
    grid-column: 1 / -1;
    flex-direction: row;
    flex-wrap: wrap;
  }

  .derecha > * {
    flex: 1 1 260px;
  }
}

@media (max-width: 900px) {
  .mesa {
    grid-template-columns: 1fr;
  }

  .equipos {
    grid-template-columns: 1fr;
  }
}
</style>
