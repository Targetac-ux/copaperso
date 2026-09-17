<script setup lang="ts">
import { formatWinrate, winratePct } from '#shared/roster'

/**
 * El histórico público, mes a mes.
 *
 * Existe porque los ocho meses que venían de los Excel llevaban una semana en
 * la base sin que nadie de fuera pudiera verlos. Aquí no hay nada que el host
 * no enseñe ya en `/host/roster`: las mismas cifras, sin elo ni roles ni
 * off-role, que son cosas de dentro.
 *
 * Los porcentajes salen de `shared/roster.ts`, las mismas funciones que usan
 * el panel y el CSV. Si esta página hiciera su propio redondeo acabaría
 * diciendo un número distinto del que ve el host del mismo jugador, que es
 * exactamente lo que ese módulo existe para evitar.
 */
interface Fila {
  displayName: string
  photoUrl: string | null
  lp: number
  jugadas: number
  victorias: number
  derrotas: number
  mvps: number
  aces: number
}

interface Mes {
  periodo: string
  filas: Fila[]
}

const { data } = await useFetch<{ meses: Mes[] }>('/api/public/roster', {
  default: () => ({ meses: [] }),
})

useSeoMeta({
  title: 'Histórico',
  description: 'El roster de la CopaPerso mes a mes: LP, partidas, victorias y winrate.',
})

// El más reciente por defecto: es el que le importa a quien entra.
const elegido = ref<string | null>(null)
const mes = computed(
  () => data.value.meses.find((m) => m.periodo === elegido.value) ?? data.value.meses[0] ?? null,
)

const totales = computed(() => {
  const f = mes.value?.filas ?? []
  return {
    jugadores: f.length,
    partidas: f.reduce((t, x) => t + x.jugadas, 0),
  }
})
</script>

<template>
  <div class="wrap hist">
    <header class="hist__cab">
      <p class="eyebrow">CopaPerso</p>
      <h1>Histórico</h1>
      <p class="hist__txt">Roster por mes con los stats de todos los bebetos que participan.</p>
    </header>

    <p v-if="!data.meses.length" class="hist__vacio">
      Todavía no hay ningún mes que enseñar. Vuelve cuando termine la primera CopaPerso.
    </p>

    <template v-else-if="mes">
      <div class="hist__meses">
        <button
          v-for="m in data.meses"
          :key="m.periodo"
          class="mes"
          :class="{ 'is-on': m.periodo === mes.periodo }"
          @click="elegido = m.periodo"
        >
          {{ m.periodo }}
        </button>
      </div>

      <p class="hist__resumen">
        {{ totales.jugadores }} {{ totales.jugadores === 1 ? 'jugador' : 'jugadores' }} ·
        {{ totales.partidas }} participaciones en partida
      </p>

      <div class="tabla-caja">
        <table class="tabla">
          <thead>
            <tr>
              <th class="foto" />
              <th>Jugador</th>
              <th class="num">LP</th>
              <th class="num">PJ</th>
              <th class="num">V</th>
              <th class="num">D</th>
              <th class="num">WR</th>
              <th class="num">MVP</th>
              <th class="num">ACE</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="f in mes.filas" :key="f.displayName">
              <td class="foto">
                <img
                  :src="f.photoUrl || '/ui/avatar-default.webp'"
                  :alt="''"
                  width="28"
                  height="28"
                  loading="lazy"
                />
              </td>
              <td class="nombre">{{ f.displayName }}</td>
              <td class="num lp">{{ f.lp }}</td>
              <td class="num">{{ f.jugadas || '—' }}</td>
              <td class="num">{{ f.jugadas ? f.victorias : '—' }}</td>
              <td class="num">{{ f.jugadas ? f.derrotas : '—' }}</td>
              <td class="num wr">{{ formatWinrate(winratePct(f)) }}</td>
              <td class="num">{{ f.mvps || '—' }}</td>
              <td class="num">{{ f.aces || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped>
.hist {
  padding-block: 40px 64px;
}

.hist__cab {
  margin-bottom: 22px;
}

.hist h1 {
  font-family: var(--f-display);
  font-size: clamp(28px, 4vw, 38px);
  margin: 4px 0 0;
}

.hist__txt {
  color: var(--muted);
  font-size: 15px;
  line-height: 1.6;
  max-width: 54ch;
  margin: 10px 0 0;
}

.hist__vacio {
  color: var(--dim);
  font-size: 15px;
}

/* Los meses como pestañas y no como un desplegable: son ocho o nueve, caben, y
   así se ve de un vistazo cuántos hay sin abrir nada. */
.hist__meses {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 14px;
}

.mes {
  font-family: var(--f-mono);
  font-size: 12px;
  letter-spacing: 0.04em;
  color: var(--muted);
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 20px;
  padding: 5px 13px;
  cursor: pointer;
}

.mes:hover {
  color: var(--text);
}

.mes.is-on {
  color: var(--ink);
  background: var(--gold);
  border-color: var(--gold);
}

.hist__resumen {
  font-family: var(--f-mono);
  font-size: 10.5px;
  letter-spacing: 0.04em;
  color: var(--dim);
  margin: 0 0 10px;
}

/* La tabla se desplaza dentro de su caja en vez de ensanchar la página: en
   móvil, nueve columnas no caben de ninguna manera. */
.tabla-caja {
  overflow-x: auto;
  border: 1px solid var(--line);
  border-radius: var(--r);
  background: var(--panel);
}

.tabla {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
}

.tabla th {
  text-align: left;
  font-family: var(--f-mono);
  font-size: 9.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--dim);
  font-weight: 500;
  padding: 10px 10px 8px;
  border-bottom: 1px solid var(--line);
  white-space: nowrap;
}

.tabla td {
  padding: 7px 10px;
  border-bottom: 1px solid var(--line-soft);
}

.tabla tr:last-child td {
  border-bottom: 0;
}

.tabla .num {
  text-align: right;
  font-family: var(--f-mono);
  /* El winrate se escribe «67 %», con espacio, y en una columna estrecha el
     porcentaje se caía a la línea de abajo. */
  white-space: nowrap;
}

.tabla .foto {
  width: 28px;
  padding-right: 0;
}

.tabla .foto img {
  display: block;
  border-radius: 50%;
  object-fit: cover;
}

.tabla .nombre {
  color: var(--text);
  white-space: nowrap;
}

.tabla .lp {
  color: var(--gold);
  font-weight: 600;
}

.tabla .wr {
  color: var(--muted);
}
</style>
