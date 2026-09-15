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

/**
 * El cuerpo de la vista **tal y como queda al final**.
 *
 * Se busca la última definición, no la primera: una vista se puede recrear en
 * una migración posterior para añadirle una columna, y mirar la primera dejaría
 * pasar justo eso —una columna privada añadida después—, que es el accidente
 * que este test existe para cazar.
 */
function viewBody(name: string): string {
  const start = sql.lastIndexOf(`create view ${name} as`)
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
  for (const view of [
    'public_tier_ranking',
    'public_roster',
    'public_session_live',
    'public_clips',
    'public_patch_notes',
    'public_site_links',
  ]) {
    it(`${view} no expone datos privados`, () => {
      const body = viewBody(view)
      for (const word of PRIVADO) {
        expect(body, `${view} menciona "${word}"`).not.toContain(word)
      }
    })
  }

  it('a anon no se le concede nada más que esas vistas', () => {
    // Sin repetidos: recrear una vista vuelve a concederla, y lo que se está
    // comprobando es *cuáles* se conceden, no cuántas veces.
    const concedido = [
      ...new Set(
        (sql.match(/grant select on ([^;]+) to anon/gi) ?? [])
          .flatMap((g) => g.replace(/grant select on |to anon.*/gi, '').split(','))
          .map((v) => v.trim()),
      ),
    ].sort()

    // La lista completa, a propósito: añadir una vista pública obliga a tocar
    // este test, que es el momento de preguntarse qué columnas lleva dentro.
    expect(concedido).toEqual([
      'public_clips',
      'public_patch_notes',
      'public_roster',
      'public_session_live',
      'public_site_links',
      'public_tier_ranking',
    ])
  })

  it('todas las tablas tienen RLS activado', () => {
    expect(sql).toContain('enable row level security')
    expect(sql).toContain('revoke all on table %I from anon, authenticated')
  })
})
