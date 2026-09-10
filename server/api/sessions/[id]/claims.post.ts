import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import { effectiveCost } from '#shared/economy'
import type { Database } from '#shared/types/database.types'

const body = z.object({
  action_code: z.string().trim().min(1).max(40),
  beneficiary_participation_id: z.string().uuid().nullable().optional(),
  payer_account_id: z.string().uuid().nullable().optional(),
  paid_with: z.enum(['bits', 'sub_na', 'sub_latam']).default('bits'),
  note: z.string().trim().max(200).optional(),
})

/**
 * Registra una recompensa reclamada.
 *
 * **No mueve a nadie ni descuenta saldos.** Es una bitácora: el host cumple la
 * recompensa moviendo él mismo a los participantes y ajusta el banco a mano.
 * Aquí solo queda constancia de qué se reclamó, quién lo pagó y a qué precio.
 */
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const sessionId = getRouterParam(event, 'id')!
  const input = body.parse(await readBody(event))
  const db = serverSupabaseServiceRole<Database>(event)

  const { data: sesion } = await db
    .from('session')
    .select('id, period_id, prices_tripled')
    .eq('id', sessionId)
    .maybeSingle()

  if (!sesion) throw createError({ statusCode: 404, statusMessage: 'Esa sesión no existe.' })

  const { data: accion } = await db
    .from('action_catalog')
    .select('code, label, cost_bits')
    .eq('period_id', sesion.period_id)
    .eq('code', input.action_code)
    .maybeSingle()

  if (!accion) {
    throw createError({ statusCode: 404, statusMessage: 'Esa recompensa no está en el catálogo.' })
  }

  // Se congela el precio que se cobró: subir el catálogo luego no reescribe esto.
  const costo = effectiveCost(accion.cost_bits, sesion.prices_tripled)

  const { data, error } = await db
    .from('reward_claim')
    .insert({
      session_id: sessionId,
      action_code: accion.code,
      cost_bits: costo,
      tripled: sesion.prices_tripled,
      paid_with: input.paid_with,
      beneficiary_participation_id: input.beneficiary_participation_id ?? null,
      payer_account_id: input.payer_account_id ?? null,
      note: input.note ?? null,
      created_by: staff.user_id,
    })
    .select('id, action_code, cost_bits, tripled, paid_with, note, created_at')
    .single()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  await logAction(event, {
    actor: staff.user_id,
    sessionId,
    actionType: 'reward.claim',
    summary: `${accion.label} reclamada · ${costo} bits${sesion.prices_tripled ? ' (×3)' : ''}`,
    payload: { claim_id: data.id, action_code: accion.code, cost_bits: costo },
    inversePayload: { op: 'delete_claim', claim_id: data.id },
  })

  setResponseStatus(event, 201)
  return data
})
