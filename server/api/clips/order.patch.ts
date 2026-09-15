import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

const body = z.object({
  cambios: z
    .array(z.object({ id: z.string().uuid(), sortOrder: z.number().int().min(0).max(500) }))
    .min(1)
    .max(100),
})

/**
 * Guarda el orden después de subir o bajar un clip.
 *
 * Llegan las filas que cambiaron, no un movimiento suelto: el orden es
 * relativo. El cálculo lo hace `shared/clips.ts` y aquí solo se escribe, igual
 * que en el Tier Manager.
 */
export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const { cambios } = body.parse(await readBody(event))
  const db = serverSupabaseServiceRole<Database>(event)

  const resultados = await Promise.all(
    cambios.map((c) => db.from('clip').update({ sort_order: c.sortOrder }).eq('id', c.id)),
  )

  const fallo = resultados.find((r) => r.error)
  if (fallo?.error) throw createError({ statusCode: 500, statusMessage: fallo.error.message })

  return await cargarClips(event)
})
