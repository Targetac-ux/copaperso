import type { H3Event } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { CLAVES, esRedConocida, leerSegundos } from '#shared/ajustes'
import type { EnlaceDeSitio, Red } from '#shared/ajustes'
import type { Database } from '#shared/types/database.types'

export interface Ajustes {
  enlaces: EnlaceDeSitio[]
  /** La duración por defecto del cronómetro, en segundos. */
  cronometro: number
}

/**
 * Los ajustes enteros, de una vez: la pantalla los pide todos juntos y son dos
 * tablas diminutas, así que no compensa un endpoint por cada cosa.
 */
export async function cargarAjustes(event: H3Event): Promise<Ajustes> {
  const db = serverSupabaseServiceRole<Database>(event)

  const [{ data: enlaces }, { data: ajuste }] = await Promise.all([
    db.from('site_link').select('network, url, sort_order, visible').order('sort_order'),
    db.from('setting').select('value').eq('key', CLAVES.CRONOMETRO).maybeSingle(),
  ])

  return {
    // Una red que ya no se sabe pintar no se devuelve: la fila se queda en la
    // base por si vuelve, pero no llega a ninguna pantalla.
    enlaces: (enlaces ?? [])
      .filter((e) => esRedConocida(e.network))
      .map((e) => ({
        network: e.network as Red,
        url: e.url,
        sortOrder: e.sort_order,
        visible: e.visible,
      })),
    cronometro: leerSegundos(ajuste?.value ?? null),
  }
}
