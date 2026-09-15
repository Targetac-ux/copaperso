import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import { REDES, esRedConocida, normalizarUrl } from '#shared/ajustes'
import type { Red } from '#shared/ajustes'
import type { Database } from '#shared/types/database.types'

const body = z.object({ url: z.string().trim().min(1).max(500) })

/**
 * Da de alta o cambia el enlace de una red.
 *
 * La URL se vuelve a normalizar **aquí**, aunque la pantalla ya lo haya hecho:
 * lo que llega por la red es lo que llega, y este valor acaba en el `href` de
 * un enlace de la página pública. Un `javascript:` ahí sería ejecución de
 * código en el navegador de quien visita la web, así que no se escribe nada que
 * no haya pasado por `normalizarUrl`.
 */
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const network = getRouterParam(event, 'network')!
  const { url } = body.parse(await readBody(event))

  if (!esRedConocida(network)) {
    throw createError({ statusCode: 422, statusMessage: 'Esa red no se conoce.' })
  }

  const limpia = normalizarUrl(url, network as Red)
  if (!limpia) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Eso no es un enlace válido. Pega la dirección completa o el usuario con @.',
    })
  }

  const db = serverSupabaseServiceRole<Database>(event)
  const orden = REDES.findIndex((r) => r.red === network)

  const { error } = await db
    .from('site_link')
    .upsert({ network, url: limpia, sort_order: orden }, { onConflict: 'network' })

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  await logAction(event, {
    actor: staff.user_id,
    actionType: 'settings.link',
    summary: `Enlace de ${network}: ${limpia}`,
    payload: { network, url: limpia },
    reversible: false,
  })

  return await cargarAjustes(event)
})
