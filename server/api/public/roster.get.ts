import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

/**
 * El histórico público, mes a mes. **Sin autenticación a propósito.**
 *
 * Lee `public_roster`, que ya suma lo jugado y lo que vino de los Excel, y que
 * no expone más columnas que estas: hay un test unitario que falla si alguien
 * le añade una privada.
 *
 * **Todos los meses en una respuesta.** Son unos cientos de filas de siete
 * columnas —el histórico entero ronda los 476 registros— y así el selector de
 * mes de la página cambia sin ir al servidor. Un endpoint por mes habría hecho
 * ocho viajes para lo mismo.
 */
export default defineEventHandler(async (event) => {
  const db = serverSupabaseServiceRole<Database>(event)

  const { data, error } = await db
    .from('public_roster')
    .select('period_name, display_name, photo_url, current_lp, wins, losses, mvps, aces')

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  type Fila = {
    period_name: string
    display_name: string
    photo_url: string | null
    current_lp: number
    wins: number
    losses: number
    mvps: number
    aces: number
  }

  const filas = (data ?? []) as unknown as Fila[]

  const meses = new Map<string, { periodo: string; filas: ReturnType<typeof aFila>[] }>()

  function aFila(f: Fila) {
    return {
      displayName: f.display_name,
      photoUrl: f.photo_url,
      lp: f.current_lp,
      // El nombre que usa `shared/roster.ts`, para que `winratePct` reciba lo
      // que espera sin que la página tenga que traducir nada.
      jugadas: f.wins + f.losses,
      victorias: f.wins,
      derrotas: f.losses,
      mvps: f.mvps,
      aces: f.aces,
    }
  }

  for (const f of filas) {
    const mes = meses.get(f.period_name) ?? { periodo: f.period_name, filas: [] }
    mes.filas.push(aFila(f))
    meses.set(f.period_name, mes)
  }

  // Del mes más nuevo al más viejo. El nombre es "SEP-2026", que ordenado como
  // texto daría ABR antes que ENE, así que se ordena por año y mes de verdad.
  const ORDEN = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']
  const clave = (nombre: string) => {
    const [mes, anio] = nombre.split('-')
    return Number(anio ?? 0) * 100 + (ORDEN.indexOf(mes ?? '') + 1)
  }

  return {
    meses: [...meses.values()]
      .sort((a, b) => clave(b.periodo) - clave(a.periodo))
      .map((m) => ({
        ...m,
        // Por LP, que es como se lee un roster. El desempate por nombre evita
        // que dos recargas devuelvan órdenes distintos con el mismo empate.
        filas: m.filas.sort(
          (a, b) => b.lp - a.lp || a.displayName.localeCompare(b.displayName, 'es'),
        ),
      })),
  }
})
