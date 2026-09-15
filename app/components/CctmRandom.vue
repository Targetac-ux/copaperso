<script setup lang="ts">
import { ROLES } from '#shared/draft'
import type { BenchPlayer } from '#shared/draft'
import type { PlayerRole } from '#shared/types/models'

/**
 * Panel Aleatorio (§9). Sortea, enseña quién salió y deja que el host elija
 * rol y equipo: el sorteo nunca asigna por su cuenta.
 */
defineProps<{ available: number; busy: boolean }>()

const emit = defineEmits<{
  roll: []
  assign: [payload: { id: string; team: 1 | 2; role: PlayerRole }]
}>()

const elegido = defineModel<BenchPlayer | null>('picked', { default: null })
const rol = ref<PlayerRole | null>(null)
const equipo = ref<1 | 2 | null>(null)

watch(elegido, (p) => {
  // Si solo tiene un rol, ya está elegido; si tiene varios, decide el host.
  rol.value = p?.roles.length === 1 ? p.roles[0]! : null
  equipo.value = null
})

const listo = computed(() => !!elegido.value && !!rol.value && !!equipo.value)

function asignar() {
  if (!listo.value) return
  emit('assign', { id: elegido.value!.sessionParticipantId, team: equipo.value!, role: rol.value! })
}
</script>

<template>
  <section class="rnd">
    <header>
      <CopaIcon name="dado" :size="20" />
      <h2>Aleatorio</h2>
    </header>

    <button class="btn btn--primary tirar" :disabled="busy || !available" @click="emit('roll')">
      Sortear jugador
    </button>
    <p class="disp num">{{ available }} disponibles en la banca</p>

    <template v-if="elegido">
      <div class="salio">
        <strong>{{ elegido.displayName }}</strong>
        <span class="sus-roles">
          <span v-for="r in elegido.roles" :key="r">{{ r }}</span>
          <em v-if="!elegido.roles.length">sin rol definido</em>
        </span>
      </div>

      <p class="etq">Rol</p>
      <div class="opciones">
        <button
          v-for="r in ROLES"
          :key="r"
          class="chip"
          :class="{ 'is-on': rol === r, 'is-suyo': elegido.roles.includes(r) }"
          @click="rol = r"
        >
          {{ r }}
        </button>
      </div>

      <p class="etq">Equipo</p>
      <div class="opciones">
        <button class="chip t1" :class="{ 'is-on': equipo === 1 }" @click="equipo = 1">Team 1</button>
        <button class="chip t2" :class="{ 'is-on': equipo === 2 }" @click="equipo = 2">Team 2</button>
      </div>

      <div class="acciones">
        <button class="btn btn--primary" :disabled="!listo || busy" @click="asignar">Asignar</button>
        <button class="btn btn--ghost" @click="elegido = null">Descartar</button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.rnd {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--r);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
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

.tirar {
  width: 100%;
}

.disp {
  margin: 0;
  font-size: 11px;
  color: var(--dim);
  text-align: center;
}

.salio {
  background: var(--panel-3);
  border: 1px solid var(--violet-dim);
  border-radius: var(--r-sm);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 4px;
}

.salio strong {
  font-family: var(--f-display);
  font-size: 16px;
}

.sus-roles {
  display: flex;
  gap: 4px;
}

.sus-roles span {
  font-family: var(--f-mono);
  font-size: 9.5px;
  border: 1px solid var(--line);
  border-radius: 3px;
  padding: 1px 5px;
  color: var(--muted);
}

.sus-roles em {
  font-family: var(--f-mono);
  font-size: 9.5px;
  font-style: normal;
  color: var(--dim);
}

.etq {
  margin: 6px 0 0;
  font-family: var(--f-mono);
  font-size: 9.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--dim);
}

.opciones {
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

/* Los roles que sí son suyos se distinguen de los que serían off-role. */
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

.acciones {
  display: flex;
  gap: 7px;
  margin-top: 10px;
}

.acciones .btn {
  flex: 1;
}
</style>
