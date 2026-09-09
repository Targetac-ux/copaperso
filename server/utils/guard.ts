import type { H3Event } from 'h3'
import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

export interface StaffUser {
  user_id: string
  display_name: string
  role: 'host' | 'moderator'
}

/**
 * Puerta única del área administrativa.
 *
 * El plan (§35) exige que las operaciones del host se validen también en el
 * backend: no basta con esconder botones. Todo endpoint que escriba llama a
 * esto primero. Comprueba dos cosas:
 *   1. que haya sesión de Supabase válida (cookie firmada, no manipulable);
 *   2. que ese usuario esté dado de alta en app_user.
 */
export async function requireStaff(event: H3Event): Promise<StaffUser> {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Necesitas iniciar sesión.' })
  }

  const db = serverSupabaseServiceRole<Database>(event)
  const { data, error } = await db
    .from('app_user')
    .select('user_id, display_name, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'No se pudo verificar el acceso.' })
  }
  if (!data) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Esta cuenta no tiene acceso al panel de CopaPerso.',
    })
  }

  return data as StaffUser
}
