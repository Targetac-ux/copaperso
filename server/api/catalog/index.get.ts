import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import { priceList } from '#shared/economy'
import type { Database } from '#shared/types/database.types'

const query = z.object({
  session_id: z.string().uuid().optional(),
  /** Ajustes las necesita todas; la mesa solo las que están puestas. */
  incluir_quitadas: z.coerce.boolean().optional(),
})

/**
 * La lista de precios de las recompensas (§13).
 *
 * Si se pide para una sesión, devuelve además el precio efectivo: el mismo
 * catálogo multiplicado si esa sesión ya entró en tiempo extra.
 */
export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const { session_id, incluir_quitadas } = query.parse(getQuery(event))
  const db = serverSupabaseServiceRole<Database>(event)

  let periodId: string | null = null
  let tripled = false

  if (session_id) {
    const { data: sesion } = await db
      .from('session')
      .select('period_id, prices_tripled')
      .eq('id', session_id)
      .maybeSingle()
    periodId = sesion?.period_id ?? null
    tripled = sesion?.prices_tripled ?? false
  }

  if (!periodId) {
    const { data: activo } = await db
      .from('period')
      .select('id')
      .eq('status', 'active')
      .order('starts_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    periodId = activo?.id ?? null
  }

  if (!periodId) return { tripled: false, actions: [] }

  let consulta = db
    .from('action_catalog')
    .select('id, code, label, cost_bits, sort_order, active')
    .eq('period_id', periodId)
    .order('sort_order')

  if (!incluir_quitadas) consulta = consulta.eq('active', true)

  const { data, error } = await consulta

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  const acciones = (data ?? []).map((a) => ({ ...a, costBits: a.cost_bits }))
  return {
    tripled,
    actions: priceList(acciones, tripled).map((a) => ({
      id: (a as unknown as { id: string }).id,
      code: a.code,
      label: a.label,
      cost_bits: a.costBits,
      effective: a.effective,
      active: (a as unknown as { active: boolean }).active,
    })),
  }
})
