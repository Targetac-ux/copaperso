import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

const query = z.object({
  q: z.string().trim().max(60).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

/** Busca perfiles permanentes. Es la base del autocomplete del registro (§4). */
export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const { q, limit } = query.parse(getQuery(event))
  const db = serverSupabaseServiceRole<Database>(event)

  let request = db
    .from('player')
    .select('id, display_name, slug, photo_url, twitch_handle, created_at')
    .order('display_name')
    .limit(limit)

  if (q) request = request.ilike('slug', `%${slugify(q)}%`)

  const { data, error } = await request
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  return data ?? []
})
