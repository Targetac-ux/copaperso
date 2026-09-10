<script setup lang="ts">
import { remainingSeconds, formatSeconds, parseDuration, DEFAULT_SECONDS } from '#shared/timer'
import type { TimerState } from '#shared/timer'

/**
 * Cronómetro de negociación.
 *
 * Los tramos son libres: el host escribe la duración que quiera y lo reinicia
 * las veces que quiera. Al llegar a cero avisa, pero **nunca bloquea**: el
 * aviso se puede cerrar y seguir trabajando.
 */
const props = defineProps<{
  timer: TimerState
  tripled: boolean
  busy: boolean
}>()

const emit = defineEmits<{
  action: [payload: { action: 'start' | 'pause' | 'reset'; seconds?: number }]
  expired: []
}>()

const restante = ref(remainingSeconds(props.timer))
const editando = ref(false)
const duracion = ref('')
let tick: ReturnType<typeof setInterval> | undefined
/** Para que el aviso salte una sola vez y no en cada segundo. */
let yaAvisado = false

function refrescar() {
  restante.value = remainingSeconds(props.timer)
  if (props.timer.running && restante.value === 0 && !yaAvisado) {
    yaAvisado = true
    emit('expired')
  }
}

watch(
  () => [props.timer.endsAt, props.timer.running],
  () => {
    // Cada arranque o reinicio rearma el aviso.
    yaAvisado = false
    refrescar()
  },
)

onMounted(() => {
  refrescar()
  tick = setInterval(refrescar, 1000)
})

onBeforeUnmount(() => clearInterval(tick))

const enRojo = computed(() => props.timer.running && restante.value <= 60)

function aplicarDuracion() {
  const segundos = parseDuration(duracion.value)
  editando.value = false
  if (segundos) emit('action', { action: 'reset', seconds: segundos })
}

function abrirEdicion() {
  duracion.value = String(Math.round((props.timer.seconds || DEFAULT_SECONDS) / 60))
  editando.value = true
}
</script>

<template>
  <div class="timer" :class="{ 'is-hot': enRojo, 'is-running': timer.running }">
    <span class="etq">Negociación</span>

    <button
      v-if="!editando"
      class="reloj"
      :title="'Clic para cambiar la duración'"
      @click="abrirEdicion"
    >
      {{ formatSeconds(restante) }}
    </button>
    <input
      v-else
      v-model="duracion"
      class="dur"
      type="text"
      aria-label="Duración en minutos"
      placeholder="15"
      @keydown.enter="aplicarDuracion"
      @blur="aplicarDuracion"
    >

    <button
      v-if="!timer.running"
      class="btn btn--ghost mini"
      :disabled="busy"
      @click="emit('action', { action: 'start' })"
    >
      Iniciar
    </button>
    <button
      v-else
      class="btn btn--ghost mini"
      :disabled="busy"
      @click="emit('action', { action: 'pause' })"
    >
      Pausar
    </button>
    <button class="btn btn--ghost mini" :disabled="busy" @click="emit('action', { action: 'reset' })">
      Reiniciar
    </button>

    <span v-if="tripled" class="x3">Precios ×3</span>
  </div>
</template>

<style scoped>
.timer {
  display: flex;
  align-items: center;
  gap: 7px;
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 4px 9px;
}

.timer.is-hot {
  border-color: var(--warn);
}

.etq {
  font-family: var(--f-mono);
  font-size: 9px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--dim);
}

.reloj {
  font-family: var(--f-mono);
  font-size: 16px;
  font-variant-numeric: tabular-nums;
  color: var(--text);
  background: none;
  border: 0;
  padding: 0 2px;
}

.is-running .reloj {
  color: var(--violet);
}

.is-hot .reloj {
  color: var(--warn);
}

.dur {
  width: 52px;
  font-family: var(--f-mono);
  font-size: 14px;
  color: var(--text);
  background: var(--panel-3);
  border: 1px solid var(--violet);
  border-radius: 4px;
  padding: 2px 6px;
}

.mini {
  font-size: 10.5px;
  padding: 3px 8px;
}

.x3 {
  font-family: var(--f-mono);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--gold);
  border: 1px solid rgba(243, 185, 77, 0.4);
  border-radius: 20px;
  padding: 2px 8px;
}
</style>
