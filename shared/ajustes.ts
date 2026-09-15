import { DEFAULT_SECONDS, clampSeconds } from './timer'

/**
 * Los ajustes del panel (Fase 7).
 *
 * Tres cosas que hasta ahora exigían un despliegue: los precios de los canjeos,
 * los enlaces del sitio y la duración por defecto del cronómetro.
 *
 * Aquí solo vive lo que se puede comprobar sin base de datos: qué redes se
 * saben pintar, cómo se normaliza una URL y cómo se lee un ajuste escalar.
 */

export type Red = 'twitch' | 'paypal' | 'instagram' | 'x' | 'tiktok' | 'youtube' | 'discord'

export interface DefinicionDeRed {
  red: Red
  label: string
  /**
   * Las principales tienen su propio sitio en la página —el botón de «Ver en
   * Twitch» y el de donar— y por eso **caen a un valor por defecto si faltan**,
   * en vez de desaparecer. Las demás son la fila de iconos del pie: si no hay
   * enlace, no hay icono.
   */
  principal: boolean
  /** Lo que se escribe delante cuando el host pega solo el usuario. */
  base: string
}

export const REDES: DefinicionDeRed[] = [
  { red: 'twitch', label: 'Twitch', principal: true, base: 'https://www.twitch.tv/' },
  { red: 'paypal', label: 'PayPal', principal: true, base: 'https://paypal.me/' },
  { red: 'instagram', label: 'Instagram', principal: false, base: 'https://instagram.com/' },
  { red: 'x', label: 'X', principal: false, base: 'https://x.com/' },
  { red: 'tiktok', label: 'TikTok', principal: false, base: 'https://tiktok.com/@' },
  { red: 'youtube', label: 'YouTube', principal: false, base: 'https://youtube.com/@' },
  { red: 'discord', label: 'Discord', principal: false, base: 'https://discord.gg/' },
]

const POR_RED = new Map(REDES.map((r) => [r.red, r]))

export function esRedConocida(v: unknown): v is Red {
  return typeof v === 'string' && POR_RED.has(v as Red)
}

/** Las que van en la fila de iconos, en orden. */
export const REDES_SOCIALES = REDES.filter((r) => !r.principal)

/**
 * Convierte lo que pegue el host en una URL utilizable, o `null`.
 *
 * Acepta las tres formas en que llega un enlace: la URL entera, el dominio sin
 * protocolo (`instagram.com/copaperso`) y el usuario suelto (`@copaperso`), que
 * se pega a la base de esa red.
 *
 * **Y rechaza cualquier esquema que no sea http o https.** Esta función es la
 * única puerta por la que entra una URL a la página pública, y un
 * `javascript:...` en un enlace que se pinta en la Home es un agujero de
 * seguridad, no una errata. Por eso no basta con mirar si «parece» una
 * dirección: se comprueba el protocolo ya interpretado.
 */
export function normalizarUrl(entrada: string, red?: Red): string | null {
  const texto = entrada.trim()
  if (!texto) return null

  // Un usuario suelto solo tiene sentido si sabemos de qué red es.
  if (texto.startsWith('@')) {
    const def = red ? POR_RED.get(red) : undefined
    if (!def) return null
    const usuario = texto.slice(1).trim()
    // La base de TikTok y YouTube ya termina en @, así que no se repite.
    return usuario ? `${def.base}${usuario}` : null
  }

  // Sin esquema se asume https. Ojo: esto NO se hace si ya trae uno, porque
  // entonces «javascript:alert(1)» se convertiría en una URL válida.
  const conEsquema = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(texto) ? texto : `https://${texto}`

  let url: URL
  try {
    url = new URL(conEsquema)
  } catch {
    return null
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  // Un anfitrión sin punto no es un dominio: «https://hola» no lleva a nada.
  if (!url.hostname.includes('.')) return null

  return url.toString()
}

export interface EnlaceDeSitio {
  network: Red
  url: string
  sortOrder: number
  visible: boolean
}

/** Las claves de `setting`, en un sitio para no escribirlas a mano dos veces. */
export const CLAVES = {
  CRONOMETRO: 'timer_seconds',
} as const

/**
 * Lee la duración guardada del cronómetro.
 *
 * Los límites no se repiten aquí: los pone `clampSeconds` (5 s a 2 h), que es
 * el mismo que valida lo que el host escribe en la mesa. Sin ajuste guardado,
 * la duración de siempre.
 */
export function leerSegundos(value: string | null | undefined): number {
  if (value === null || value === undefined || value.trim() === '') return DEFAULT_SECONDS
  const n = Number(value)
  if (!Number.isFinite(n)) return DEFAULT_SECONDS
  return clampSeconds(n)
}

/**
 * El enlace de una red, o el respaldo si no hay ninguno guardado.
 *
 * Es lo que permite que la Home siga en pie con la tabla vacía —antes de
 * aplicar la migración, o si alguien borra una fila sin querer— en vez de
 * quedarse con un botón que no lleva a ningún sitio.
 */
export function enlaceDe(enlaces: EnlaceDeSitio[], red: Red, respaldo?: string): string | null {
  return enlaces.find((e) => e.network === red)?.url ?? respaldo ?? null
}
