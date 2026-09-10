import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

/**
 * Saca a alguien del periodo.
 *
 * Borra la participación, nunca el perfil permanente: el histórico de meses
 * anteriores y el nombre siguen ahí para no volver a duplicarlo (§8).
 */
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const id = getRouterParam(event, 'id')!
  const db = serverSupabaseServiceRole<Database>(event)

  const { data: participation } = await db
    .from('participation')
    .select('id, player_id, period_id, roles, elo, current_lp, player(display_name)')
    .eq('id', id)
    .maybeSingle()

  if (!participation) {
    throw createError({ statusCode: 404, statusMessage: 'Esa participación no existe.' })
  }

  const { error } = await db.from('participation').delete().eq('id', id)
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  const nombre =
    (participation.player as unknown as { display_name: string } | null)?.display_name ?? 'Alguien'

  await logAction(event, {
    actor: staff.user_id,
    actionType: 'participation.delete',
    summary: `${nombre} sale del periodo`,
    payload: { participation_id: id, player_id: participation.player_id },
    inversePayload: {
      op: 'restore_participation',
      player_id: participation.player_id,
      period_id: participation.period_id,
      roles: participation.roles,
      elo: participation.elo,
    },
  })

  return { ok: true }
})
