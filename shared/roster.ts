import type { EloTierDb, MatchResultDb, PlayerRoleDb } from './types/database.types'

/**
 * El roster de un periodo (§29).
 *
 * Las cuentas viven aquí, sin base de datos de por medio, porque la misma fila
 * se pinta en pantalla y se exporta a CSV. Si cada uno hiciera su propio
 * redondeo, el CSV y la tabla acabarían diciendo cosas distintas del mismo
 * jugador, que es justo lo que el host no puede permitirse al revisar un mes.
 */

export interface FilaRoster {
  playerId: string
  participationId: string
  displayName: string
  photoUrl: string | null
  elo: EloTierDb | null
  roles: PlayerRoleDb[]
  lp: number
  jugadas: number
  victorias: number
  /** La doble derrota cuenta por dos (A4). */
  derrotas: number
  mvps: number
  aces: number
  offRoles: number
  /** De qué Excel salió el mes, si salió de uno. `null` lo contó la aplicación. */
  importadoDe: string | null
}

/**
 * Los totales que vinieron de un Excel, cuando el mes se importó.
 *
 * Son meses en los que no hay ni una fila de `match_player`: el CCPR Roster
 * guardaba totales, no partidas. `null` en cualquiera de los campos significa
 * «esto no vino de un Excel», que no es lo mismo que cero.
 */
export interface AgregadoHistorico {
  historic_wins: number | null
  historic_losses: number | null
  historic_mvps: number | null
  historic_aces: number | null
  historic_off_roles: number | null
}

/** Una partida de alguien, tal y como quedó en el snapshot. */
export interface ResultadoDeJugador {
  result: MatchResultDb | null
  isMvp: boolean
  isAce: boolean
  isOffRole: boolean
}

/**
 * Cuenta las partidas de un jugador, y le suma lo que trajera de un Excel.
 *
 * Solo entran las que tienen resultado: una partida en juego, o una cuyo
 * resultado se deshizo, no cuenta para nadie.
 *
 * El histórico **se suma**, no sustituye: un mes importado al que luego se le
 * juegue una copa de verdad tiene que acabar enseñando las dos cosas. Y como
 * el Excel no guardaba dobles derrotas por separado —su columna de derrotas ya
 * venía con la doble contada por dos—, aquí entra tal cual.
 *
 * `jugadas` sale de sumar victorias y derrotas del histórico, que es todo lo
 * que la hoja sabía de una partida.
 */
export function contar(resultados: ResultadoDeJugador[], historico?: AgregadoHistorico | null) {
  const jugados = resultados.filter((r) => r.result !== null)
  const h = (campo: keyof AgregadoHistorico) => historico?.[campo] ?? 0
  return {
    jugadas: jugados.length + h('historic_wins') + h('historic_losses'),
    victorias: jugados.filter((r) => r.result === 'win').length + h('historic_wins'),
    derrotas:
      jugados.reduce(
        (t, r) => t + (r.result === 'loss' ? 1 : r.result === 'double_loss' ? 2 : 0),
        0,
      ) + h('historic_losses'),
    mvps: jugados.filter((r) => r.isMvp).length + h('historic_mvps'),
    aces: jugados.filter((r) => r.isAce).length + h('historic_aces'),
    offRoles: jugados.filter((r) => r.isOffRole).length + h('historic_off_roles'),
  }
}

/**
 * El porcentaje de victorias, redondeado, o `null` si no ha jugado.
 *
 * `null` y no `0`: no es lo mismo no haber ganado ninguna que no haber jugado
 * ninguna, y enseñar «0 %» a quien no ha jugado es mentir sobre él.
 */
export function winratePct(fila: Pick<FilaRoster, 'jugadas' | 'victorias'>): number | null {
  if (!fila.jugadas) return null
  return Math.round((fila.victorias / fila.jugadas) * 100)
}

/** Lo que se lee en pantalla. */
export function formatWinrate(pct: number | null): string {
  return pct === null ? '—' : `${pct} %`
}

// --------------------------------------------------------------- orden ----

export type CampoOrden = 'nombre' | 'lp' | 'jugadas' | 'victorias' | 'derrotas' | 'wr' | 'mvps' | 'aces'

const valor = (f: FilaRoster, campo: CampoOrden): number | string => {
  switch (campo) {
    case 'nombre': return f.displayName.toLowerCase()
    case 'lp': return f.lp
    case 'jugadas': return f.jugadas
    case 'victorias': return f.victorias
    case 'derrotas': return f.derrotas
    case 'mvps': return f.mvps
    case 'aces': return f.aces
    // Quien no ha jugado se va al final en vez de colarse como un 0 %.
    case 'wr': return winratePct(f) ?? -1
  }
}

export function ordenar(filas: FilaRoster[], campo: CampoOrden, desc = true): FilaRoster[] {
  return [...filas].sort((a, b) => {
    const va = valor(a, campo)
    const vb = valor(b, campo)
    if (va === vb) return a.displayName.localeCompare(b.displayName, 'es')
    const cmp = typeof va === 'string' ? va.localeCompare(vb as string, 'es') : va - (vb as number)
    return desc ? -cmp : cmp
  })
}

// --------------------------------------------------------------- filtro ----

function normalizar(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Busca por nombre, por rol o por elo: «mid», «demon» o «tar» valen. */
export function filtrar(filas: FilaRoster[], texto: string): FilaRoster[] {
  const q = normalizar(texto.trim())
  if (!q) return filas
  return filas.filter((f) => {
    const heno = normalizar([f.displayName, f.elo ?? '', ...f.roles].join(' '))
    return heno.includes(q)
  })
}

// ------------------------------------------------------------------ CSV ----

export const CSV_CABECERAS = [
  'Jugador',
  'Elo',
  'Roles',
  'LP',
  'Partidas',
  'Victorias',
  'Derrotas',
  'Winrate',
  'MVP',
  'ACE',
  'Off role',
] as const

/**
 * Una celda de CSV segura.
 *
 * Se entrecomilla lo que lleve coma, comillas o salto de línea, que en nombres
 * de Twitch pasa más de lo que parece.
 */
function celda(v: string | number): string {
  const s = String(v)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function filaCsv(f: FilaRoster): string {
  const pct = winratePct(f)
  return [
    f.displayName,
    f.elo ?? '',
    f.roles.join(' '),
    f.lp,
    f.jugadas,
    f.victorias,
    f.derrotas,
    // El mismo número que la pantalla, sin el «%» para que la hoja lo ordene.
    pct === null ? '' : pct,
    f.mvps,
    f.aces,
    f.offRoles,
  ]
    .map(celda)
    .join(',')
}

export function rosterACsv(filas: FilaRoster[]): string {
  // BOM para que Excel en Windows no destroce los acentos.
  return '\uFEFF' + [CSV_CABECERAS.join(','), ...filas.map(filaCsv)].join('\r\n') + '\r\n'
}
