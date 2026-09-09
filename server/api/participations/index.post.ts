import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import { parsePlayerLine } from '#shared/parser'
import type { Database } from '#shared/types/database.types'

const ROLES = ['TOP', 'JG', 'MID', 'ADC', 'SUP'] as const
const ELOS = [
  'IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM',
  'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER',
] as const

const body = z.object({
  /** La línea tal cual la teclea el host: "Target Mid/Jg Challenger". */
  line: z.string().trim().max(120).optional(),
  /** O los campos ya resueltos, cuando el host eligió del autocomplete. */
  player_id: z.string().uuid().optional(),
  display_name: z.string().trim().min(1).max(40).optional(),
  roles: z.array(z.enum(ROLES)).max(5).optional(),
  elo: z.enum(ELOS).nullable().optional(),
  period_id: z.string().uuid().optional(),
})

/**
 * Registra a alguien en el mes: el paso que ejecuta el host en directo (§7).
 *
 * Reutiliza el perfil permanente si ya existe (por slug) y crea la
 * participación con 100 LP. Si esa persona ya estaba registrada este mes,
 * devuelve la que había en vez de fallar: durante el stream es normal
 * apuntar a alguien dos veces.
 */
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const input = body.parse(await readBody(event))
  const db = serverSupabaseServiceRole<Database>(event)

  // 1. Resolver nombre, roles y elo, vengan de donde vengan.
  const parsed = input.line ? parsePlayerLine(input.line) : null
  const displayName = input.display_name ?? parsed?.name
  const roles = input.roles ?? parsed?.roles ?? []
  const elo = input.elo !== undefined ? input.elo : (parsed?.elo ?? null)

  if (!input.player_id && !displayName) {
    throw createError({ statusCode: 400, statusMessage: 'Falta el nombre del jugador.' })
  }

  // 2. Periodo activo.
  let periodId = input.period_id
  if (!periodId) {
    const { data: activo } = await db
      .from('period')
      .select('id, name')
      .eq('status', 'active')
      .order('starts_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!activo) {
      throw createError({
        statusCode: 409,
        statusMessage: 'No hay ningún periodo abierto. Abre el mes antes de registrar gente.',
      })
    }
    periodId = activo.id
  }

  // 3. Perfil permanente: se reutiliza si ya existe.
  let playerId = input.player_id
  let playerCreated = false

  if (!playerId) {
    const slug = slugify(displayName!)
    if (!slug) {
      throw createError({ statusCode: 400, statusMessage: 'Ese nombre no tiene letras ni números.' })
    }

    const { data: existente } = await db
      .from('player')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (existente) {
      playerId = existente.id
    } else {
      const { data: nuevo, error } = await db
        .from('player')
        .insert({ display_name: displayName! })
        .select('id')
        .single()

      if (error) throw createError({ statusCode: 500, statusMessage: error.message })
      playerId = nuevo.id
      playerCreated = true
    }
  }

  const { data: player } = await db
    .from('player')
    .select('id, display_name, slug, photo_url')
    .eq('id', playerId!)
    .maybeSingle()

  if (!player) throw createError({ statusCode: 404, statusMessage: 'Ese jugador no existe.' })

  // 4. Participación del mes. Si ya estaba, se devuelve tal cual.
  const { data: yaEstaba } = await db
    .from('participation')
    .select('id, elo, roles, initial_lp, current_lp, created_at')
    .eq('player_id', playerId!)
    .eq('period_id', periodId)
    .maybeSingle()

  if (yaEstaba) {
    return { player, participation: yaEstaba, created: false, playerCreated }
  }

  const { data: participation, error } = await db
    .from('participation')
    .insert({
      player_id: playerId!,
      period_id: periodId,
      roles,
      elo,
      initial_lp: 100,
      current_lp: 100,
    })
    .select('id, elo, roles, initial_lp, current_lp, created_at')
    .single()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  await logAction(event, {
    actor: staff.user_id,
    actionType: 'participation.create',
    summary: `${player.display_name} entra al periodo con 100 LP`,
    payload: { participation_id: participation.id, player_id: player.id, roles, elo },
    inversePayload: { participation_id: participation.id, op: 'delete' },
  })

  setResponseStatus(event, 201)
  return { player, participation, created: true, playerCreated }
})
