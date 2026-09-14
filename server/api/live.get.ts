import { cargarEnVivo } from '../utils/live'

/**
 * El estado público de la sesión. **Sin autenticación a propósito.**
 *
 * Sirve para dos cosas: pintar la página la primera vez (también en el
 * servidor, para que se vea algo antes de que arranque el JavaScript) y
 * resincronizar cuando el espectador recupera la conexión y se ha perdido
 * avisos por el camino.
 *
 * Devuelve exactamente lo mismo que viaja por el canal de broadcast, pasado por
 * la misma auditoría.
 */
export default defineEventHandler(async (event) => {
  return await cargarEnVivo(event)
})
