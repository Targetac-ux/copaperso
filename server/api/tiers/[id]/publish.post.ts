import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

/**
 * Publica una edición: a partir de aquí es la que ve la Home.
 *
 * La anterior **no se modifica**, solo deja de ser la vigente: sus filas siguen
 * donde estaban y se pueden volver a consultar. Es lo que hace que el histórico
 * de ediciones signifique algo.
 *
 * El orden importa: la base tiene un índice único sobre `is_current`, así que
 * hay que bajar la vigente antes de subir la nueva o el insert choca.
 */
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const tierListId = getRouterParam(event, 'id')!
  const db = serverSupabaseServiceRole<Database>(event)

  const { data: lista } = await db
    .from('tier_list')
    .select('id, title, published_at, is_current')
    .eq('id', tierListId)
    .maybeSingle()

  if (!lista) throw createError({ statusCode: 404, statusMessage: 'Esa edición no existe.' })
  if (lista.is_current) return await cargarTabla(event, tierListId)

  const { count } = await db
    .from('tier_entry')
    .select('id', { count: 'exact', head: true })
    .eq('tier_list_id', tierListId)

  if (!count) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Esa edición no tiene a nadie: publicarla dejaría la Home vacía.',
    })
  }

  const { data: anterior } = await db
    .from('tier_list')
    .select('id')
    .eq('is_current', true)
    .maybeSingle()

  if (anterior) {
    await db.from('tier_list').update({ is_current: false }).eq('id', anterior.id)
  }

  const { error } = await db
    .from('tier_list')
    .update({ is_current: true, published_at: lista.published_at ?? new Date().toISOString() })
    .eq('id', tierListId)

  if (error) {
    // Si falla, se devuelve la anterior a su sitio: peor que no publicar es
    // dejar la Home sin ninguna edición vigente.
    if (anterior) await db.from('tier_list').update({ is_current: true }).eq('id', anterior.id)
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  await logAction(event, {
    actor: staff.user_id,
    actionType: 'tier.publish',
    summary: `Publicado el Tier Ranking: ${lista.title ?? 'sin título'} (${count} jugadores)`,
    payload: { tier_list_id: tierListId, anterior: anterior?.id ?? null },
    inversePayload: { op: 'unpublish_tier_list', tier_list_id: tierListId, anterior: anterior?.id ?? null },
  })

  return await cargarTabla(event, tierListId)
})
