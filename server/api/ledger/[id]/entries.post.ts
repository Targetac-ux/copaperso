import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

const body = z.object({
  delta_bits: z.number().int().default(0),
  delta_subs: z.number().int().default(0),
  reason: z.string().trim().min(1).max(120),
  session_id: z.string().uuid().nullable().optional(),
})

/**
 * Un movimiento en el banco.
 *
 * Los descuentos los hace el host a mano (§13): el sistema no cobra solo.
 * Esto solo apunta lo que él decide, y deja el saldo cuadrado.
 */
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const accountId = getRouterParam(event, 'id')!
  const input = body.parse(await readBody(event))
  const db = serverSupabaseServiceRole<Database>(event)

  if (!input.delta_bits && !input.delta_subs) {
    throw createError({ statusCode: 400, statusMessage: 'El movimiento no cambia nada.' })
  }

  const { data: cuenta } = await db
    .from('ledger_account')
    .select('id, display_name, balance_bits, balance_subs')
    .eq('id', accountId)
    .maybeSingle()

  if (!cuenta) throw createError({ statusCode: 404, statusMessage: 'Esa cuenta no existe.' })

  const { error: entryError } = await db.from('ledger_entry').insert({
    account_id: accountId,
    delta_bits: input.delta_bits,
    delta_subs: input.delta_subs,
    reason: input.reason,
    session_id: input.session_id ?? null,
    created_by: staff.user_id,
  })
  if (entryError) throw createError({ statusCode: 500, statusMessage: entryError.message })

  const { data, error } = await db
    .from('ledger_account')
    .update({
      balance_bits: cuenta.balance_bits + input.delta_bits,
      balance_subs: cuenta.balance_subs + input.delta_subs,
    })
    .eq('id', accountId)
    .select('id, display_name, balance_bits, balance_subs')
    .single()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  const signo = input.delta_bits >= 0 ? '+' : ''
  await logAction(event, {
    actor: staff.user_id,
    sessionId: input.session_id ?? null,
    actionType: 'ledger.entry',
    summary: `${cuenta.display_name}: ${signo}${input.delta_bits} bits · ${input.reason}`,
    payload: { account_id: accountId, ...input },
    inversePayload: {
      op: 'ledger_entry',
      account_id: accountId,
      delta_bits: -input.delta_bits,
      delta_subs: -input.delta_subs,
    },
  })

  return data
})
