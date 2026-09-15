export default defineNuxtConfig({
  compatibilityDate: '2026-09-01',
  devtools: { enabled: true },

  modules: ['@nuxtjs/supabase', '@nuxt/eslint', '@nuxt/fonts'],

  css: ['~/assets/css/main.css'],

  // El área del host está protegida por el módulo; el resto del sitio es público.
  supabase: {
    types: '~~/shared/types/database.types.d.ts',
    redirectOptions: {
      login: '/host/login',
      callback: '/host',
      include: ['/host', '/host/**'],
      exclude: ['/host/login'],
    },
  },

  fonts: {
    families: [
      { name: 'Chakra Petch', provider: 'google', weights: [500, 600, 700] },
      { name: 'Barlow', provider: 'google', weights: [400, 500, 600] },
      { name: 'JetBrains Mono', provider: 'google', weights: [400, 500, 700] },
    ],
  },

  runtimeConfig: {
    // La llave secreta la gestiona el módulo de Supabase (SUPABASE_SECRET_KEY)
    // y nunca sale del servidor.
    public: {
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'es' },
      titleTemplate: '%s · CopaPerso',
      title: 'La copa de la comunidad',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#070A18' },
        {
          name: 'description',
          content:
            'CopaPerso: el torneo comunitario 5v5 de League of Legends. Draft en vivo, negociación con bits y puro soloQ.',
        },
        { property: 'og:type', content: 'website' },
        // La og:image se pone en app.vue con la dirección entera: una ruta
        // relativa no la resuelve nadie fuera de este dominio.
        { name: 'twitter:card', content: 'summary_large_image' },
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/brand/favicon-32.png' },
        { rel: 'apple-touch-icon', href: '/brand/favicon-180.png' },
      ],
    },
  },

  /**
   * La vista en vivo se pinta en el navegador, no en el servidor.
   *
   * Todo lo que enseña cambia cada pocos segundos y llega por un canal de
   * Realtime, así que el HTML del servidor nace caducado: lo único que aportaba
   * era un parpadeo al hidratar y un cronómetro con la hora del servidor.
   */
  routeRules: {
    '/en-vivo': { ssr: false },
    /**
     * `/modos` era una página en obra y su sitio en el menú lo ocupan ahora los
     * patch notes. Los modos no desaparecen: están explicados dentro de las
     * reglas, así que la dirección vieja lleva ahí en vez de dar un 404 a quien
     * la tenga guardada.
     */
    '/modos': { redirect: { to: '/reglas', statusCode: 301 } },
  },

  nitro: { preset: process.env.VERCEL ? 'vercel' : undefined },
})
