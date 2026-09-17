/**
 * Deja la base en blanco para empezar de verdad.
 *
 *   node scripts/limpiar-datos.mjs            enseña qué borraría, sin tocar nada
 *   node scripts/limpiar-datos.mjs --hazlo    lo borra
 *
 * Por defecto trabaja sobre el `.env`, que es el de desarrollo. Para la base de
 * producción —la que usa Vercel— hay que pedirlo a mano:
 *
 *   node scripts/limpiar-datos.mjs --env=.env.produccion
 *
 * Antes de nada enseña a qué proyecto va a entrar. **Míralo.** Las dos bases se
 * parecen por dentro y el identificador de la URL es lo único que las distingue.
 *
 * **Lo que NO se toca, nunca:** `app_user` y las cuentas de autenticación. Son
 * los accesos al panel; borrarlos te deja fuera de tu propia aplicación y no se
 * recuperan desde aquí.
 *
 * Todo lo demás —jugadores, participaciones, sesiones, partidas, economía,
 * bitácora, periodos y su catálogo— es del torneo, y esto lo borra entero. Es
 * para el momento de arrancar limpio antes de importar el histórico, no para
 * arreglar un dato suelto.
 *
 * Se borra en orden de dependencia aunque casi todo tenga borrado en cascada:
 * explícito es más fácil de leer y de auditar que confiar en que la cascada
 * llegue donde uno cree.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'

/** `--env=.env.loquesea`; si no se dice nada, el `.env` de siempre. */
const archivoEnv = process.argv.find((a) => a.startsWith('--env='))?.slice(6) ?? '.env'

function cargarEnv() {
  if (archivoEnv === '.env' && process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY) {
    return process.env
  }
  const file = readFileSync(new URL(`../${archivoEnv}`, import.meta.url), 'utf8')
  return Object.fromEntries(
    file
      .split('\n')
      .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
      .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
  )
}

const env = cargarEnv()
if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
  console.error(`A \`${archivoEnv}\` le falta SUPABASE_URL o SUPABASE_SECRET_KEY.`)
  process.exit(1)
}
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
})

/** De las hojas a la raíz. El orden importa. */
const EN_ORDEN = [
  'lp_event',
  'match_event',
  'match_player',
  'match',
  'blue_shell_result',
  'team_member',
  'team',
  'reward_claim',
  'ledger_entry',
  'ledger_account',
  'loan',
  'state_record',
  'restriction',
  'note',
  'extra',
  'session_participant',
  'session',
  'action_log',
  'tier_entry',
  'tier_list',
  'participation',
  'action_catalog',
  'period',
  'player',
]

/** Lo que sobrevive, y por qué. */
const INTOCABLES = {
  app_user: 'los accesos al panel',
  clip: 'los clips de la Home, que no son datos del torneo',
  rule_patch: 'los patch notes publicados',
  setting: 'los ajustes (cronómetro)',
  site_link: 'los enlaces del sitio',
}

async function contar() {
  const filas = []
  for (const t of EN_ORDEN) {
    const { count, error } = await db.from(t).select('*', { count: 'exact', head: true })
    if (!error && count) filas.push([t, count])
  }
  return filas
}

async function main() {
  const hazlo = process.argv.includes('--hazlo')

  // A qué base se está entrando, siempre y lo primero. Nunca la llave: solo el
  // identificador del proyecto, que es lo que hay que reconocer.
  console.log(`Proyecto:  ${env.SUPABASE_URL}   (leído de ${archivoEnv})\n`)

  const antes = await contar()
  if (!antes.length) {
    console.log('La base ya está limpia: no hay nada del torneo que borrar.')
    return
  }

  console.log(hazlo ? 'SE VA A BORRAR:' : 'SE BORRARÍA (nada se ha tocado):')
  let total = 0
  for (const [t, n] of antes) {
    console.log('  ', t.padEnd(22), String(n).padStart(6))
    total += n
  }
  console.log('  ', '—'.repeat(22), String(total).padStart(6), 'filas')

  console.log('\nSE QUEDA:')
  for (const [t, porque] of Object.entries(INTOCABLES)) {
    const { count } = await db.from(t).select('*', { count: 'exact', head: true })
    console.log('  ', t.padEnd(22), String(count ?? 0).padStart(6), ' ', porque)
  }
  const { data: cuentas } = await db.auth.admin.listUsers({ perPage: 100 })
  console.log('  ', 'cuentas de acceso'.padEnd(22), String(cuentas.users.length).padStart(6), '  ')
  for (const u of cuentas.users) console.log('      ·', u.email)

  if (!hazlo) {
    console.log('\nPara hacerlo de verdad:  node scripts/limpiar-datos.mjs --hazlo')
    return
  }

  // Se escribe el nombre a mano. Un `--hazlo` se teclea sin pensar; esto no.
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const dicho = await rl.question('\nEscribe BORRAR para confirmar: ')
  rl.close()
  if (dicho.trim() !== 'BORRAR') {
    console.log('Cancelado. No se ha tocado nada.')
    return
  }

  console.log()
  for (const t of EN_ORDEN) {
    // `neq` sobre la clave con un uuid imposible: borra todo, y evita el
    // `delete()` sin filtro, que PostgREST rechaza a propósito.
    const col = t === 'setting' ? 'key' : 'id'
    const { error } = await db.from(t).delete().neq(col, '00000000-0000-0000-0000-000000000000')
    console.log(error ? `  ✗ ${t}: ${error.message}` : `  ✓ ${t}`)
  }

  const despues = await contar()
  console.log(
    despues.length
      ? `\nQuedan filas sin borrar: ${JSON.stringify(despues)}`
      : '\nListo. La base está limpia y tu acceso al panel sigue en pie.',
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
