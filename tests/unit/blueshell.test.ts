import { describe, it, expect } from 'vitest'
import {
  BLUE_SHELL_LABEL,
  BLUE_SHELL_OUTCOMES,
  esBlueShellOutcome,
  girar,
} from '../../shared/blueshell'

describe('la ruleta del Blue Shell (§16)', () => {
  it('los cuatro resultados salen en 400 tiradas', () => {
    const vistos = new Set<string>()
    for (let i = 0; i < 400; i++) vistos.add(girar())
    expect([...vistos].sort()).toEqual([...BLUE_SHELL_OUTCOMES].sort())
  })

  it('reparte parejo: ninguno baja del 15 % en 4000 tiradas', () => {
    const cuenta = new Map<string, number>()
    for (let i = 0; i < 4000; i++) {
      const r = girar()
      cuenta.set(r, (cuenta.get(r) ?? 0) + 1)
    }
    for (const o of BLUE_SHELL_OUTCOMES) {
      expect(cuenta.get(o) ?? 0).toBeGreaterThan(4000 * 0.15)
    }
  })

  it('cada tramo del azar cae en un resultado distinto', () => {
    expect(girar(() => 0)).toBe('NO_FLASH')
    expect(girar(() => 0.26)).toBe('DOUBLE_LOSS')
    expect(girar(() => 0.51)).toBe('RANDOM_CHAMPION')
    expect(girar(() => 0.99)).toBe('SPECIFIC_BUILD')
  })

  it('un rng que devuelva 1 no se sale de la lista', () => {
    expect(girar(() => 1)).toBe('SPECIFIC_BUILD')
  })

  it('todos los resultados tienen su etiqueta en castellano', () => {
    for (const o of BLUE_SHELL_OUTCOMES) {
      expect(BLUE_SHELL_LABEL[o]).toBeTruthy()
    }
  })

  it('reconoce lo que viene de fuera', () => {
    expect(esBlueShellOutcome('NO_FLASH')).toBe(true)
    expect(esBlueShellOutcome('PERDER_TODO')).toBe(false)
    expect(esBlueShellOutcome(null)).toBe(false)
  })
})
