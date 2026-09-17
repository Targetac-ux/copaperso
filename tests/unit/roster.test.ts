import { describe, it, expect } from 'vitest'
import {
  CSV_CABECERAS,
  contar,
  filaCsv,
  filtrar,
  formatWinrate,
  ordenar,
  rosterACsv,
  winratePct,
} from '../../shared/roster'
import type { AgregadoHistorico, FilaRoster, ResultadoDeJugador } from '../../shared/roster'

function fila(p: Partial<FilaRoster> = {}): FilaRoster {
  return {
    playerId: 'p',
    participationId: 'pa',
    displayName: 'Target',
    photoUrl: null,
    elo: 'DEMON',
    roles: ['MID', 'JG'],
    lp: 145,
    jugadas: 3,
    victorias: 2,
    derrotas: 1,
    mvps: 1,
    aces: 0,
    offRoles: 1,
    importadoDe: null,
    ...p,
  }
}

const r = (p: Partial<ResultadoDeJugador> = {}): ResultadoDeJugador => ({
  result: 'win',
  isMvp: false,
  isAce: false,
  isOffRole: false,
  ...p,
})

describe('las cuentas del roster', () => {
  it('cuenta victorias, derrotas y premios', () => {
    const c = contar([
      r({ result: 'win', isMvp: true }),
      r({ result: 'win', isOffRole: true }),
      r({ result: 'loss' }),
      r({ result: 'loss', isAce: true }),
    ])
    expect(c).toEqual({ jugadas: 4, victorias: 2, derrotas: 2, mvps: 1, aces: 1, offRoles: 1 })
  })

  it('la doble derrota cuenta por dos', () => {
    const c = contar([r({ result: 'win' }), r({ result: 'double_loss' })])
    expect(c.derrotas).toBe(2)
    expect(c.jugadas).toBe(2)
    expect(c.victorias).toBe(1)
  })

  it('una partida sin resultado no cuenta para nadie', () => {
    // Es una que sigue en juego, o una cuyo resultado se deshizo.
    const c = contar([r({ result: 'win' }), r({ result: null, isMvp: true })])
    expect(c.jugadas).toBe(1)
    expect(c.mvps, 'el MVP de una partida deshecha no cuenta').toBe(0)
  })

  it('sin partidas, todo a cero', () => {
    expect(contar([])).toEqual({
      jugadas: 0, victorias: 0, derrotas: 0, mvps: 0, aces: 0, offRoles: 0,
    })
  })
})

describe('el winrate', () => {
  it('se redondea al entero', () => {
    expect(winratePct({ jugadas: 3, victorias: 2 })).toBe(67)
    expect(winratePct({ jugadas: 8, victorias: 3 })).toBe(38)
    expect(winratePct({ jugadas: 2, victorias: 1 })).toBe(50)
  })

  // Prueba 2 de cierre: ni NaN ni 0 % para quien no ha jugado.
  it('quien no ha jugado no tiene winrate, y se lee «—»', () => {
    expect(winratePct({ jugadas: 0, victorias: 0 })).toBeNull()
    expect(formatWinrate(null)).toBe('—')
    expect(formatWinrate(null)).not.toContain('NaN')
    expect(formatWinrate(null)).not.toContain('0')
  })

  it('perder todas es 0 %, que no es lo mismo que no jugar', () => {
    expect(formatWinrate(winratePct({ jugadas: 4, victorias: 0 }))).toBe('0 %')
  })

  it('ganarlas todas es 100 %', () => {
    expect(formatWinrate(winratePct({ jugadas: 5, victorias: 5 }))).toBe('100 %')
  })
})

describe('la pantalla y el CSV dicen lo mismo', () => {
  // Prueba 2 de cierre: el mismo redondeo en los dos sitios.
  const casos = [
    { jugadas: 3, victorias: 2 },
    { jugadas: 8, victorias: 3 },
    { jugadas: 7, victorias: 5 },
    { jugadas: 4, victorias: 0 },
    { jugadas: 0, victorias: 0 },
  ]

  for (const caso of casos) {
    it(`${caso.victorias} de ${caso.jugadas}`, () => {
      const f = fila(caso)
      const pct = winratePct(f)
      const enPantalla = formatWinrate(pct)
      const enCsv = filaCsv(f).split(',')[7]

      if (pct === null) {
        expect(enPantalla).toBe('—')
        expect(enCsv, 'sin partidas, la celda va vacía, no «0»').toBe('')
      } else {
        expect(enCsv).toBe(String(pct))
        expect(enPantalla).toBe(`${pct} %`)
      }
    })
  }
})

describe('el CSV', () => {
  it('lleva las cabeceras en orden y una fila por jugador', () => {
    const csv = rosterACsv([fila({ displayName: 'Uno' }), fila({ displayName: 'Dos' })])
    const lineas = csv.replace('\uFEFF', '').trim().split('\r\n')
    expect(lineas[0]).toBe(CSV_CABECERAS.join(','))
    expect(lineas).toHaveLength(3)
  })

  it('empieza con BOM, para que Excel no rompa los acentos', () => {
    expect(rosterACsv([])).toMatch(/^\uFEFF/)
  })

  it('entrecomilla un nombre con coma sin partir la fila', () => {
    const csv = rosterACsv([fila({ displayName: 'Target, el MID' })])
    const lineas = csv.replace('\uFEFF', '').trim().split('\r\n')
    expect(lineas).toHaveLength(2)
    expect(lineas[1]).toContain('"Target, el MID"')
  })

  it('duplica las comillas de un nombre que las lleve', () => {
    expect(filaCsv(fila({ displayName: 'El "Demon"' }))).toContain('"El ""Demon"""')
  })

  it('sin jugadores deja solo la cabecera', () => {
    expect(rosterACsv([]).replace('\uFEFF', '').trim()).toBe(CSV_CABECERAS.join(','))
  })
})

describe('ordenar', () => {
  const filas = [
    fila({ displayName: 'Ana', lp: 100, jugadas: 2, victorias: 2 }),
    fila({ displayName: 'Beto', lp: 160, jugadas: 4, victorias: 1 }),
    fila({ displayName: 'Cleo', lp: 130, jugadas: 0, victorias: 0 }),
  ]

  it('por LP, de más a menos', () => {
    expect(ordenar(filas, 'lp').map((f) => f.displayName)).toEqual(['Beto', 'Cleo', 'Ana'])
  })

  it('por nombre, alfabético', () => {
    expect(ordenar(filas, 'nombre', false).map((f) => f.displayName)).toEqual(['Ana', 'Beto', 'Cleo'])
  })

  it('quien no ha jugado se va al final del winrate, no al medio como un 0 %', () => {
    const orden = ordenar(filas, 'wr').map((f) => f.displayName)
    expect(orden[0]).toBe('Ana')
    expect(orden[2], 'sin partidas, al final').toBe('Cleo')
  })

  it('a igualdad, manda el nombre', () => {
    const empate = [fila({ displayName: 'Zeta', lp: 100 }), fila({ displayName: 'Alfa', lp: 100 })]
    expect(ordenar(empate, 'lp').map((f) => f.displayName)).toEqual(['Alfa', 'Zeta'])
  })

  it('no toca el array original', () => {
    const copia = [...filas]
    ordenar(filas, 'lp')
    expect(filas).toEqual(copia)
  })
})

describe('buscar', () => {
  const filas = [
    fila({ displayName: 'Target', roles: ['MID'], elo: 'DEMON' }),
    fila({ displayName: 'Mádhu', roles: ['JG'], elo: 'GOLD' }),
  ]

  it('por trozo del nombre', () => {
    expect(filtrar(filas, 'tar').map((f) => f.displayName)).toEqual(['Target'])
  })

  it('sin acentos', () => {
    expect(filtrar(filas, 'madhu')).toHaveLength(1)
  })

  it('por rol y por elo', () => {
    expect(filtrar(filas, 'jg').map((f) => f.displayName)).toEqual(['Mádhu'])
    expect(filtrar(filas, 'demon').map((f) => f.displayName)).toEqual(['Target'])
  })

  it('vacío devuelve todo', () => {
    expect(filtrar(filas, '   ')).toHaveLength(2)
  })
})

describe('el histórico importado del Excel', () => {
  /**
   * Los ocho meses del CCPR Roster llegaron como totales, no como partidas.
   * Si `contar` no los sumara, el roster de febrero enseñaría el LP correcto
   * junto a «0 partidas», que es exactamente la pantalla rota que la
   * migración 20260916000001 existe para evitar.
   */
  const h = (p: Partial<AgregadoHistorico> = {}): AgregadoHistorico => ({
    historic_wins: 0,
    historic_losses: 0,
    historic_mvps: 0,
    historic_aces: 0,
    historic_off_roles: 0,
    ...p,
  })

  it('un mes sin partidas enseña lo que traía la hoja', () => {
    const c = contar([], h({ historic_wins: 9, historic_losses: 5, historic_mvps: 1, historic_aces: 2 }))
    expect(c).toEqual({ jugadas: 14, victorias: 9, derrotas: 5, mvps: 1, aces: 2, offRoles: 0 })
    expect(winratePct(c)).toBe(64)
  })

  it('un mes importado al que luego se le juega una copa suma las dos cosas', () => {
    const c = contar([r(), r({ result: 'loss' })], h({ historic_wins: 3, historic_losses: 1 }))
    expect(c).toMatchObject({ jugadas: 6, victorias: 4, derrotas: 2 })
  })

  // La doble derrota del Blue Shell cuenta por dos, y la hoja ya la traía
  // contada así: sumarla otra vez la contaría cuatro veces.
  it('la doble derrota jugada sigue contando por dos junto al histórico', () => {
    expect(contar([r({ result: 'double_loss' })], h({ historic_losses: 4 })).derrotas).toBe(6)
  })

  it('sin histórico no cambia nada de lo que ya contaba', () => {
    const jugadas = [r(), r({ result: 'loss', isMvp: true })]
    expect(contar(jugadas, null)).toEqual(contar(jugadas))
    expect(contar(jugadas, undefined)).toEqual(contar(jugadas))
  })

  // `null` es «este mes no vino de un Excel», y no es lo mismo que cero: quien
  // no ha jugado tiene que seguir saliendo con «—» y no con «0 %».
  it('un mes vacío y sin histórico sigue sin winrate', () => {
    expect(winratePct(contar([], h()))).toBeNull()
    expect(winratePct(contar([], null))).toBeNull()
  })

  it('el CSV exporta las cifras importadas como cualquier otra', () => {
    const c = contar([], h({ historic_wins: 2, historic_losses: 2, historic_mvps: 1 }))
    expect(filaCsv(fila({ ...c, displayName: 'Ratth', elo: null, roles: [], lp: 50 })))
      .toBe('Ratth,,,50,4,2,2,50,1,0,0')
  })
})
