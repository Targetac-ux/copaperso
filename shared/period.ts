/**
 * Nombres y fechas de los periodos.
 *
 * Ojo con las zonas horarias: `new Date('2026-10-01')` se interpreta como
 * medianoche UTC, que en México es todavía el 30 de septiembre. Abrir el mes
 * la noche del día 1 habría creado el periodo del mes anterior. Por eso aquí
 * las fechas se construyen y se formatean siempre en local, sin pasar por
 * toISOString().
 */

const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']

/** "2026-10-01" → Date local del 1 de octubre (no del 30 de septiembre). */
export function parseLocalDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!m) return null
  const [, y, mes, d] = m
  const fecha = new Date(Number(y), Number(mes) - 1, Number(d))
  return Number.isNaN(fecha.getTime()) ? null : fecha
}

/** Date → "2026-10-01", en la zona del servidor. */
export function toLocalISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Date → "OCT-2026", que es como se nombran los periodos. */
export function periodNameFor(date: Date): string {
  return `${MESES[date.getMonth()]}-${date.getFullYear()}`
}

/** Primer día del mes de esa fecha. */
export function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}
