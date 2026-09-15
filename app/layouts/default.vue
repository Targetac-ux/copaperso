<script setup lang="ts">
import { CANAL_TWITCH, CANAL_TWITCH_NOMBRE } from '#shared/enlaces'

const nav = [
  { to: '/', label: 'Inicio' },
  { to: '/en-vivo', label: 'En vivo' },
  { to: '/tier-ranking', label: 'Tier Ranking' },
  { to: '/reglas', label: 'Reglas' },
  { to: '/modos', label: 'Modos' },
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
watch(() => ruta.fullPath, () => (abierto.value = false))
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
        <a class="btn btn--primary site__twitch" :href="CANAL_TWITCH" target="_blank" rel="noopener">
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
        <a class="site__movil-canal" :href="CANAL_TWITCH" target="_blank" rel="noopener">
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
        <p>La copa de la comunidad, hecha por la comunidad.</p>
        <a class="site__canal" :href="CANAL_TWITCH" target="_blank" rel="noopener">
          <AppBrandIcon name="twitch" :size="18" />
          <span>{{ CANAL_TWITCH_NOMBRE }}</span>
        </a>
        <NuxtLink to="/host" class="site__hostlink">Acceso host</NuxtLink>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.site {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
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

.site__footer p {
  margin: 0;
  color: var(--dim);
  font-size: 14px;
}

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

.site__hostlink {
  font-family: var(--f-mono);
  font-size: 12px;
  color: var(--dim);
}

.site__hostlink:hover {
  color: var(--violet);
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
  transition: transform 0.18s ease, opacity 0.18s ease;
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
