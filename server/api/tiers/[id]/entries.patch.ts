import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import { TIERS } from '#shared/tiers'
import type { Database } from '#shared/types/database.types'

const body = z.object({
  cambios: z
    .array(
      z.object({
        id: z.string().uuid(),
        tier: z.enum(TIERS as [string, ...string[]]),
        rankOrder: z.number().int().min(0).max(500),
      }),
    )
    .min(1)
    .max(200),
})

/**
 * Guarda un movimiento de la tabla.
 *
 * Llega la lista de filas que cambiaron —quién, a qué tier y en qué posición—,
 * no un movimiento suelto: el orden es relativo, así que mover a uno renumera a
 * los de su fila vieja y a los de la nueva. El cálculo lo hace `shared/tiers.ts`
 * y aquí solo se escribe.
 *
 * **Una edición publicada no se toca.** Si el host quiere cambiar algo, empieza
 * una nueva: esa es la garantía de que el histórico no se reescribe.
 */
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const tierListId = getRouterParam(event, 'id')!
  const { cambios } = body.parse(await readBody(event))
  const db = serverSupabaseServiceRole<Database>(event)

  const { data: lista } = await db
    .from('tier_list')
    .select('id, published_at')
    .eq('id', tierListId)
    .maybeSingle()

  if (!lista) throw createError({ statusCode: 404, statusMessage: 'Esa edición no existe.' })
  if (lista.published_at) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Esa edición ya está publicada. Empieza una nueva para cambiarla.',
    })
  }

  // Cómo estaban, para poder deshacerlo.
  const { data: antes } = await db
    .from('tier_entry')
    .select('id, tier, rank_order')
    .in('id', cambios.map((c) => c.id))
    .eq('tier_list_id', tierListId)

  if ((antes ?? []).length !== cambios.length) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Alguno de esos jugadores no está en esta edición.',
    })
  }

  await Promise.all(
    cambios.map((c) =>
      db
        .from('tier_entry')
        .update({ tier: c.tier as (typeof TIERS)[number], rank_order: c.rankOrder })
        .eq('id', c.id)
        .eq('tier_list_id', tierListId),
    ),
  )

  // Mover gente por la tabla es un gesto continuo: registrarlo entrada por
  // entrada llenaría el historial de ruido. Lo que sí se registra es publicar,
  // que es la acción que sale a la calle.
  void staff

  return await cargarTabla(event, tierListId)
})
