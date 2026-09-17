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
 * objeto antes de publicarlo: si alguien añade un campo que no está declarado
 * aquí, no sale.
 *
 * **Qué se enseña, y por qué cambió** (17 de septiembre de 2026). Al principio
 * esta vista no sacaba bits, saldos, cárcel ni restricciones. Decisión del
 * host: los paneles son *para los jugadores*, que es donde miran para negociar
 * —el saldo de cada uno es el motivo de todo esto—, y en el Excel el banco
 * entero salía en pantalla igualmente. Lo que **sigue fuera**: los préstamos,
 * las notas del host y el historial de canjeos. Las notas se quedaron fuera a
 * propósito: son el cuaderno del host, texto libre escrito sin pensar que se
 * ve, que es exactamente por lo que `ultimaAccion` lleva lista blanca.
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

export interface RecompensaEnVivo {
  codigo: string
  etiqueta: string
  /** Ya multiplicado si la negociación está en ×3: es el precio que se paga. */
  precio: number
}

export interface CuentaEnVivo {
  displayName: string
  bits: number
  subs: number
}

export interface CastigoEnVivo {
  displayName: string
  texto: string
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
  /** El ×3 de la negociación. Los precios de abajo ya vienen multiplicados. */
  preciosTriplicados: boolean
  /** La mesa de negociación: qué se puede pedir y a cómo está. */
  recompensas: RecompensaEnVivo[]
  /** El banco entero. Es el panel por el que se hizo todo esto. */
  banco: CuentaEnVivo[]
  carcel: CastigoEnVivo[]
  restricciones: CastigoEnVivo[]
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
  recompensas: [],
  banco: [],
  carcel: [],
  restricciones: [],
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
  // Desde que el banco y los castigos se ven, lo que los mueve tiene que
  // avisar: si no, el saldo se queda congelado en pantalla hasta que el host
  // toque cualquier otra cosa, y el panel estaría mintiendo.
  'ledger.entry',
  'ledger.open',
  'reward.claim',
  'restriction.create',
  'restriction.lift',
  'catalog.add',
  'catalog.update',
  'undo',
] as const

/**
 * Deshacer sí cambia lo que se ve, así que tiene que avisar al público. Pero su
 * resumen es «Deshecho: …» seguido del resumen original, que puede ser el de un
 * movimiento del banco. Se publica el hecho, no el texto.
 */
const RESUMEN_FIJO: Record<string, string> = {
  undo: 'Se deshizo la última acción',

  /**
   * Estas llevan texto que escribe el host —el motivo de un movimiento, la
   * nota de una restricción— y eso no se publica aunque la cifra sí.
   *
   * No se pierde nada: el dato está en el panel, que es estructurado y se
   * acaba de refrescar. Lo único que hace el aviso es decir que mires.
   */
  'ledger.entry': 'Movimiento en el banco',
  'ledger.open': 'Cuenta nueva en el banco',
  'restriction.create': 'Nueva restricción',
  'catalog.add': 'Cambio en las recompensas',
  'catalog.update': 'Cambio en los precios',
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
 * La forma exacta de lo que puede salir. **Lista blanca, no lista negra.**
 *
 * Antes esto era una lista de palabras prohibidas en los nombres de campo, y
 * funcionó mientras la vista enseñaba cuatro cosas. En cuanto hubo que sacar
 * los saldos dejó de servir: prohibir «bits» era justo lo contrario de lo que
 * se quería, y quitar la palabra de la lista no protegía de que alguien
 * añadiera mañana un campo nuevo con otro nombre.
 *
 * Declarando la forma, lo que no está escrito aquí no sale, se llame como se
 * llame. `null` es una hoja: su valor no se mira —un valor es el nombre de una
 * persona, y alguien que se llame «Bits» no puede tumbar la vista—. Un array
 * lleva dentro la forma de sus elementos.
 */
export const FORMA_PUBLICA = {
  hay: null,
  sesion: { number: null, mode: null },
  equipos: [{ teamNumber: null, members: [{ displayName: null, role: null, isOffRole: null }] }],
  banca: [{ displayName: null, roles: null }],
  marcador: { t1: null, t2: null },
  partida: { numero: null, enJuego: null },
  cronometro: { endsAt: null, remaining: null, seconds: null, running: null },
  preciosTriplicados: null,
  recompensas: [{ codigo: null, etiqueta: null, precio: null }],
  banco: [{ displayName: null, bits: null, subs: null }],
  carcel: [{ displayName: null, texto: null }],
  restricciones: [{ displayName: null, texto: null }],
  ultimaAccion: null,
  at: null,
} as const

/**
 * Lo que sigue sin poder aparecer **dentro del texto** de la última acción.
 *
 * Solo el texto libre: la forma ya la defiende `FORMA_PUBLICA`. La lista es
 * corta a propósito, y es lo que de verdad no es de nadie más — los préstamos,
 * los correos y los identificadores internos.
 */
export const PROHIBIDO = [
  'loan',
  'prestamo',
  'principal',
  'adeudo',
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

  /**
   * Recorre el objeto contra la forma declarada.
   *
   * `spec === null` es una hoja y ahí se para: no se mira el valor. Un `null`
   * o un `undefined` en el payload tampoco se inspecciona —media vista es
   * opcional— porque lo que se audita es qué campos existen, no si están
   * rellenos.
   */
  function revisar(valor: unknown, spec: unknown, ruta: string) {
    if (spec === null) return
    if (valor === null || valor === undefined) return

    if (Array.isArray(spec)) {
      if (!Array.isArray(valor)) {
        problemas.push(`${ruta}: se esperaba una lista`)
        return
      }
      valor.forEach((v, i) => revisar(v, spec[0], `${ruta}[${i}]`))
      return
    }

    if (typeof valor !== 'object') return

    const forma = spec as Record<string, unknown>
    for (const [clave, dentro] of Object.entries(valor)) {
      if (!(clave in forma)) {
        problemas.push(`${ruta || 'raíz'}: campo "${clave}" no está en la vista pública`)
        continue
      }
      revisar(dentro, forma[clave], ruta ? `${ruta}.${clave}` : clave)
    }
  }

  revisar(payload, FORMA_PUBLICA, '')

  // El texto libre sí se mira por dentro: es lo único escrito para el host.
  const accion = (payload as { ultimaAccion?: unknown } | null)?.ultimaAccion
  if (typeof accion === 'string') {
    const limpia = normalizar(accion)
    for (const mala of PROHIBIDO.map(normalizar)) {
      if (limpia.includes(mala)) problemas.push(`ultimaAccion menciona "${mala}"`)
    }
  }

  return problemas
}
