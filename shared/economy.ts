/**
 * Precios, saldos y préstamos (§13, §14, §19).
 *
 * Lógica pura: la usan tanto la pantalla del host como el servidor, para que
 * los dos calculen exactamente lo mismo.
 */

/** El multiplicador cuando la negociación entra en tiempo extra. Fijo por decisión del host. */
export const TRIPLE = 3

export interface CatalogAction {
  code: string
  label: string
  costBits: number
}

/** Lo que cuesta ahora mismo una recompensa en una sesión concreta. */
export function effectiveCost(costBits: number, tripled: boolean): number {
  return tripled ? costBits * TRIPLE : costBits
}

/** Todos los precios de la sesión, ya multiplicados si toca. */
export function priceList(
  actions: readonly CatalogAction[],
  tripled: boolean,
): (CatalogAction & { effective: number })[] {
  return actions.map((a) => ({ ...a, effective: effectiveCost(a.costBits, tripled) }))
}

// --------------------------------------------------------------- préstamos --

export interface Loan {
  principalBits: number
  dailyRate: number
  lentAt: string
  settledAt?: string | null
}

/**
 * Interés **lineal** del 10 % diario sobre el monto original.
 *
 *   400 bits → 440 al día 1, 480 al 2, 520 al 3, 880 al día 12.
 *
 * No es compuesto: no se calcula sobre lo que ya se debe, sino siempre sobre
 * el principal. Con interés compuesto, 400 al día 12 serían 1255.
 */
export function loanAmountDue(loan: Loan, on: Date = new Date()): number {
  const dias = daysBetween(loan.lentAt, loan.settledAt ?? on)
  return Math.round(loan.principalBits + loan.principalBits * loan.dailyRate * dias)
}

/** Solo el interés acumulado, sin el principal. */
export function loanInterest(loan: Loan, on: Date = new Date()): number {
  return loanAmountDue(loan, on) - loan.principalBits
}

/** Días completos entre dos fechas, nunca negativo. */
export function daysBetween(from: string | Date, to: string | Date): number {
  const a = typeof from === 'string' ? parseDay(from) : startOfDay(from)
  const b = typeof to === 'string' ? parseDay(to) : startOfDay(to)
  if (!a || !b) return 0
  const dias = Math.round((b.getTime() - a.getTime()) / 86_400_000)
  return Math.max(0, dias)
}

function parseDay(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim())
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

// ------------------------------------------------------- banco de bits/subs --

export type PaidWith = 'bits' | 'sub_na' | 'sub_latam'

export const PAID_WITH_LABEL: Record<PaidWith, string> = {
  bits: 'Bits',
  sub_na: '1 sub NA/EUW',
  sub_latam: '2 subs LATAM',
}

/**
 * Los subs no tienen tipo de cambio con los bits: 1 sub NA/EUW o 2 LATAM valen
 * *cualquiera* de las recompensas, y al final lo decide el streamer. Por eso
 * esto devuelve una nota y no un número.
 */
export const SUBS_NOTE =
  '1 sub NA/EUW o 2 subs LATAM equivalen a cualquier recompensa. Lo decide el host.'

/** Saldo tras aplicar movimientos. El host los escribe a mano; nada es automático. */
export function balanceAfter(
  current: { bits: number; subs: number },
  entries: readonly { deltaBits: number; deltaSubs: number }[],
): { bits: number; subs: number } {
  return entries.reduce(
    (acc, e) => ({ bits: acc.bits + e.deltaBits, subs: acc.subs + e.deltaSubs }),
    current,
  )
}
