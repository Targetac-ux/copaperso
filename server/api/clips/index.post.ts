import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import { slugDeUrl } from '#shared/clips'
import type { Database } from '#shared/types/database.types'

const body = z.object({
  url: z.string().trim().min(1).max(500),
  title: z.string().trim().min(1).max(120),
  edition: z.string().trim().max(60).optional().nullable(),
})

/**
 * Añade un clip a la Home.
 *
 * El slug se vuelve a extraer **aquí**, aunque la pantalla ya lo haya hecho:
 * lo que llega por la red es lo que llega, y un slug inventado acabaría siendo
 * un hueco negro en la portada.
 */
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const { url, title, edition } = body.parse(await readBody(event))

  const slug = slugDeUrl(url)
  if (!slug) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Eso no parece un clip de Twitch. Pega el enlace que da el botón de compartir.',
    })
  }

  const db = serverSupabaseServiceRole<Database>(event)

  const { data: repetido } = await db.from('clip').select('id').eq('slug', slug).maybeSingle()
  if (repetido) {
    throw createError({ statusCode: 409, statusMessage: 'Ese clip ya está en la lista.' })
  }

  // Al final de la fila: el host lo sube desde el panel si quiere destacarlo.
  const { data: ultimo } = await db
    .from('clip')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await db.from('clip').insert({
    slug,
    title,
    edition: edition || null,
    sort_order: (ultimo?.sort_order ?? -1) + 1,
  })

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  await logAction(event, {
    actor: staff.user_id,
    actionType: 'clip.add',
    summary: `Añadido el clip «${title}» a la Home`,
    payload: { slug, title },
    reversible: false,
  })

  return await cargarClips(event)
})
