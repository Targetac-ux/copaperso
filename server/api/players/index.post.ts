import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

const body = z.object({
  display_name: z.string().trim().min(1, 'El nombre no puede ir vacío.').max(40),
  twitch_handle: z.string().trim().max(40).optional().nullable(),
})

/**
 * Crea un perfil permanente. Si el slug ya existe devuelve el perfil que ya
 * estaba: registrar dos veces a "Target" durante el stream no debe crear un
 * duplicado ni reventar con un error de base de datos.
 */
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const input = body.parse(await readBody(event))
  const db = serverSupabaseServiceRole<Database>(event)

  const slug = slugify(input.display_name)
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Ese nombre no tiene letras ni números.' })
  }

  const { data: existing } = await db
    .from('player')
    .select('id, display_name, slug, photo_url, twitch_handle, created_at')
    .eq('slug', slug)
    .maybeSingle()

  if (existing) return { player: existing, created: false }

  const { data, error } = await db
    .from('player')
    .insert({
      display_name: input.display_name,
      twitch_handle: input.twitch_handle ?? null,
    })
    .select('id, display_name, slug, photo_url, twitch_handle, created_at')
    .single()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  await logAction(event, {
    actor: staff.user_id,
    actionType: 'player.create',
    summary: `Perfil creado: ${data.display_name}`,
    payload: { player_id: data.id },
    inversePayload: { op: 'delete_player', player_id: data.id },
  })

  setResponseStatus(event, 201)
  return { player: data, created: true }
})
