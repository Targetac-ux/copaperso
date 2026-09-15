import sharp from 'sharp'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

const MAX_BYTES = 5 * 1024 * 1024
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']

/**
 * Sube la foto de un jugador.
 *
 * Siempre sale 512x512 en webp, venga como venga: así el Tier List y la banca
 * nunca se descuadran por una foto apaisada.
 *
 * El **encuadre lo elige el host** si quiere (§29): puede mandar un recorte
 * cuadrado en píxeles de la imagen original. Sin recorte, el servidor lo decide
 * solo buscando la parte con más detalle, que para un avatar suele ser la cara.
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

  // El recorte llega como tres números en el propio formulario.
  const num = (nombre: string) => {
    const parte = form?.find((p) => p.name === nombre)
    const v = parte ? Number(parte.data.toString()) : NaN
    return Number.isFinite(v) ? Math.round(v) : null
  }

  const recorte = { x: num('crop_x'), y: num('crop_y'), lado: num('crop_lado') }
  const hayRecorte = recorte.x !== null && recorte.y !== null && !!recorte.lado

  let img = sharp(file.data).rotate()

  if (hayRecorte) {
    // Después de `rotate()` el tamaño puede no ser el del fichero: una foto de
    // móvil viene tumbada con la orientación en los metadatos. El encuadre que
    // eligió el host es sobre la imagen ya derecha, que es la que vio.
    const meta = await img.metadata()
    const ancho = meta.width ?? 0
    const alto = meta.height ?? 0
    const lado = Math.min(recorte.lado!, ancho, alto)
    // Se acota dentro de la imagen: un recorte que se salga hace fallar a sharp.
    const left = Math.max(0, Math.min(recorte.x!, ancho - lado))
    const top = Math.max(0, Math.min(recorte.y!, alto - lado))

    if (lado > 0) img = img.extract({ left, top, width: lado, height: lado })
  }

  const square = await img
    .resize(512, 512, hayRecorte ? { fit: 'cover' } : { fit: 'cover', position: 'attention' })
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
