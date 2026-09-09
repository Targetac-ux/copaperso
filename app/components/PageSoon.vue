<script setup lang="ts">
/**
 * Marcador de sección aún no construida. Existe para que la navegación no
 * tenga enlaces rotos mientras se levantan las fases: es más honesto decir
 * "llega en la Fase 5" que dar un 404.
 */
defineProps<{ title: string; phase: string; host?: boolean }>()
</script>

<template>
  <div class="soon" :class="{ 'soon--host': host }">
    <p class="eyebrow">Fase {{ phase }}</p>
    <h1>{{ title }}</h1>
    <p class="soon__text">
      Esta sección todavía no está construida. Llega en la
      <strong>Fase {{ phase }}</strong> del plan de desarrollo.
    </p>
    <NuxtLink v-if="!host" class="btn btn--ghost" to="/">Volver al inicio</NuxtLink>
    <NuxtLink v-else class="btn btn--ghost" to="/host">Volver al panel</NuxtLink>
  </div>
</template>

<style scoped>
.soon {
  max-width: var(--wrap);
  margin: 0 auto;
  padding: 90px 24px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 14px;
}

.soon--host {
  padding: 40px 0;
}

h1 {
  font-size: 32px;
  font-weight: 600;
  margin: 0;
}

.soon__text {
  color: var(--muted);
  max-width: 52ch;
  margin: 0;
}

.soon__text strong {
  color: var(--text);
  font-weight: 600;
}
</style>
