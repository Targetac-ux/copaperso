import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

/**
 * Los patch notes publicados. **Sin autenticación a propósito.**
 *
 * Lee la vista `public_patch_notes`, que ya deja fuera los borradores: un
 * parche a medio escribir no sale de la base.
 */
export default defineEventHandler(async (event) => {
  const db = serverSupabaseServiceRole<Database>(event)

  const { data, error } = await db
    .from('public_patch_notes')
    .select('id, version, title, body, published_at')
    .order('published_at', { ascending: false })

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  return (data ?? []).map((n) => ({
    id: n.id,
    version: n.version,
    title: n.title,
    body: n.body,
    publishedAt: n.published_at,
  }))
})
