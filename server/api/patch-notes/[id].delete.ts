import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

/** Borra un parche. Lo que ya se leyó no se puede desleer, pero deja de estar. */
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const id = getRouterParam(event, 'id')!
  const db = serverSupabaseServiceRole<Database>(event)

  const { data: parche } = await db.from('rule_patch').select('title').eq('id', id).maybeSingle()
  if (!parche) throw createError({ statusCode: 404, statusMessage: 'Ese parche no existe.' })

  const { error } = await db.from('rule_patch').delete().eq('id', id)
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  await logAction(event, {
    actor: staff.user_id,
    actionType: 'patch.remove',
    summary: `Borrado el parche «${parche.title}»`,
    payload: { title: parche.title },
    reversible: false,
  })

  return await cargarParches(event)
})
