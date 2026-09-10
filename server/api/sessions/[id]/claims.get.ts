import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

/** Lo que se ha reclamado en esta sesión. */
export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const sessionId = getRouterParam(event, 'id')!
  const db = serverSupabaseServiceRole<Database>(event)

  const { data, error } = await db
    .from('reward_claim')
    .select('id, action_code, cost_bits, tripled, paid_with, note, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  return data ?? []
})
