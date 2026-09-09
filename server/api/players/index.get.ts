import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import { matchNames } from '#shared/similarity'
import type { Database } from '#shared/types/database.types'

const query = z.object({
  q: z.string().trim().max(60).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(8),
})

/**
 * Busca perfiles permanentes: es lo que alimenta el autocomplete del registro (§4).
 *
 * El ranking por parecido se hace en memoria a propósito. CopaPerso maneja
 * decenas de jugadores, no millones, y traerlos todos y ordenarlos aquí detecta
 * erratas ("Taget" → Target) que un LIKE de SQL nunca encontraría. Si algún día
 * el roster creciera muchísimo, esto se movería a pg_trgm.
 */
export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const { q, limit } = query.parse(getQuery(event))
  const db = serverSupabaseServiceRole<Database>(event)

  const { data, error } = await db
    .from('player')
    .select('id, display_name, slug, photo_url, twitch_handle, created_at')
    .order('display_name')
    .limit(500)

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  const players = data ?? []
  if (!q) return players.slice(0, limit).map((player) => ({ player, kind: 'all' as const }))

  return matchNames(q, players, (p) => p.display_name, limit).map((m) => ({
    player: m.item,
    kind: m.kind,
    score: Number(m.score.toFixed(3)),
  }))
})
