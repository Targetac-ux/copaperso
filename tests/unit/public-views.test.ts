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
  for (const view of ['public_tier_ranking', 'public_roster', 'public_session_live', 'public_clips']) {
    it(`${view} no expone datos privados`, () => {
      const body = viewBody(view)
      for (const word of PRIVADO) {
        expect(body, `${view} menciona "${word}"`).not.toContain(word)
      }
    })
  }

  it('a anon no se le concede nada más que esas vistas', () => {
    const concedido = (sql.match(/grant select on ([^;]+) to anon/gi) ?? [])
      .flatMap((g) => g.replace(/grant select on |to anon.*/gi, '').split(','))
      .map((v) => v.trim())
      .sort()

    // La lista completa, a propósito: añadir una vista pública obliga a tocar
    // este test, que es el momento de preguntarse qué columnas lleva dentro.
    expect(concedido).toEqual([
      'public_clips',
      'public_roster',
      'public_session_live',
      'public_tier_ranking',
    ])
  })

  it('todas las tablas tienen RLS activado', () => {
    expect(sql).toContain('enable row level security')
    expect(sql).toContain('revoke all on table %I from anon, authenticated')
  })
})
