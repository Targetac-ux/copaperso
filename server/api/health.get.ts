import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

/** Comprobación de vida: la usa el cron semanal que evita que Supabase pause el proyecto. */
export default defineEventHandler(async (event) => {
  const db = serverSupabaseServiceRole<Database>(event)
  const started = Date.now()
  const { error } = await db.from('period').select('id').limit(1)

  return {
    ok: !error,
    database: error ? 'error' : 'ok',
    message: error?.message,
    latencyMs: Date.now() - started,
    time: new Date().toISOString(),
  }
})
