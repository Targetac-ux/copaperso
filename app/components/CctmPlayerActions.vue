<script setup lang="ts">
import { ROLES, findMember, importanLosRoles, rolPorDefecto } from '#shared/draft'
import type { DraftState } from '#shared/draft'
import type { PlayerRole } from '#shared/types/models'

/** Lo que se puede hacer con el jugador seleccionado (§27). */
const props = defineProps<{
  draft: DraftState
  selectedId: string
  swapFrom: string | null
  busy: boolean
}>()

const emit = defineEmits<{
  assign: [payload: { id: string; team: 1 | 2; role: PlayerRole }]
  bench: [id: string]
  state: [payload: { id: string; state: 'jail' | 'graveyard' | 'removed' }]
  startSwap: [id: string]
  cancelSwap: []
  close: []
}>()

const jugador = computed(() =>
  props.draft.bench.find((b) => b.sessionParticipantId === props.selectedId),
)
const enEquipo = computed(() => findMember(props.draft, props.selectedId))

/** En ARAM AFK no se elige rol: no significa nada. */
const conRoles = computed(() => importanLosRoles(props.draft.mode))

const rol = ref<PlayerRole | null>(null)
const equipo = ref<1 | 2 | null>(null)

watch(
  () => props.selectedId,
  () => {
    rol.value = enEquipo.value?.member.role ?? (jugador.value?.roles.length === 1 ? jugador.value.roles[0]! : null)
    equipo.value = enEquipo.value?.team.teamNumber ?? null
  },
  { immediate: true },
)

const puedeAsignar = computed(() => (conRoles.value ? !!rol.value : true) && !!equipo.value)

/** El rol que se manda: el elegido, o uno cualquiera si no cuentan. */
const rolAEnviar = computed(() =>
  conRoles.value ? rol.value! : rolPorDefecto(jugador.value?.roles ?? []),
)
</script>

<template>
  <section v-if="jugador" class="acc">
    <header>
      <h2>Jugador</h2>
      <button class="cerrar" aria-label="Quitar selección" @click="emit('close')">✕</button>
    </header>

    <div class="ficha">
      <strong>{{ jugador.displayName }}</strong>
      <span class="meta">
        <span v-for="r in jugador.roles" :key="r" class="rl">{{ r }}</span>
        <em v-if="!jugador.roles.length">sin rol</em>
        <span class="donde">
          <template v-if="!enEquipo">en la banca</template>
          <template v-else-if="conRoles">
            Team {{ enEquipo.team.teamNumber }} · {{ enEquipo.member.role }}
          </template>
          <template v-else>Team {{ enEquipo.team.teamNumber }}</template>
        </span>
      </span>
    </div>

    <template v-if="swapFrom && swapFrom !== selectedId">
      <p class="swap-aviso">Elige a quién cambiar por este jugador.</p>
    </template>

    <p class="etq">Asignar a</p>
    <div v-if="conRoles" class="ops">
      <button v-for="r in ROLES" :key="r" class="chip" :class="{ 'is-on': rol === r, 'is-suyo': jugador.roles.includes(r) }" @click="rol = r">
        {{ r }}
      </button>
    </div>
    <p v-else class="sin-roles">En ARAM AFK no se elige rol: una línea y una vida.</p>
    <div class="ops">
      <button class="chip t1" :class="{ 'is-on': equipo === 1 }" @click="equipo = 1">Team 1</button>
      <button class="chip t2" :class="{ 'is-on': equipo === 2 }" @click="equipo = 2">Team 2</button>
    </div>
    <button
      class="btn btn--primary ancho"
      :disabled="!puedeAsignar || busy"
      @click="emit('assign', { id: selectedId, team: equipo!, role: rolAEnviar })"
    >
      {{ enEquipo ? 'Mover aquí' : 'Asignar' }}
    </button>

    <p class="etq">Acciones</p>
    <div class="botones">
      <button v-if="enEquipo && !swapFrom" class="btn btn--ghost" @click="emit('startSwap', selectedId)">
        Swap
      </button>
      <button v-if="swapFrom" class="btn btn--ghost" @click="emit('cancelSwap')">Cancelar swap</button>
      <button v-if="enEquipo" class="btn btn--ghost" :disabled="busy" @click="emit('bench', selectedId)">
        A la banca
      </button>
      <button class="btn btn--ghost" :disabled="busy" @click="emit('state', { id: selectedId, state: 'jail' })">
        Cárcel
      </button>
      <button class="btn btn--ghost" :disabled="busy" @click="emit('state', { id: selectedId, state: 'graveyard' })">
        Cementerio
      </button>
      <button class="btn btn--ghost peligro" :disabled="busy" @click="emit('state', { id: selectedId, state: 'removed' })">
        Sacar de la sesión
      </button>
    </div>
    <p class="nota">Sacarlo de la sesión no borra su perfil ni su participación del mes.</p>
  </section>
</template>

<style scoped>
.acc {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--r);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

header {
  display: flex;
  align-items: center;
}

h2 {
  font-family: var(--f-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--dim);
  font-weight: 500;
}

.cerrar {
  margin-left: auto;
  background: none;
  border: 0;
  color: var(--dim);
  font-size: 13px;
  padding: 2px 4px;
}

.cerrar:hover {
  color: var(--text);
}

.ficha {
  background: var(--panel-2);
  border-radius: var(--r-sm);
  padding: 9px 10px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.ficha strong {
  font-family: var(--f-display);
  font-size: 15px;
}

.meta {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
}

.rl {
  font-family: var(--f-mono);
  font-size: 9.5px;
  border: 1px solid var(--line);
  border-radius: 3px;
  padding: 1px 5px;
  color: var(--muted);
}

.meta em {
  font-family: var(--f-mono);
  font-size: 9.5px;
  font-style: normal;
  color: var(--dim);
}

.donde {
  margin-left: auto;
  font-family: var(--f-mono);
  font-size: 10px;
  color: var(--violet-txt);
}

.swap-aviso {
  margin: 0;
  font-family: var(--f-mono);
  font-size: 10.5px;
  color: var(--gold);
}

.sin-roles {
  margin: 0;
  font-size: 12px;
  color: var(--dim);
}

.etq {
  margin: 5px 0 0;
  font-family: var(--f-mono);
  font-size: 9.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--dim);
}

.ops {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}

.chip {
  font-family: var(--f-mono);
  font-size: 11px;
  padding: 5px 10px;
  border-radius: 20px;
  border: 1px solid var(--line);
  background: transparent;
  color: var(--muted);
}

.chip.is-suyo {
  color: var(--text);
  border-color: var(--violet-dim);
}

.chip.is-on {
  background: var(--violet);
  border-color: var(--violet);
  color: #fff;
}

.chip.t1.is-on {
  background: var(--team-1);
  border-color: var(--team-1);
}

.chip.t2.is-on {
  background: var(--team-2);
  border-color: var(--team-2);
}

.ancho {
  width: 100%;
  margin-top: 4px;
}

.botones {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px;
}

.botones .btn {
  font-size: 12px;
  padding: 7px 8px;
}

.peligro {
  grid-column: 1 / -1;
  border-color: rgba(255, 90, 110, 0.35);
  color: var(--danger);
}

.nota {
  margin: 2px 0 0;
  font-family: var(--f-mono);
  font-size: 9.5px;
  line-height: 1.6;
  color: var(--dim);
}
</style>
