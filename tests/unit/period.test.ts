import { describe, it, expect } from 'vitest'
import { parseLocalDate, toLocalISODate, periodNameFor, monthStart } from '../../shared/period'

describe('fechas de periodo', () => {
  it('el día 1 pertenece a su mes, no al anterior', () => {
    // El fallo clásico: new Date('2026-10-01') es 30-sep en cualquier huso al
    // oeste de Greenwich, y abrir el mes esa noche creaba el periodo anterior.
    const octubre = parseLocalDate('2026-10-01')!
    expect(octubre.getMonth()).toBe(9)
    expect(periodNameFor(octubre)).toBe('OCT-2026')
  })

  it('nombra los doce meses', () => {
    const nombres = Array.from({ length: 12 }, (_, i) => periodNameFor(new Date(2026, i, 15)))
    expect(nombres).toEqual([
      'ENE-2026', 'FEB-2026', 'MAR-2026', 'ABR-2026', 'MAY-2026', 'JUN-2026',
      'JUL-2026', 'AGO-2026', 'SEP-2026', 'OCT-2026', 'NOV-2026', 'DIC-2026',
    ])
  })

  it('ida y vuelta sin desplazamiento', () => {
    for (const fecha of ['2026-01-01', '2026-06-30', '2026-12-31', '2027-03-01']) {
      expect(toLocalISODate(parseLocalDate(fecha)!)).toBe(fecha)
    }
  })

  it('el primer día del mes', () => {
    expect(toLocalISODate(monthStart(new Date(2026, 9, 23)))).toBe('2026-10-01')
    expect(toLocalISODate(monthStart(new Date(2026, 0, 31)))).toBe('2026-01-01')
  })

  it('rechaza lo que no es una fecha', () => {
    expect(parseLocalDate('octubre')).toBeNull()
    expect(parseLocalDate('2026-13-01')?.getMonth()).not.toBe(12)
    expect(parseLocalDate('')).toBeNull()
  })
})
