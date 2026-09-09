import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

const query = z.object({ period_id: z.string().uuid().optional() })

/** Quién está registrado en un periodo, con su LP actual. */
export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const { period_id } = query.parse(getQuery(event))
  const db = serverSupabaseServiceRole<Database>(event)

  let periodId = period_id
  if (!periodId) {
    const { data: activo } = await db
      .from('period')
      .select('id')
      .eq('status', 'active')
      .order('starts_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!activo) return []
    periodId = activo.id
  }

  const { data, error } = await db
    .from('participation')
    .select('id, player_id, elo, roles, initial_lp, current_lp, created_at, player(id, display_name, slug, photo_url)')
    .eq('period_id', periodId)
    .order('created_at')

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  return data ?? []
})
