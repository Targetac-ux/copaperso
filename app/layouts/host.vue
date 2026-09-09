<script setup lang="ts">
const supabase = useSupabaseClient()
const router = useRouter()
const { staff } = useStaff()

const nav = [
  { to: '/host', label: 'Sesión actual', icon: '▸' },
  { to: '/host/jugadores', label: 'Jugadores', icon: '◍' },
  { to: '/host/periodos', label: 'Periodos', icon: '◷' },
  { to: '/host/roster', label: 'Roster', icon: '▤' },
  { to: '/host/tiers', label: 'Tier Manager', icon: '★' },
  { to: '/host/ajustes', label: 'Ajustes', icon: '⚙' },
]

async function logout() {
  await supabase.auth.signOut()
  await router.push('/host/login')
}
</script>

<template>
  <div class="host">
    <aside class="host__rail">
      <NuxtLink to="/" class="host__brand">
        <AppLogo :size="30" />
      </NuxtLink>

      <nav class="host__nav">
        <NuxtLink v-for="item in nav" :key="item.to" :to="item.to">
          <span aria-hidden="true">{{ item.icon }}</span>{{ item.label }}
        </NuxtLink>
      </nav>

      <div class="host__user">
        <p class="host__name">{{ staff?.display_name ?? 'Host' }}</p>
        <p class="host__role">{{ staff?.role === 'moderator' ? 'Moderador' : 'Administrador' }}</p>
        <button class="btn btn--ghost host__logout" @click="logout">Cerrar sesión</button>
      </div>
    </aside>

    <main class="host__main">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.host {
  display: grid;
  grid-template-columns: 232px minmax(0, 1fr);
  min-height: 100vh;
}

.host__rail {
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding: 20px 16px;
  border-right: 1px solid var(--line-soft);
  background: var(--panel);
  position: sticky;
  top: 0;
  height: 100vh;
}

.host__nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.host__nav a {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: var(--r-sm);
  color: var(--muted);
  font-size: 14.5px;
}

.host__nav a span {
  color: var(--dim);
  font-size: 12px;
}

.host__nav a:hover {
  background: var(--panel-2);
  color: var(--text);
}

.host__nav a.router-link-exact-active {
  background: var(--panel-3);
  color: var(--text);
}

.host__nav a.router-link-exact-active span {
  color: var(--violet);
}

.host__user {
  margin-top: auto;
  border-top: 1px solid var(--line-soft);
  padding-top: 14px;
}

.host__name {
  margin: 0;
  font-family: var(--f-display);
  font-weight: 600;
  font-size: 14px;
}

.host__role {
  margin: 0 0 10px;
  font-family: var(--f-mono);
  font-size: 10.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--dim);
}

.host__logout {
  width: 100%;
  font-size: 12.5px;
  padding: 7px 10px;
}

.host__main {
  padding: 26px 30px 60px;
  min-width: 0;
}

@media (max-width: 860px) {
  .host {
    grid-template-columns: 1fr;
  }

  .host__rail {
    position: static;
    height: auto;
    flex-direction: row;
    align-items: center;
    flex-wrap: wrap;
  }

  .host__nav {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .host__user {
    margin: 0 0 0 auto;
    border: 0;
    padding: 0;
  }

  .host__main {
    padding: 18px;
  }
}
</style>
