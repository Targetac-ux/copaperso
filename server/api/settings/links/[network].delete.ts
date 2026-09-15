import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

/** Quita el enlace de una red. En la Home deja de salir su icono. */
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const network = getRouterParam(event, 'network')!
  const db = serverSupabaseServiceRole<Database>(event)

  const { error } = await db.from('site_link').delete().eq('network', network)
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  await logAction(event, {
    actor: staff.user_id,
    actionType: 'settings.link',
    summary: `Quitado el enlace de ${network}`,
    payload: { network },
    reversible: false,
  })

  return await cargarAjustes(event)
})
