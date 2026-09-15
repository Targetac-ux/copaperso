import { serverSupabaseServiceRole } from '#supabase/server'
import { esRedConocida } from '#shared/ajustes'
import type { Red } from '#shared/ajustes'
import type { Database } from '#shared/types/database.types'

/**
 * Los enlaces del sitio. **Sin autenticación a propósito.**
 *
 * Lee la vista `public_site_links`, que ya deja fuera los ocultos y solo tiene
 * la red, la URL y el orden.
 */
export default defineEventHandler(async (event) => {
  const db = serverSupabaseServiceRole<Database>(event)

  const { data, error } = await db
    .from('public_site_links')
    .select('network, url, sort_order')
    .order('sort_order')

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  return (data ?? [])
    .filter((e) => esRedConocida(e.network))
    .map((e) => ({ network: e.network as Red, url: e.url, sortOrder: e.sort_order, visible: true }))
})
