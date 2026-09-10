import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

/** Levanta una restricción. No la borra: la desactiva, para que quede el rastro. */
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const id = getRouterParam(event, 'id')!
  const db = serverSupabaseServiceRole<Database>(event)

  const { error } = await db.from('restriction').update({ active: false }).eq('id', id)
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  await logAction(event, {
    actor: staff.user_id,
    actionType: 'restriction.lift',
    summary: 'Restricción levantada',
    payload: { restriction_id: id },
    inversePayload: { op: 'restore_restriction', restriction_id: id },
  })

  return { ok: true }
})
