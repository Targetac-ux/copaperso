<script setup lang="ts">
definePageMeta({ layout: 'host' })
useSeoMeta({ title: 'Periodos y sesiones', robots: 'noindex' })

const MODOS = [
  { value: 'perso', label: 'Copa Perso' },
  { value: 'tryhard', label: 'Copa Tryhard' },
  { value: 'random', label: 'Copa Random' },
  { value: 'analisis', label: 'Copa Análisis' },
  { value: 'aram_afk', label: 'Copa ARAM AFK' },
] as const

const { data: periodos, refresh: refrescarPeriodos } = await useFetch('/api/periods', {
  default: () => [],
})
const { data: sesiones, refresh: refrescarSesiones } = await useFetch('/api/sessions', {
  default: () => [],
})

const activo = computed(() => periodos.value.find((p) => p.status === 'active') ?? null)
const modo = ref<(typeof MODOS)[number]['value']>('perso')
const error = ref('')
const ocupado = ref(false)

/** Por defecto, el mes en curso; se puede adelantar para prepararlo antes. */
const hoy = new Date()
const mes = ref(`${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`)

async function abrirMes() {
  if (
    !confirm(
      `¿Abrir ${mes.value}? El periodo actual se cierra y su roster queda congelado. ` +
        'Nadie se arrastra al mes nuevo.',
    )
  ) {
    return
  }
  ocupado.value = true
  error.value = ''
  try {
    await $fetch('/api/periods', { method: 'POST', body: { starts_at: `${mes.value}-01` } })
    await Promise.all([refrescarPeriodos(), refrescarSesiones()])
  } catch (e) {
    error.value = (e as { statusMessage?: string }).statusMessage ?? 'No se pudo abrir el periodo.'
  } finally {
    ocupado.value = false
  }
}

async function nuevaSesion() {
  ocupado.value = true
  error.value = ''
  try {
    await $fetch('/api/sessions', { method: 'POST', body: { mode: modo.value } })
    await Promise.all([refrescarSesiones(), refrescarPeriodos()])
  } catch (e) {
    error.value = (e as { statusMessage?: string }).statusMessage ?? 'No se pudo crear la sesión.'
  } finally {
    ocupado.value = false
  }
}

const etiquetaModo = (v: string) => MODOS.find((m) => m.value === v)?.label ?? v
const ESTADO: Record<string, string> = { open: 'Abierta', live: 'En vivo', closed: 'Cerrada' }
</script>

<template>
  <div>
    <header class="cab">
      <div>
        <p class="eyebrow">Calendario</p>
        <h1>Periodos y sesiones</h1>
      </div>
    </header>

    <p v-if="error" class="alert alert--error">{{ error }}</p>

    <section class="card bloque">
      <div class="bloque__cab">
        <h2>Periodo activo</h2>
        <div class="acciones">
          <input v-model="mes" type="month" aria-label="Mes a abrir">
          <button class="btn btn--ghost" :disabled="ocupado" @click="abrirMes">Abrir mes nuevo</button>
        </div>
      </div>

      <p v-if="!activo" class="vacio">No hay ningún periodo abierto.</p>
      <p v-else class="activo">
        <strong>{{ activo.name }}</strong>
        <span class="num">{{ activo.participants }} jugadores</span>
        <span class="num">{{ activo.sessions }} sesiones</span>
      </p>

      <p class="nota">
        Cada mes empieza vacío: nadie se arrastra del anterior y quien vuelve se reincorpora con
        100 LP. Los periodos cerrados conservan su roster tal como quedó.
      </p>
    </section>

    <section class="card bloque">
      <div class="bloque__cab">
        <h2>Sesiones</h2>
        <div class="acciones">
          <select v-model="modo" aria-label="Modo de juego">
            <option v-for="m in MODOS" :key="m.value" :value="m.value">{{ m.label }}</option>
          </select>
          <button class="btn btn--primary" :disabled="ocupado || !activo" @click="nuevaSesion">
            Nueva sesión
          </button>
        </div>
      </div>

      <p v-if="!sesiones.length" class="vacio">Todavía no hay ninguna CopaPerso en este periodo.</p>
      <ul v-else class="sesiones">
        <li v-for="s in sesiones" :key="s.id">
          <span class="ses__num">#{{ s.number }}</span>
          <span class="ses__modo">{{ etiquetaModo(s.mode) }}</span>
          <span class="ses__estado" :class="`is-${s.status}`">{{ ESTADO[s.status] }}</span>
          <time class="num">{{ new Date(s.started_at).toLocaleDateString('es-MX') }}</time>
        </li>
      </ul>
    </section>

    <section class="card bloque">
      <h2>Histórico</h2>
      <ul class="historico">
        <li v-for="p in periodos" :key="p.id">
          <strong>{{ p.name }}</strong>
          <span class="num">{{ p.participants }} jugadores</span>
          <span class="num">{{ p.sessions }} sesiones</span>
          <span class="estado" :class="`is-${p.status}`">
            {{ p.status === 'active' ? 'activo' : 'cerrado' }}
          </span>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.cab {
  margin-bottom: 18px;
}

h1 {
  font-size: 27px;
  font-weight: 600;
  margin-top: 4px;
}

h2 {
  font-size: 16px;
  font-weight: 600;
}

.bloque {
  margin-bottom: 14px;
}

.bloque__cab {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}

.bloque__cab .btn,
.acciones {
  margin-left: auto;
}

.acciones {
  display: flex;
  gap: 8px;
}

.acciones input[type='month'] {
  font: inherit;
  font-size: 13.5px;
  font-family: var(--f-mono);
  color: var(--text);
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  padding: 0 10px;
}

.acciones select {
  font: inherit;
  font-size: 14px;
  color: var(--text);
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  padding: 0 10px;
}

.activo {
  display: flex;
  align-items: baseline;
  gap: 14px;
  margin: 0 0 10px;
}

.activo strong {
  font-family: var(--f-display);
  font-size: 19px;
}

.activo span,
.historico span {
  font-size: 12.5px;
  color: var(--muted);
}

.nota {
  margin: 0;
  font-size: 13px;
  color: var(--dim);
  max-width: 66ch;
}

.sesiones,
.historico {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sesiones li,
.historico li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 10px;
  border-radius: var(--r-sm);
  background: var(--panel-2);
  font-size: 14px;
}

.ses__num {
  font-family: var(--f-display);
  font-weight: 700;
  color: var(--violet);
  min-width: 42px;
}

.ses__modo {
  flex: 1;
}

.ses__estado,
.estado {
  font-family: var(--f-mono);
  font-size: 10.5px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border: 1px solid var(--line);
  border-radius: 20px;
  padding: 2px 9px;
  color: var(--muted);
}

.ses__estado.is-live {
  border-color: var(--danger);
  color: var(--danger);
}

.ses__estado.is-open,
.estado.is-active {
  border-color: var(--ok);
  color: var(--ok);
}

.historico li strong {
  min-width: 92px;
  font-family: var(--f-display);
}

.historico li .estado {
  margin-left: auto;
}

time {
  font-size: 12px;
  color: var(--dim);
}

.vacio {
  color: var(--muted);
  margin: 0;
}
</style>
