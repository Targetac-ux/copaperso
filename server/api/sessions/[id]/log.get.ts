import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

const query = z.object({ limit: z.coerce.number().int().min(1).max(100).default(25) })

/** El historial de la sesión (§21), de lo más reciente a lo más antiguo. */
export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const sessionId = getRouterParam(event, 'id')!
  const { limit } = query.parse(getQuery(event))
  const db = serverSupabaseServiceRole<Database>(event)

  const { data, error } = await db
    .from('action_log')
    .select('id, action_type, summary, created_at, undone_at, reversible')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  return data ?? []
})
