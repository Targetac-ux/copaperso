import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

/** El Banco de bits/subs (§14): jugadores y donadores externos, con su saldo. */
export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const db = serverSupabaseServiceRole<Database>(event)

  const { data, error } = await db
    .from('ledger_account')
    .select('id, player_id, display_name, kind, balance_bits, balance_subs, updated_at')
    .order('balance_bits', { ascending: false })

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  return data ?? []
})
