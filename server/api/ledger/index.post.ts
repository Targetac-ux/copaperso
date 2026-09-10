import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

const body = z.object({
  display_name: z.string().trim().min(1).max(40),
  /** Un donador externo no juega, pero tiene saldo igual (§15). */
  kind: z.enum(['player', 'supporter']).default('supporter'),
  player_id: z.string().uuid().nullable().optional(),
  balance_bits: z.number().int().default(0),
  balance_subs: z.number().int().default(0),
})

/** Abre una cuenta en el banco. */
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const input = body.parse(await readBody(event))
  const db = serverSupabaseServiceRole<Database>(event)

  const { data, error } = await db
    .from('ledger_account')
    .insert({
      display_name: input.display_name,
      kind: input.kind,
      player_id: input.player_id ?? null,
      balance_bits: input.balance_bits,
      balance_subs: input.balance_subs,
    })
    .select('id, display_name, kind, balance_bits, balance_subs')
    .single()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  await logAction(event, {
    actor: staff.user_id,
    actionType: 'ledger.open',
    summary: `Cuenta abierta: ${data.display_name} (${data.balance_bits} bits)`,
    payload: { account_id: data.id },
    inversePayload: { op: 'delete_account', account_id: data.id },
  })

  setResponseStatus(event, 201)
  return data
})
