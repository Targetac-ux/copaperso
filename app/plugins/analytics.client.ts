import { injectAnalytics } from '@vercel/analytics/nuxt/runtime'
import { seMide } from '#shared/analytics'

/**
 * Analytics de Vercel, solo para el sitio público.
 *
 * Se monta a mano en vez de con el módulo `@vercel/analytics/nuxt` porque el
 * módulo mide todas las rutas, y el panel del host no tiene por qué salir en un
 * panel de métricas: lo usa una sola persona, así que no dice nada de la
 * audiencia y ensucia lo que sí importa. `beforeSend` descarta esas vistas
 * antes de que salgan del navegador.
 *
 * Fuera de Vercel el script no existe y la llamada no hace nada, así que en
 * local no molesta.
 */
export default defineNuxtPlugin(() => {
  injectAnalytics({
    beforeSend: (evento) => (seMide(evento.url) ? evento : null),
  })
})
