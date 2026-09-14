import { describe, it, expect } from 'vitest'
import {
  LP_DELTA,
  LP_INICIAL,
  avisosDeCierre,
  cuentaDerrotas,
  cuentaVictorias,
  deltaDe,
  eventosDeCierre,
  lpTotal,
  resultadoDe,
} from '../../shared/lp'
import type { CierreDePartida, JugadorDePartida } from '../../shared/lp'
import type { PlayerRoleDb } from '../../shared/types/database.types'

const ROLES: PlayerRoleDb[] = ['TOP', 'JG', 'MID', 'ADC', 'SUP']

/** Cinco contra cinco, todos en su rol. Los ids son `t1-TOP`, `t2-SUP`… */
function alineacion(): JugadorDePartida[] {
  const out: JugadorDePartida[] = []
  for (const n of [1, 2] as const) {
    for (const role of ROLES) {
      out.push({
        participationId: `t${n}-${role}`,
        displayName: `${role} del ${n}`,
        teamNumber: n,
        role,
        isOffRole: false,
      })
    }
  }
  return out
}

const cierreBase: CierreDePartida = { winnerTeam: 1, mvp: null, ace: null, doubleLosses: [] }

describe('tabla de LP (§23)', () => {
  it('cada concepto vale lo que dice el plan', () => {
    expect(LP_DELTA.WIN).toBe(15)
    expect(LP_DELTA.LOSS).toBe(-15)
    expect(LP_DELTA.MVP).toBe(5)
    expect(LP_DELTA.ACE).toBe(10)
    expect(LP_DELTA.OFF_ROLE).toBe(2)
    expect(LP_DELTA.DOUBLE_LOSS).toBe(-30)
  })

  it('ganar son +15 y perder −15', () => {
    const eventos = eventosDeCierre(alineacion(), cierreBase)
    expect(deltaDe(eventos, 't1-TOP')).toBe(15)
    expect(deltaDe(eventos, 't2-TOP')).toBe(-15)
  })

  it('victoria + MVP + off role suman 22', () => {
    const jugadores = alineacion()
    jugadores[0]!.isOffRole = true // t1-TOP
    const eventos = eventosDeCierre(jugadores, { ...cierreBase, mvp: 't1-TOP' })
    expect(deltaDe(eventos, 't1-TOP')).toBe(22)
  })

  it('el ACE son +10 y se acumula con la victoria', () => {
    const eventos = eventosDeCierre(alineacion(), { ...cierreBase, ace: 't1-MID' })
    expect(deltaDe(eventos, 't1-MID')).toBe(25)
  })

  it('el mismo jugador puede ser MVP y ACE a la vez', () => {
    const eventos = eventosDeCierre(alineacion(), {
      ...cierreBase,
      mvp: 't1-ADC',
      ace: 't1-ADC',
    })
    expect(deltaDe(eventos, 't1-ADC')).toBe(30)
  })

  it('el off role suma también al que pierde', () => {
    const jugadores = alineacion()
    jugadores[5]!.isOffRole = true // t2-TOP
    const eventos = eventosDeCierre(jugadores, cierreBase)
    expect(deltaDe(eventos, 't2-TOP')).toBe(-13)
  })

  it('deja un evento por concepto, no uno por jugador', () => {
    const jugadores = alineacion()
    jugadores[0]!.isOffRole = true
    const eventos = eventosDeCierre(jugadores, { ...cierreBase, mvp: 't1-TOP' })
    const suyos = eventos.filter((e) => e.participationId === 't1-TOP').map((e) => e.type)
    expect(suyos).toEqual(['WIN', 'OFF_ROLE', 'MVP'])
  })

  it('una partida normal reparte 10 eventos', () => {
    expect(eventosDeCierre(alineacion(), cierreBase)).toHaveLength(10)
  })
})

describe('doble derrota (§16, A4)', () => {
  it('son −30 y manda sobre el marcador: la sufre alguien del equipo ganador', () => {
    const cierre = { ...cierreBase, doubleLosses: ['t1-JG'] }
    const eventos = eventosDeCierre(alineacion(), cierre)

    expect(deltaDe(eventos, 't1-JG')).toBe(-30)
    // Su equipo sigue ganando: los demás cobran su victoria.
    expect(deltaDe(eventos, 't1-TOP')).toBe(15)
  })

  it('el resultado individual queda como derrota, no como victoria', () => {
    const jugadores = alineacion()
    const jg = jugadores.find((j) => j.participationId === 't1-JG')!
    expect(resultadoDe(jg, { ...cierreBase, doubleLosses: ['t1-JG'] })).toBe('double_loss')
    expect(resultadoDe(jg, cierreBase)).toBe('win')
  })

  it('cuenta como dos derrotas en el roster', () => {
    expect(cuentaDerrotas(['loss', 'double_loss'])).toBe(3)
    expect(cuentaVictorias(['win', 'double_loss', 'loss'])).toBe(1)
  })

  it('en el equipo perdedor sustituye a la derrota, no se suma a ella', () => {
    const eventos = eventosDeCierre(alineacion(), { ...cierreBase, doubleLosses: ['t2-MID'] })
    expect(deltaDe(eventos, 't2-MID')).toBe(-30)
    const suyos = eventos.filter((e) => e.participationId === 't2-MID')
    expect(suyos).toHaveLength(1)
  })
})

describe('el total sale de sumar eventos (A3)', () => {
  it('parte de 100', () => {
    expect(lpTotal([])).toBe(LP_INICIAL)
  })

  it('tres partidas ganadas dejan 145', () => {
    expect(lpTotal([15, 15, 15])).toBe(145)
  })

  it('revertir una partida es no sumar sus deltas', () => {
    const conTres = lpTotal([15, 15, 15])
    const conDos = lpTotal([15, 15])
    expect(conTres - conDos).toBe(15)
  })
})

describe('anular una partida', () => {
  it('sin ganador no reparte nada', () => {
    expect(eventosDeCierre(alineacion(), { ...cierreBase, winnerTeam: null })).toEqual([])
  })
})

describe('avisos antes de cerrar', () => {
  it('avisa si el MVP está en el equipo que perdió', () => {
    const avisos = avisosDeCierre(alineacion(), { ...cierreBase, mvp: 't2-TOP' })
    expect(avisos.map((a) => a.code)).toContain('mvp_perdedor')
  })

  it('no avisa si el MVP ganó', () => {
    const avisos = avisosDeCierre(alineacion(), { ...cierreBase, mvp: 't1-TOP' })
    expect(avisos.map((a) => a.code)).not.toContain('mvp_perdedor')
  })

  it('avisa si no se marcó MVP', () => {
    const avisos = avisosDeCierre(alineacion(), cierreBase)
    expect(avisos.map((a) => a.code)).toContain('sin_mvp')
  })

  it('avisa del equipo incompleto, y dice con cuántos jugó', () => {
    const jugadores = alineacion().filter((j) => j.participationId !== 't2-SUP')
    const avisos = avisosDeCierre(jugadores, { ...cierreBase, mvp: 't1-TOP' })
    const inc = avisos.find((a) => a.code === 'equipo_incompleto')
    expect(inc?.message).toContain('4 jugadores')
  })

  it('un 5v5 con MVP no tiene nada que avisar', () => {
    expect(avisosDeCierre(alineacion(), { ...cierreBase, mvp: 't1-TOP' })).toEqual([])
  })
})
