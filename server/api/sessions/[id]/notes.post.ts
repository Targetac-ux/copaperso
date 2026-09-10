import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

const body = z.discriminatedUnion('type', [
  z.object({ type: z.literal('note'), body: z.string().trim().min(1).max(300) }),
  z.object({
    type: z.literal('extra'),
    kind: z.enum(['bonus', 'penalty', 'prize', 'condition']),
    body: z.string().trim().min(1).max(300),
  }),
  z.object({
    type: z.literal('restriction'),
    participation_id: z.string().uuid(),
    kind: z.enum(['no_role', 'no_team', 'custom']),
    value: z.string().trim().max(40).optional(),
    note: z.string().trim().max(200).optional(),
  }),
])

const ETIQUETA_EXTRA = {
  bonus: 'Bonus',
  penalty: 'Penalización',
  prize: 'Premio',
  condition: 'Condición',
} as const

/** Apunta una nota, un extra o una restricción. */
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const sessionId = getRouterParam(event, 'id')!
  const input = body.parse(await readBody(event))
  const db = serverSupabaseServiceRole<Database>(event)

  if (input.type === 'note') {
    const { data, error } = await db
      .from('note')
      .insert({ scope: 'session', ref_id: sessionId, body: input.body, created_by: staff.user_id })
      .select('id, body, created_at')
      .single()
    if (error) throw createError({ statusCode: 500, statusMessage: error.message })

    await logAction(event, {
      actor: staff.user_id,
      sessionId,
      actionType: 'note.create',
      summary: `Nota: ${input.body.slice(0, 60)}`,
      payload: { note_id: data.id },
      inversePayload: { op: 'delete_note', note_id: data.id },
    })
    setResponseStatus(event, 201)
    return data
  }

  if (input.type === 'extra') {
    const { data, error } = await db
      .from('extra')
      .insert({ scope: 'session', ref_id: sessionId, kind: input.kind, body: input.body })
      .select('id, kind, body, created_at')
      .single()
    if (error) throw createError({ statusCode: 500, statusMessage: error.message })

    await logAction(event, {
      actor: staff.user_id,
      sessionId,
      actionType: 'extra.create',
      summary: `${ETIQUETA_EXTRA[input.kind]}: ${input.body.slice(0, 60)}`,
      payload: { extra_id: data.id },
      inversePayload: { op: 'delete_extra', extra_id: data.id },
    })
    setResponseStatus(event, 201)
    return data
  }

  const { data, error } = await db
    .from('restriction')
    .insert({
      participation_id: input.participation_id,
      kind: input.kind,
      value: input.value ?? null,
      note: input.note ?? null,
    })
    .select('id, kind, value, note')
    .single()
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  await logAction(event, {
    actor: staff.user_id,
    sessionId,
    actionType: 'restriction.create',
    summary: `Restricción: ${input.kind === 'no_role' ? `no puede ${input.value}` : (input.note ?? input.value ?? 'personalizada')}`,
    payload: { restriction_id: data.id },
    inversePayload: { op: 'delete_restriction', restriction_id: data.id },
  })
  setResponseStatus(event, 201)
  return data
})
