import type { EloTierDb, PlayerRoleDb, TierName } from './types/database.types'

/**
 * El Tier Ranking (§30).
 *
 * **Lo decide el host a mano** (confirmado el 14 de septiembre de 2026): el LP
 * del periodo no coloca a nadie ni propone nada. Por eso aquí no hay ninguna
 * fórmula que convierta puntos en tier; solo el orden de los tiers y las reglas
 * de mover gente de uno a otro.
 *
 * Una **edición** es una foto publicada del ranking. Editar la que se está
 * preparando nunca toca las ya publicadas, porque cada una tiene sus propias
 * filas.
 */

/** De mejor a peor, que es como se lee de arriba abajo en la pantalla. */
export const TIERS: TierName[] = ['S_PLUS', 'S', 'A', 'B', 'C', 'D']

export const TIER_LABEL: Record<TierName, string> = {
  S_PLUS: 'S+',
  S: 'S',
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
}

/** El archivo de cada insignia, tal y como llegaron de la generación. */
export const TIER_INSIGNIA: Record<TierName, string> = {
  S_PLUS: '/tiers/tier-s-plus.svg',
  S: '/tiers/tier-s.svg',
  A: '/tiers/tier-a.svg',
  B: '/tiers/tier-b.svg',
  C: '/tiers/tier-c.svg',
  D: '/tiers/tier-d.svg',
}

export function esTier(v: unknown): v is TierName {
  return typeof v === 'string' && (TIERS as string[]).includes(v)
}

export interface EntradaTier {
  id: string
  playerId: string
  displayName: string
  photoUrl: string | null
  tier: TierName
  points: number | null
  mainRole: PlayerRoleDb | null
  elo: EloTierDb | null
  rankOrder: number
}

export interface Edicion {
  id: string
  title: string | null
  periodName: string | null
  publishedAt: string | null
  isCurrent: boolean
  createdAt: string
}

/** Agrupa por tier y ordena dentro de cada uno. Los seis salen siempre. */
export function porTier(entradas: EntradaTier[]): Record<TierName, EntradaTier[]> {
  const mapa = Object.fromEntries(TIERS.map((t) => [t, [] as EntradaTier[]])) as Record<
    TierName,
    EntradaTier[]
  >

  for (const e of entradas) {
    // Un tier que no conocemos no se pierde: se queda en D antes que desaparecer.
    ;(mapa[e.tier] ?? mapa.D).push(e)
  }

  for (const t of TIERS) {
    mapa[t].sort((a, b) => a.rankOrder - b.rankOrder || a.displayName.localeCompare(b.displayName, 'es'))
  }

  return mapa
}

/**
 * Mueve a alguien a un tier, en la posición que se le indique.
 *
 * Devuelve **la lista entera reordenada**, no solo lo que cambió: el orden es
 * relativo, así que mover a uno renumera a los de su fila vieja y a los de la
 * nueva. Que lo decida una función pura es lo que permite comprobarlo sin
 * pantalla ni base de datos.
 */
export function mover(
  entradas: EntradaTier[],
  entryId: string,
  destino: TierName,
  posicion: number,
): EntradaTier[] {
  const movida = entradas.find((e) => e.id === entryId)
  if (!movida) return entradas

  const grupos = porTier(entradas)

  // Fuera de donde estaba.
  grupos[movida.tier] = grupos[movida.tier].filter((e) => e.id !== entryId)

  // Y dentro de donde va, acotando la posición a lo que existe.
  const destinoLista = [...grupos[destino]]
  const donde = Math.max(0, Math.min(posicion, destinoLista.length))
  destinoLista.splice(donde, 0, { ...movida, tier: destino })
  grupos[destino] = destinoLista

  return TIERS.flatMap((t) => grupos[t].map((e, i) => ({ ...e, tier: t, rankOrder: i })))
}

/** Lo que hay que guardar tras mover: id, tier y posición de cada uno. */
export interface CambioDeOrden {
  id: string
  tier: TierName
  rankOrder: number
}

/** Solo las filas que de verdad cambiaron, para no escribir de más. */
export function cambios(antes: EntradaTier[], despues: EntradaTier[]): CambioDeOrden[] {
  const previo = new Map(antes.map((e) => [e.id, e]))
  return despues
    .filter((e) => {
      const p = previo.get(e.id)
      return !p || p.tier !== e.tier || p.rankOrder !== e.rankOrder
    })
    .map((e) => ({ id: e.id, tier: e.tier, rankOrder: e.rankOrder }))
}
