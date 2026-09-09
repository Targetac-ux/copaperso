import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

/** Los periodos, del más reciente al más antiguo, con cuánta gente participó. */
export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const db = serverSupabaseServiceRole<Database>(event)

  const { data: periods, error } = await db
    .from('period')
    .select('id, name, starts_at, ends_at, status, created_at')
    .order('starts_at', { ascending: false })

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  const { data: participations } = await db.from('participation').select('period_id')
  const { data: sessions } = await db.from('session').select('period_id')

  return (periods ?? []).map((period) => ({
    ...period,
    participants: participations?.filter((p) => p.period_id === period.id).length ?? 0,
    sessions: sessions?.filter((s) => s.period_id === period.id).length ?? 0,
  }))
})
