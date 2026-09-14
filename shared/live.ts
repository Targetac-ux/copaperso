import type { PlayerRoleDb } from './types/database.types'

/**
 * Lo que ve el público (Fase 4B).
 *
 * El espectador no tiene cuenta, así que todo lo que llegue aquí es, a efectos
 * prácticos, público para siempre. Por eso la vista en vivo **no lee tablas por
 * Realtime**: el servidor arma este objeto y lo publica por un canal de
 * broadcast. Un fallo de RLS no puede filtrar nada que no esté aquí dentro,
 * porque el espectador nunca consulta la base.
 *
 * Y para que esto no se erosione con el tiempo, `auditarEnVivo` revisa el
 * objeto antes de publicarlo: si alguien añade un campo privado, no sale.
 */

export interface MiembroEnVivo {
  displayName: string
  role: PlayerRoleDb
  isOffRole: boolean
}

export interface EquipoEnVivo {
  teamNumber: 1 | 2
  members: MiembroEnVivo[]
}

export interface CronometroEnVivo {
  endsAt: string | null
  remaining: number | null
  seconds: number
  running: boolean
}

export interface EnVivo {
  /** `false` cuando no hay ninguna sesión abierta: la página lo dice y ya está. */
  hay: boolean
  sesion: { number: number; mode: string } | null
  equipos: EquipoEnVivo[]
  /** Quien espera turno. Solo los de la banca: ni cárcel ni cementerio salen. */
  banca: { displayName: string; roles: PlayerRoleDb[] }[]
  marcador: { t1: number; t2: number }
  partida: { numero: number; enJuego: boolean } | null
  cronometro: CronometroEnVivo
  /** El ×3 de la negociación, sin cantidades: es parte del espectáculo. */
  preciosTriplicados: boolean
  ultimaAccion: string | null
  at: string
}

export const EN_VIVO_VACIO: EnVivo = {
  hay: false,
  sesion: null,
  equipos: [],
  banca: [],
  marcador: { t1: 0, t2: 0 },
  partida: null,
  cronometro: { endsAt: null, remaining: null, seconds: 900, running: false },
  preciosTriplicados: false,
  ultimaAccion: null,
  at: '',
}

/**
 * Las acciones cuyo resumen puede leer el público.
 *
 * Es una lista blanca a propósito. El resumen de una acción es texto libre
 * escrito para el host —«Movimiento en el banco: −200 bits»— y publicarlo todo
 * filtraría justo lo que esta vista no debe enseñar. Solo estas salen, y son
 * también las únicas que provocan un aviso al público.
 */
export const ACCIONES_PUBLICAS = [
  'session.create',
  'session.join',
  'participation.create',
  'draft.assign',
  'draft.move',
  'draft.bench',
  'draft.bench_all',
  'draft.swap',
  'match.start',
  'match.finish',
  'timer.start',
  'timer.pause',
  'timer.reset',
  'prices.triple',
  'prices.restore',
  'blue_shell.save',
  'undo',
] as const

/**
 * Deshacer sí cambia lo que se ve, así que tiene que avisar al público. Pero su
 * resumen es «Deshecho: …» seguido del resumen original, que puede ser el de un
 * movimiento del banco. Se publica el hecho, no el texto.
 */
const RESUMEN_FIJO: Record<string, string> = {
  undo: 'Se deshizo la última acción',
}

/** El texto que puede leer el público, o `null` si esa acción no cuenta nada. */
export function resumenPublico(actionType: string, summary: string): string | null {
  if (!esAccionPublica(actionType)) return null
  return RESUMEN_FIJO[actionType] ?? summary
}

export function esAccionPublica(actionType: string): boolean {
  return (ACCIONES_PUBLICAS as readonly string[]).includes(actionType)
}

/**
 * Palabras que no pueden aparecer **como nombre de campo** en el payload, ni
 * dentro del texto de la última acción.
 *
 * Se comprueban los nombres de campo y no los valores porque un valor es el
 * nombre de una persona: alguien que se llame «Bits» no puede tumbar la vista.
 */
export const PROHIBIDO = [
  'bits',
  'subs',
  'saldo',
  'balance',
  'ledger',
  'loan',
  'prestamo',
  'principal',
  'jail',
  'carcel',
  'graveyard',
  'cementerio',
  'restriction',
  'restriccion',
  'note',
  'nota',
  'claim',
  'canjeo',
  'email',
  'user_id',
  'participation_id',
  'inverse',
]

function normalizar(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Devuelve lo que se ha colado. Vacío es que el payload es publicable.
 *
 * Se usa en los tests y también en caliente, antes de enviar: más vale no
 * publicar un cambio que publicar los bits de la gente.
 */
export function auditarEnVivo(payload: unknown): string[] {
  const problemas: string[] = []
  const prohibidas = PROHIBIDO.map(normalizar)

  function revisarClave(clave: string, ruta: string) {
    const limpia = normalizar(clave)
    for (const mala of prohibidas) {
      if (limpia.includes(mala)) problemas.push(`${ruta}: campo "${clave}" (${mala})`)
    }
  }

  function recorrer(valor: unknown, ruta: string) {
    if (Array.isArray(valor)) {
      valor.forEach((v, i) => recorrer(v, `${ruta}[${i}]`))
      return
    }
    if (valor && typeof valor === 'object') {
      for (const [k, v] of Object.entries(valor)) {
        revisarClave(k, ruta || 'raíz')
        recorrer(v, ruta ? `${ruta}.${k}` : k)
      }
    }
  }

  recorrer(payload, '')

  // El texto libre sí se mira por dentro: es lo único escrito para el host.
  const accion = (payload as { ultimaAccion?: unknown } | null)?.ultimaAccion
  if (typeof accion === 'string') {
    const limpia = normalizar(accion)
    for (const mala of prohibidas) {
      if (limpia.includes(mala)) problemas.push(`ultimaAccion menciona "${mala}"`)
    }
  }

  return problemas
}
