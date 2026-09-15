import { describe, it, expect } from 'vitest'
import {
  TRIPLE,
  balanceAfter,
  codigoDeRecompensa,
  codigoLibre,
  daysBetween,
  effectiveCost,
  loanAmountDue,
  loanInterest,
  priceList,
} from '../../shared/economy'

const CATALOGO = [
  { code: 'SPOT_TAKEOVER', label: 'Cupo', costBits: 200 },
  { code: 'TEAM_CHANGE', label: 'Cambio de Team', costBits: 150 },
  { code: 'BENCH_PULL', label: 'Sacar de banca', costBits: 200 },
  { code: 'ROLE_CHANGE_REENTRY', label: 'Rol y reingreso', costBits: 300 },
  { code: 'GRAVEYARD_EXIT', label: 'Sacar del cementerio', costBits: 300 },
  { code: 'BLUE_SHELL', label: 'Blue Shell', costBits: 500 },
]

describe('precios', () => {
  it('a precio normal no cambia nada', () => {
    expect(effectiveCost(500, false)).toBe(500)
    expect(effectiveCost(150, false)).toBe(150)
  })

  it('triplicados, x3 exacto', () => {
    expect(effectiveCost(500, true)).toBe(1500)
    expect(effectiveCost(200, true)).toBe(600)
    expect(effectiveCost(150, true)).toBe(450)
    expect(TRIPLE).toBe(3)
  })

  it('el catálogo de §13 triplicado da los números esperados', () => {
    const lista = priceList(CATALOGO, true)
    const por = (code: string) => lista.find((a) => a.code === code)!.effective
    expect(por('SPOT_TAKEOVER')).toBe(600)
    expect(por('TEAM_CHANGE')).toBe(450)
    expect(por('BENCH_PULL')).toBe(600)
    expect(por('ROLE_CHANGE_REENTRY')).toBe(900)
    expect(por('GRAVEYARD_EXIT')).toBe(900)
    expect(por('BLUE_SHELL')).toBe(1500)
  })

  it('el catálogo original nunca se toca al triplicar', () => {
    const antes = CATALOGO.map((a) => a.costBits)
    priceList(CATALOGO, true)
    expect(CATALOGO.map((a) => a.costBits)).toEqual(antes)
  })
})

describe('préstamos', () => {
  const prestamo = { principalBits: 400, dailyRate: 0.1, lentAt: '2026-09-01' }
  const dia = (n: number) => new Date(2026, 8, 1 + n)

  it('los números que dio el host', () => {
    expect(loanAmountDue(prestamo, dia(0))).toBe(400)
    expect(loanAmountDue(prestamo, dia(1))).toBe(440)
    expect(loanAmountDue(prestamo, dia(2))).toBe(480)
    expect(loanAmountDue(prestamo, dia(3))).toBe(520)
    expect(loanAmountDue(prestamo, dia(12))).toBe(880)
  })

  it('es lineal, no compuesto', () => {
    // Compuesto daría 400 * 1.1^12 = 1255. Lineal da 880.
    expect(loanAmountDue(prestamo, dia(12))).toBe(880)
    expect(loanAmountDue(prestamo, dia(12))).not.toBe(1255)
  })

  it('el interés sale aparte del principal', () => {
    expect(loanInterest(prestamo, dia(7))).toBe(280)
    expect(loanInterest(prestamo, dia(0))).toBe(0)
  })

  it('un préstamo saldado deja de correr', () => {
    const saldado = { ...prestamo, settledAt: '2026-09-04' }
    expect(loanAmountDue(saldado, dia(30))).toBe(520)
  })

  it('una fecha futura no genera interés negativo', () => {
    expect(loanAmountDue({ ...prestamo, lentAt: '2026-12-01' }, dia(1))).toBe(400)
  })

  it('cuenta días completos', () => {
    expect(daysBetween('2026-09-01', '2026-09-13')).toBe(12)
    expect(daysBetween('2026-09-01', '2026-09-01')).toBe(0)
    expect(daysBetween('2026-09-13', '2026-09-01')).toBe(0)
  })
})

describe('banco de bits/subs', () => {
  it('suma y resta lo que escribe el host', () => {
    const saldo = balanceAfter({ bits: 1000, subs: 0 }, [
      { deltaBits: -500, deltaSubs: 0 },
      { deltaBits: 200, deltaSubs: 1 },
    ])
    expect(saldo).toEqual({ bits: 700, subs: 1 })
  })

  it('sin movimientos, el saldo no cambia', () => {
    expect(balanceAfter({ bits: 350, subs: 2 }, [])).toEqual({ bits: 350, subs: 2 })
  })

  it('permite saldo negativo: el host sabrá por qué', () => {
    expect(balanceAfter({ bits: 100, subs: 0 }, [{ deltaBits: -500, deltaSubs: 0 }]).bits).toBe(-400)
  })
})

describe('el código de una recompensa nueva', () => {
  it('se parece a los de siempre', () => {
    expect(codigoDeRecompensa('Cambio de Team')).toBe('CAMBIO_DE_TEAM')
    expect(codigoDeRecompensa('Blue Shell')).toBe('BLUE_SHELL')
  })

  it('quita acentos y símbolos, que no valen como identificador', () => {
    expect(codigoDeRecompensa('Sacar del cementerio ✦')).toBe('SACAR_DEL_CEMENTERIO')
    expect(codigoDeRecompensa('  Cambio  de   rol  ')).toBe('CAMBIO_DE_ROL')
  })

  it('un nombre que no deja nada utilizable no devuelve vacío', () => {
    expect(codigoDeRecompensa('🎁🎁')).toMatch(/^RECOMPENSA_/)
    expect(codigoDeRecompensa('')).toMatch(/^RECOMPENSA_/)
  })

  it('no choca con uno que ya existe', () => {
    expect(codigoLibre('Blue Shell', ['BLUE_SHELL'])).toBe('BLUE_SHELL_2')
    expect(codigoLibre('Blue Shell', ['BLUE_SHELL', 'BLUE_SHELL_2'])).toBe('BLUE_SHELL_3')
  })

  it('si está libre, se queda tal cual', () => {
    expect(codigoLibre('Otra cosa', ['BLUE_SHELL'])).toBe('OTRA_COSA')
  })
})
