<script setup lang="ts">
/**
 * Los iconos del torneo: bits, subs, MVP, ACE, cárcel, cementerio, préstamo,
 * dado y el Blue Shell.
 *
 * Van como `<img>` y no en línea —al revés que `AppBrandIcon`— porque **son
 * ilustraciones a varios colores**, no glifos de una tinta: no tienen que
 * heredar el color del texto, y dejarlos como imagen deja que el navegador los
 * cachee y los cargue en paralelo.
 *
 * Son decorativos: acompañan a una etiqueta que ya dice lo mismo en palabras,
 * así que llevan `alt=""` y no se leen dos veces con un lector de pantalla.
 * Si alguna vez uno va solo, sin texto al lado, ahí sí hay que ponerle `alt`.
 *
 * El Blue Shell es el único que no es SVG: viene del generador de imágenes como
 * PNG, y su SVG vectorizado pesaba 210 kB, así que no se publica.
 */
const FORMATO: Record<string, 'svg' | 'webp'> = { 'blue-shell': 'webp' }

withDefaults(
  defineProps<{
    name: 'bits' | 'sub' | 'mvp' | 'ace' | 'carcel' | 'cementerio' | 'prestamo' | 'dado' | 'blue-shell'
    size?: number
  }>(),
  { size: 22 },
)
</script>

<template>
  <img
    class="icono"
    :src="`/ui/${name}.${FORMATO[name] ?? 'svg'}`"
    alt=""
    :width="size"
    :height="size"
    loading="lazy"
    decoding="async"
  >
</template>

<style scoped>
.icono {
  display: block;
  flex: none;
  object-fit: contain;
}
</style>
