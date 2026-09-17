<script setup lang="ts">
import { importanLosRoles } from '#shared/draft'
import { formatSeconds, remainingSeconds } from '#shared/timer'
import { MODE_LABEL } from '#shared/types/models'
import type { SessionMode } from '#shared/types/database.types'

/**
 * La vista pública en vivo (Fase 4B).
 *
 * Lo que ve quien está mirando el stream: cómo se van formando los equipos, el
 * marcador y cuánto queda de negociación. Nada de bits, cárcel ni notas: eso no
 * llega siquiera al navegador, porque el servidor no lo publica.
 *
 * Con `?overlay=1` se queda sin fondo ni cabecera, para meterla en OBS como
 * fuente de navegador encima del juego.
 */
const route = useRoute()
const overlay = computed(() => route.query.overlay === '1')

definePageMeta({ layout: false })
useSeoMeta({
  title: 'En vivo',
  description: 'Los equipos de la CopaPerso, formándose en directo.',
  robots: 'noindex',
})

const { estado, conexion } = useEnVivo()
const {
  enabled: sonido,
  chime,
  toggle: alternarSonido,
} = useTicTac({
  clave: 'copaperso:aviso-publico',
  estado: 'aviso-publico',
})

/** En ARAM AFK no hay posiciones, así que tampoco se enseñan aquí. */
/**
 * Cárcel y restricciones en una sola lista.
 *
 * Son dos tablas distintas por dentro, pero para quien mira es lo mismo: a
 * quién le pesa algo esta noche. Dos paneles casi vacíos al lado uno del otro
 * se leían como un error de maquetación.
 *
 * Y sin repetir a nadie: la cárcel importada del Excel vive como restricción
 * `CARCEL`, así que quien esté en las dos saldría dos veces con el mismo texto.
 */
const castigos = computed(() => {
  const vistos = new Set<string>()
  return [...estado.value.carcel, ...estado.value.restricciones].filter((c) => {
    const clave = `${c.displayName}·${c.texto}`
    if (vistos.has(clave)) return false
    vistos.add(clave)
    return true
  })
})

const conRoles = computed(() =>
  estado.value?.sesion ? importanLosRoles(estado.value.sesion.mode as SessionMode) : true,
)

// --- cronómetro ------------------------------------------------------------
const restante = ref(0)
let tick: ReturnType<typeof setInterval> | undefined
let yaAvisado = false

function refrescarReloj() {
  const c = estado.value.cronometro
  restante.value = remainingSeconds({
    endsAt: c.endsAt,
    seconds: c.seconds,
    remaining: c.remaining,
    running: c.running,
  })

  if (c.running && restante.value === 0 && !yaAvisado) {
    yaAvisado = true
    chime()
  }
}

watch(
  () => [estado.value.cronometro.endsAt, estado.value.cronometro.running],
  () => {
    yaAvisado = false
    refrescarReloj()
  },
)

onMounted(() => {
  refrescarReloj()
  tick = setInterval(refrescarReloj, 1000)
})
onBeforeUnmount(() => clearInterval(tick))

const enRojo = computed(() => estado.value.cronometro.running && restante.value <= 60)

const huecos = (n: number) => Math.max(0, 5 - n)
</script>

<template>
  <div class="vivo" :class="{ 'is-overlay': overlay }">
    <header v-if="!overlay" class="cab">
      <NuxtLink to="/" aria-label="CopaPerso, inicio">
        <AppLogo :size="30" />
      </NuxtLink>

      <span v-if="estado.hay && estado.sesion" class="sesion">
        Sesión #{{ estado.sesion.number }}
        <i>{{ MODE_LABEL[estado.sesion.mode as SessionMode] ?? estado.sesion.mode }}</i>
      </span>

      <span class="hueco" />

      <span class="conexion" :class="`is-${conexion}`">
        <i class="punto" />
        {{
          conexion === 'en-vivo'
            ? 'En directo'
            : conexion === 'conectando'
              ? 'Conectando…'
              : 'Sin conexión'
        }}
      </span>

      <button
        class="sonido"
        :title="sonido ? 'Silenciar el aviso' : 'Activar el aviso'"
        :aria-label="sonido ? 'Silenciar el aviso' : 'Activar el aviso'"
        @click="alternarSonido"
      >
        {{ sonido ? '🔊' : '🔇' }}
      </button>
    </header>

    <p v-if="!estado.hay" class="nada">
      Ahora mismo no hay ninguna CopaPerso en directo.
      <NuxtLink to="/">Volver al inicio</NuxtLink>
    </p>

    <template v-else>
      <div class="marcador">
        <span class="lado t1">
          <b>{{ estado.marcador.t1 }}</b>
          <i>Team 1</i>
        </span>

        <div class="centro">
          <span class="reloj" :class="{ 'is-hot': enRojo, 'is-run': estado.cronometro.running }">
            {{ formatSeconds(restante) }}
          </span>
          <span class="etq">Negociación</span>
          <span v-if="estado.preciosTriplicados" class="x3">Precios ×3</span>
          <span v-if="estado.partida" class="partida">
            {{ estado.partida.enJuego ? 'Partida' : 'Tras la partida' }}
            {{ estado.partida.numero }}
          </span>
        </div>

        <span class="lado t2">
          <b>{{ estado.marcador.t2 }}</b>
          <i>Team 2</i>
        </span>
      </div>

      <div class="equipos">
        <section v-for="eq in estado.equipos" :key="eq.teamNumber" :class="`t${eq.teamNumber}`">
          <h2>Team {{ eq.teamNumber }}</h2>
          <ul>
            <li v-for="m in eq.members" :key="m.displayName + m.role">
              <span v-if="conRoles" class="rol" :class="`rol--${m.role.toLowerCase()}`">
                {{ m.role }}
              </span>
              <span class="nombre">{{ m.displayName }}</span>
              <span v-if="m.isOffRole" class="off" title="Juega fuera de su rol">off</span>
            </li>
            <li v-for="h in huecos(eq.members.length)" :key="`h${h}`" class="vacio">
              <span v-if="conRoles" class="rol">—</span>
              <span class="nombre">por elegir</span>
            </li>
          </ul>
        </section>
      </div>

      <section v-if="estado.banca.length" class="banca">
        <h2>Esperando</h2>
        <ul>
          <li v-for="b in estado.banca" :key="b.displayName">
            {{ b.displayName }}
            <i v-if="b.roles.length">{{ b.roles.join(' · ') }}</i>
          </li>
        </ul>
      </section>

      <!--
        Los paneles de negociación **no salen en el overlay de OBS**: son para
        que los jugadores los miren en la web mientras negocian. El host ve
        todo esto, y más, en el CCTM. En una esquina del stream no cabrían, y
        lo que el stream necesita enseñar son los equipos y el marcador.
      -->
      <div v-if="!overlay" class="paneles">
        <section v-if="estado.recompensas.length" class="panel">
          <h2>
            Recompensas
            <i v-if="estado.preciosTriplicados" class="x3">×3</i>
          </h2>
          <ul class="precios">
            <li v-for="r in estado.recompensas" :key="r.codigo">
              <span>{{ r.etiqueta }}</span>
              <b>{{ r.precio.toLocaleString('es-MX') }}</b>
            </li>
          </ul>
        </section>

        <section v-if="estado.banco.length" class="panel panel--banco">
          <h2>Banco</h2>
          <ul class="saldos">
            <li v-for="c in estado.banco" :key="c.displayName">
              <span>{{ c.displayName }}</span>
              <b>
                {{ c.bits.toLocaleString('es-MX') }}
                <em v-if="c.subs">+{{ c.subs }} sub{{ c.subs === 1 ? '' : 's' }}</em>
              </b>
            </li>
          </ul>
        </section>

        <section v-if="castigos.length" class="panel">
          <h2>Cárcel y restricciones</h2>
          <ul class="castigos">
            <li v-for="(c, i) in castigos" :key="`${c.displayName}-${i}`">
              <span>{{ c.displayName }}</span>
              <i>{{ c.texto }}</i>
            </li>
          </ul>
        </section>
      </div>

      <p v-if="estado.ultimaAccion" class="ultima">
        <span class="etq">Último movimiento</span>
        {{ estado.ultimaAccion }}
      </p>
    </template>
  </div>
</template>

<style scoped>
.vivo {
  min-height: 100vh;
  background: var(--ink);
  color: var(--text);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* En OBS la página va encima del juego: sin fondo y sin cabecera. */
.vivo.is-overlay {
  min-height: 0;
  background: transparent;
  padding: 10px;
}

.cab {
  display: flex;
  align-items: center;
  gap: 10px;
}

.sesion {
  font-family: var(--f-display);
  font-size: 15px;
}

.sesion i {
  font-style: normal;
  color: var(--dim);
  font-size: 12px;
  margin-left: 6px;
}

.hueco {
  flex: 1;
}

.conexion {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--f-mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--dim);
}

.punto {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--dim);
}

.conexion.is-en-vivo {
  color: var(--ok);
}

.conexion.is-en-vivo .punto {
  background: var(--ok);
}

.conexion.is-sin-conexion {
  color: var(--danger);
}

.conexion.is-sin-conexion .punto {
  background: var(--danger);
}

.sonido {
  background: none;
  border: 0;
  font-size: 13px;
  padding: 2px 3px;
  line-height: 1;
  opacity: 0.75;
}

.nada {
  margin: auto;
  text-align: center;
  color: var(--muted);
  font-size: 15px;
}

.nada a {
  display: block;
  margin-top: 8px;
  color: var(--violet-txt);
}

.marcador {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 12px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 10px 16px;
}

.lado {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.lado b {
  font-family: var(--f-display);
  font-size: 34px;
  line-height: 1;
}

.lado i {
  font-style: normal;
  font-family: var(--f-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.lado.t1 b,
.lado.t1 i {
  color: var(--team-1);
}

.lado.t2 b,
.lado.t2 i {
  color: var(--team-2);
}

.centro {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.reloj {
  font-family: var(--f-mono);
  font-size: 30px;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.reloj.is-run {
  color: var(--violet-txt);
}

.reloj.is-hot {
  color: var(--warn);
}

.etq {
  font-family: var(--f-mono);
  font-size: 9px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--dim);
}

.x3 {
  font-family: var(--f-mono);
  font-size: 9.5px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--gold);
  border: 1px solid rgba(243, 185, 77, 0.4);
  border-radius: 20px;
  padding: 1px 8px;
  margin-top: 3px;
}

.partida {
  font-family: var(--f-mono);
  font-size: 10px;
  color: var(--ok);
  margin-top: 2px;
}

.equipos {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.equipos section {
  background: var(--panel);
  border: 1px solid var(--line);
  border-top-width: 3px;
  border-radius: 12px;
  padding: 10px 12px 12px;
}

.equipos .t1 {
  border-top-color: var(--team-1);
}

.equipos .t2 {
  border-top-color: var(--team-2);
}

.equipos h2 {
  font-family: var(--f-mono);
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  margin: 0 0 8px;
}

.equipos .t1 h2 {
  color: var(--team-1);
}

.equipos .t2 h2 {
  color: var(--team-2);
}

.equipos ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.equipos li {
  display: flex;
  align-items: center;
  gap: 9px;
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 7px 10px;
}

.equipos li.vacio {
  opacity: 0.45;
}

.rol {
  font-family: var(--f-mono);
  font-size: 12.5px;
  font-weight: 700;
  width: 34px;
  color: var(--dim);
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

.nombre {
  font-size: 14px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.off {
  font-family: var(--f-mono);
  font-size: 9px;
  text-transform: uppercase;
  color: var(--gold);
}

/**
 * Los tres paneles de negociación.
 *
 * En tres columnas mientras quepan, y apilados por debajo de 860 px — es la
 * misma rotura que ya usan los equipos, y así el teléfono no acaba con tres
 * columnas de un dedo de ancho. El banco lleva su propio alto máximo: con 43
 * cuentas, sin él empuja el resto de la página fuera de la pantalla.
 */
.paneles {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  align-items: start;
}
.panel {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 9px 12px 11px;
  min-width: 0;
}
.panel h2 {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--f-mono);
  font-size: 9.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--dim);
  margin: 0 0 7px;
}
.panel h2 .x3 {
  font-style: normal;
  color: var(--gold);
  letter-spacing: 0.06em;
}
.panel ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
.panel li {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  padding: 3px 0;
  font-size: 12.5px;
  line-height: 1.4;
}
.panel li + li {
  border-top: 1px solid var(--line-soft);
}
/* El nombre cede y se corta; la cifra nunca, que es lo que se viene a leer. */
.panel li span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.panel li b {
  flex: none;
  font-family: var(--f-mono);
  font-weight: 600;
  color: var(--text);
}
.panel li i {
  flex: none;
  font-style: normal;
  font-size: 11px;
  color: var(--dim);
}
.panel li em {
  font-style: normal;
  font-size: 10.5px;
  color: var(--gold);
}
.precios b {
  color: var(--gold);
}
.panel--banco ul {
  max-height: 260px;
  overflow-y: auto;
}

.banca {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 9px 12px 11px;
}

.banca h2 {
  font-family: var(--f-mono);
  font-size: 9.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--dim);
  margin: 0 0 7px;
}

.banca ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.banca li {
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: 20px;
  padding: 3px 11px;
  font-size: 12.5px;
}

.banca i {
  font-style: normal;
  font-family: var(--f-mono);
  font-size: 9px;
  color: var(--dim);
  margin-left: 6px;
}

.ultima {
  margin: 0;
  font-size: 13px;
  color: var(--muted);
  display: flex;
  align-items: baseline;
  gap: 9px;
}

/* Tres columnas de paneles se quedan sin ancho antes que los equipos: aquí
   caben dos, y en el móvil de verdad se apilan con todo lo demás. */
@media (max-width: 860px) {
  .paneles {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 620px) {
  .equipos,
  .paneles {
    grid-template-columns: 1fr;
  }

  .lado b {
    font-size: 26px;
  }

  .reloj {
    font-size: 24px;
  }
}
</style>
