/**
 * Los patch notes de las reglas.
 *
 * Las reglas de la CopaPerso no son fijas: cada cierto tiempo se añade algo o
 * se quita. En vez de reescribir la página de reglas en silencio —y dejar a la
 * gente sin saber qué cambió— cada tanda de cambios queda publicada con su
 * fecha, como las notas de parche de un juego.
 *
 * El cuerpo se escribe como texto suelto, una línea por cambio. Una línea que
 * empieza por `+` es algo que entra y una que empieza por `-` es algo que sale;
 * el resto es texto normal. Es la convención de los changelogs de toda la vida y
 * no obliga al host a aprender ningún formato: escribe la lista y ya.
 *
 * **El detalle vive en un vídeo.** El host graba cada parche y lo explica ahí,
 * así que lo de aquí es el resumen para leer de un vistazo y el vídeo es la
 * versión completa. El vídeo es opcional: un parche de dos líneas no necesita
 * uno.
 */

export interface PatchNote {
  id: string
  version: string | null
  title: string
  publishedAt: string | null
  body: string
  /**
   * El **id** del vídeo de YouTube donde el host lo explica, no la URL: la URL
   * cambia de forma según de dónde la copies, y del id salen tanto el
   * reproductor como la miniatura. Opcional.
   */
  videoId: string | null
}

export type TipoDeLinea = 'añade' | 'quita' | 'texto'

export interface LineaDeParche {
  tipo: TipoDeLinea
  texto: string
}

/**
 * Parte el cuerpo en líneas y dice de qué tipo es cada una.
 *
 * Las líneas en blanco se van: sirven para respirar al escribir, no para pintar
 * huecos. Y el signo se quita del texto, que ya lo dice el color.
 */
export function leerCuerpo(body: string): LineaDeParche[] {
  return body
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((linea) => {
      // Se exige el espacio para no confundir un signo con un menos de verdad:
      // «-15 LP por derrota» es texto, no una línea de algo que se quita.
      if (linea.startsWith('+ ')) return { tipo: 'añade' as const, texto: linea.slice(2).trim() }
      if (linea.startsWith('- ')) return { tipo: 'quita' as const, texto: linea.slice(2).trim() }
      return { tipo: 'texto' as const, texto: linea }
    })
}

/** Cuántos cambios trae, para el resumen de la lista del panel. */
export function contarCambios(body: string): { añade: number; quita: number } {
  const lineas = leerCuerpo(body)
  return {
    añade: lineas.filter((l) => l.tipo === 'añade').length,
    quita: lineas.filter((l) => l.tipo === 'quita').length,
  }
}

/** De la más reciente a la más vieja; las sin publicar, primero. */
export function ordenar<T extends { publishedAt: string | null }>(notas: T[]): T[] {
  return [...notas].sort((a, b) => {
    if (!a.publishedAt && !b.publishedAt) return 0
    if (!a.publishedAt) return -1
    if (!b.publishedAt) return 1
    return b.publishedAt.localeCompare(a.publishedAt)
  })
}

// --- el vídeo ---------------------------------------------------------------

/** Los anfitriones de los que sale un enlace de YouTube. */
const YOUTUBE = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
])

/** Un id de vídeo son once caracteres de este alfabeto. */
const ID = /^[A-Za-z0-9_-]{11}$/

/**
 * Saca el id del vídeo de lo que sea que haya pegado el host.
 *
 * Acepta las formas que reparte YouTube —`watch?v=`, `youtu.be/`, `/embed/`,
 * `/shorts/`, `/live/`— con los parámetros que vengan detrás. Cualquier otra
 * cosa devuelve `null`, para que el host vea un aviso en vez de un recuadro
 * negro en la web.
 *
 * Se guarda **el id y no la URL**: la URL cambia de forma según de dónde la
 * copies, y con el id se construye tanto el reproductor como la miniatura.
 */
export function idDeYoutube(entrada: string): string | null {
  const texto = entrada.trim()
  if (!texto) return null

  // El id suelto, que es lo que queda si copian solo el final.
  if (!texto.includes('/') && !texto.includes('?')) return ID.test(texto) ? texto : null

  let url: URL
  try {
    url = new URL(texto.startsWith('http') ? texto : `https://${texto}`)
  } catch {
    return null
  }

  if (!YOUTUBE.has(url.hostname.toLowerCase())) return null

  const deParametro = url.searchParams.get('v')
  if (deParametro) return ID.test(deParametro) ? deParametro : null

  const partes = url.pathname.split('/').filter(Boolean)
  // youtu.be/ID, /embed/ID, /shorts/ID, /live/ID, /v/ID
  const candidato =
    url.hostname.toLowerCase().endsWith('youtu.be')
      ? partes[0]
      : ['embed', 'shorts', 'live', 'v'].includes(partes[0] ?? '')
        ? partes[1]
        : undefined

  return candidato && ID.test(candidato) ? candidato : null
}

/**
 * La portada del vídeo. `hqdefault` existe siempre; `maxresdefault` solo si el
 * vídeo se subió en alta, y cuando no está devuelve un 404 que se vería como
 * una imagen rota.
 */
export function miniaturaDeYoutube(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
}

/**
 * El reproductor. `youtube-nocookie.com` no deja cookies hasta que se le da al
 * play, y aquí el play siempre lo da la persona.
 */
export function incrustadoDeYoutube(id: string, autoplay = false): string {
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0${autoplay ? '&autoplay=1' : ''}`
}

/** El enlace para verlo en YouTube, que es el respaldo si el iframe no carga. */
export function urlDeYoutube(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`
}
