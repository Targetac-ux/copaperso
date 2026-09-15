import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

const body = z.object({
  cost_bits: z.number().int().min(0).max(1_000_000).optional(),
  label: z.string().trim().min(1).max(80).optional(),
  active: z.boolean().optional(),
})

/**
 * Cambia el precio de una recompensa.
 *
 * Solo afecta de aquí en adelante: lo ya registrado en la bitácora guarda el
 * costo que se cobró entonces, así que subir un precio no reescribe la historia.
 */
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const id = getRouterParam(event, 'id')!
  const input = body.parse(await readBody(event))
  const db = serverSupabaseServiceRole<Database>(event)

  const { data: antes } = await db
    .from('action_catalog')
    .select('id, label, cost_bits')
    .eq('id', id)
    .maybeSingle()

  if (!antes) throw createError({ statusCode: 404, statusMessage: 'Esa recompensa no existe.' })

  const { data, error } = await db
    .from('action_catalog')
    .select('id, code, label, cost_bits, active')
    .eq('id', id)
    .maybeSingle()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  const { error: updateError } = await db.from('action_catalog').update(input).eq('id', id)
  if (updateError) throw createError({ statusCode: 500, statusMessage: updateError.message })

  // Se cuelga de la copa abierta, si la hay. El historial del CCTM es por
  // sesión: sin este id la entrada no sale en ninguna pantalla y su «deshacer»
  // —que existe desde la Fase 3C— no se podía pulsar nunca. Cambiar un precio
  // con la copa en marcha es además lo que más urge poder revertir.
  const { data: abierta } = await db
    .from('session')
    .select('id')
    .neq('status', 'closed')
    .limit(1)
    .maybeSingle()

  await logAction(event, {
    actor: staff.user_id,
    sessionId: abierta?.id ?? null,
    actionType: 'catalog.update',
    summary: `${antes.label}: ${antes.cost_bits} → ${input.cost_bits ?? antes.cost_bits} bits`,
    payload: { id, ...input },
    inversePayload: { op: 'catalog_cost', id, cost_bits: antes.cost_bits, label: antes.label },
  })

  return { ...data, ...input }
})
