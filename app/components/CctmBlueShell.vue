<script setup lang="ts">
import { BLUE_SHELL_DESC, BLUE_SHELL_LABEL, BLUE_SHELL_OUTCOMES, girar } from '#shared/blueshell'
import type { BlueShellOutcome } from '#shared/blueshell'

/**
 * La ruleta del Blue Shell (§16).
 *
 * **Girar no guarda nada.** Se puede girar las veces que haga falta y cerrar sin
 * dejar rastro; solo «Guardar» escribe. Y lo que guarda es la constancia de la
 * tirada, no el castigo: la doble derrota se marca luego al cerrar la partida,
 * donde se ve junto al resto del resultado (A6-bis).
 */
const props = defineProps<{
  open: boolean
  busy: boolean
  /** A quién se le puede tirar: los que están en algún equipo. */
  candidates: { participationId: string; displayName: string; teamNumber: 1 | 2 }[]
}>()

const emit = defineEmits<{
  save: [payload: { participation_id: string; outcome: BlueShellOutcome }]
  close: []
}>()

const victima = ref<string | null>(null)
const resultado = ref<BlueShellOutcome | null>(null)
const girando = ref(false)
/** Lo que se enseña mientras rueda, solo para que se vea moverse. */
const marquesina = ref<BlueShellOutcome>('NO_FLASH')
let animacion: ReturnType<typeof setInterval> | undefined

watch(
  () => props.open,
  (abierto) => {
    if (abierto) {
      victima.value = null
      resultado.value = null
      girando.value = false
    } else {
      pararAnimacion()
    }
  },
)

function pararAnimacion() {
  clearInterval(animacion)
  animacion = undefined
}

onBeforeUnmount(pararAnimacion)

function tirar() {
  if (!victima.value || girando.value) return
  girando.value = true
  resultado.value = null

  // El resultado se decide ya; la animación solo lo disimula un segundo.
  const salida = girar()
  animacion = setInterval(() => {
    marquesina.value = girar()
  }, 80)

  setTimeout(() => {
    pararAnimacion()
    resultado.value = salida
    marquesina.value = salida
    girando.value = false
  }, 1100)
}

const nombreVictima = computed(
  () => props.candidates.find((c) => c.participationId === victima.value)?.displayName ?? '',
)

function guardar() {
  if (!victima.value || !resultado.value) return
  emit('save', { participation_id: victima.value, outcome: resultado.value })
}
</script>

<template>
  <div v-if="open" class="capa" @click.self="emit('close')">
    <div class="bs" role="dialog" aria-labelledby="bs-titulo">
      <header class="bs__cab">
        <CopaIcon name="blue-shell" :size="30" />
        <h2 id="bs-titulo">Blue Shell</h2>
      </header>
      <p class="sub">Elige a quién le cae y gira. Hasta que guardes, no existe.</p>

      <p v-if="!candidates.length" class="vacio">
        No hay nadie en los equipos todavía.
      </p>

      <template v-else>
        <div class="victimas">
          <button
            v-for="c in candidates"
            :key="c.participationId"
            class="quien"
            :class="[`is-t${c.teamNumber}`, { 'is-on': victima === c.participationId }]"
            :disabled="girando"
            @click="victima = c.participationId"
          >
            {{ c.displayName }}
          </button>
        </div>

        <div class="ruleta" :class="{ 'is-spinning': girando, 'is-done': !!resultado }">
          <span v-if="girando || resultado" class="cara">
            {{ BLUE_SHELL_LABEL[resultado ?? marquesina] }}
          </span>
          <span v-else class="cara cara--vacia">—</span>
        </div>

        <p v-if="resultado && !girando" class="desc">
          {{ BLUE_SHELL_DESC[resultado] }}
        </p>

        <div class="btns">
          <button
            class="btn btn--primary"
            :disabled="!victima || girando"
            @click="tirar"
          >
            {{ resultado ? 'Girar otra vez' : 'Girar' }}
          </button>
          <button
            v-if="resultado && !girando"
            class="btn btn--ghost"
            :disabled="busy"
            @click="guardar"
          >
            Guardar para {{ nombreVictima }}
          </button>
          <button class="btn btn--ghost" :disabled="busy" @click="emit('close')">Cancelar</button>
        </div>

        <ul class="premios">
          <li v-for="o in BLUE_SHELL_OUTCOMES" :key="o">
            <b>{{ BLUE_SHELL_LABEL[o] }}</b>
            <span>{{ BLUE_SHELL_DESC[o] }}</span>
          </li>
        </ul>

        <p class="nota">
          Guardar deja constancia; no mueve a nadie ni aplica el castigo. Si sale doble derrota, al
          finalizar la partida vendrá marcada.
        </p>
      </template>
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

.bs {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 18px 20px 16px;
  width: min(520px, 100%);
  max-height: 88vh;
  overflow-y: auto;
}

.bs__cab {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 3px;
}

h2 {
  font-size: 17px;
  margin: 0 0 3px;
  color: var(--team-1);
}

.sub {
  font-size: 12px;
  color: var(--muted);
  margin: 0 0 14px;
}

.vacio {
  font-size: 12.5px;
  color: var(--dim);
}

.victimas {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-bottom: 14px;
}

.quien {
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: 20px;
  padding: 3px 10px;
  font-size: 11.5px;
  color: var(--muted);
}

.quien.is-t1.is-on {
  border-color: var(--team-1);
  color: var(--team-1);
}

.quien.is-t2.is-on {
  border-color: var(--team-2);
  color: var(--team-2);
}

.ruleta {
  display: grid;
  place-items: center;
  min-height: 74px;
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: 10px;
}

.ruleta.is-spinning {
  border-color: var(--violet);
}

.ruleta.is-done {
  border-color: var(--gold);
}

.cara {
  font-family: var(--f-display);
  font-size: 21px;
  letter-spacing: 0.02em;
  color: var(--text);
}

.is-spinning .cara {
  color: var(--violet);
  opacity: 0.8;
}

.is-done .cara {
  color: var(--gold);
}

.cara--vacia {
  color: var(--dim);
}

.desc {
  margin: 8px 0 0;
  font-size: 12.5px;
  color: var(--muted);
  text-align: center;
}

.btns {
  display: flex;
  gap: 8px;
  margin-top: 14px;
}

.btns .btn {
  flex: 1;
}

.premios {
  list-style: none;
  margin: 14px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.premios li {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: var(--dim);
  border-top: 1px solid var(--line-soft);
  padding-top: 3px;
}

.premios b {
  color: var(--muted);
  min-width: 118px;
  font-weight: 600;
}

.nota {
  margin: 10px 0 0;
  font-size: 11px;
  color: var(--dim);
}
</style>
