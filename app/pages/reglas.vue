<script setup lang="ts">
import { BLUE_SHELL_DESC, BLUE_SHELL_LABEL, BLUE_SHELL_OUTCOMES } from '#shared/blueshell'
import { LP_INICIAL } from '#shared/lp'
import { leerCuerpo } from '#shared/patchnotes'
import type { PatchNote } from '#shared/patchnotes'

/**
 * Reglas y formato, en dos partes.
 *
 * **Las reglas** son texto: cambian poco y cuando cambian hay que reescribirlas
 * con cuidado, así que viven en esta página y no en la base.
 *
 * **Los patch notes** son lo contrario: se añade uno cada cierto tiempo y no
 * pueden esperar a un despliegue, así que los administra el host desde
 * `/host/patch-notes`. Están juntos aquí porque quien viene a leer las reglas
 * es exactamente quien quiere saber qué cambió desde la última vez.
 */
useSeoMeta({
  title: 'Reglas y formato',
  description:
    'Cómo se entra a la CopaPerso, los cinco modos de juego, la fase de negociación con bits y ' +
    'la puntuación. Y los patch notes de cada cambio en las reglas.',
})

const { data: parches } = await useFetch<PatchNote[]>('/api/public/patch-notes', {
  default: () => [],
})

const MODOS = [
  {
    icon: 'copa-perso',
    name: 'Copa Perso',
    desc:
      'El formato de siempre. Los equipos se sortean en directo y cada quien juega en uno de los ' +
      'roles que registró.',
  },
  {
    icon: 'copa-tryhard',
    name: 'Copa Tryhard',
    desc: 'Prioridad para Master+. Mismo formato que la Perso, pero sin piedad.',
  },
  {
    icon: 'copa-random',
    name: 'Copa Random',
    desc: 'Campeones al azar, y el rol también sale sorteado entre los que cada uno registró.',
  },
  {
    icon: 'copa-analisis',
    name: 'Copa Análisis',
    desc: 'Se juega como la Perso y al terminar se revisa la partida jugada por jugada.',
  },
  {
    icon: 'copa-aram-afk',
    name: 'Copa ARAM AFK',
    desc:
      'ARAM: una sola línea y una sola vida por jugador. Aquí los roles no cuentan para nada, ' +
      'así que los equipos pueden quedar desparejos y da igual.',
  },
]

/** Los seis canjeos y su precio, tal y como están en el catálogo del torneo. */
const CANJEOS = [
  { label: 'Cupo: entrar en lugar de alguien ya seleccionado', bits: 200 },
  { label: 'Cambio de Team', bits: 150 },
  { label: 'Sacar a alguien de la banca', bits: 200 },
  { label: 'Cambio de rol y reingreso', bits: 300 },
  { label: 'Sacar del cementerio', bits: 300 },
  { label: 'Blue Shell', bits: 500 },
]

const LP = [
  { que: 'Ganar la partida', delta: '+15' },
  { que: 'Perderla', delta: '−15' },
  { que: 'MVP de la partida', delta: '+5' },
  { que: 'ACE de la partida', delta: '+10' },
  { que: 'Jugar fuera de tu rol', delta: '+2' },
  { que: 'Doble derrota (Blue Shell)', delta: '−30' },
]

/**
 * La pestaña viaja en el hash, para poder enlazar los patch notes directamente.
 *
 * **El hash se lee al montar, no en el setup.** El servidor nunca lo recibe
 * —el navegador no lo manda— así que durante el render inicial `useRoute()`
 * devuelve la ruta sin hash y `/reglas#patch-notes` abría igualmente la
 * pestaña de las reglas. Leerlo de `window` después de montar es lo único que
 * lo sabe de verdad, y además evita el desajuste de hidratación: el servidor
 * siempre pinta la primera pestaña y el cliente cambia después.
 */
const router = useRouter()
const pestana = ref<'reglas' | 'patch'>('reglas')

onMounted(() => {
  if (window.location.hash === '#patch-notes') pestana.value = 'patch'
})

function ver(cual: 'reglas' | 'patch') {
  pestana.value = cual
  router.replace({ hash: cual === 'patch' ? '#patch-notes' : '' })
}

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
</script>

<template>
  <div class="wrap reglas">
    <header class="reglas__cab">
      <p class="eyebrow">Cómo funciona</p>
      <h1>Reglas y formato</h1>
    </header>

    <nav class="tabs" aria-label="Secciones">
      <button :class="{ 'is-on': pestana === 'reglas' }" @click="ver('reglas')">Las reglas</button>
      <button :class="{ 'is-on': pestana === 'patch' }" @click="ver('patch')">
        Patch notes
        <i v-if="parches.length" class="cuantos">{{ parches.length }}</i>
      </button>
    </nav>

    <!-- ── Las reglas ──────────────────────────────────────────────── -->
    <div v-show="pestana === 'reglas'" class="hojas">
      <section class="hoja">
        <h2>Cómo se entra</h2>
        <p class="grande">
          No hay formularios ni inscripción previa. La copa se anuncia en el chat de Twitch y entra
          quien esté ahí en ese momento.
        </p>
        <p>
          Eso es todo el requisito: <strong>estar presente cuando se anuncia que va a empezar</strong>.
          Quien llega tarde se queda en la banca, y desde la banca todavía se puede entrar — pero ya
          no gratis, sino por los canjeos de ahí abajo.
        </p>
      </section>

      <section class="hoja">
        <h2>Los modos</h2>
        <p>Cada copa se juega en uno de estos cinco formatos. El modo se anuncia al abrirla.</p>
        <ul class="modos">
          <li v-for="m in MODOS" :key="m.icon">
            <img :src="`/modes/${m.icon}.svg`" :alt="''" width="44" height="44" loading="lazy">
            <div>
              <h3>{{ m.name }}</h3>
              <p>{{ m.desc }}</p>
            </div>
          </li>
        </ul>
      </section>

      <section class="hoja">
        <h2>La fase de negociación</h2>
        <p class="grande">
          Antes de cada partida se abre una fase de negociación con el cronómetro corriendo.
          Mientras dura, <strong>tanto quienes juegan como quienes miran</strong> pueden canjear
          bits o subs por recompensas que cambian los equipos y a los jugadores.
        </p>

        <table class="precios">
          <caption class="sr">Recompensas y su precio en bits</caption>
          <thead>
            <tr><th scope="col">Recompensa</th><th scope="col">Bits</th></tr>
          </thead>
          <tbody>
            <tr v-for="c in CANJEOS" :key="c.label">
              <td>{{ c.label }}</td>
              <td class="num">{{ c.bits }}</td>
            </tr>
          </tbody>
        </table>

        <p class="aviso">
          Un canjeo <strong>no ejecuta nada por sí solo</strong>: queda registrado y es el host quien
          lo aplica en la mesa. Y los precios pueden subir a <strong>el triple</strong> durante una
          partida; al terminar vuelven a la normalidad, así que cada partida empieza su negociación
          con los precios de esta tabla.
        </p>
      </section>

      <section class="hoja">
        <h2>El Blue Shell</h2>
        <p>
          El canjeo más caro castiga a un jugador. La ruleta tiene cuatro resultados y
          <strong>los cuatro salen con la misma probabilidad</strong>:
        </p>
        <ul class="shell">
          <li v-for="o in BLUE_SHELL_OUTCOMES" :key="o">
            <b>{{ BLUE_SHELL_LABEL[o] }}</b>
            <span>{{ BLUE_SHELL_DESC[o] }}</span>
          </li>
        </ul>
      </section>

      <section class="hoja">
        <h2>Puntuación</h2>
        <p>
          Todo el mundo empieza el mes con <strong>{{ LP_INICIAL }} LP</strong>. Cada partida suma o
          resta según lo que pase en ella:
        </p>
        <table class="precios">
          <caption class="sr">Puntos por cada cosa que ocurre en una partida</caption>
          <thead>
            <tr><th scope="col">Qué pasó</th><th scope="col">LP</th></tr>
          </thead>
          <tbody>
            <tr v-for="l in LP" :key="l.que">
              <td>{{ l.que }}</td>
              <td class="num" :class="l.delta.startsWith('+') ? 'sube' : 'baja'">{{ l.delta }}</td>
            </tr>
          </tbody>
        </table>
        <p class="aviso">
          <strong>Cada mes empieza de cero.</strong> El roster del mes anterior se queda como quedó y
          nadie arrastra puntos: quien vuelve, vuelve con {{ LP_INICIAL }}.
        </p>
      </section>
    </div>

    <!-- ── Patch notes ─────────────────────────────────────────────── -->
    <div v-show="pestana === 'patch'" class="hojas">
      <p class="intro">
        Las reglas se mueven. Cada vez que se añade o se quita algo queda aquí, con su fecha.
      </p>

      <p v-if="!parches.length" class="vacio">
        Todavía no hay ningún parche publicado. Las reglas son las de arriba, tal cual.
      </p>

      <article v-for="p in parches" :key="p.id" class="parche">
        <header>
          <h2>{{ p.title }}</h2>
          <span v-if="p.version" class="version">{{ p.version }}</span>
          <time v-if="p.publishedAt" :datetime="p.publishedAt">{{ fecha(p.publishedAt) }}</time>
        </header>

        <ul class="cambios">
          <li v-for="(l, i) in leerCuerpo(p.body)" :key="i" :class="`es-${l.tipo}`">
            <span v-if="l.tipo !== 'texto'" class="signo" aria-hidden="true">
              {{ l.tipo === 'añade' ? '+' : '−' }}
            </span>
            <span>{{ l.texto }}</span>
          </li>
        </ul>
      </article>
    </div>
  </div>
</template>

<style scoped>
.reglas {
  padding-block: 40px 64px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.reglas__cab {
  text-align: center;
}

.eyebrow {
  font-family: var(--f-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--violet);
  margin: 0 0 6px;
}

h1 {
  font-family: var(--f-display);
  font-size: clamp(26px, 4vw, 40px);
  margin: 0;
}

.tabs {
  display: flex;
  gap: 6px;
  justify-content: center;
  flex-wrap: wrap;
}

.tabs button {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  padding: 9px 18px;
  color: var(--muted);
  font: inherit;
  font-size: 14.5px;
  cursor: pointer;
}

.tabs button:hover {
  color: var(--text);
}

.tabs button.is-on {
  background: var(--violet);
  border-color: var(--violet);
  color: #fff;
}

.cuantos {
  font-style: normal;
  font-family: var(--f-mono);
  font-size: 11px;
  opacity: 0.8;
}

.hojas {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.hoja {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--r);
  padding: 24px 26px;
}

.hoja h2 {
  font-family: var(--f-display);
  font-size: 20px;
  margin: 0 0 12px;
}

.hoja p {
  margin: 0 0 12px;
  font-size: 15px;
  line-height: 1.65;
  color: var(--muted);
  max-width: 68ch;
}

.hoja p:last-child {
  margin-bottom: 0;
}

.grande {
  font-size: 16.5px !important;
  color: var(--text) !important;
}

strong {
  color: var(--text);
  font-weight: 600;
}

.modos {
  list-style: none;
  margin: 4px 0 0;
  padding: 0;
  display: grid;
  gap: 12px;
}

.modos li {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  background: var(--panel-2);
  border-radius: var(--r-sm);
  padding: 14px 16px;
}

.modos img {
  flex: none;
}

.modos h3 {
  font-size: 15.5px;
  font-weight: 600;
  margin: 0 0 3px;
}

.modos p {
  margin: 0;
  font-size: 14px;
}

.precios {
  width: 100%;
  border-collapse: collapse;
  margin: 4px 0 14px;
  font-size: 14.5px;
}

.precios th {
  text-align: left;
  font-family: var(--f-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--dim);
  font-weight: 600;
  padding: 0 10px 8px 0;
}

.precios th:last-child,
.precios td:last-child {
  text-align: right;
  padding-right: 0;
  white-space: nowrap;
}

.precios td {
  padding: 9px 10px 9px 0;
  border-top: 1px solid var(--line-soft);
  color: var(--muted);
}

.num {
  font-family: var(--f-mono);
  color: var(--text);
}

.sube { color: #7be0a0; }
.baja { color: #ff8da0; }

.aviso {
  font-size: 13.5px !important;
  color: var(--dim) !important;
  border-left: 2px solid var(--violet-dim, var(--line));
  padding-left: 12px;
}

.shell {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.shell li {
  background: var(--panel-2);
  border-radius: var(--r-sm);
  padding: 11px 14px;
  font-size: 14.5px;
  color: var(--muted);
}

.shell b {
  color: var(--text);
  margin-right: 8px;
}

/* --- patch notes --- */
.intro,
.vacio {
  margin: 0;
  color: var(--muted);
  font-size: 15px;
  text-align: center;
}

.vacio {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--r);
  padding: 28px 24px;
  color: var(--dim);
}

.parche {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--r);
  padding: 20px 24px;
}

.parche header {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.parche h2 {
  font-family: var(--f-display);
  font-size: 19px;
  margin: 0;
}

.version {
  font-family: var(--f-mono);
  font-size: 11px;
  color: var(--violet);
  border: 1px solid var(--violet-dim, var(--line));
  border-radius: 999px;
  padding: 2px 9px;
}

.parche time {
  margin-left: auto;
  font-size: 12.5px;
  color: var(--dim);
}

.cambios {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.cambios li {
  display: flex;
  gap: 10px;
  font-size: 14.5px;
  line-height: 1.55;
  color: var(--muted);
}

.signo {
  font-family: var(--f-mono);
  font-weight: 700;
  flex: none;
  width: 1ch;
}

.es-añade .signo { color: #7be0a0; }
.es-quita .signo { color: #ff8da0; }

.es-texto {
  color: var(--dim);
}

.sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

@media (max-width: 560px) {
  .hoja {
    padding: 20px 18px;
  }

  .parche time {
    margin-left: 0;
  }
}
</style>
