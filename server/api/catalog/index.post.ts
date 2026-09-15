import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import { codigoLibre } from '#shared/economy'
import type { Database } from '#shared/types/database.types'

const body = z.object({
  label: z.string().trim().min(1).max(80),
  cost_bits: z.number().int().min(0).max(1_000_000),
})

/**
 * Añade una recompensa al catálogo del mes en curso.
 *
 * **El catálogo es por periodo**, así que esto la añade al mes abierto. Al abrir
 * el siguiente se hereda, junto con los precios (ver `periods/index.post.ts`).
 *
 * El código se deriva del nombre una sola vez y ya no cambia: es lo que se
 * guarda en cada canjeo de la bitácora, y si cambiara, los canjeos viejos
 * dejarían de saber a qué recompensa se referían.
 */
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const { label, cost_bits } = body.parse(await readBody(event))
  const db = serverSupabaseServiceRole<Database>(event)

  const { data: activo } = await db
    .from('period')
    .select('id')
    .eq('status', 'active')
    .order('starts_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!activo) {
    throw createError({
      statusCode: 409,
      statusMessage: 'No hay ningún mes abierto. Abre el periodo antes de añadir recompensas.',
    })
  }

  const { data: existentes } = await db
    .from('action_catalog')
    .select('code, sort_order')
    .eq('period_id', activo.id)

  const usados = (existentes ?? []).map((a) => a.code)
  const code = codigoLibre(label, usados)
  const orden = Math.max(0, ...(existentes ?? []).map((a) => a.sort_order)) + 1

  const { error } = await db
    .from('action_catalog')
    .insert({ period_id: activo.id, code, label, cost_bits, sort_order: orden })

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  await logAction(event, {
    actor: staff.user_id,
    actionType: 'catalog.add',
    summary: `Nueva recompensa: «${label}» por ${cost_bits} bits`,
    payload: { code, label, cost_bits },
    reversible: false,
  })

  return { ok: true }
})
