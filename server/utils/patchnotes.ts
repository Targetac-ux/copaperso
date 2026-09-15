import type { H3Event } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { ordenar } from '#shared/patchnotes'
import type { PatchNote } from '#shared/patchnotes'
import type { Database } from '#shared/types/database.types'

/** Todos los parches, publicados o no. Los borradores van arriba. */
export async function cargarParches(event: H3Event): Promise<PatchNote[]> {
  const db = serverSupabaseServiceRole<Database>(event)

  const { data, error } = await db
    .from('rule_patch')
    .select('id, version, title, body, published_at')
    .order('created_at', { ascending: false })

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  return ordenar(
    (data ?? []).map((n) => ({
      id: n.id,
      version: n.version,
      title: n.title,
      body: n.body,
      publishedAt: n.published_at,
    })),
  )
}
