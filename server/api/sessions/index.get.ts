import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

const query = z.object({ period_id: z.string().uuid().optional() })

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const { period_id } = query.parse(getQuery(event))
  const db = serverSupabaseServiceRole<Database>(event)

  let request = db
    .from('session')
    .select('id, period_id, number, mode, status, started_at, closed_at')
    .order('number', { ascending: false })

  if (period_id) request = request.eq('period_id', period_id)

  const { data, error } = await request
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  return data ?? []
})
