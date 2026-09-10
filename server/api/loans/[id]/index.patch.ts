import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import { loanAmountDue } from '#shared/economy'
import type { Database } from '#shared/types/database.types'

const body = z.object({
  status: z.enum(['open', 'settled', 'forgiven']),
  settled_amount: z.number().int().min(0).optional(),
  note: z.string().trim().max(200).optional(),
})

/** Salda o perdona un préstamo. Al saldarlo, el interés deja de correr. */
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const id = getRouterParam(event, 'id')!
  const input = body.parse(await readBody(event))
  const db = serverSupabaseServiceRole<Database>(event)

  const { data: prestamo } = await db
    .from('loan')
    .select('id, person_name, principal_bits, daily_rate, lent_at, status')
    .eq('id', id)
    .maybeSingle()

  if (!prestamo) throw createError({ statusCode: 404, statusMessage: 'Ese préstamo no existe.' })

  const cierra = input.status !== 'open'
  const hoy = toLocalISODate(new Date())
  const debido = loanAmountDue({
    principalBits: prestamo.principal_bits,
    dailyRate: Number(prestamo.daily_rate),
    lentAt: prestamo.lent_at,
  })

  const { data, error } = await db
    .from('loan')
    .update({
      status: input.status,
      settled_at: cierra ? hoy : null,
      settled_amount: cierra ? (input.settled_amount ?? debido) : null,
      note: input.note ?? null,
    })
    .eq('id', id)
    .select('id, person_name, status, settled_at, settled_amount')
    .single()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  await logAction(event, {
    actor: staff.user_id,
    actionType: `loan.${input.status}`,
    summary:
      input.status === 'settled'
        ? `${prestamo.person_name} pagó ${data.settled_amount} bits`
        : input.status === 'forgiven'
          ? `Préstamo perdonado a ${prestamo.person_name}`
          : `Préstamo de ${prestamo.person_name} reabierto`,
    payload: { loan_id: id, ...input },
    inversePayload: { op: 'loan_status', loan_id: id, status: prestamo.status },
  })

  return data
})
