import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

/** Las tiradas guardadas de la sesión, de la más reciente a la más vieja. */
export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const sessionId = getRouterParam(event, 'id')!
  const db = serverSupabaseServiceRole<Database>(event)

  const { data, error } = await db
    .from('blue_shell_result')
    .select('id, participation_id, match_id, outcome, spun_at, participation(player(display_name))')
    .eq('session_id', sessionId)
    .order('spun_at', { ascending: false })

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  type Fila = {
    id: string
    participation_id: string
    match_id: string | null
    outcome: string
    spun_at: string
    participation: { player: { display_name: string } | null } | null
  }

  return ((data ?? []) as unknown as Fila[]).map((f) => ({
    id: f.id,
    participationId: f.participation_id,
    matchId: f.match_id,
    outcome: f.outcome,
    spunAt: f.spun_at,
    displayName: f.participation?.player?.display_name ?? 'Sin nombre',
  }))
})
