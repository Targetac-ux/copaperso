import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import { parseLocalDate, toLocalISODate, periodNameFor, monthStart } from '#shared/period'
import type { Database } from '#shared/types/database.types'

const body = z.object({
  name: z.string().trim().min(3).max(20).optional(),
  starts_at: z.string().date().optional(),
})

/**
 * Abre un mes nuevo.
 *
 * No arrastra a nadie del mes anterior: cada periodo empieza vacío y quien
 * vuelve se reincorpora con 100 LP (§5). El periodo anterior se cierra, para
 * que su roster quede congelado.
 */
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const input = body.parse((await readBody(event)) ?? {})
  const db = serverSupabaseServiceRole<Database>(event)

  const starts = input.starts_at ? parseLocalDate(input.starts_at) : new Date()
  if (!starts) throw createError({ statusCode: 400, statusMessage: 'Esa fecha no es válida.' })

  const name = input.name ?? periodNameFor(starts)

  const { data: existe } = await db.from('period').select('id').eq('name', name).maybeSingle()
  if (existe) {
    throw createError({ statusCode: 409, statusMessage: `El periodo ${name} ya existe.` })
  }

  const { data, error } = await db
    .from('period')
    .insert({
      name,
      starts_at: toLocalISODate(monthStart(starts)),
      status: 'active',
    })
    .select('id, name, starts_at, ends_at, status, created_at')
    .single()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  // Cerrar los demás: solo hay un periodo activo a la vez.
  await db.from('period').update({ status: 'closed' }).eq('status', 'active').neq('id', data.id)

  // Y sembrar su catálogo de recompensas con los costos vigentes.
  await db.rpc('seed_action_catalog', { p_period_id: data.id })

  await logAction(event, {
    actor: staff.user_id,
    actionType: 'period.create',
    summary: `Periodo abierto: ${data.name}`,
    payload: { period_id: data.id, name: data.name },
    reversible: false,
  })

  setResponseStatus(event, 201)
  return data
})
