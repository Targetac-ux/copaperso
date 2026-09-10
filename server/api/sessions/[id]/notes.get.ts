import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

/**
 * Notas, extras y restricciones de la sesión (§18, §20).
 *
 * Todo esto es texto que administra el host: condiciones especiales, premios,
 * penalizaciones y limitaciones como "PlayerX no puede TOP". El sistema no las
 * hace cumplir; las tiene a la vista para que el host decida.
 */
export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const sessionId = getRouterParam(event, 'id')!
  const db = serverSupabaseServiceRole<Database>(event)

  const { data: participantes } = await db
    .from('session_participant')
    .select('participation_id')
    .eq('session_id', sessionId)

  const ids = (participantes ?? []).map((p) => p.participation_id)

  const [notas, extras, restricciones] = await Promise.all([
    db.from('note').select('id, scope, ref_id, body, created_at').eq('ref_id', sessionId),
    db.from('extra').select('id, scope, ref_id, kind, body, created_at').eq('ref_id', sessionId),
    ids.length
      ? db
          .from('restriction')
          .select('id, participation_id, kind, value, note, active')
          .in('participation_id', ids)
          .eq('active', true)
      : Promise.resolve({ data: [] as never[] }),
  ])

  // Nombres para poder enseñar "Target: no puede MID" y no un uuid.
  const nombres = new Map<string, string>()
  if (ids.length) {
    const { data } = await db
      .from('participation')
      .select('id, player(display_name)')
      .in('id', ids)
    for (const p of data ?? []) {
      const nombre = (p.player as unknown as { display_name: string } | null)?.display_name
      if (nombre) nombres.set(p.id, nombre)
    }
  }

  return {
    notes: notas.data ?? [],
    extras: extras.data ?? [],
    restrictions: (restricciones.data ?? []).map((r) => ({
      ...r,
      player_name: nombres.get(r.participation_id) ?? 'Alguien',
    })),
  }
})
