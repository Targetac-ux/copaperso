import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

const body = z.object({
  title: z.string().trim().min(1).max(120),
  version: z.string().trim().max(40).optional().nullable(),
})

/**
 * Empieza un parche nuevo. **Nace sin publicar**: un parche a medio escribir no
 * tiene por qué verse en la web.
 */
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const { title, version } = body.parse(await readBody(event))
  const db = serverSupabaseServiceRole<Database>(event)

  const { error } = await db.from('rule_patch').insert({ title, version: version || null })
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  await logAction(event, {
    actor: staff.user_id,
    actionType: 'patch.create',
    summary: `Nuevo parche de reglas: «${title}»`,
    payload: { title },
    reversible: false,
  })

  return await cargarParches(event)
})
