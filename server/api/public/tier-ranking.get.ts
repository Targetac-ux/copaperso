import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database, EloTierDb, PlayerRoleDb, TierName } from '#shared/types/database.types'

/**
 * El Tier Ranking público. **Sin autenticación a propósito.**
 *
 * Lee la vista `public_tier_ranking`, que ya filtra por la edición vigente y
 * publicada: mientras el host prepara la siguiente, aquí se sigue viendo la
 * anterior. La vista no expone más columnas que estas, y hay un test unitario
 * que falla si alguien le añade una privada.
 */
export default defineEventHandler(async (event) => {
  const db = serverSupabaseServiceRole<Database>(event)

  const { data, error } = await db
    .from('public_tier_ranking')
    .select('tier, rank_order, points, main_role, elo, display_name, photo_url, edition_title, published_at')
    .order('rank_order')

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  type Fila = {
    tier: TierName
    rank_order: number
    points: number | null
    main_role: PlayerRoleDb | null
    elo: EloTierDb | null
    display_name: string
    photo_url: string | null
    edition_title: string | null
    published_at: string | null
  }

  const filas = (data ?? []) as unknown as Fila[]

  return {
    edicion: filas[0] ? { title: filas[0].edition_title, publishedAt: filas[0].published_at } : null,
    entradas: filas.map((f) => ({
      tier: f.tier,
      rankOrder: f.rank_order,
      points: f.points,
      mainRole: f.main_role,
      elo: f.elo,
      displayName: f.display_name,
      photoUrl: f.photo_url,
    })),
  }
})
