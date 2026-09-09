import { describe, it, expect } from 'vitest'
import { matchNames, editDistance, foldName } from '../../shared/similarity'

const jugadores = [
  { id: '1', display_name: 'Target' },
  { id: '2', display_name: 'Candy' },
  { id: '3', display_name: 'Zenix' },
  { id: '4', display_name: 'Targetiin' },
  { id: '5', display_name: 'Aliencero' },
  { id: '6', display_name: 'Rayito' },
]

const nombres = (r: { item: { display_name: string } }[]) => r.map((x) => x.item.display_name)

describe('matchNames', () => {
  it('las erratas típicas proponen el mismo perfil', () => {
    // Es el caso del plan: Target / Taget / Targte / TARGET / "target "
    for (const escrito of ['Target', 'Taget', 'Targte', 'TARGET', 'target ', 'Tárget']) {
      expect(nombres(matchNames(escrito, jugadores, (p) => p.display_name))[0]).toBe('Target')
    }
  })

  it('teclear el principio basta', () => {
    expect(nombres(matchNames('Tar', jugadores, (p) => p.display_name))).toContain('Target')
    expect(nombres(matchNames('Zen', jugadores, (p) => p.display_name))).toEqual(['Zenix'])
  })

  it('el nombre exacto va primero, aunque haya otro que empiece igual', () => {
    const r = matchNames('Target', jugadores, (p) => p.display_name)
    expect(r[0]!.item.display_name).toBe('Target')
    expect(r[0]!.kind).toBe('exact')
    expect(nombres(r)).toContain('Targetiin')
  })

  it('no propone a cualquiera', () => {
    expect(nombres(matchNames('Kotori', jugadores, (p) => p.display_name))).toEqual([])
    expect(nombres(matchNames('Omega', jugadores, (p) => p.display_name))).toEqual([])
  })

  it('con nombres cortos no acepta erratas', () => {
    // "Ana" y "Ane" son casi seguro dos personas, no una errata.
    const cortos = [{ id: '1', display_name: 'Ana' }]
    expect(matchNames('Ane', cortos, (p) => p.display_name)).toEqual([])
  })

  it('no devuelve nada con la búsqueda vacía', () => {
    expect(matchNames('', jugadores, (p) => p.display_name)).toEqual([])
    expect(matchNames('   ', jugadores, (p) => p.display_name)).toEqual([])
  })

  it('respeta el límite de sugerencias', () => {
    expect(matchNames('a', jugadores, (p) => p.display_name, 2).length).toBeLessThanOrEqual(2)
  })
})

describe('editDistance', () => {
  it('cuenta los cambios mínimos', () => {
    expect(editDistance('target', 'target')).toBe(0)
    expect(editDistance('target', 'taget')).toBe(1)
    expect(editDistance('target', 'targte')).toBe(2)
    expect(editDistance('target', 'candy')).toBeGreaterThan(3)
  })

  it('corta pronto cuando la diferencia es enorme', () => {
    expect(editDistance('a', 'abcdefghij', 2)).toBe(3)
  })
})

describe('foldName', () => {
  it('normaliza igual que la base de datos', () => {
    expect(foldName('Ramón')).toBe('ramon')
    expect(foldName('xX_Player_Xx')).toBe('xxplayerxx')
    expect(foldName('Candy♥')).toBe('candy')
  })
})
