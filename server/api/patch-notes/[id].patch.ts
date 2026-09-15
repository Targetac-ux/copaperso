import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import { idDeYoutube } from '#shared/patchnotes'
import type { Database } from '#shared/types/database.types'

const body = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  version: z.string().trim().max(40).optional().nullable(),
  body: z.string().max(8000).optional(),
  /** El enlace del vídeo tal y como lo pega el host; aquí se saca el id. */
  video: z.string().trim().max(300).optional().nullable(),
  /** Publicar o retirar. Es lo que decide si se ve en la web. */
  publicado: z.boolean().optional(),
})

/**
 * Edita un parche, y lo publica o lo retira.
 *
 * **Publicado no quiere decir congelado.** A diferencia de una edición del Tier
 * Ranking —que es una foto y por eso no se toca— un parche es un texto: si trae
 * una errata se corrige donde está, sin abrir otro. Lo que sí se registra es
 * publicarlo y retirarlo, que es cuando cambia lo que la gente lee.
 *
 * El enlace del vídeo se vuelve a interpretar **aquí**, aunque la pantalla ya lo
 * haya hecho: lo que llega por la red es lo que llega, y un id inventado sería
 * un recuadro negro en la página pública.
 */
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const id = getRouterParam(event, 'id')!
  const campos = body.parse(await readBody(event))
  const db = serverSupabaseServiceRole<Database>(event)

  const { data: antes } = await db
    .from('rule_patch')
    .select('title, published_at')
    .eq('id', id)
    .maybeSingle()

  if (!antes) throw createError({ statusCode: 404, statusMessage: 'Ese parche no existe.' })

  // El campo vacío quita el vídeo; un enlace que no se entiende es un error, no
  // un «quitar» silencioso.
  let videoId: string | null | undefined
  if (campos.video !== undefined) {
    if (!campos.video) {
      videoId = null
    } else {
      videoId = idDeYoutube(campos.video)
      if (!videoId) {
        throw createError({
          statusCode: 422,
          statusMessage: 'Eso no parece un vídeo de YouTube. Pega el enlace que da «Compartir».',
        })
      }
    }
  }

  const estaba = !!antes.published_at
  const { error } = await db
    .from('rule_patch')
    .update({
      ...(campos.title !== undefined ? { title: campos.title } : {}),
      ...(campos.version !== undefined ? { version: campos.version || null } : {}),
      ...(campos.body !== undefined ? { body: campos.body } : {}),
      ...(videoId !== undefined ? { video_id: videoId } : {}),
      ...(campos.publicado !== undefined
        ? {
            // Al retirar se borra la fecha; al publicar de nuevo se pone la de
            // hoy, que es cuando de verdad salió.
            published_at: campos.publicado ? (antes.published_at ?? new Date().toISOString()) : null,
          }
        : {}),
    })
    .eq('id', id)

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  if (campos.publicado !== undefined && campos.publicado !== estaba) {
    await logAction(event, {
      actor: staff.user_id,
      actionType: campos.publicado ? 'patch.publish' : 'patch.unpublish',
      summary: `${campos.publicado ? 'Publicado' : 'Retirado'} el parche «${antes.title}»`,
      payload: { patch_id: id },
      reversible: false,
    })
  }

  return await cargarParches(event)
})
