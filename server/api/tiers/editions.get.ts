import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

/** El histórico de ediciones, de la más reciente a la más vieja. */
export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const db = serverSupabaseServiceRole<Database>(event)

  const { data, error } = await db
    .from('tier_list')
    .select('id, title, published_at, is_current, created_at, period(name), tier_entry(count)')
    .order('created_at', { ascending: false })

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  type Fila = {
    id: string
    title: string | null
    published_at: string | null
    is_current: boolean
    created_at: string
    period: { name: string } | null
    tier_entry: { count: number }[]
  }

  return ((data ?? []) as unknown as Fila[]).map((f) => ({
    id: f.id,
    title: f.title,
    periodName: f.period?.name ?? null,
    publishedAt: f.published_at,
    isCurrent: f.is_current,
    createdAt: f.created_at,
    jugadores: f.tier_entry?.[0]?.count ?? 0,
  }))
})
