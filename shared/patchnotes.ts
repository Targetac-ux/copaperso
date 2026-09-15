/**
 * Los patch notes de las reglas.
 *
 * Las reglas de la CopaPerso no son fijas: cada cierto tiempo se añade algo o
 * se quita. En vez de reescribir la página de reglas en silencio —y dejar a la
 * gente sin saber qué cambió— cada tanda de cambios queda publicada con su
 * fecha, como las notas de parche de un juego.
 *
 * El cuerpo se escribe como texto suelto, una línea por cambio. Una línea que
 * empieza por `+` es algo que entra y una que empieza por `-` es algo que sale;
 * el resto es texto normal. Es la convención de los changelogs de toda la vida y
 * no obliga al host a aprender ningún formato: escribe la lista y ya.
 */

export interface PatchNote {
  id: string
  version: string | null
  title: string
  publishedAt: string | null
  body: string
}

export type TipoDeLinea = 'añade' | 'quita' | 'texto'

export interface LineaDeParche {
  tipo: TipoDeLinea
  texto: string
}

/**
 * Parte el cuerpo en líneas y dice de qué tipo es cada una.
 *
 * Las líneas en blanco se van: sirven para respirar al escribir, no para pintar
 * huecos. Y el signo se quita del texto, que ya lo dice el color.
 */
export function leerCuerpo(body: string): LineaDeParche[] {
  return body
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((linea) => {
      // Se exige el espacio para no confundir un signo con un menos de verdad:
      // «-15 LP por derrota» es texto, no una línea de algo que se quita.
      if (linea.startsWith('+ ')) return { tipo: 'añade' as const, texto: linea.slice(2).trim() }
      if (linea.startsWith('- ')) return { tipo: 'quita' as const, texto: linea.slice(2).trim() }
      return { tipo: 'texto' as const, texto: linea }
    })
}

/** Cuántos cambios trae, para el resumen de la lista del panel. */
export function contarCambios(body: string): { añade: number; quita: number } {
  const lineas = leerCuerpo(body)
  return {
    añade: lineas.filter((l) => l.tipo === 'añade').length,
    quita: lineas.filter((l) => l.tipo === 'quita').length,
  }
}

/** De la más reciente a la más vieja; las sin publicar, primero. */
export function ordenar<T extends { publishedAt: string | null }>(notas: T[]): T[] {
  return [...notas].sort((a, b) => {
    if (!a.publishedAt && !b.publishedAt) return 0
    if (!a.publishedAt) return -1
    if (!b.publishedAt) return 1
    return b.publishedAt.localeCompare(a.publishedAt)
  })
}
