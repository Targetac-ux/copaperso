<script setup lang="ts">
import { marcadorDe, partidaEnCurso } from '#shared/match'
import type { PartidaCargada } from '#shared/match'

/**
 * El control de partida, en la barra de la sesión.
 *
 * Es la acción más repetida de la noche y la que más prisa tiene: por eso vive
 * arriba, junto al cronómetro, y no en un panel al que haya que bajar.
 */
const props = defineProps<{
  matches: PartidaCargada[]
  busy: boolean
}>()

const emit = defineEmits<{ start: []; finish: []; blueShell: [] }>()

const enCurso = computed(() => partidaEnCurso(props.matches))
const marcador = computed(() => marcadorDe(props.matches))

/** El número que le tocará a la siguiente, para decirlo antes de empezarla. */
const siguiente = computed(() => props.matches.length + 1)
</script>

<template>
  <div class="pbar" :class="{ 'is-live': enCurso }">
    <span class="etq">Partidas</span>

    <span v-if="marcador.jugadas" class="marcador" title="Partidas ganadas por cada equipo">
      <b class="t1">{{ marcador.t1 }}</b>
      <i>–</i>
      <b class="t2">{{ marcador.t2 }}</b>
    </span>
    <span v-else class="ninguna">ninguna</span>

    <template v-if="enCurso">
      <span class="viva">Partida {{ enCurso.matchNumber }} en juego</span>
      <button class="btn btn--primary mini" :disabled="busy" @click="emit('finish')">
        Finalizar
      </button>
    </template>
    <template v-else>
      <button class="btn btn--ghost mini" :disabled="busy" @click="emit('start')">
        Iniciar partida {{ siguiente }}
      </button>
    </template>

    <button
      class="btn btn--ghost mini bshell"
      :disabled="busy"
      title="Girar la ruleta del Blue Shell"
      @click="emit('blueShell')"
    >
      Blue Shell
    </button>
  </div>
</template>

<style scoped>
.pbar {
  display: flex;
  align-items: center;
  gap: 7px;
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 4px 9px;
}

.pbar.is-live {
  border-color: var(--ok);
}

.etq {
  font-family: var(--f-mono);
  font-size: 9px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--dim);
}

.marcador {
  font-family: var(--f-mono);
  font-size: 15px;
  font-variant-numeric: tabular-nums;
  display: inline-flex;
  gap: 3px;
}

.marcador .t1 {
  color: var(--team-1);
}

.marcador .t2 {
  color: var(--team-2);
}

.marcador i {
  color: var(--dim);
  font-style: normal;
}

.ninguna {
  font-family: var(--f-mono);
  font-size: 10px;
  color: var(--dim);
}

.viva {
  font-family: var(--f-mono);
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ok);
}

.mini {
  font-size: 10.5px;
  padding: 3px 8px;
}

.bshell {
  color: var(--team-1);
}
</style>
