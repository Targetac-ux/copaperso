/**
 * Fecha local en formato ISO corto.
 *
 * Se evita toISOString() a propósito: convierte a UTC, y al oeste de Greenwich
 * eso devuelve el día anterior durante buena parte de la tarde.
 */
export function toLocalISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
