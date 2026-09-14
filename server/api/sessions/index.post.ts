import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

const body = z.object({
  mode: z.enum(['perso', 'tryhard', 'random', 'analisis', 'aram_afk']).default('perso'),
  period_id: z.string().uuid().optional(),
})

/**
 * Abre una CopaPerso. Numera sola dentro del periodo y crea de una vez los dos
 * equipos vacíos, para que el CCTM no tenga que crearlos a mitad del draft.
 */
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const input = body.parse((await readBody(event)) ?? {})
  const db = serverSupabaseServiceRole<Database>(event)

  let periodId = input.period_id
  if (!periodId) {
    const { data: activo } = await db
      .from('period')
      .select('id')
      .eq('status', 'active')
      .order('starts_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!activo) {
      throw createError({
        statusCode: 409,
        statusMessage: 'No hay ningún periodo abierto. Abre el mes antes de crear la sesión.',
      })
    }
    periodId = activo.id
  }

  const { data: previas } = await db
    .from('session')
    .select('number')
    .eq('period_id', periodId)
    .order('number', { ascending: false })
    .limit(1)

  const number = (previas?.[0]?.number ?? 0) + 1

  const { data, error } = await db
    .from('session')
    .insert({ period_id: periodId, number, mode: input.mode, status: 'open' })
    .select('id, period_id, number, mode, status, started_at, closed_at, prices_tripled, tripled_at, timer_ends_at, timer_seconds, timer_running, timer_remaining_seconds')
    .single()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  const { error: teamError } = await db.from('team').insert([
    { session_id: data.id, team_number: 1, name: 'Team 1' },
    { session_id: data.id, team_number: 2, name: 'Team 2' },
  ])
  if (teamError) throw createError({ statusCode: 500, statusMessage: teamError.message })

  await logAction(event, {
    actor: staff.user_id,
    actionType: 'session.create',
    summary: `Sesión #${number} abierta`,
    sessionId: data.id,
    payload: { session_id: data.id, mode: data.mode },
    reversible: false,
  })

  setResponseStatus(event, 201)
  return data
})
