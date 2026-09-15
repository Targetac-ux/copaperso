import type { H3Event } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Clip } from '#shared/clips'
import type { Database } from '#shared/types/database.types'

/** La lista completa, en el orden en que el host la dejó. */
export async function cargarClips(event: H3Event): Promise<Clip[]> {
  const db = serverSupabaseServiceRole<Database>(event)

  const { data, error } = await db
    .from('clip')
    .select('id, slug, title, edition, sort_order, visible')
    .order('sort_order')
    .order('created_at')

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  return (data ?? []).map((c) => ({
    id: c.id,
    slug: c.slug,
    title: c.title,
    edition: c.edition,
    sortOrder: c.sort_order,
    visible: c.visible,
  }))
}
