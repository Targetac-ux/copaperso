import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

const body = z.object({
  person_name: z.string().trim().min(1).max(40),
  principal_bits: z.number().int().min(1).max(1_000_000),
  player_id: z.string().uuid().nullable().optional(),
  lent_at: z.string().date().optional(),
  note: z.string().trim().max(200).optional(),
})

/** Anota un préstamo. El interés corre solo: 10 % del original por día. */
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const input = body.parse(await readBody(event))
  const db = serverSupabaseServiceRole<Database>(event)

  const { data, error } = await db
    .from('loan')
    .insert({
      person_name: input.person_name,
      principal_bits: input.principal_bits,
      player_id: input.player_id ?? null,
      lent_at: input.lent_at ?? toLocalISODate(new Date()),
      note: input.note ?? null,
    })
    .select('id, person_name, principal_bits, lent_at, status')
    .single()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  await logAction(event, {
    actor: staff.user_id,
    actionType: 'loan.create',
    summary: `Préstamo: ${data.principal_bits} bits a ${data.person_name}`,
    payload: { loan_id: data.id },
    inversePayload: { op: 'delete_loan', loan_id: data.id },
  })

  setResponseStatus(event, 201)
  return data
})
