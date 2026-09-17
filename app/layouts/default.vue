<script setup lang="ts">
import { CANAL_TWITCH_NOMBRE } from '#shared/enlaces'

const { twitch, sociales } = useEnlaces()

/**
 * La versión que se enseña en el pie, `major.minor`.
 *
 * Sale de `package.json` por `runtimeConfig` (ver nuxt.config.ts). Se corta el
 * parche porque semver obliga a tres números y el tercero no le dice nada a
 * quien visita la página.
 *
 * **No confundir con la versión de los patch notes**, que es la de las reglas
 * y la escribe el host en `/host/patch-notes`. Son dos numeraciones distintas
 * a propósito: una cuenta cómo cambia el sitio y la otra cómo cambia el
 * torneo.
 */
const version = computed(() => {
  const v = String(useRuntimeConfig().public.version ?? '')
  const [mayor, menor] = v.split('.')
  return mayor ? `v${mayor}.${menor ?? 0}` : ''
})

const nav = [
  { to: '/', label: 'Inicio' },
  { to: '/en-vivo', label: 'En vivo' },
  { to: '/tier-ranking', label: 'Tier Ranking' },
  { to: '/historico', label: 'Histórico' },
  { to: '/reglas', label: 'Reglas' },
  { to: '/patch-notes', label: 'Patch notes' },
  { to: '/premios', label: 'Premios' },
]

/**
 * El menú de móvil.
 *
 * Por debajo de 760 px la fila de enlaces no cabe junto al logo y al botón de
 * Twitch, así que se pliega detrás de este botón. Antes simplemente se
 * escondía y no la sustituía nada: desde un teléfono solo se llegaba a la
 * portada.
 */
const abierto = ref(false)
const ruta = useRoute()

// Al cambiar de página se cierra solo: si no, el menú tapa lo que acabas de
// abrir. Y con Escape, que es lo que espera cualquiera con un panel abierto.
watch(
  () => ruta.fullPath,
  () => (abierto.value = false),
)
onMounted(() => {
  const alPulsar = (e: KeyboardEvent) => {
    if (e.key === 'Escape') abierto.value = false
  }
  window.addEventListener('keydown', alPulsar)
  onBeforeUnmount(() => window.removeEventListener('keydown', alPulsar))
})
</script>

<template>
  <div class="site">
    <header class="site__header">
      <div class="wrap site__bar">
        <NuxtLink to="/" aria-label="CopaPerso, inicio">
          <AppLogo :size="34" />
        </NuxtLink>
        <nav class="site__nav">
          <NuxtLink v-for="item in nav" :key="item.to" :to="item.to">{{ item.label }}</NuxtLink>
        </nav>
        <!-- El `aria-label` no es de adorno: en móvil el texto se esconde para
             que quepa junto al menú, y sin él el enlace se queda sin nombre
             —solo el icono, que es decorativo— y un lector de pantalla lo
             anuncia como «enlace». -->
        <a
          class="btn btn--primary site__twitch"
          :href="twitch"
          target="_blank"
          rel="noopener"
          aria-label="Ver en Twitch"
        >
          <AppBrandIcon name="twitch" />
          <span>Ver en Twitch</span>
        </a>

        <button
          class="site__menu"
          type="button"
          :aria-expanded="abierto"
          aria-controls="menu-movil"
          aria-label="Menú"
          @click="abierto = !abierto"
        >
          <span class="site__hamburguesa" :class="{ 'is-x': abierto }" aria-hidden="true" />
        </button>
      </div>

      <nav v-show="abierto" id="menu-movil" class="site__movil">
        <NuxtLink v-for="item in nav" :key="item.to" :to="item.to">{{ item.label }}</NuxtLink>
        <a class="site__movil-canal" :href="twitch" target="_blank" rel="noopener">
          <AppBrandIcon name="twitch" :size="17" />
          <span>Ver en Twitch</span>
        </a>
      </nav>
    </header>

    <main>
      <slot />
    </main>

    <footer class="site__footer">
      <div class="wrap site__footer-inner">
        <AppLogo :size="28" />
        <a class="site__canal" :href="twitch" target="_blank" rel="noopener">
          <AppBrandIcon name="twitch" :size="18" />
          <span>{{ CANAL_TWITCH_NOMBRE }}</span>
        </a>

        <!-- Solo las redes que tienen enlace puesto en Ajustes: una fila de
             iconos que no llevan a ningún sitio es peor que no tenerla. -->
        <ul v-if="sociales.length" class="site__redes">
          <li v-for="r in sociales" :key="r.red">
            <a :href="r.url" target="_blank" rel="noopener" :aria-label="r.label">
              <AppBrandIcon :name="r.red" :size="18" />
            </a>
          </li>
        </ul>

        <span v-if="version" class="site__version">{{ version }}</span>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.site {
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/**
 * La textura del fondo: el panal, detrás de toda la web pública.
 *
 * **Una sola copia que cubre la pantalla, no un mosaico.** La imagen no casa
 * por los bordes —al repetirla se ve la costura, una retícula de líneas cada
 * pocos cientos de píxeles— así que se pinta una sola vez.
 *
 * El tamaño va en `vmax` y no en `cover`: `cover` encogía el dibujo hasta que
 * las líneas del panal bajaban de un píxel y se perdían. `100vmax` es el
 * mínimo que tapa la pantalla entera sea cual sea la proporción —también un
 * teléfono muy alto— y deja el panal al mayor tamaño posible sin repetirlo.
 *
 * Y va en un pseudoelemento **fijo**: así no se desplaza al hacer scroll, la
 * página entera comparte el mismo fondo, y un teléfono no tiene que repintar el
 * patrón en cada píxel de scroll.
 *
 * El brillo se sube porque la imagen viene casi del mismo color que el fondo y
 * tal cual no se distingue nada; con esto el panal se insinúa sin tapar lo que
 * hay encima. `pointer-events: none` y `z-index: -1`: es fondo, no capa.
 *
 * Solo en la web pública. El panel del host es una mesa de trabajo, y ahí un
 * patrón detrás de diez paneles de datos sería ruido.
 */
.site::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background: url('/backgrounds/textura.webp') center / 100vmax 100vmax no-repeat;
  /* La imagen viene casi del color del fondo; sin esto el panal no se
     distingue y queda un cambio de color y nada más. */
  filter: brightness(1.35);
}

.site__header {
  position: sticky;
  top: 0;
  z-index: 20;
  background: rgba(7, 10, 24, 0.85);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--line-soft);
}

.site__bar {
  display: flex;
  align-items: center;
  gap: 20px;
  height: 66px;
}

.site__nav {
  display: flex;
  gap: 4px;
  margin-left: auto;
}

.site__nav a {
  padding: 8px 12px;
  border-radius: var(--r-sm);
  font-size: 14.5px;
  color: var(--muted);
}

.site__nav a:hover {
  color: var(--text);
  background: var(--panel);
}

.site__nav a.router-link-active {
  color: var(--text);
}

main {
  flex: 1;
}

.site__footer {
  border-top: 1px solid var(--line-soft);
  margin-top: 80px;
  padding: 28px 0;
}

.site__footer-inner {
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
}

/* El canal y las redes se van al extremo opuesto del logo: el pie es
   marca a un lado, dónde encontrarnos al otro. Antes empujaba el enlace
   «Acceso host», que ya no está —al espectador no le decía nada, y
   esconderlo no protege nada: las rutas del panel viajan igualmente en el
   JavaScript. Lo que protege el panel es la sesión y el RLS. */
.site__canal {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin-left: auto;
  font-size: 13.5px;
  color: var(--muted);
}

.site__canal:hover {
  color: #a970ff;
}

.site__redes {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  gap: 4px;
}

.site__redes a {
  display: flex;
  padding: 8px;
  border-radius: var(--r-sm);
  color: var(--dim);
}

.site__redes a:hover {
  color: var(--text);
  background: var(--panel);
}

.site__version {
  font-family: var(--f-mono);
  font-size: 11px;
  color: var(--dim);
  /* Separada de los iconos, que están pegados entre sí a propósito. */
  margin-left: 4px;
}

/* El botón de la hamburguesa solo existe en móvil; en escritorio manda la
   fila de enlaces. */
.site__menu {
  display: none;
  background: none;
  border: 0;
  padding: 10px 4px;
  cursor: pointer;
  color: var(--text);
}

/* Tres rayas que se cruzan al abrir: la de en medio se desvanece y las otras
   dos giran sobre el mismo punto. */
.site__hamburguesa,
.site__hamburguesa::before,
.site__hamburguesa::after {
  display: block;
  width: 22px;
  height: 2px;
  border-radius: 2px;
  background: currentColor;
  transition:
    transform 0.18s ease,
    opacity 0.18s ease;
}

.site__hamburguesa::before,
.site__hamburguesa::after {
  content: '';
  position: relative;
}

.site__hamburguesa::before {
  top: -7px;
}

.site__hamburguesa::after {
  top: 5px;
}

.site__hamburguesa.is-x {
  background: transparent;
}

.site__hamburguesa.is-x::before {
  top: -2px;
  transform: rotate(45deg);
}

.site__hamburguesa.is-x::after {
  top: -4px;
  transform: rotate(-45deg);
}

.site__movil {
  display: none;
}

@media (max-width: 760px) {
  .site__nav {
    display: none;
  }

  .site__menu {
    display: block;
  }

  /* El botón de Twitch se queda, pero solo con el logo: el texto no cabe al
     lado de la hamburguesa y el icono ya dice a dónde va. Los dos se van a la
     derecha, que es donde el pulgar los alcanza. */
  .site__twitch {
    margin-left: auto;
    padding: 9px 12px;
  }

  .site__twitch span {
    display: none;
  }

  .site__movil {
    display: flex;
    flex-direction: column;
    padding: 6px 24px 14px;
    border-top: 1px solid var(--line-soft);
  }

  .site__movil a {
    padding: 13px 4px;
    font-size: 16px;
    color: var(--muted);
    border-bottom: 1px solid var(--line-soft);
  }

  .site__movil a:last-child {
    border-bottom: 0;
  }

  .site__movil a.router-link-active {
    color: var(--text);
  }

  .site__movil-canal {
    display: flex;
    align-items: center;
    gap: 9px;
    color: #a970ff !important;
  }
}
</style>
