<script setup lang="ts">
import { formatWinrate, winratePct } from '#shared/roster'
import type { EloTierDb, PlayerRoleDb } from '#shared/types/database.types'

/**
 * La ficha de un jugador: su foto y su histórico mes a mes.
 *
 * Los periodos **no se suman**: el LP se reinicia cada mes (A3), así que un
 * total acumulado sería un número sin significado. Lo que se lee aquí es la
 * evolución, que es lo que el host quiere ver antes de colocar a alguien en un
 * tier.
 */
const props = defineProps<{ playerId: string }>()
const emit = defineEmits<{ close: []; updated: [] }>()

interface PeriodoDeJugador {
  periodId: string
  periodName: string
  elo: EloTierDb | null
  roles: PlayerRoleDb[]
  lp: number
  lpInicial: number
  jugadas: number
  victorias: number
  derrotas: number
  mvps: number
  aces: number
  offRoles: number
}

interface Ficha {
  player: { id: string; display_name: string; photo_url: string | null; twitch_handle: string | null }
  periodos: PeriodoDeJugador[]
}

const { data, refresh, status } = await useFetch<Ficha>(
  computed(() => `/api/players/${props.playerId}/historial`),
)

watch(() => props.playerId, () => refresh())

// --- foto: elegir y encuadrar ---------------------------------------------
const LADO = 240

const archivo = ref<File | null>(null)
const urlLocal = ref<string | null>(null)
const natural = reactive({ w: 0, h: 0 })
const zoom = ref(1)
const pos = reactive({ x: 0, y: 0 })
const subiendo = ref(false)
const errorFoto = ref('')

/** Escala a la que la imagen cubre justo el marco, antes del zoom del host. */
const escalaBase = computed(() =>
  natural.w && natural.h ? LADO / Math.min(natural.w, natural.h) : 1,
)
const escala = computed(() => escalaBase.value * zoom.value)

function limitar() {
  const anchoVisible = natural.w * escala.value
  const altoVisible = natural.h * escala.value
  // No se puede arrastrar hasta dejar un hueco: el marco siempre lleno.
  pos.x = Math.min(0, Math.max(LADO - anchoVisible, pos.x))
  pos.y = Math.min(0, Math.max(LADO - altoVisible, pos.y))
}

watch(zoom, (nuevo, viejo) => {
  // Al ampliar se mantiene el centro del marco, que es lo que el host mira.
  const factor = nuevo / viejo
  pos.x = LADO / 2 - (LADO / 2 - pos.x) * factor
  pos.y = LADO / 2 - (LADO / 2 - pos.y) * factor
  limitar()
})

function elegir(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  errorFoto.value = ''
  if (!f) return
  if (urlLocal.value) URL.revokeObjectURL(urlLocal.value)

  archivo.value = f
  urlLocal.value = URL.createObjectURL(f)
  zoom.value = 1
  pos.x = 0
  pos.y = 0
}

function alCargar(e: Event) {
  const img = e.target as HTMLImageElement
  natural.w = img.naturalWidth
  natural.h = img.naturalHeight
  // Centrado de salida.
  pos.x = (LADO - natural.w * escala.value) / 2
  pos.y = (LADO - natural.h * escala.value) / 2
  limitar()
}

let arrastrando = false
let desde = { x: 0, y: 0 }

function empezarArrastre(e: PointerEvent) {
  if (!urlLocal.value) return
  arrastrando = true
  desde = { x: e.clientX - pos.x, y: e.clientY - pos.y }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function moverArrastre(e: PointerEvent) {
  if (!arrastrando) return
  pos.x = e.clientX - desde.x
  pos.y = e.clientY - desde.y
  limitar()
}

function soltarArrastre(e: PointerEvent) {
  arrastrando = false
  ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
}

function cancelar() {
  if (urlLocal.value) URL.revokeObjectURL(urlLocal.value)
  urlLocal.value = null
  archivo.value = null
  errorFoto.value = ''
}

onBeforeUnmount(() => {
  if (urlLocal.value) URL.revokeObjectURL(urlLocal.value)
})

async function guardarFoto() {
  if (!archivo.value) return
  subiendo.value = true
  errorFoto.value = ''

  try {
    // Del marco a píxeles del original: lo que se ve es lo que se recorta.
    const lado = Math.round(LADO / escala.value)
    const body = new FormData()
    body.append('file', archivo.value)
    body.append('crop_x', String(Math.round(-pos.x / escala.value)))
    body.append('crop_y', String(Math.round(-pos.y / escala.value)))
    body.append('crop_lado', String(lado))

    await $fetch(`/api/players/${props.playerId}/photo`, { method: 'POST', body })
    cancelar()
    await refresh()
    emit('updated')
  } catch (e) {
    errorFoto.value = (e as { statusMessage?: string }).statusMessage ?? 'No se pudo subir.'
  } finally {
    subiendo.value = false
  }
}
</script>

<template>
  <div class="capa" @click.self="emit('close')">
    <aside class="ficha" role="dialog" aria-labelledby="ficha-titulo">
      <header class="cab">
        <h2 id="ficha-titulo">{{ data?.player.display_name ?? 'Jugador' }}</h2>
        <button class="cerrar" aria-label="Cerrar" @click="emit('close')">✕</button>
      </header>

      <p v-if="status === 'pending'" class="vacio">Cargando…</p>

      <template v-else-if="data">
        <section class="foto">
          <template v-if="urlLocal">
            <div
              class="marco"
              :style="{ width: `${LADO}px`, height: `${LADO}px` }"
              @pointerdown="empezarArrastre"
              @pointermove="moverArrastre"
              @pointerup="soltarArrastre"
              @pointercancel="soltarArrastre"
            >
              <img
                :src="urlLocal"
                alt=""
                :style="{
                  transform: `translate(${pos.x}px, ${pos.y}px) scale(${escala})`,
                }"
                @load="alCargar"
              >
              <span class="marco__guia" aria-hidden="true" />
            </div>

            <label class="zoom">
              Zoom
              <input v-model.number="zoom" type="range" min="1" max="3" step="0.02">
            </label>

            <p class="pista">Arrastra la imagen para elegir el encuadre.</p>

            <div class="btns">
              <button class="btn btn--primary" :disabled="subiendo" @click="guardarFoto">
                {{ subiendo ? 'Subiendo…' : 'Guardar foto' }}
              </button>
              <button class="btn btn--ghost" :disabled="subiendo" @click="cancelar">Cancelar</button>
            </div>
          </template>

          <template v-else>
            <img
              class="actual"
              :src="data.player.photo_url || '/ui/avatar-default.webp'"
              alt=""
              width="96"
              height="96"
            >
            <label class="btn btn--ghost elegir">
              {{ data.player.photo_url ? 'Cambiar foto' : 'Subir foto' }}
              <input type="file" accept="image/jpeg,image/png,image/webp" @change="elegir">
            </label>
          </template>

          <p v-if="errorFoto" class="alert alert--error">{{ errorFoto }}</p>
        </section>

        <section class="historico">
          <h3>Mes a mes</h3>

          <p v-if="!data.periodos.length" class="vacio">Todavía no ha jugado ningún periodo.</p>

          <ul v-else>
            <li v-for="p in data.periodos" :key="p.periodId">
              <div class="mes">
                <b>{{ p.periodName }}</b>
                <span class="lp">{{ p.lp }} LP</span>
                <span class="delta" :class="{ neg: p.lp < p.lpInicial }">
                  {{ p.lp - p.lpInicial >= 0 ? '+' : '' }}{{ p.lp - p.lpInicial }}
                </span>
              </div>

              <div class="datos">
                <span>{{ p.jugadas || '—' }} PJ</span>
                <span>{{ p.jugadas ? `${p.victorias}V ${p.derrotas}D` : '—' }}</span>
                <span>{{ formatWinrate(winratePct(p)) }}</span>
                <span v-if="p.mvps" class="oro">{{ p.mvps }} MVP</span>
                <span v-if="p.aces" class="oro">{{ p.aces }} ACE</span>
                <span v-if="p.offRoles">{{ p.offRoles }} off role</span>
              </div>
            </li>
          </ul>

          <p class="nota">
            Cada mes va por separado: el LP se reinicia al abrir el periodo, así que sumar los meses
            no diría nada.
          </p>
        </section>
      </template>
    </aside>
  </div>
</template>

<style scoped>
.capa {
  position: fixed;
  inset: 0;
  z-index: 70;
  background: rgba(var(--ink-rgb), 0.7);
  display: flex;
  justify-content: flex-end;
}

.ficha {
  background: var(--panel);
  border-left: 1px solid var(--line);
  width: min(400px, 100%);
  height: 100%;
  overflow-y: auto;
  padding: 16px 18px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cab {
  display: flex;
  align-items: center;
  gap: 10px;
}

h2 {
  font-family: var(--f-display);
  font-size: 19px;
  margin: 0;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cerrar {
  background: none;
  border: 0;
  color: var(--dim);
  font-size: 15px;
  padding: 2px 6px;
}

.cerrar:hover {
  color: var(--text);
}

.foto {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.actual {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  object-fit: cover;
  background: var(--panel-3);
}

.elegir {
  position: relative;
  overflow: hidden;
  cursor: pointer;
}

.elegir input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.marco {
  position: relative;
  overflow: hidden;
  border-radius: 50%;
  background: var(--panel-3);
  touch-action: none;
  cursor: grab;
}

.marco:active {
  cursor: grabbing;
}

.marco img {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
  max-width: none;
  user-select: none;
  -webkit-user-drag: none;
}

/* Un aro fino para que se vea dónde corta el círculo. */
.marco__guia {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.35);
  pointer-events: none;
}

.zoom {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  font-family: var(--f-mono);
  font-size: 9.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--dim);
}

.zoom input {
  flex: 1;
}

.pista {
  margin: 0;
  font-size: 11.5px;
  color: var(--dim);
}

.btns {
  display: flex;
  gap: 8px;
  width: 100%;
}

.btns .btn {
  flex: 1;
}

.historico h3,
.nota {
  font-family: var(--f-mono);
  font-size: 9.5px;
  letter-spacing: 0.13em;
  text-transform: uppercase;
  color: var(--dim);
  font-weight: 500;
  margin: 0 0 8px;
}

.nota {
  letter-spacing: 0;
  text-transform: none;
  line-height: 1.7;
  margin: 12px 0 0;
}

.historico ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.historico li {
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  padding: 8px 10px;
}

.mes {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.mes b {
  font-family: var(--f-mono);
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--text);
}

.lp {
  margin-left: auto;
  font-family: var(--f-mono);
  font-size: 12px;
  color: var(--violet);
}

.delta {
  font-family: var(--f-mono);
  font-size: 10px;
  color: var(--ok);
}

.delta.neg {
  color: var(--danger);
}

.datos {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 5px;
  font-family: var(--f-mono);
  font-size: 10px;
  color: var(--muted);
}

.oro {
  color: var(--gold);
}

.vacio {
  margin: 0;
  font-size: 12.5px;
  color: var(--dim);
}
</style>
