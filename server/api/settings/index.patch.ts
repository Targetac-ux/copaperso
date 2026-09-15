import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import { CLAVES } from '#shared/ajustes'
import { clampSeconds } from '#shared/timer'
import type { Database } from '#shared/types/database.types'

const body = z.object({
  cronometro: z.number().int().optional(),
})

/**
 * Guarda los ajustes escalares. De momento solo la duración por defecto del
 * cronómetro, que **afecta a las sesiones nuevas**: la que esté abierta
 * conserva la suya, porque el host ya la habrá ajustado a mano si le hacía falta.
 */
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const campos = body.parse(await readBody(event))
  const db = serverSupabaseServiceRole<Database>(event)

  if (campos.cronometro !== undefined) {
    // Se acota con la misma regla que valida lo que se escribe en la mesa.
    const segundos = clampSeconds(campos.cronometro)
    const { error } = await db
      .from('setting')
      .upsert({ key: CLAVES.CRONOMETRO, value: String(segundos) }, { onConflict: 'key' })

    if (error) throw createError({ statusCode: 500, statusMessage: error.message })

    await logAction(event, {
      actor: staff.user_id,
      actionType: 'settings.timer',
      summary: `Cronómetro por defecto: ${segundos} s`,
      payload: { seconds: segundos },
      reversible: false,
    })
  }

  return await cargarAjustes(event)
})
