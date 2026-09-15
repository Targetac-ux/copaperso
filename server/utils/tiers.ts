import type { H3Event } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Edicion, EntradaTier } from '#shared/tiers'
import type { Database, EloTierDb, PlayerRoleDb, TierName } from '#shared/types/database.types'

type FilaEntrada = {
  id: string
  player_id: string
  tier: TierName
  points: number | null
  main_role: PlayerRoleDb | null
  elo: EloTierDb | null
  rank_order: number
  player: { display_name: string; photo_url: string | null } | null
}

export interface TablaCargada {
  edicion: Edicion | null
  entradas: EntradaTier[]
}

/**
 * La edición que el host está preparando, o la que le pidan por id.
 *
 * Sin id devuelve el borrador: el que aún no se ha publicado. Si no hay
 * ninguno, devuelve la publicada actual para que se vea algo y el host decida
 * si empieza una nueva.
 */
export async function cargarTabla(event: H3Event, tierListId?: string): Promise<TablaCargada> {
  const db = serverSupabaseServiceRole<Database>(event)

  const { data: lista } = tierListId
    ? await db
        .from('tier_list')
        .select('id, title, published_at, is_current, created_at, period(name)')
        .eq('id', tierListId)
        .maybeSingle()
    : await db
        .from('tier_list')
        .select('id, title, published_at, is_current, created_at, period(name)')
        .is('published_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

  const fila =
    lista ??
    (
      await db
        .from('tier_list')
        .select('id, title, published_at, is_current, created_at, period(name)')
        .eq('is_current', true)
        .maybeSingle()
    ).data

  if (!fila) return { edicion: null, entradas: [] }

  const { data: entradas, error } = await db
    .from('tier_entry')
    .select('id, player_id, tier, points, main_role, elo, rank_order, player(display_name, photo_url)')
    .eq('tier_list_id', fila.id)
    .order('rank_order')

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  const periodo = fila.period as unknown as { name: string } | null

  return {
    edicion: {
      id: fila.id,
      title: fila.title,
      periodName: periodo?.name ?? null,
      publishedAt: fila.published_at,
      isCurrent: fila.is_current,
      createdAt: fila.created_at,
    },
    entradas: ((entradas ?? []) as unknown as FilaEntrada[]).map((e) => ({
      id: e.id,
      playerId: e.player_id,
      displayName: e.player?.display_name ?? 'Sin nombre',
      photoUrl: e.player?.photo_url ?? null,
      tier: e.tier,
      points: e.points,
      mainRole: e.main_role,
      elo: e.elo,
      rankOrder: e.rank_order,
    })),
  }
}
