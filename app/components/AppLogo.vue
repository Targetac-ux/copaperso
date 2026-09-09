<script setup lang="ts">
/**
 * El escudo viene de assets/brand/isotipo.svg; la palabra la ponemos con
 * tipografía real (Chakra Petch), no como imagen: así se lee nítida a
 * cualquier tamaño y no depende de que la IA escriba bien las letras.
 */
withDefaults(defineProps<{ size?: number; wordmark?: boolean }>(), {
  size: 36,
  wordmark: true,
})
</script>

<template>
  <span class="logo">
    <img
      src="/brand/isotipo.svg"
      alt="CopaPerso"
      :width="size"
      :height="size"
      :style="{ width: `${size}px`, height: `${size}px` }"
    >
    <span v-if="wordmark" class="logo__word" :style="{ fontSize: `${size * 0.44}px` }">
      Copa<b>Perso</b>
    </span>
  </span>
</template>

<style scoped>
.logo {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.logo img {
  flex: none;
}

.logo__word {
  font-family: var(--f-display);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text);
  line-height: 1;
}

.logo__word b {
  font-weight: 700;
  color: var(--gold);
}
</style>
