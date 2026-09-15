<script setup lang="ts">
/**
 * Los logotipos de Twitch y PayPal.
 *
 * Van **en línea y no como `<img>`** a propósito: así heredan el color del
 * texto del botón con `currentColor`, y el mismo icono sirve sobre el morado
 * del botón principal y sobre el gris del pie sin tener dos archivos.
 *
 * Los trazos son los oficiales de cada marca, tomados de la colección
 * `simple-icons` (v16.31.0). Se copian aquí en vez de depender del paquete
 * entero —son miles de iconos para usar dos— y por eso queda anotado de dónde
 * salen, que es lo que hace falta para poder actualizarlos.
 *
 * Uso referencial: marcan el enlace al canal y el medio de pago. Van en una
 * sola tinta, que es como ambas marcas permiten usarlos sobre color.
 */
const TRAZOS = {
  twitch: {
    label: 'Twitch',
    d: 'M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z',
  },
  paypal: {
    label: 'PayPal',
    d: 'M15.607 4.653H8.941L6.645 19.251H1.82L4.862 0h7.995c3.754 0 6.375 2.294 6.473 5.513-.648-.478-2.105-.86-3.722-.86m6.57 5.546c0 3.41-3.01 6.853-6.958 6.853h-2.493L11.595 24H6.74l1.845-11.538h3.592c4.208 0 7.346-3.634 7.153-6.949a5.24 5.24 0 0 1 2.848 4.686',
  },
} as const

withDefaults(defineProps<{ name: keyof typeof TRAZOS; size?: number }>(), { size: 16 })
</script>

<template>
  <svg
    class="marca"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
  ><path :d="TRAZOS[name].d" /></svg>
</template>

<style scoped>
.marca {
  display: block;
  flex: none;
}
</style>
