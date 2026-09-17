import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

const body = z.object({
  title: z.string().trim().max(80).optional(),
  /** De dónde salen los jugadores: de la edición actual o del periodo. */
  desde: z.enum(['actual', 'periodo']).default('actual'),
  /**
   * Qué mes. Por defecto el activo, que es el caso normal.
   *
   * Se puede pedir otro para rellenar hacia atrás: con los ocho meses del
   * histórico ya importados, la edición de marzo tiene de dónde sembrarse. Al
   * publicarlas conviene ir de la más vieja a la más nueva —`is_current` tiene
   * un índice único y publicar baja la anterior— para que la vigente acabe
   * siendo la del mes más reciente, que es la que ve la Home.
   */
  period_id: z.string().uuid().optional(),
})

/**
 * Empieza una edición nueva del Tier Ranking.
 *
 * Nace como borrador —sin `published_at`— y **no toca la publicada**: son filas
 * distintas. Así el host puede prepararla con calma mientras la Home sigue
 * enseñando la anterior.
 *
 * Se puede partir de la edición vigente (para retocarla) o de un periodo —el
 * activo, o cualquier otro para rellenar meses pasados—. En ambos casos los
 * jugadores entran en D: el tier lo pone el host a mano, no se deduce de nada.
 */
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const input = body.parse(await readBody(event).catch(() => ({})))
  const db = serverSupabaseServiceRole<Database>(event)

  /**
   * Un borrador a medias se respeta; uno vacío se reaprovecha.
   *
   * La diferencia importa: si «Nueva edición» se pulsa antes de que exista una
   * publicada, no hay nada que copiar y el borrador nace sin nadie. Ese no es
   * trabajo de nadie, es un accidente — y negarse a empezar otro por su culpa
   * dejaba el módulo sin un solo botón que hiciera algo, porque un borrador
   * vacío tampoco se puede publicar.
   */
  const { data: borrador } = await db
    .from('tier_list')
    .select('id')
    .is('published_at', null)
    .maybeSingle()

  if (borrador) {
    const { count } = await db
      .from('tier_entry')
      .select('id', { count: 'exact', head: true })
      .eq('tier_list_id', borrador.id)

    if (count) {
      throw createError({
        statusCode: 409,
        statusMessage:
          'Ya hay una edición sin publicar. Publícala o descártala antes de empezar otra.',
      })
    }

    await db.from('tier_list').delete().eq('id', borrador.id)
  }

  const { data: periodo } = input.period_id
    ? await db.from('period').select('id, name').eq('id', input.period_id).maybeSingle()
    : await db
        .from('period')
        .select('id, name')
        .eq('status', 'active')
        .order('starts_at', { ascending: false })
        .limit(1)
        .maybeSingle()

  if (input.period_id && !periodo) {
    throw createError({ statusCode: 404, statusMessage: 'No hay ningún periodo con ese id.' })
  }

  const { data: lista, error } = await db
    .from('tier_list')
    .insert({
      period_id: periodo?.id ?? null,
      title: input.title ?? (periodo ? `Tier Ranking ${periodo.name}` : 'Tier Ranking'),
    })
    .select('id')
    .single()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  // Los jugadores de partida: o los de la edición vigente, o los del mes.
  if (input.desde === 'actual') {
    const { data: vigente } = await db
      .from('tier_list')
      .select('id')
      .eq('is_current', true)
      .maybeSingle()

    if (vigente) {
      const { data: previas } = await db
        .from('tier_entry')
        .select('player_id, tier, points, main_role, elo, rank_order')
        .eq('tier_list_id', vigente.id)
        .order('rank_order')

      // Copiando la vigente se conserva el tier: es un retoque, no un borrón.
      const { error: errCopia } = await db.from('tier_entry').insert(
        (previas ?? []).map((p) => ({
          tier_list_id: lista.id,
          player_id: p.player_id,
          tier: p.tier,
          points: p.points,
          main_role: p.main_role,
          elo: p.elo,
          rank_order: p.rank_order,
        })),
      )
      if (errCopia) throw createError({ statusCode: 500, statusMessage: errCopia.message })
    }
  } else if (periodo) {
    const { data: parts } = await db
      .from('participation')
      .select('player_id, elo, roles')
      .eq('period_id', periodo.id)

    // Todos entran en D: el tier lo pone el host, no se deduce de nada.
    const filas = (parts ?? []).map((p, i) => ({
      tier_list_id: lista.id,
      player_id: p.player_id,
      tier: 'D' as const,
      main_role: p.roles?.[0] ?? null,
      elo: p.elo,
      rank_order: i,
    }))

    if (filas.length) {
      const { error: errIns } = await db.from('tier_entry').insert(filas)
      if (errIns) throw createError({ statusCode: 500, statusMessage: errIns.message })
    }
  }

  await logAction(event, {
    actor: staff.user_id,
    actionType: 'tier.create',
    summary: `Edición nueva del Tier Ranking${periodo ? ` (${periodo.name})` : ''}`,
    payload: { tier_list_id: lista.id, desde: input.desde },
    inversePayload: { op: 'delete_tier_list', tier_list_id: lista.id },
  })

  return await cargarTabla(event, lista.id)
})
