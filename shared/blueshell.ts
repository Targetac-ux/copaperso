import type { BlueShellOutcomeDb } from './types/database.types'

/**
 * El Blue Shell (§16).
 *
 * Se compra con bits y castiga a un jugador con uno de cuatro resultados. La
 * ruleta se gira en pantalla, pero **girar no guarda nada**: hasta que el host
 * pulsa «Guardar», no existe. Puede volver a girar o cancelar sin dejar rastro.
 *
 * Y guardar el resultado tampoco ejecuta el castigo: igual que los canjeos
 * (A6-bis), deja constancia y es el host quien lo aplica. La doble derrota se
 * marca al cerrar la partida, donde ya se ve junto al resto del resultado.
 */

export const BLUE_SHELL_OUTCOMES = [
  'NO_FLASH',
  'DOUBLE_LOSS',
  'RANDOM_CHAMPION',
  'SPECIFIC_BUILD',
] as const

export type BlueShellOutcome = (typeof BLUE_SHELL_OUTCOMES)[number]

export const BLUE_SHELL_LABEL: Record<BlueShellOutcomeDb, string> = {
  NO_FLASH: 'Sin flash',
  DOUBLE_LOSS: 'Doble derrota',
  RANDOM_CHAMPION: 'Campeón aleatorio',
  SPECIFIC_BUILD: 'Build obligada',
}

export const BLUE_SHELL_DESC: Record<BlueShellOutcomeDb, string> = {
  NO_FLASH: 'Juega la partida sin hechizo de flash.',
  DOUBLE_LOSS: 'Si pierde, la derrota cuenta doble (−30 LP).',
  RANDOM_CHAMPION: 'Le toca campeón al azar.',
  SPECIFIC_BUILD: 'Tiene que armar la build que le indiquen.',
}

/**
 * Los cuatro salen con la misma probabilidad.
 *
 * El plan no fija pesos distintos, así que va uniforme. Si algún día uno tiene
 * que salir más o menos, se cambia aquí: es el único sitio que lo decide.
 */
export function girar(rng: () => number = Math.random): BlueShellOutcome {
  const i = Math.floor(rng() * BLUE_SHELL_OUTCOMES.length)
  // Math.random() nunca devuelve 1, pero un rng inyectado podría: se acota.
  return BLUE_SHELL_OUTCOMES[Math.min(i, BLUE_SHELL_OUTCOMES.length - 1)]!
}

export function esBlueShellOutcome(v: unknown): v is BlueShellOutcome {
  return typeof v === 'string' && (BLUE_SHELL_OUTCOMES as readonly string[]).includes(v)
}
