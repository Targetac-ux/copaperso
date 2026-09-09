<script setup lang="ts">
const nav = [
  { to: '/', label: 'Inicio' },
  { to: '/tier-ranking', label: 'Tier Ranking' },
  { to: '/reglas', label: 'Reglas' },
  { to: '/modos', label: 'Modos' },
  { to: '/premios', label: 'Premios' },
]
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
        <a class="btn btn--primary" href="https://twitch.tv" target="_blank" rel="noopener">
          Ver en Twitch
        </a>
      </div>
    </header>

    <main>
      <slot />
    </main>

    <footer class="site__footer">
      <div class="wrap site__footer-inner">
        <AppLogo :size="28" />
        <p>La copa de la comunidad, hecha por la comunidad.</p>
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

.site__hostlink {
  margin-left: auto;
  font-family: var(--f-mono);
  font-size: 12px;
  color: var(--dim);
}

.site__hostlink:hover {
  color: var(--violet);
}

@media (max-width: 760px) {
  .site__nav {
    display: none;
  }
}
</style>
