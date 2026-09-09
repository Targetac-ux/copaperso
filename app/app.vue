<script setup lang="ts">
/**
 * Marca el documento cuando Vue ha hidratado. Los tests de punta a punta lo
 * esperan antes de hacer clic: sin esto, Playwright pulsa botones que todavía
 * no tienen manejador y el test falla sin que haya nada roto.
 */
onMounted(() => {
  document.documentElement.dataset.hydrated = 'true'
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
