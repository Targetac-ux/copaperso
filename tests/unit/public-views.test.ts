import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Las vistas públicas son la única superficie que ve un usuario anónimo.
 * Este test falla si alguien añade ahí una columna privada — que es
 * exactamente el accidente que expondría los bits de la gente en la Home.
 */
const dir = join(process.cwd(), 'supabase/migrations')
const sql = readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .map((f) => readFileSync(join(dir, f), 'utf8'))
  .join('\n')

function viewBody(name: string): string {
  const start = sql.indexOf(`create view ${name} as`)
  expect(start, `no se encontró la vista ${name}`).toBeGreaterThan(-1)
  const end = sql.indexOf(';', start)
  return sql.slice(start, end).toLowerCase()
}

const PRIVADO = [
  'balance_bits',
  'balance_subs',
  'cost_bits',
  'ledger',
  'loan',
  'principal',
  'restriction',
  'reward_claim',
  'state_record',
  'inverse_payload',
]

describe('vistas públicas', () => {
  for (const view of ['public_tier_ranking', 'public_roster', 'public_session_live']) {
    it(`${view} no expone datos privados`, () => {
      const body = viewBody(view)
      for (const word of PRIVADO) {
        expect(body, `${view} menciona "${word}"`).not.toContain(word)
      }
    })
  }

  it('solo esas tres vistas se conceden a anon', () => {
    const grants = sql.match(/grant select on ([^;]+) to anon/gi) ?? []
    expect(grants).toHaveLength(1)
    expect(grants[0]).toContain('public_tier_ranking')
    expect(grants[0]).toContain('public_roster')
    expect(grants[0]).toContain('public_session_live')
  })

  it('todas las tablas tienen RLS activado', () => {
    expect(sql).toContain('enable row level security')
    expect(sql).toContain('revoke all on table %I from anon, authenticated')
  })
})
