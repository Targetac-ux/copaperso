/**
 * Qué se mide y qué no.
 *
 * El panel del host lo usa una sola persona: sus visitas no dicen nada de la
 * audiencia y ensucian las métricas del sitio público. Se filtran antes de que
 * salgan del navegador.
 *
 * Va aquí, y no dentro del plugin, para poder comprobarlo: una regla que decide
 * qué datos se envían fuera no debería vivir sin test.
 */
export function seMide(url: string): boolean {
  let ruta: string
  try {
    // El evento trae la URL completa; si viniera solo la ruta, la base sobra.
    ruta = new URL(url, 'http://copaperso.invalid').pathname
  } catch {
    return false
  }

  return ruta !== '/host' && !ruta.startsWith('/host/')
}
