<script setup lang="ts">
import { filtrar, formatWinrate, ordenar, winratePct } from '#shared/roster'
import type { CampoOrden, FilaRoster } from '#shared/roster'

/**
 * El roster del mes (§29).
 *
 * Un periodo a la vez, nunca la suma de varios: el LP se reinicia cada mes, así
 * que un total acumulado no significaría nada. Para ver la evolución de alguien
 * está su ficha, que sí enseña mes a mes.
 */
definePageMeta({ layout: 'host' })
useSeoMeta({ title: 'Roster', robots: 'noindex' })

interface Periodo { id: string; name: string; status: string; starts_at: string }

const { data: periodos } = await useFetch<Periodo[]>('/api/periods', { default: () => [] })

const periodoElegido = ref<string | null>(null)
const busqueda = ref('')
const campo = ref<CampoOrden>('lp')
const desc = ref(true)

const { data, refresh, status } = await useFetch<{ period: Periodo; filas: FilaRoster[] }>(
  '/api/roster',
  {
    query: computed(() => (periodoElegido.value ? { period_id: periodoElegido.value } : {})),
    default: () => ({ period: { id: '', name: '', status: '', starts_at: '' }, filas: [] }),
  },
)

watch(periodoElegido, () => refresh())

const visibles = computed(() =>
  ordenar(filtrar(data.value.filas, busqueda.value), campo.value, desc.value),
)

/** Los totales de lo que se está viendo, no de todo el mes. */
const totales = computed(() => {
  const f = visibles.value
  return {
    jugadores: f.length,
    conPartidas: f.filter((x) => x.jugadas > 0).length,
    partidas: f.reduce((t, x) => t + x.jugadas, 0),
  }
})

/**
 * De dónde salieron las cifras del mes, si no salieron de partidas.
 *
 * Los ocho meses anteriores a octubre de 2026 vienen del CCPR Roster: son
 * totales que el host llevaba a mano, sin partida detrás. La tabla se lee
 * igual, pero una victoria de un mes importado y una de un mes jugado no
 * están respaldadas por lo mismo, y eso tiene que verse.
 */
const importadoDe = computed(() => {
  const origenes = new Set(visibles.value.map((f) => f.importadoDe).filter(Boolean))
  return origenes.size === 1 ? [...origenes][0] : origenes.size > 1 ? 'varios Excel' : null
})

function ordenarPor(c: CampoOrden) {
  if (campo.value === c) desc.value = !desc.value
  else {
    campo.value = c
    desc.value = c !== 'nombre'
  }
}

const flecha = (c: CampoOrden) => (campo.value !== c ? '' : desc.value ? ' ↓' : ' ↑')

const urlCsv = computed(() =>
  periodoElegido.value ? `/api/roster/export?period_id=${periodoElegido.value}` : '/api/roster/export',
)

const abierto = ref<string | null>(null)
</script>

<template>
  <section class="roster">
    <header class="cab">
      <h1>Roster</h1>

      <select v-model="periodoElegido" aria-label="Periodo" class="periodo">
        <option :value="null">{{ data.period.name || 'Periodo activo' }}</option>
        <option v-for="p in periodos" :key="p.id" :value="p.id">{{ p.name }}</option>
      </select>

      <input
        v-model="busqueda"
        type="search"
        class="buscar"
        placeholder="Buscar por nombre, rol o elo…"
        aria-label="Buscar en el roster"
      >

      <span class="hueco" />

      <!-- Descarga directa del servidor: el CSV sale del mismo sitio que la
           tabla, así que no puede decir otra cosa. -->
      <a class="btn btn--ghost" :href="urlCsv" download>Exportar CSV</a>
    </header>

    <p v-if="status === 'pending'" class="estado">Cargando…</p>

    <p v-else-if="!data.filas.length" class="estado">
      Nadie se ha registrado todavía en {{ data.period.name }}.
    </p>

    <template v-else>
      <p class="resumen">
        {{ totales.jugadores }} {{ totales.jugadores === 1 ? 'jugador' : 'jugadores' }} ·
        {{ totales.conPartidas }} con partidas jugadas ·
        {{ totales.partidas }} participaciones en partida
      </p>

      <p v-if="importadoDe" class="importado">
        Mes importado de <strong>{{ importadoDe }}</strong>: las cifras son los totales que
        llevaba la hoja, no partidas registradas aquí.
      </p>

      <div class="tabla-caja">
        <table class="tabla">
          <thead>
            <tr>
              <th class="foto" />
              <th><button @click="ordenarPor('nombre')">Jugador{{ flecha('nombre') }}</button></th>
              <th>Elo</th>
              <th>Roles</th>
              <th class="num"><button @click="ordenarPor('lp')">LP{{ flecha('lp') }}</button></th>
              <th class="num"><button @click="ordenarPor('jugadas')">PJ{{ flecha('jugadas') }}</button></th>
              <th class="num"><button @click="ordenarPor('victorias')">V{{ flecha('victorias') }}</button></th>
              <th class="num"><button @click="ordenarPor('derrotas')">D{{ flecha('derrotas') }}</button></th>
              <th class="num"><button @click="ordenarPor('wr')">WR{{ flecha('wr') }}</button></th>
              <th class="num"><button @click="ordenarPor('mvps')">MVP{{ flecha('mvps') }}</button></th>
              <th class="num"><button @click="ordenarPor('aces')">ACE{{ flecha('aces') }}</button></th>
              <th class="num">Off</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="f in visibles"
              :key="f.participationId"
              :class="{ 'is-open': abierto === f.playerId }"
              @click="abierto = abierto === f.playerId ? null : f.playerId"
            >
              <td class="foto">
                <img
                  :src="f.photoUrl || '/ui/avatar-default.webp'"
                  :alt="''"
                  width="28"
                  height="28"
                  loading="lazy"
                >
              </td>
              <td class="nombre">{{ f.displayName }}</td>
              <td class="elo">{{ f.elo ?? '—' }}</td>
              <td class="roles">
                <span v-for="rol in f.roles" :key="rol" :class="`rol rol--${rol.toLowerCase()}`">
                  {{ rol }}
                </span>
                <em v-if="!f.roles.length">—</em>
              </td>
              <td class="num lp">{{ f.lp }}</td>
              <td class="num">{{ f.jugadas || '—' }}</td>
              <td class="num">{{ f.jugadas ? f.victorias : '—' }}</td>
              <td class="num">{{ f.jugadas ? f.derrotas : '—' }}</td>
              <td class="num wr">{{ formatWinrate(winratePct(f)) }}</td>
              <td class="num">{{ f.mvps || '—' }}</td>
              <td class="num">{{ f.aces || '—' }}</td>
              <td class="num">{{ f.offRoles || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-if="!visibles.length" class="estado">Nadie coincide con «{{ busqueda }}».</p>
    </template>

    <HostPlayerCard v-if="abierto" :player-id="abierto" @close="abierto = null" @updated="refresh" />
  </section>
</template>

<style scoped>
.roster {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cab {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

h1 {
  font-family: var(--f-display);
  font-size: 22px;
  margin: 0;
}

.hueco {
  flex: 1;
}

.periodo,
.buscar {
  font: inherit;
  font-size: 13px;
  color: var(--text);
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  padding: 7px 9px;
}

.buscar {
  min-width: 260px;
}

.periodo:focus,
.buscar:focus {
  border-color: var(--violet);
  outline: none;
}

.estado {
  color: var(--dim);
  font-size: 13px;
  margin: 0;
}

.resumen {
  font-family: var(--f-mono);
  font-size: 10.5px;
  letter-spacing: 0.04em;
  color: var(--dim);
  margin: 0;
}

.importado {
  font-size: 12px;
  color: var(--dim);
  margin: 0;
}

.importado strong {
  color: var(--text);
  font-weight: 600;
}

/* La tabla tiene su propio scroll horizontal: la página no se mueve. */
.tabla-caja {
  overflow-x: auto;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--r);
}

.tabla {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

th {
  text-align: left;
  padding: 9px 10px;
  border-bottom: 1px solid var(--line);
  font-family: var(--f-mono);
  font-size: 9.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--dim);
  font-weight: 500;
  white-space: nowrap;
}

th button {
  background: none;
  border: 0;
  padding: 0;
  font: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
  color: inherit;
}

th button:hover {
  color: var(--text);
}

td {
  padding: 7px 10px;
  border-bottom: 1px solid var(--line-soft);
  white-space: nowrap;
}

tbody tr:hover {
  background: var(--panel-2);
}

tbody tr.is-open {
  background: var(--panel-3);
}

.foto {
  width: 38px;
  padding-right: 0;
}

.foto img {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  display: block;
  background: var(--panel-3);
}

.nombre {
  font-size: 13.5px;
  color: var(--text);
}

.elo {
  font-family: var(--f-mono);
  font-size: 10px;
  color: var(--muted);
}

.num {
  text-align: right;
  font-family: var(--f-mono);
  font-variant-numeric: tabular-nums;
}

.lp {
  color: var(--violet-txt);
}

.wr {
  color: var(--muted);
}

.rol {
  font-family: var(--f-mono);
  font-size: 9.5px;
  font-weight: 700;
  margin-right: 5px;
}

.rol--top { color: var(--rol-top); }
.rol--jg { color: var(--rol-jg); }
.rol--mid { color: var(--rol-mid); }
.rol--adc { color: var(--rol-adc); }
.rol--sup { color: var(--rol-sup); }

.roles em {
  color: var(--dim);
  font-style: normal;
}
</style>
