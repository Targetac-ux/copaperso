import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

const body = z.object({
  display_name: z.string().trim().min(1).max(40).optional(),
  twitch_handle: z.string().trim().max(40).nullable().optional(),
})

/** Corrige un perfil permanente: el nombre mal escrito de un mes se arrastra a todos. */
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const id = getRouterParam(event, 'id')!
  const input = body.parse(await readBody(event))
  const db = serverSupabaseServiceRole<Database>(event)

  const { data: antes } = await db
    .from('player')
    .select('id, display_name, twitch_handle')
    .eq('id', id)
    .maybeSingle()

  if (!antes) throw createError({ statusCode: 404, statusMessage: 'Ese jugador no existe.' })

  if (input.display_name) {
    const slug = slugify(input.display_name)
    if (!slug) {
      throw createError({ statusCode: 400, statusMessage: 'Ese nombre no tiene letras ni números.' })
    }
    const { data: choque } = await db
      .from('player')
      .select('id, display_name')
      .eq('slug', slug)
      .neq('id', id)
      .maybeSingle()

    if (choque) {
      throw createError({
        statusCode: 409,
        statusMessage: `Ya existe un perfil con ese nombre: ${choque.display_name}.`,
      })
    }
  }

  const { data, error } = await db
    .from('player')
    .update(input)
    .eq('id', id)
    .select('id, display_name, slug, photo_url, twitch_handle, created_at')
    .single()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  await logAction(event, {
    actor: staff.user_id,
    actionType: 'player.update',
    summary: `Perfil editado: ${antes.display_name} → ${data.display_name}`,
    payload: { player_id: id, ...input },
    inversePayload: {
      op: 'player_update',
      player_id: id,
      display_name: antes.display_name,
      twitch_handle: antes.twitch_handle,
    },
  })

  return data
})
