import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import { parsePlayerLine } from '#shared/parser'
import { importanLosRoles, isOffRole } from '#shared/draft'
import type { Database } from '#shared/types/database.types'

const ROLES = ['TOP', 'JG', 'MID', 'ADC', 'SUP'] as const
const ELOS = [
  'IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM',
  'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER', 'DEMON',
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
  /** Si viene, además de registrarlo lo mete en la sesión (§7). */
  session_id: z.string().uuid().optional(),
  /** Y si además viene equipo y rol, entra directo al equipo sin pasar por la banca. */
  team_number: z.union([z.literal(1), z.literal(2)]).optional(),
  role: z.enum(ROLES).optional(),
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
    const destino = await colocarEnSesion(event, staff.user_id, input, yaEstaba.id, player.display_name)
    return { player, participation: yaEstaba, created: false, playerCreated, ...destino }
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
    inversePayload: { op: 'delete_participation', participation_id: participation.id },
  })

  const destino = await colocarEnSesion(event, staff.user_id, input, participation.id, player.display_name)

  setResponseStatus(event, 201)
  return { player, participation, created: true, playerCreated, ...destino }
})

/**
 * Mete al recién registrado en la sesión que está en marcha.
 *
 * El host registra a la gente en directo mientras el chat la va diciendo, así
 * que lo normal es que quiera que entre a la banca en el mismo gesto. Y si ya
 * sabe dónde la quiere, directa al equipo (§7).
 */
async function colocarEnSesion(
  event: Parameters<typeof requireStaff>[0],
  actor: string,
  input: { session_id?: string; team_number?: 1 | 2; role?: (typeof ROLES)[number] },
  participationId: string,
  nombre: string,
) {
  if (!input.session_id) return {}
  const db = serverSupabaseServiceRole<Database>(event)

  const { data: existente } = await db
    .from('session_participant')
    .select('id, state')
    .eq('session_id', input.session_id)
    .eq('participation_id', participationId)
    .maybeSingle()

  let spId = existente?.id
  if (existente) {
    if (existente.state === 'removed') {
      await db.from('session_participant').update({ state: 'bench' }).eq('id', existente.id)
    }
  } else {
    const { data, error } = await db
      .from('session_participant')
      .insert({ session_id: input.session_id, participation_id: participationId, state: 'bench' })
      .select('id')
      .single()

    if (error) throw createError({ statusCode: 500, statusMessage: error.message })
    spId = data.id

    await logAction(event, {
      actor,
      sessionId: input.session_id,
      actionType: 'session.join',
      summary: `${nombre} entra a la banca`,
      payload: { session_participant_id: spId },
      inversePayload: { op: 'remove', session_participant_id: spId },
    })
  }

  if (!input.team_number || !input.role) return { session_participant_id: spId }

  const ids = await teamIds(event, input.session_id)
  const [{ data: participacion }, { data: sesion }] = await Promise.all([
    db.from('participation').select('roles').eq('id', participationId).maybeSingle(),
    db.from('session').select('mode').eq('id', input.session_id).maybeSingle(),
  ])

  // En ARAM AFK nadie va off-role: no hay posiciones que respetar. La misma
  // regla que en /assign, porque por aquí se llega al mismo sitio.
  const offRole =
    importanLosRoles(sesion?.mode ?? 'perso') && isOffRole(participacion?.roles ?? [], input.role)

  await db.from('team_member').delete().eq('session_participant_id', spId!)
  const { error } = await db.from('team_member').insert({
    team_id: ids[input.team_number],
    session_participant_id: spId!,
    role: input.role,
    is_off_role: offRole,
  })
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  await db.from('session_participant').update({ state: 'team' }).eq('id', spId!)

  await logAction(event, {
    actor,
    sessionId: input.session_id,
    actionType: 'draft.assign',
    summary: `${nombre} → Team ${input.team_number} / ${input.role}${offRole ? ' (off-role)' : ''}`,
    payload: { session_participant_id: spId, team_number: input.team_number, role: input.role },
    inversePayload: { op: 'bench', session_participant_id: spId },
  })

  return { session_participant_id: spId }
}
