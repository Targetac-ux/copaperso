<script setup lang="ts">
import type { Player, PlayerRole, EloTier } from '#shared/types/models'
import { ELO_LABEL } from '#shared/types/models'

definePageMeta({ layout: 'host' })
useSeoMeta({ title: 'Jugadores', robots: 'noindex' })

interface Participacion {
  id: string
  roles: PlayerRole[]
  elo: EloTier | null
  current_lp: number
  created_at: string
  player: Player
}

const { data: periodo } = await useFetch('/api/periods', {
  transform: (periods) => periods.find((p) => p.status === 'active') ?? null,
})

const { data: participaciones, refresh } = await useFetch<Participacion[]>('/api/participations', {
  default: () => [],
})

const quitando = ref<string | null>(null)

async function quitar(p: Participacion) {
  if (!confirm(`¿Sacar a ${p.player.display_name} del periodo? Su perfil no se borra.`)) return
  quitando.value = p.id
  try {
    await $fetch(`/api/participations/${p.id}`, { method: 'DELETE' })
    await refresh()
  } finally {
    quitando.value = null
  }
}
</script>

<template>
  <div>
    <header class="cab">
      <div>
        <p class="eyebrow">Periodo {{ periodo?.name ?? 'sin abrir' }}</p>
        <h1>Jugadores</h1>
      </div>
      <span class="cuenta num">{{ participaciones.length }} registrados</span>
    </header>

    <div v-if="!periodo" class="alert alert--error">
      No hay ningún periodo abierto.
      <NuxtLink to="/host/periodos">Abre el mes</NuxtLink> antes de registrar gente.
    </div>

    <section v-else class="card alta">
      <PlayerLineInput @registered="refresh()" />
    </section>

    <section class="lista">
      <p v-if="!participaciones.length" class="vacio">
        Nadie registrado todavía. Cada mes empieza en blanco: quien vuelve se reincorpora con 100 LP.
      </p>

      <table v-else>
        <thead>
          <tr>
            <th>Jugador</th>
            <th>Roles</th>
            <th>Elo</th>
            <th class="der">LP</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in participaciones" :key="p.id">
            <td>
              <span class="jug">
                <img
                  :src="p.player.photo_url || '/brand/favicon-32.png'"
                  alt=""
                  width="26"
                  height="26"
                >
                <b>{{ p.player.display_name }}</b>
              </span>
            </td>
            <td>
              <span v-if="p.roles.length" class="roles">
                <span v-for="rol in p.roles" :key="rol" class="rol">{{ rol }}</span>
              </span>
              <span v-else class="nada">—</span>
            </td>
            <td>
              <span v-if="p.elo">{{ ELO_LABEL[p.elo] }}</span>
              <span v-else class="nada">—</span>
            </td>
            <td class="der num">{{ p.current_lp }}</td>
            <td class="der">
              <button
                class="btn btn--ghost quitar"
                :disabled="quitando === p.id"
                @click="quitar(p)"
              >
                Quitar
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<style scoped>
.cab {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 18px;
}

h1 {
  font-size: 27px;
  font-weight: 600;
  margin-top: 4px;
}

.cuenta {
  margin-left: auto;
  font-size: 12.5px;
  color: var(--muted);
  border: 1px solid var(--line);
  border-radius: 20px;
  padding: 5px 12px;
}

.alta {
  margin-bottom: 22px;
}

.lista table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

th {
  text-align: left;
  font-family: var(--f-mono);
  font-size: 10px;
  letter-spacing: 0.13em;
  text-transform: uppercase;
  color: var(--dim);
  font-weight: 500;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
}

td {
  padding: 9px 12px;
  border-bottom: 1px solid var(--line-soft);
  vertical-align: middle;
}

.der {
  text-align: right;
}

.jug {
  display: flex;
  align-items: center;
  gap: 9px;
}

.jug img {
  border-radius: 50%;
  background: var(--panel-2);
  object-fit: cover;
}

.roles {
  display: inline-flex;
  gap: 4px;
}

.rol {
  font-family: var(--f-mono);
  font-size: 10.5px;
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 1px 6px;
  color: var(--muted);
}

.nada {
  color: var(--dim);
}

.quitar {
  font-size: 12px;
  padding: 5px 10px;
}

.vacio {
  color: var(--muted);
  max-width: 60ch;
}
</style>
