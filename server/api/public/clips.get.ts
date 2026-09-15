import { serverSupabaseServiceRole } from '#supabase/server'
import { MAX_EN_HOME } from '#shared/clips'
import type { Database } from '#shared/types/database.types'

/**
 * Los clips de la Home. **Sin autenticación a propósito.**
 *
 * Lee la vista `public_clips`, que ya deja fuera los ocultos y solo tiene estas
 * cuatro columnas. El tope no es de la base: cada clip carga un reproductor
 * entero de Twitch y una fila de seis ya es más de lo que nadie mira.
 */
export default defineEventHandler(async (event) => {
  const db = serverSupabaseServiceRole<Database>(event)

  const { data, error } = await db
    .from('public_clips')
    .select('slug, title, edition, sort_order')
    .order('sort_order')
    .limit(MAX_EN_HOME)

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  return (data ?? []).map((c) => ({ slug: c.slug, title: c.title, edition: c.edition }))
})
