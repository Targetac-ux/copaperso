import { describe, it, expect } from 'vitest'
import { TIERS, TIER_INSIGNIA, TIER_LABEL, cambios, esTier, mover, porTier } from '../../shared/tiers'
import type { EntradaTier } from '../../shared/tiers'
import type { TierName } from '../../shared/types/database.types'

function e(id: string, tier: TierName, rankOrder: number, nombre = id): EntradaTier {
  return {
    id,
    playerId: `p-${id}`,
    displayName: nombre,
    photoUrl: null,
    tier,
    points: null,
    mainRole: 'MID',
    elo: 'GOLD',
    rankOrder,
  }
}

const tabla = () => [
  e('a1', 'A', 0),
  e('a2', 'A', 1),
  e('a3', 'A', 2),
  e('s1', 'S', 0),
  e('d1', 'D', 0),
]

describe('los tiers', () => {
  it('van de mejor a peor', () => {
    expect(TIERS).toEqual(['S_PLUS', 'S', 'A', 'B', 'C', 'D'])
  })

  it('S_PLUS se lee «S+»', () => {
    expect(TIER_LABEL.S_PLUS).toBe('S+')
  })

  it('reconoce lo que viene de fuera', () => {
    expect(esTier('S_PLUS')).toBe(true)
    expect(esTier('SS')).toBe(false)
    expect(esTier(null)).toBe(false)
  })
})

describe('agrupar por tier', () => {
  it('los seis salen aunque estén vacíos', () => {
    expect(Object.keys(porTier([]))).toEqual(TIERS)
  })

  it('ordena por posición dentro de cada tier', () => {
    const grupos = porTier([e('a2', 'A', 1), e('a1', 'A', 0)])
    expect(grupos.A.map((x) => x.id)).toEqual(['a1', 'a2'])
  })

  it('a igual posición, manda el nombre', () => {
    const grupos = porTier([e('x', 'A', 0, 'Zeta'), e('y', 'A', 0, 'Alfa')])
    expect(grupos.A.map((x) => x.displayName)).toEqual(['Alfa', 'Zeta'])
  })
})

describe('mover a alguien de tier', () => {
  it('lo saca de donde estaba y lo mete donde va', () => {
    const despues = mover(tabla(), 'a1', 'S_PLUS', 0)
    const grupos = porTier(despues)

    expect(grupos.S_PLUS.map((x) => x.id)).toEqual(['a1'])
    expect(grupos.A.map((x) => x.id)).toEqual(['a2', 'a3'])
  })

  it('renumera a los que se quedan, sin huecos', () => {
    const grupos = porTier(mover(tabla(), 'a1', 'S_PLUS', 0))
    expect(grupos.A.map((x) => x.rankOrder)).toEqual([0, 1])
  })

  it('respeta la posición dentro del tier de destino', () => {
    const despues = mover(tabla(), 's1', 'A', 1)
    expect(porTier(despues).A.map((x) => x.id)).toEqual(['a1', 's1', 'a2', 'a3'])
  })

  it('una posición pasada de rosca lo deja al final', () => {
    const despues = mover(tabla(), 's1', 'A', 99)
    expect(porTier(despues).A.map((x) => x.id)).toEqual(['a1', 'a2', 'a3', 's1'])
  })

  it('moverlo dentro de su propio tier también ordena', () => {
    const despues = mover(tabla(), 'a3', 'A', 0)
    expect(porTier(despues).A.map((x) => x.id)).toEqual(['a3', 'a1', 'a2'])
  })

  it('un id que no existe no cambia nada', () => {
    const antes = tabla()
    expect(mover(antes, 'fantasma', 'S', 0)).toBe(antes)
  })

  it('no toca la lista original', () => {
    const antes = tabla()
    const copia = JSON.parse(JSON.stringify(antes))
    mover(antes, 'a1', 'D', 0)
    expect(antes).toEqual(copia)
  })

  it('nadie se pierde por el camino', () => {
    const despues = mover(tabla(), 'd1', 'S', 0)
    expect(despues).toHaveLength(5)
    expect(new Set(despues.map((x) => x.id)).size).toBe(5)
  })
})

describe('qué hay que guardar', () => {
  it('solo las filas que cambiaron', () => {
    const antes = tabla()
    const despues = mover(antes, 'a1', 'S_PLUS', 0)
    const lista = cambios(antes, despues)

    // a1 cambia de tier; a2 y a3 suben una posición. s1 y d1 siguen igual.
    expect(lista.map((c) => c.id).sort()).toEqual(['a1', 'a2', 'a3'])
  })

  it('el que se mueve lleva su tier nuevo y su posición', () => {
    const lista = cambios(tabla(), mover(tabla(), 'd1', 'S', 1))
    const d1 = lista.find((c) => c.id === 'd1')!
    expect(d1.tier).toBe('S')
    expect(d1.rankOrder).toBe(1)
  })

  it('sin movimiento, nada que guardar', () => {
    const antes = tabla()
    expect(cambios(antes, porTier(antes) && antes)).toEqual([])
  })
})

describe('las insignias', () => {
  it('hay una por tier y apuntan a un archivo que existe', async () => {
    const { existsSync } = await import('node:fs')
    for (const t of TIERS) {
      const ruta = TIER_INSIGNIA[t]
      expect(ruta, `falta la insignia de ${t}`).toBeTruthy()
      expect(existsSync(`public${ruta}`), `no existe public${ruta}`).toBe(true)
    }
  })
})
