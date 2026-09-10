import sharp from 'sharp'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

const MAX_BYTES = 5 * 1024 * 1024
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']

/**
 * Sube la foto de un jugador.
 *
 * El recorte cuadrado lo hace el servidor: da igual con qué proporción llegue
 * la imagen, sale 512x512 centrada y en webp. Así el Tier List y la banca
 * nunca se descuadran por una foto apaisada.
 */
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const playerId = getRouterParam(event, 'id')!
  const db = serverSupabaseServiceRole<Database>(event)

  const form = await readMultipartFormData(event)
  const file = form?.find((part) => part.name === 'file' && part.filename)

  if (!file) throw createError({ statusCode: 400, statusMessage: 'No llegó ninguna imagen.' })
  if (file.data.length > MAX_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'La imagen pasa de 5 MB.' })
  }
  if (file.type && !ACCEPTED.includes(file.type)) {
    throw createError({ statusCode: 415, statusMessage: 'Solo aceptamos JPG, PNG o WebP.' })
  }

  const { data: player, error: playerError } = await db
    .from('player')
    .select('id, display_name, slug, photo_url')
    .eq('id', playerId)
    .maybeSingle()

  if (playerError) throw createError({ statusCode: 500, statusMessage: playerError.message })
  if (!player) throw createError({ statusCode: 404, statusMessage: 'Ese jugador no existe.' })

  const square = await sharp(file.data)
    .rotate()
    .resize(512, 512, { fit: 'cover', position: 'attention' })
    .webp({ quality: 82 })
    .toBuffer()

  const path = `${player.slug}/${Date.now()}.webp`
  const { error: uploadError } = await db.storage
    .from('players')
    .upload(path, square, { contentType: 'image/webp', upsert: true })

  if (uploadError) throw createError({ statusCode: 500, statusMessage: uploadError.message })

  const { data: pub } = db.storage.from('players').getPublicUrl(path)
  const previous = player.photo_url

  const { error: updateError } = await db
    .from('player')
    .update({ photo_url: pub.publicUrl })
    .eq('id', player.id)

  if (updateError) throw createError({ statusCode: 500, statusMessage: updateError.message })

  await logAction(event, {
    actor: staff.user_id,
    actionType: 'player.photo',
    summary: `Foto actualizada: ${player.display_name}`,
    payload: { player_id: player.id, path },
    inversePayload: { op: 'player_photo', player_id: player.id, photo_url: previous },
  })

  return { photo_url: pub.publicUrl, bytes: square.length }
})
