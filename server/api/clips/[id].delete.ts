import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

/**
 * Quita un clip de la lista.
 *
 * No se deshace desde el historial: volver a ponerlo es pegar el enlace otra
 * vez, y el clip sigue existiendo en Twitch. Por eso se registra como no
 * reversible en vez de prometer un botón que no haría nada.
 */
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const id = getRouterParam(event, 'id')!
  const db = serverSupabaseServiceRole<Database>(event)

  const { data: clip } = await db.from('clip').select('slug, title').eq('id', id).maybeSingle()
  if (!clip) throw createError({ statusCode: 404, statusMessage: 'Ese clip no existe.' })

  const { error } = await db.from('clip').delete().eq('id', id)
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  await logAction(event, {
    actor: staff.user_id,
    actionType: 'clip.remove',
    summary: `Quitado el clip «${clip.title}» de la Home`,
    payload: { slug: clip.slug, title: clip.title },
    reversible: false,
  })

  return await cargarClips(event)
})
