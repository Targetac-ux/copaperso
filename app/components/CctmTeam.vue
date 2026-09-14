<script setup lang="ts">
import { ROLES, emptyRoles, TEAM_SIZE } from '#shared/draft'
import type { DraftTeam } from '#shared/draft'
import type { PlayerRole } from '#shared/types/models'

/** Un equipo con sus cinco puestos. Cada puesto acepta que le suelten a alguien. */
const props = defineProps<{
  team: DraftTeam
  selected: string | null
  swapFrom: string | null
  /** Demons de este equipo y del otro: la regla del torneo es repartirlos 1:1. */
  demons?: { own: number; other: number; any: boolean }
}>()

const emit = defineEmits<{
  drop: [payload: { id: string; role: PlayerRole }]
  select: [id: string]
}>()

const { read, end, dragging } = useDragPlayer()
const encima = ref<PlayerRole | null>(null)

/** Un puesto por rol; si nadie lo ocupa, queda vacío. */
const slots = computed(() =>
  ROLES.map((role) => ({
    role,
    member: props.team.members.find((m) => m.role === role) ?? null,
  })),
)

/** Alguien con un rol que no es de los cinco (no debería pasar, pero se ve). */
const extras = computed(() => props.team.members.filter((m) => !ROLES.includes(m.role)))

const libres = computed(() => emptyRoles(props.team).length)

function onDrop(event: DragEvent, role: PlayerRole) {
  const id = read(event)
  encima.value = null
  end()
  if (id) emit('drop', { id, role })
}
</script>

<template>
  <section class="team" :class="`is-t${team.teamNumber}`">
    <header>
      <h2>Team {{ team.teamNumber }}</h2>
      <span class="cnt num">{{ team.members.length }}/{{ TEAM_SIZE }}</span>
      <span
        v-if="demons?.any"
        class="demons"
        :class="{ 'is-ok': demons.own === demons.other }"
        :title="`Los Demon deberían ir 1:1 entre los dos equipos`"
      >
        {{ demons.own }} Demon
      </span>
    </header>

    <ul>
      <li
        v-for="slot in slots"
        :key="slot.role"
        :class="{
          'is-filled': !!slot.member,
          'is-over': encima === slot.role,
          'is-open': dragging && !slot.member,
          'is-sel': slot.member && selected === slot.member.sessionParticipantId,
          'is-swap': slot.member && swapFrom === slot.member.sessionParticipantId,
        }"
        @dragover.prevent="encima = slot.role"
        @dragleave="encima = null"
        @drop.prevent="onDrop($event, slot.role)"
        @click="slot.member && emit('select', slot.member.sessionParticipantId)"
      >
        <span class="rol" :class="`rol--${slot.role.toLowerCase()}`">{{ slot.role }}</span>

        <template v-if="slot.member">
          <span class="nm">{{ slot.member.displayName }}</span>
          <span v-if="slot.member.isOffRole" class="off">off-role</span>
        </template>
        <span v-else class="hueco">—</span>
      </li>

      <li v-for="m in extras" :key="m.sessionParticipantId" class="is-filled is-extra">
        <span class="rol" :class="`rol--${m.role.toLowerCase()}`">{{ m.role }}</span>
        <span class="nm">{{ m.displayName }}</span>
      </li>
    </ul>

    <p class="pie">
      <span v-if="libres">{{ libres }} {{ libres === 1 ? 'hueco libre' : 'huecos libres' }}</span>
      <span v-else class="completo">Equipo completo</span>
    </p>
  </section>
</template>

<style scoped>
.team {
  background: var(--panel);
  border: 1px solid var(--line);
  border-top: 3px solid var(--line);
  border-radius: var(--r);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.is-t1 {
  border-top-color: var(--team-1);
}

.is-t2 {
  border-top-color: var(--team-2);
}

header {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

h2 {
  font-family: var(--f-display);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.is-t1 h2 {
  color: var(--team-1);
}

.is-t2 h2 {
  color: var(--team-2);
}

.demons {
  font-family: var(--f-mono);
  font-size: 9.5px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  border: 1px solid rgba(255, 196, 77, 0.4);
  border-radius: 20px;
  padding: 1px 7px;
  color: var(--warn);
}

.demons.is-ok {
  border-color: rgba(63, 214, 154, 0.4);
  color: var(--ok);
}

.cnt {
  margin-left: auto;
  font-size: 12px;
  color: var(--muted);
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

li {
  display: flex;
  align-items: center;
  gap: 9px;
  background: var(--panel-2);
  border: 1px dashed var(--line);
  border-radius: var(--r-sm);
  padding: 8px 10px;
  font-size: 13px;
  min-height: 38px;
  transition: border-color 0.12s ease, background 0.12s ease;
}

li.is-filled {
  border-style: solid;
  cursor: pointer;
}

li.is-filled:hover {
  background: var(--panel-3);
}

li.is-open {
  border-color: var(--violet-dim);
}

li.is-over {
  border-color: var(--violet);
  border-style: solid;
  background: var(--panel-3);
}

li.is-sel {
  border-color: var(--violet);
}

li.is-swap {
  border-color: var(--gold);
  background: rgba(243, 185, 77, 0.08);
}

.rol {
  font-family: var(--f-mono);
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: 0.06em;
  width: 38px;
  flex: none;
}

.rol--top {
  color: var(--rol-top);
}

.rol--jg {
  color: var(--rol-jg);
}

.rol--mid {
  color: var(--rol-mid);
}

.rol--adc {
  color: var(--rol-adc);
}

.rol--sup {
  color: var(--rol-sup);
}

/* En un puesto vacío el rol es una etiqueta, no un dato: baja de tono. */
li:not(.is-filled) .rol {
  opacity: 0.45;
}

.nm {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hueco {
  color: var(--dim);
}

.off {
  margin-left: auto;
  font-family: var(--f-mono);
  font-size: 9px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--warn);
  border: 1px solid rgba(255, 196, 77, 0.35);
  border-radius: 3px;
  padding: 1px 5px;
  flex: none;
}

.is-extra {
  border-color: var(--warn);
}

.pie {
  margin: 0;
  font-family: var(--f-mono);
  font-size: 10px;
  color: var(--dim);
}

.completo {
  color: var(--ok);
}
</style>
