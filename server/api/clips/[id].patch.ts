import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

const body = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  edition: z.string().trim().max(60).optional().nullable(),
  visible: z.boolean().optional(),
})

/** Cambia el título, la edición o si sale en la Home. El slug no se toca. */
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const id = getRouterParam(event, 'id')!
  const campos = body.parse(await readBody(event))

  if (!Object.keys(campos).length) {
    throw createError({ statusCode: 422, statusMessage: 'No hay nada que cambiar.' })
  }

  const db = serverSupabaseServiceRole<Database>(event)

  const { data: antes } = await db.from('clip').select('title, visible').eq('id', id).maybeSingle()
  if (!antes) throw createError({ statusCode: 404, statusMessage: 'Ese clip no existe.' })

  const { error } = await db
    .from('clip')
    .update({
      ...(campos.title !== undefined ? { title: campos.title } : {}),
      ...(campos.edition !== undefined ? { edition: campos.edition || null } : {}),
      ...(campos.visible !== undefined ? { visible: campos.visible } : {}),
    })
    .eq('id', id)

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  // Esconder y volver a enseñar cambian lo que ve la gente, así que se anotan.
  // Corregir una errata en el título, no: llenaría el historial de ruido.
  if (campos.visible !== undefined && campos.visible !== antes.visible) {
    await logAction(event, {
      actor: staff.user_id,
      actionType: campos.visible ? 'clip.show' : 'clip.hide',
      summary: `${campos.visible ? 'Vuelve a la' : 'Quitado de la'} Home el clip «${antes.title}»`,
      payload: { clip_id: id },
      reversible: false,
    })
  }

  return await cargarClips(event)
})
