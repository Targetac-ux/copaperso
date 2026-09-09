/**
 * Crea (o borra) un usuario de pruebas para los e2e, sin tocar las cuentas
 * reales del host.
 *
 *   node scripts/e2e-user.mjs create    imprime las credenciales
 *   node scripts/e2e-user.mjs destroy   lo borra de auth y de app_user
 *
 * La contraseña se genera al vuelo y no se guarda en ningún sitio: si la
 * pierdes, borra el usuario y créalo otra vez.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'

const EMAIL = 'e2e-bot@copaperso.gg'

function loadEnv() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY) return process.env
  const file = readFileSync(new URL('../.env', import.meta.url), 'utf8')
  return Object.fromEntries(
    file
      .split('\n')
      .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
      .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
  )
}

const env = loadEnv()
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
})

async function findUser() {
  const { data } = await db.auth.admin.listUsers({ perPage: 200 })
  return data?.users.find((u) => u.email === EMAIL)
}

const accion = process.argv[2]

if (accion === 'create') {
  const existing = await findUser()
  if (existing) {
    await db.from('app_user').delete().eq('user_id', existing.id)
    await db.auth.admin.deleteUser(existing.id)
  }

  const password = randomBytes(18).toString('base64url')
  const { data, error } = await db.auth.admin.createUser({
    email: EMAIL,
    password,
    email_confirm: true,
  })
  if (error) throw error

  const { error: staffError } = await db
    .from('app_user')
    .insert({ user_id: data.user.id, display_name: 'Bot de pruebas', role: 'host' })
  if (staffError) throw staffError

  console.log(`E2E_HOST_EMAIL=${EMAIL}`)
  console.log(`E2E_HOST_PASSWORD=${password}`)
} else if (accion === 'destroy') {
  const user = await findUser()
  if (!user) {
    console.log('No había usuario de pruebas.')
    process.exit(0)
  }
  await db.from('app_user').delete().eq('user_id', user.id)
  const { error } = await db.auth.admin.deleteUser(user.id)
  if (error) throw error
  console.log('Usuario de pruebas borrado.')
} else {
  console.log('Uso: node scripts/e2e-user.mjs create|destroy')
  process.exit(1)
}
