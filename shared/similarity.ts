/**
 * Sugerencias de perfiles ya existentes mientras el host teclea (§4).
 *
 * Importante: esto SUGIERE, nunca decide. "Taget" y "Target" son slugs
 * distintos y podrían ser dos personas reales; lo que hace este módulo es
 * ponerle "Target" delante al host para que elija. La decisión es suya.
 */

/** Normaliza igual que player_slug() en la base: sin acentos, sin símbolos. */
export function foldName(name: string): string {
  return (name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/** Distancia de edición, cortando en cuanto se pasa del máximo que nos importa. */
export function editDistance(a: string, b: string, max = 3): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > max) return max + 1

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  let curr = new Array<number>(b.length + 1)

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    let fila = curr[0]!
    for (let j = 1; j <= b.length; j++) {
      const coste = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + coste)
      fila = Math.min(fila, curr[j]!)
    }
    if (fila > max) return max + 1
    ;[prev, curr] = [curr, prev]
  }

  return prev[b.length]!
}

export type MatchKind = 'exact' | 'prefix' | 'typo' | 'contains'

export interface NameMatch<T> {
  item: T
  score: number
  kind: MatchKind
}

/** Cuánto se puede equivocar el host según lo largo que sea el nombre. */
function toleranciaDe(largo: number): number {
  if (largo <= 3) return 0
  if (largo <= 5) return 1
  return 2
}

/**
 * Ordena candidatos por parecido con lo tecleado. Devuelve solo los que
 * merecen enseñarse, de más a menos probable.
 */
export function matchNames<T>(
  query: string,
  items: readonly T[],
  getName: (item: T) => string,
  limit = 6,
): NameMatch<T>[] {
  const q = foldName(query)
  if (!q) return []

  const matches: NameMatch<T>[] = []

  for (const item of items) {
    const name = foldName(getName(item))
    if (!name) continue

    if (name === q) {
      matches.push({ item, score: 1, kind: 'exact' })
      continue
    }

    if (name.startsWith(q)) {
      // Cuanto menos falta por teclear, más seguro es el acierto.
      matches.push({ item, score: 0.9 * (q.length / name.length) + 0.05, kind: 'prefix' })
      continue
    }

    const distancia = editDistance(q, name, 3)
    if (distancia <= toleranciaDe(Math.max(q.length, name.length))) {
      matches.push({ item, score: 0.8 - distancia * 0.15, kind: 'typo' })
      continue
    }

    if (name.includes(q) && q.length >= 3) {
      matches.push({ item, score: 0.45, kind: 'contains' })
    }
  }

  return matches.sort((a, b) => b.score - a.score || getName(a.item).localeCompare(getName(b.item))).slice(0, limit)
}
