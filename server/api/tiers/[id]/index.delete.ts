import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

/**
 * Descarta un borrador del Tier Ranking.
 *
 * Existe porque sin esto el módulo se podía quedar atascado sin salida: un
 * borrador vacío no se puede publicar —publicarlo dejaría la Home en blanco—,
 * y mientras hay uno abierto no se deja empezar otro. Con los dos botones
 * escondidos y ningún borrado, no quedaba ni un clic que hiciera algo.
 *
 * **Solo borradores.** Una edición publicada es el histórico: el Tier Ranking
 * de un mes es una foto, y borrarla se llevaría por delante la única copia de
 * cómo estaba el ranking entonces. Para cambiar algo se empieza otra edición.
 */
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const id = getRouterParam(event, 'id')!
  const db = serverSupabaseServiceRole<Database>(event)

  const { data: lista } = await db
    .from('tier_list')
    .select('id, title, published_at, is_current')
    .eq('id', id)
    .maybeSingle()

  if (!lista) throw createError({ statusCode: 404, statusMessage: 'Esa edición no existe.' })

  if (lista.published_at || lista.is_current) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Esa edición ya está publicada: es histórico y no se borra.',
    })
  }

  const { count } = await db
    .from('tier_entry')
    .select('id', { count: 'exact', head: true })
    .eq('tier_list_id', id)

  // Las entradas caen solas: `tier_entry` cuelga de la lista con cascada.
  const { error } = await db.from('tier_list').delete().eq('id', id)
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  await logAction(event, {
    actor: staff.user_id,
    actionType: 'tier.discard',
    summary: `Borrador del Tier Ranking descartado: ${lista.title ?? 'sin título'} (${count ?? 0} jugadores)`,
    payload: { tier_list_id: id },
    // Un borrador borrado no se puede devolver: sus entradas se fueron con él.
    reversible: false,
  })

  return { ok: true }
})
