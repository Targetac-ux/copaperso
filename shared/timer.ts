/**
 * Cronómetro de negociación (§13 ampliado, septiembre 2026).
 *
 * El host lo arranca con la duración que quiera —15 minutos por defecto, pero
 * escribible— y lo reinicia tantas veces como quiera: los tramos son libres.
 * Cuando llega a cero avisa; nunca bloquea nada.
 */

export const DEFAULT_SECONDS = 15 * 60
export const MIN_SECONDS = 30
export const MAX_SECONDS = 2 * 60 * 60

export interface TimerState {
  /** Cuándo termina, en ISO. Null si no está corriendo. */
  endsAt: string | null
  /** La duración que escribió el host, para poder reiniciarlo igual. */
  seconds: number
  running: boolean
}

/** Segundos que faltan. Nunca baja de cero. */
export function remainingSeconds(timer: TimerState, now: Date = new Date()): number {
  if (!timer.endsAt) return timer.seconds
  const ms = new Date(timer.endsAt).getTime() - now.getTime()
  return Math.max(0, Math.ceil(ms / 1000))
}

/** "12:34". Con más de una hora, "1:02:03". */
export function formatSeconds(total: number): string {
  const s = Math.max(0, Math.floor(total))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const seg = s % 60
  const dos = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${dos(m)}:${dos(seg)}` : `${dos(m)}:${dos(seg)}`
}

/** ¿Se acabó? Solo si estaba corriendo: un cronómetro parado no dispara nada. */
export function hasExpired(timer: TimerState, now: Date = new Date()): boolean {
  return timer.running && !!timer.endsAt && remainingSeconds(timer, now) === 0
}

/** Deja la duración dentro de lo razonable: ni 3 segundos ni 5 horas. */
export function clampSeconds(seconds: number): number {
  if (!Number.isFinite(seconds)) return DEFAULT_SECONDS
  return Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, Math.round(seconds)))
}

/** "15" o "15:30" o "90s" → segundos. Lo que el host teclee. */
export function parseDuration(input: string): number | null {
  const texto = (input ?? '').trim().toLowerCase()
  if (!texto) return null

  const conDosPuntos = /^(\d{1,2}):(\d{1,2})$/.exec(texto)
  if (conDosPuntos) {
    return clampSeconds(Number(conDosPuntos[1]) * 60 + Number(conDosPuntos[2]))
  }

  const enSegundos = /^(\d{1,4})\s*s$/.exec(texto)
  if (enSegundos) return clampSeconds(Number(enSegundos[1]))

  const enMinutos = /^(\d{1,3})\s*(m|min|minutos)?$/.exec(texto)
  if (enMinutos) return clampSeconds(Number(enMinutos[1]) * 60)

  return null
}
