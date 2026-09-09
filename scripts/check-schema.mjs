/**
 * Comprueba que un entorno tiene el esquema completo y bien sembrado.
 *
 *   npm run db:check
 *
 * Útil después de aplicar migraciones, al crear staging, o cuando algo
 * "no funciona" y hay que saber si el problema es la base o la app.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

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

const TABLAS = [
  'app_user', 'player', 'period', 'participation', 'session', 'session_participant',
  'team', 'team_member', 'match', 'match_player', 'match_event', 'lp_event',
  'action_catalog', 'reward_claim', 'ledger_account', 'ledger_entry', 'state_record',
  'restriction', 'loan', 'note', 'extra', 'blue_shell_result', 'action_log',
  'tier_list', 'tier_entry',
]
const VISTAS = ['public_tier_ranking', 'public_roster', 'public_session_live']

// Los costos de §13. Si esto no cuadra, la negociación mostraría precios inventados.
const COSTOS = {
  SPOT_TAKEOVER: 200,
  TEAM_CHANGE: 150,
  BENCH_PULL: 200,
  ROLE_CHANGE_REENTRY: 300,
  GRAVEYARD_EXIT: 300,
  BLUE_SHELL: 500,
}

let fallos = 0
const nota = (ok, msg) => {
  console.log(`  ${ok ? '✓' : '✗'} ${msg}`)
  if (!ok) fallos++
}

console.log(`\nRevisando ${env.SUPABASE_URL}\n`)

console.log('TABLAS')
for (const t of TABLAS) {
  const { error } = await db.from(t).select('*', { count: 'exact', head: true })
  nota(!error, `${t}${error ? ' → ' + error.message : ''}`)
}

console.log('\nVISTAS PÚBLICAS')
for (const v of VISTAS) {
  const { error } = await db.from(v).select('*', { head: true })
  nota(!error, `${v}${error ? ' → ' + error.message : ''}`)
}

console.log('\nDATOS DE ARRANQUE')
const { data: periodos } = await db.from('period').select('name, status')
nota(
  !!periodos?.length,
  `periodo: ${periodos?.map((p) => `${p.name} (${p.status})`).join(', ') || 'ninguno'}`,
)

const { data: acciones } = await db.from('action_catalog').select('code, cost_bits')
nota(acciones?.length === 6, `catálogo de recompensas: ${acciones?.length ?? 0} de 6`)
for (const [code, cost] of Object.entries(COSTOS)) {
  const found = acciones?.find((a) => a.code === code)
  nota(found?.cost_bits === cost, `${code} = ${found?.cost_bits ?? '—'} bits (esperado ${cost})`)
}

console.log('\nSTORAGE')
const { data: buckets } = await db.storage.listBuckets()
for (const b of ['players', 'brand']) {
  const found = buckets?.find((x) => x.id === b)
  nota(!!found, `bucket ${b}${found ? ` · público: ${found.public}` : ''}`)
}

console.log('\nHOST')
const { data: staff } = await db.from('app_user').select('display_name, role')
nota(
  !!staff?.length,
  staff?.length
    ? `app_user: ${staff.map((s) => `${s.display_name} (${s.role})`).join(', ')}`
    : 'app_user VACÍO — nadie puede entrar al panel',
)

console.log(`\n${fallos === 0 ? '✓ esquema completo y sembrado' : `✗ ${fallos} fallos`}\n`)
process.exit(fallos ? 1 : 0)
