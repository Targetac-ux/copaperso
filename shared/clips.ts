/**
 * Los clips de Twitch de la Home (§Fase 7).
 *
 * Un clip se guarda por su **slug**, que es lo único que Twitch necesita para
 * incrustarlo. Se acepta que el host pegue la URL entera —que es lo que le da
 * el botón de compartir— y aquí se extrae.
 *
 * **La pieza delicada es `parent`.** Twitch se niega a reproducir un clip
 * incrustado si el dominio de la página no viene declarado en la URL del
 * iframe, y no admite comodines: `*.vercel.app` no vale. Como todavía no hay
 * dominio propio y cada despliegue de previsualización de Vercel estrena
 * subdominio, el valor no se puede escribir a mano en ningún sitio: se lee del
 * navegador en el momento de montar el iframe. Así funciona igual en local, en
 * una previsualización y el día que haya dominio, sin tocar nada.
 */

/** Letras, dígitos, guión y guión bajo: lo que Twitch usa para los slugs. */
const SLUG = /^[A-Za-z0-9_-]{4,150}$/

/** Los dos anfitriones de los que sale un enlace de clip. */
const ANFITRIONES = new Set(['clips.twitch.tv', 'twitch.tv', 'www.twitch.tv', 'm.twitch.tv'])

export function esSlug(v: unknown): v is string {
  return typeof v === 'string' && SLUG.test(v)
}

/**
 * Saca el slug de lo que sea que haya pegado el host.
 *
 * Acepta las formas que reparte Twitch —`clips.twitch.tv/SLUG`,
 * `twitch.tv/canal/clip/SLUG`, el `embed?clip=SLUG`— con o sin parámetros
 * detrás, y también el slug suelto. Cualquier otra cosa devuelve `null`, para
 * que el host vea un aviso en vez de una caja negra en la Home.
 */
export function slugDeUrl(entrada: string): string | null {
  const texto = entrada.trim()
  if (!texto) return null

  // El slug suelto, que es lo que queda si alguien copia solo el final.
  if (!texto.includes('/') && !texto.includes('?')) return esSlug(texto) ? texto : null

  let url: URL
  try {
    url = new URL(texto.startsWith('http') ? texto : `https://${texto}`)
  } catch {
    return null
  }

  if (!ANFITRIONES.has(url.hostname.toLowerCase())) return null

  // .../embed?clip=SLUG
  const deParametro = url.searchParams.get('clip')
  if (deParametro) return esSlug(deParametro) ? deParametro : null

  const partes = url.pathname.split('/').filter(Boolean)

  // twitch.tv/CANAL/clip/SLUG
  const iClip = partes.indexOf('clip')
  if (iClip >= 0) {
    const slug = partes[iClip + 1]
    return slug && esSlug(slug) ? slug : null
  }

  // clips.twitch.tv/SLUG
  if (url.hostname.toLowerCase() === 'clips.twitch.tv' && partes.length === 1) {
    return esSlug(partes[0]!) ? partes[0]! : null
  }

  return null
}

/**
 * El dominio tal y como lo quiere Twitch: sin puerto, sin protocolo y en
 * minúsculas. `localhost` vale y es lo que se usa al desarrollar.
 */
export function dominioPadre(hostname: string): string | null {
  const limpio = hostname.trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '')
  if (!limpio) return null
  if (limpio === 'localhost') return limpio
  // Un dominio de verdad: etiquetas separadas por puntos, sin espacios.
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(limpio) ? limpio : null
}

/** La URL del iframe. Sin `parent` válido no hay nada que montar. */
export function urlDeIncrustado(
  slug: string,
  hostname: string,
  opciones: { autoplay?: boolean } = {},
): string | null {
  if (!esSlug(slug)) return null
  const padre = dominioPadre(hostname)
  if (!padre) return null

  const q = new URLSearchParams({
    clip: slug,
    parent: padre,
    autoplay: String(opciones.autoplay ?? false),
  })
  return `https://clips.twitch.tv/embed?${q}`
}

/** El enlace para verlo en Twitch, que es el respaldo si el iframe no carga. */
export function urlDeClip(slug: string): string {
  return `https://clips.twitch.tv/${encodeURIComponent(slug)}`
}

export interface Clip {
  id: string
  slug: string
  title: string
  edition: string | null
  sortOrder: number
  visible: boolean
}

/**
 * Cuántos se enseñan en la Home. No es un límite de la base: es que cada clip
 * carga un reproductor entero de Twitch, y una fila de seis ya es más de lo que
 * nadie mira.
 */
export const MAX_EN_HOME = 6

/**
 * Sube o baja un clip una posición y **renumera la lista entera**, igual que en
 * el Tier Manager: el orden es relativo, así que mover a uno cambia a su vecino.
 * Devolver toda la lista es lo que permite comprobarlo sin pantalla ni base.
 */
export function mover<T extends { id: string; sortOrder: number }>(
  lista: T[],
  id: string,
  direccion: -1 | 1,
): T[] {
  const ordenada = [...lista].sort((a, b) => a.sortOrder - b.sortOrder)
  const i = ordenada.findIndex((c) => c.id === id)
  if (i < 0) return lista

  const j = i + direccion
  // En los extremos no pasa nada: se devuelve la misma lista, no un error.
  if (j < 0 || j >= ordenada.length) return lista

  ordenada.splice(j, 0, ordenada.splice(i, 1)[0]!)
  return ordenada.map((c, k) => ({ ...c, sortOrder: k }))
}

/** Solo las filas cuyo orden cambió, para no escribir de más. */
export function cambios<T extends { id: string; sortOrder: number }>(
  antes: T[],
  despues: T[],
): { id: string; sortOrder: number }[] {
  const previo = new Map(antes.map((c) => [c.id, c.sortOrder]))
  return despues
    .filter((c) => previo.get(c.id) !== c.sortOrder)
    .map((c) => ({ id: c.id, sortOrder: c.sortOrder }))
}
