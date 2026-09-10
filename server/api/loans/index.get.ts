import { serverSupabaseServiceRole } from '#supabase/server'
import { loanAmountDue, loanInterest } from '#shared/economy'
import type { Database } from '#shared/types/database.types'

/** Préstamos con su adeudo al día de hoy (§19): 10 % lineal diario. */
export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const db = serverSupabaseServiceRole<Database>(event)

  const { data, error } = await db
    .from('loan')
    .select('id, person_name, principal_bits, daily_rate, lent_at, status, settled_at, settled_amount, note')
    .order('lent_at', { ascending: false })

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  return (data ?? []).map((l) => {
    const prestamo = {
      principalBits: l.principal_bits,
      dailyRate: Number(l.daily_rate),
      lentAt: l.lent_at,
      settledAt: l.settled_at,
    }
    return { ...l, amount_due: loanAmountDue(prestamo), interest: loanInterest(prestamo) }
  })
})
