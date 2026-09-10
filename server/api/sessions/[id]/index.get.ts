import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

/** El estado completo de la mesa de control: sesión, banca y equipos. */
export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = getRouterParam(event, 'id')!
  const db = serverSupabaseServiceRole<Database>(event)

  const { data: session, error } = await db
    .from('session')
    .select('id, period_id, number, mode, status, started_at, closed_at')
    .eq('id', id)
    .maybeSingle()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  if (!session) throw createError({ statusCode: 404, statusMessage: 'Esa sesión no existe.' })

  return { session, draft: await loadDraftState(event, id) }
})
