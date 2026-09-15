<script setup lang="ts">
import type { BenchPlayer } from '#shared/draft'

/** La banca de jugadores (§8): quién está disponible esta noche. */
const props = defineProps<{
  players: BenchPlayer[]
  selected: string | null
}>()

const emit = defineEmits<{
  select: [id: string]
  benchDrop: [id: string]
}>()

const { start, end, read, dragging } = useDragPlayer()
const buscar = ref('')

const visibles = computed(() => {
  const q = buscar.value.trim().toLowerCase()
  const disponibles = props.players.filter((p) => p.state === 'bench')
  if (!q) return disponibles
  return disponibles.filter((p) => p.displayName.toLowerCase().includes(q))
})

function onDrop(event: DragEvent) {
  const id = read(event)
  end()
  if (id) emit('benchDrop', id)
}
</script>

<template>
  <section
    class="banca"
    :class="{ 'is-target': dragging }"
    @dragover.prevent
    @drop.prevent="onDrop"
  >
    <header>
      <h2>Banca de jugadores</h2>
      <span class="num">{{ visibles.length }}</span>
    </header>

    <slot name="registro" />

    <input v-model="buscar" type="search" placeholder="Buscar jugador…" aria-label="Buscar en la banca">

    <ul v-if="visibles.length">
      <li
        v-for="p in visibles"
        :key="p.sessionParticipantId"
        :class="{ 'is-sel': selected === p.sessionParticipantId }"
        draggable="true"
        @dragstart="start($event, p.sessionParticipantId)"
        @dragend="end"
        @click="emit('select', p.sessionParticipantId)"
      >
        <span class="dot" />
        <span class="nm">{{ p.displayName }}</span>
        <span class="roles">
          <span v-for="r in p.roles" :key="r">{{ r }}</span>
          <em v-if="!p.roles.length">sin rol</em>
        </span>
      </li>
    </ul>

    <p v-else-if="buscar" class="vacio">Nadie coincide con «{{ buscar }}».</p>
    <p v-else class="vacio">
      La banca está vacía. Registra gente desde <NuxtLink to="/host/jugadores">Jugadores</NuxtLink>.
    </p>

    <p class="pista">Arrastra a un hueco del equipo, o haz clic para ver sus acciones.</p>
  </section>
</template>

<style scoped>
.banca {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--r);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
}

.banca.is-target {
  border-color: var(--violet);
  box-shadow: 0 0 0 3px rgba(123, 92, 255, 0.12);
}

header {
  display: flex;
  align-items: center;
  gap: 8px;
}

h2 {
  font-family: var(--f-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--dim);
  font-weight: 500;
}

header .num {
  margin-left: auto;
  font-size: 12px;
  color: var(--muted);
}

input {
  font: inherit;
  font-size: 13.5px;
  color: var(--text);
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  padding: 7px 10px;
}

input:focus {
  border-color: var(--violet);
  outline: none;
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

li {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--panel-2);
  border: 1px solid transparent;
  border-radius: var(--r-sm);
  padding: 7px 9px;
  font-size: 13px;
  cursor: grab;
}

li:hover {
  background: var(--panel-3);
}

li.is-sel {
  border-color: var(--violet);
  background: var(--panel-3);
}

li:active {
  cursor: grabbing;
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--ok);
  flex: none;
}

.nm {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.roles {
  margin-left: auto;
  display: flex;
  gap: 4px;
  flex: none;
}

.roles span {
  font-family: var(--f-mono);
  font-size: 9.5px;
  border: 1px solid var(--line);
  border-radius: 3px;
  padding: 1px 5px;
  color: var(--muted);
}

.roles em {
  font-family: var(--f-mono);
  font-size: 9.5px;
  font-style: normal;
  color: var(--dim);
}

.vacio {
  margin: 0;
  font-size: 13px;
  color: var(--dim);
}

.vacio a {
  color: var(--violet-txt);
}

.pista {
  margin: auto 0 0;
  font-family: var(--f-mono);
  font-size: 10px;
  line-height: 1.6;
  color: var(--dim);
}
</style>
