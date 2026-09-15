<script setup lang="ts">
/**
 * Marca el documento cuando Vue ha hidratado. Los tests de punta a punta lo
 * esperan antes de hacer clic: sin esto, Playwright pulsa botones que todavía
 * no tienen manejador y el test falla sin que haya nada roto. c:
 */
onMounted(() => {
  document.documentElement.dataset.hydrated = 'true'
})

/**
 * La imagen de vista previa, **con la dirección entera**.
 *
 * Estaba puesta como `/brand/og-image.jpg` a secas, y así no funciona: al pegar
 * el enlace en Discord, X o WhatsApp, quien lee la etiqueta no está en nuestro
 * dominio y no sabe contra qué resolver una ruta relativa, así que sale una
 * tarjeta sin imagen. Se construye con `NUXT_PUBLIC_SITE_URL`, que es justo
 * para lo que existe y lo que habrá que cambiar el día que haya dominio.
 */
const { siteUrl } = useRuntimeConfig().public
const ruta = useRoute()

useSeoMeta({
  ogImage: `${siteUrl}/brand/og-image.jpg`,
  ogUrl: () => `${siteUrl}${ruta.path}`,
  twitterImage: `${siteUrl}/brand/og-image.jpg`,
  ogSiteName: 'CopaPerso',
  ogLocale: 'es_MX',
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
