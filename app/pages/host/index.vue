<script setup lang="ts">
definePageMeta({ layout: 'host' })
useSeoMeta({ title: 'Panel del host', robots: 'noindex' })

const { staff, loadStaff } = useStaff()
await loadStaff()

const { data: health } = await useFetch('/api/health')

/** Lo que ya está construido y lo que llega en cada fase. */
const modules = [
  { name: 'CCTM Manager', desc: 'Banca, draft, equipos, swap y aleatorio.', phase: 'Fase 3', ready: false },
  { name: 'Partidas y LP', desc: 'Resultado, MVP, ACE, off-role y Blue Shell.', phase: 'Fase 4', ready: false },
  { name: 'Vista en vivo', desc: 'Lo que ven los espectadores durante el draft.', phase: 'Fase 4B', ready: false },
  { name: 'Roster', desc: 'Estadísticas e histórico por periodo.', phase: 'Fase 5', ready: false },
  { name: 'Tier Manager', desc: 'La Tier List que sale en la Home.', phase: 'Fase 6', ready: false },
]
</script>

<template>
  <div>
    <header class="head">
      <div>
        <p class="eyebrow">Panel del host</p>
        <h1>Hola, {{ staff?.display_name ?? 'host' }}</h1>
      </div>
      <span class="pill" :class="health?.ok ? 'pill--ok' : 'pill--bad'">
        {{ health?.ok ? 'Base de datos conectada' : 'Sin conexión a la base' }}
        <em v-if="health?.ok" class="num">{{ health.latencyMs }} ms</em>
      </span>
    </header>

    <p class="lede">
      Las fundaciones están montadas: acceso, base de datos, almacenamiento de fotos e historial de
      acciones. El CCTM Manager llega en la Fase 3.
    </p>

    <ul class="modules">
      <li v-for="mod in modules" :key="mod.name" class="card module">
        <div>
          <h2>{{ mod.name }}</h2>
          <p>{{ mod.desc }}</p>
        </div>
        <span class="tag">{{ mod.phase }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.head {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

h1 {
  font-size: 27px;
  font-weight: 600;
  margin-top: 4px;
}

.pill {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  padding: 6px 12px;
  border-radius: 20px;
  border: 1px solid var(--line);
  background: var(--panel);
}

.pill em {
  font-style: normal;
  font-size: 11px;
  color: var(--dim);
}

.pill--ok {
  border-color: rgba(63, 214, 154, 0.4);
  color: var(--ok);
}

.pill--bad {
  border-color: rgba(255, 90, 110, 0.4);
  color: var(--danger);
}

.lede {
  color: var(--muted);
  max-width: 64ch;
  margin: 0 0 26px;
}

.modules {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px;
}

.module {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 18px;
}

.module h2 {
  font-size: 15.5px;
  font-weight: 600;
}

.module p {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--muted);
}

.tag {
  margin-left: auto;
  flex: none;
  font-family: var(--f-mono);
  font-size: 10px;
  letter-spacing: 0.08em;
  color: var(--dim);
  border: 1px solid var(--line);
  border-radius: 20px;
  padding: 2px 8px;
}
</style>
