<script setup lang="ts">
import { TIERS, TIER_LABEL, cambios, mover, porTier } from '#shared/tiers'
import type { EntradaTier } from '#shared/tiers'
import type { TierName } from '#shared/types/database.types'

/**
 * El Tier Ranking Manager (§30).
 *
 * **El tier lo pone el host.** No hay nada que lo calcule ni que lo proponga:
 * se arrastra a la gente entre filas y ya está.
 *
 * Lo que se edita es siempre un **borrador**. Publicar lo convierte en la
 * edición vigente —la que ve la Home— y a partir de ahí queda congelado: para
 * cambiar algo se empieza otra. Por eso el histórico significa algo.
 */
definePageMeta({ layout: 'host' })
useSeoMeta({ title: 'Tier Manager', robots: 'noindex' })

interface Tabla {
  edicion: { id: string; title: string | null; periodName: string | null; publishedAt: string | null; isCurrent: boolean } | null
  entradas: EntradaTier[]
}
interface EdicionListada {
  id: string
  title: string | null
  periodName: string | null
  publishedAt: string | null
  isCurrent: boolean
  createdAt: string
  jugadores: number
}

const { data, refresh } = await useFetch<Tabla>('/api/tiers', {
  default: () => ({ edicion: null, entradas: [] }),
})
const { data: ediciones, refresh: refrescarEdiciones } = await useFetch<EdicionListada[]>(
  '/api/tiers/editions',
  { default: () => [] },
)

const ocupado = ref(false)
const error = ref('')

const editable = computed(() => !!data.value.edicion && !data.value.edicion.publishedAt)
const grupos = computed(() => porTier(data.value.entradas))

// --- arrastrar -------------------------------------------------------------
const arrastrado = ref<string | null>(null)
const sobre = ref<{ tier: TierName; pos: number } | null>(null)

function empezar(e: DragEvent, id: string) {
  if (!editable.value) return
  arrastrado.value = id
  e.dataTransfer?.setData('text/plain', id)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

function encima(tier: TierName, pos: number) {
  if (!arrastrado.value) return
  sobre.value = { tier, pos }
}

async function soltar(tier: TierName, pos: number) {
  const id = arrastrado.value
  arrastrado.value = null
  sobre.value = null
  if (!id || !editable.value) return

  const antes = data.value.entradas
  const despues = mover(antes, id, tier, pos)
  const lista = cambios(antes, despues)
  if (!lista.length) return

  // Se pinta ya y se guarda después: arrastrar con un parpadeo de espera en
  // cada movimiento haría insoportable ordenar cuarenta personas.
  data.value = { ...data.value, entradas: despues }

  ocupado.value = true
  error.value = ''
  try {
    await $fetch(`/api/tiers/${data.value.edicion!.id}/entries`, {
      method: 'PATCH',
      body: { cambios: lista },
    })
  } catch (err) {
    error.value = (err as { statusMessage?: string }).statusMessage ?? 'No se pudo guardar el cambio.'
    await refresh()
  } finally {
    ocupado.value = false
  }
}

// --- acciones --------------------------------------------------------------
async function nuevaEdicion(desde: 'actual' | 'periodo') {
  ocupado.value = true
  error.value = ''
  try {
    await $fetch('/api/tiers', { method: 'POST', body: { desde } })
    await Promise.all([refresh(), refrescarEdiciones()])
  } catch (err) {
    error.value = (err as { statusMessage?: string }).statusMessage ?? 'No se pudo crear la edición.'
  } finally {
    ocupado.value = false
  }
}

async function publicar() {
  if (!data.value.edicion) return
  ocupado.value = true
  error.value = ''
  try {
    await $fetch(`/api/tiers/${data.value.edicion.id}/publish`, { method: 'POST' })
    await Promise.all([refresh(), refrescarEdiciones()])
  } catch (err) {
    error.value = (err as { statusMessage?: string }).statusMessage ?? 'No se pudo publicar.'
  } finally {
    ocupado.value = false
  }
}

async function verEdicion(id: string) {
  data.value = await $fetch<Tabla>('/api/tiers', { query: { id } })
}

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
</script>

<template>
  <section class="tiers">
    <header class="cab">
      <h1>Tier Manager</h1>

      <span v-if="data.edicion" class="edicion">
        {{ data.edicion.title ?? 'Sin título' }}
        <i v-if="data.edicion.isCurrent" class="viva">publicada</i>
        <i v-else-if="data.edicion.publishedAt" class="vieja">edición anterior</i>
        <i v-else class="borrador">borrador</i>
      </span>

      <span class="hueco" />

      <button
        v-if="editable"
        class="btn btn--primary"
        :disabled="ocupado || !data.entradas.length"
        @click="publicar"
      >
        Publicar
      </button>
      <template v-else>
        <button class="btn btn--ghost" :disabled="ocupado" @click="nuevaEdicion('actual')">
          Nueva edición
        </button>
        <button class="btn btn--ghost" :disabled="ocupado" @click="nuevaEdicion('periodo')">
          Empezar desde el mes
        </button>
      </template>
    </header>

    <p v-if="error" class="alert alert--error">{{ error }}</p>

    <p v-if="!data.edicion" class="estado">
      Todavía no hay ninguna edición. Empieza una desde el mes para colocar a los inscritos.
    </p>

    <template v-else>
      <p class="pista">
        <template v-if="editable">
          Arrastra a cada jugador a su tier. Se guarda solo; publicar es lo que lo saca a la Home.
        </template>
        <template v-else>
          Esta edición está publicada y no se toca. Para cambiar algo, empieza una nueva.
        </template>
      </p>

      <div class="tablero">
        <section v-for="tier in TIERS" :key="tier" class="fila" :class="`is-${tier.toLowerCase()}`">
          <div class="fila__etq">
            <b>{{ TIER_LABEL[tier] }}</b>
            <span>{{ grupos[tier].length }}</span>
          </div>

          <ul
            class="fila__gente"
            :class="{ 'is-target': sobre?.tier === tier }"
            @dragover.prevent="encima(tier, grupos[tier].length)"
            @drop.prevent="soltar(tier, grupos[tier].length)"
          >
            <li
              v-for="(e, i) in grupos[tier]"
              :key="e.id"
              class="jugador"
              :class="{ 'is-moving': arrastrado === e.id }"
              :draggable="editable"
              @dragstart="empezar($event, e.id)"
              @dragend="arrastrado = null"
              @dragover.prevent.stop="encima(tier, i)"
              @drop.prevent.stop="soltar(tier, i)"
            >
              <img
                :src="e.photoUrl || '/ui/avatar-default.webp'"
                :alt="''"
                width="40"
                height="40"
                loading="lazy"
              >
              <span class="jugador__nombre">{{ e.displayName }}</span>
              <span v-if="e.mainRole" class="jugador__rol" :class="`rol--${e.mainRole.toLowerCase()}`">
                {{ e.mainRole }}
              </span>
            </li>

            <li v-if="!grupos[tier].length" class="vacia">—</li>
          </ul>
        </section>
      </div>

      <section v-if="ediciones.length" class="historico">
        <h2>Ediciones</h2>
        <ul>
          <li v-for="ed in ediciones" :key="ed.id" :class="{ 'is-current': ed.isCurrent }">
            <button @click="verEdicion(ed.id)">
              <b>{{ ed.title ?? 'Sin título' }}</b>
              <span class="cuando">{{ ed.publishedAt ? fecha(ed.publishedAt) : 'sin publicar' }}</span>
              <span class="cuantos">{{ ed.jugadores }} jugadores</span>
              <span v-if="ed.isCurrent" class="viva">en la Home</span>
            </button>
          </li>
        </ul>
      </section>
    </template>
  </section>
</template>

<style scoped>
.tiers {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cab {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

h1 {
  font-family: var(--f-display);
  font-size: 22px;
  margin: 0;
}

.hueco {
  flex: 1;
}

.edicion {
  font-size: 13px;
  color: var(--muted);
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.edicion i {
  font-family: var(--f-mono);
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-style: normal;
  border-radius: 20px;
  padding: 2px 8px;
  border: 1px solid var(--line);
}

.viva {
  color: var(--ok);
  border-color: rgba(63, 214, 154, 0.4) !important;
}

.borrador {
  color: var(--gold);
  border-color: rgba(243, 185, 77, 0.4) !important;
}

.vieja {
  color: var(--dim);
}

.estado,
.pista {
  margin: 0;
  font-size: 13px;
  color: var(--dim);
}

.tablero {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.fila {
  display: flex;
  gap: 10px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--r);
  padding: 8px;
}

.fila__etq {
  width: 62px;
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border-radius: var(--r-sm);
  background: var(--panel-2);
}

.fila__etq b {
  font-family: var(--f-display);
  font-size: 22px;
  line-height: 1;
}

.fila__etq span {
  font-family: var(--f-mono);
  font-size: 9.5px;
  color: var(--dim);
}

.is-s_plus .fila__etq b { color: #ff7ad9; }
.is-s .fila__etq b { color: var(--gold); }
.is-a .fila__etq b { color: #7be0a0; }
.is-b .fila__etq b { color: var(--team-1); }
.is-c .fila__etq b { color: var(--muted); }
.is-d .fila__etq b { color: var(--dim); }

.fila__gente {
  list-style: none;
  margin: 0;
  padding: 4px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex: 1;
  min-height: 56px;
  border-radius: var(--r-sm);
  border: 1px dashed transparent;
}

.fila__gente.is-target {
  border-color: var(--violet);
  background: rgba(123, 92, 255, 0.06);
}

.jugador {
  display: flex;
  align-items: center;
  gap: 7px;
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: 20px;
  padding: 3px 11px 3px 3px;
  cursor: grab;
}

.jugador.is-moving {
  opacity: 0.35;
}

.jugador img {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  object-fit: cover;
  background: var(--panel-3);
  pointer-events: none;
}

.jugador__nombre {
  font-size: 12.5px;
  color: var(--text);
  pointer-events: none;
}

.jugador__rol {
  font-family: var(--f-mono);
  font-size: 9px;
  font-weight: 700;
  pointer-events: none;
}

.rol--top { color: var(--rol-top); }
.rol--jg { color: var(--rol-jg); }
.rol--mid { color: var(--rol-mid); }
.rol--adc { color: var(--rol-adc); }
.rol--sup { color: var(--rol-sup); }

.vacia {
  color: var(--dim);
  font-family: var(--f-mono);
  font-size: 12px;
  align-self: center;
  padding-left: 6px;
}

.historico {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--r);
  padding: 11px 13px 12px;
}

.historico h2 {
  font-family: var(--f-mono);
  font-size: 9.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--dim);
  margin: 0 0 8px;
}

.historico ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.historico button {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  padding: 6px 10px;
  font: inherit;
  font-size: 12.5px;
  color: var(--muted);
  text-align: left;
}

.historico li.is-current button {
  border-color: rgba(63, 214, 154, 0.4);
}

.historico b {
  color: var(--text);
  font-weight: 500;
}

.cuando,
.cuantos {
  font-family: var(--f-mono);
  font-size: 10px;
  color: var(--dim);
}

.cuantos {
  margin-left: auto;
}
</style>
