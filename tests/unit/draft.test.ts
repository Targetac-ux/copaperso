import { describe, it, expect } from 'vitest'
import {
  checkAssignment,
  checkSwap,
  pickRandomFromBench,
  emptyRoles,
  findMember,
  isOffRole,
  remainingSlots,
  demonBalance,
  isDemon,
  type DraftState,
  type BenchPlayer,
} from '../../shared/draft'

function banca(
  id: string,
  nombre: string,
  roles: BenchPlayer['roles'] = ['MID'],
  state: BenchPlayer['state'] = 'bench',
  elo: BenchPlayer['elo'] = 'CHALLENGER',
): BenchPlayer {
  return {
    sessionParticipantId: id,
    participationId: `p-${id}`,
    displayName: nombre,
    roles,
    elo,
    state,
  }
}

function estado(overrides: Partial<DraftState> = {}): DraftState {
  return {
    bench: [
      banca('a', 'Target', ['MID', 'JG']),
      banca('b', 'Candy', ['ADC']),
      banca('c', 'Zenix', ['TOP']),
      banca('d', 'Kotori', ['SUP'], 'jail'),
      banca('e', 'Omega', ['JG'], 'graveyard'),
    ],
    teams: [
      { teamNumber: 1, members: [] },
      { teamNumber: 2, members: [] },
    ],
    ...overrides,
  }
}

const miembro = (id: string, nombre: string, role: BenchPlayer['roles'][number]) => ({
  sessionParticipantId: id,
  participationId: `p-${id}`,
  displayName: nombre,
  role,
  isOffRole: false,
})

describe('checkAssignment', () => {
  it('asignar a un hueco libre no da problemas', () => {
    const r = checkAssignment(estado(), 'a', 1, 'MID')
    expect(r.errors).toEqual([])
    expect(r.warnings).toEqual([])
  })

  it('rechaza a quien no está en la sesión', () => {
    expect(checkAssignment(estado(), 'zzz', 1, 'MID').errors[0]!.code).toBe('not_in_session')
  })

  it('rechaza meter a un sexto jugador', () => {
    const s = estado({
      teams: [
        {
          teamNumber: 1,
          members: [
            miembro('x1', 'Uno', 'TOP'), miembro('x2', 'Dos', 'JG'), miembro('x3', 'Tres', 'MID'),
            miembro('x4', 'Cuatro', 'ADC'), miembro('x5', 'Cinco', 'SUP'),
          ],
        },
        { teamNumber: 2, members: [] },
      ],
    })
    expect(checkAssignment(s, 'a', 1, 'MID').errors[0]!.code).toBe('team_full')
  })

  it('mover a alguien dentro de su propio equipo lleno no es "equipo lleno"', () => {
    // Cambiarle el rol a quien ya está dentro debe seguir siendo posible.
    const s = estado({
      teams: [
        {
          teamNumber: 1,
          members: [
            miembro('a', 'Target', 'TOP'), miembro('x2', 'Dos', 'JG'), miembro('x3', 'Tres', 'MID'),
            miembro('x4', 'Cuatro', 'ADC'), miembro('x5', 'Cinco', 'SUP'),
          ],
        },
        { teamNumber: 2, members: [] },
      ],
    })
    expect(checkAssignment(s, 'a', 1, 'JG').errors).toEqual([])
  })

  it('el rol repetido avisa pero deja pasar', () => {
    const s = estado({
      teams: [
        { teamNumber: 1, members: [miembro('x1', 'Otro', 'MID')] },
        { teamNumber: 2, members: [] },
      ],
    })
    const r = checkAssignment(s, 'a', 1, 'MID')
    expect(r.errors).toEqual([])
    expect(r.warnings.map((w) => w.code)).toContain('duplicate_role')
    expect(r.warnings[0]!.message).toContain('Otro')
  })

  it('avisa del off-role', () => {
    // Candy es ADC; ponerla de SUP es off-role.
    const r = checkAssignment(estado(), 'b', 1, 'SUP')
    expect(r.errors).toEqual([])
    expect(r.warnings.map((w) => w.code)).toContain('off_role')
  })

  it('avisa si viene de la cárcel o del cementerio, pero no lo impide', () => {
    expect(checkAssignment(estado(), 'd', 1, 'SUP').warnings.map((w) => w.code)).toContain('not_available')
    expect(checkAssignment(estado(), 'e', 1, 'JG').errors).toEqual([])
  })
})

describe('checkSwap', () => {
  const conEquipos = () =>
    estado({
      teams: [
        { teamNumber: 1, members: [miembro('a', 'Target', 'MID')] },
        { teamNumber: 2, members: [miembro('b', 'PlayerA', 'ADC')] },
      ],
    })

  it('dos jugadores de equipos distintos', () => {
    expect(checkSwap(conEquipos(), 'a', 'b').errors).toEqual([])
  })

  it('no se puede intercambiar a alguien consigo mismo', () => {
    expect(checkSwap(conEquipos(), 'a', 'a').errors[0]!.code).toBe('same_player')
  })

  it('no se puede intercambiar con alguien que está en la banca', () => {
    expect(checkSwap(conEquipos(), 'a', 'c').errors[0]!.code).toBe('not_on_team')
  })

  it('avisa si los dos están en el mismo equipo', () => {
    const s = estado({
      teams: [
        { teamNumber: 1, members: [miembro('a', 'Target', 'MID'), miembro('b', 'Candy', 'ADC')] },
        { teamNumber: 2, members: [] },
      ],
    })
    expect(checkSwap(s, 'a', 'b').warnings.length).toBe(1)
  })
})

describe('pickRandomFromBench', () => {
  it('solo saca a los que están disponibles', () => {
    // Kotori (cárcel) y Omega (cementerio) nunca pueden salir.
    const posibles = new Set<string>()
    for (let i = 0; i < 300; i++) {
      const elegido = pickRandomFromBench(estado().bench)
      posibles.add(elegido!.sessionParticipantId)
    }
    expect([...posibles].sort()).toEqual(['a', 'b', 'c'])
  })

  it('reparte parejo: 200 tiradas sobre 10 jugadores, desviación bajo el 15%', () => {
    const banca10 = Array.from({ length: 10 }, (_, i) => banca(`j${i}`, `Jugador ${i}`))
    const cuenta = new Map<string, number>()
    const tiradas = 200

    for (let i = 0; i < tiradas; i++) {
      const elegido = pickRandomFromBench(banca10)!
      cuenta.set(elegido.sessionParticipantId, (cuenta.get(elegido.sessionParticipantId) ?? 0) + 1)
    }

    expect(cuenta.size).toBe(10)
    const esperado = tiradas / 10
    for (const [, veces] of cuenta) {
      expect(Math.abs(veces - esperado) / esperado).toBeLessThan(0.85)
    }
    // Y la media global sí tiene que cuadrar de cerca.
    const media = [...cuenta.values()].reduce((a, b) => a + b, 0) / cuenta.size
    expect(Math.abs(media - esperado) / esperado).toBeLessThan(0.15)
  })

  it('devuelve null si no queda nadie disponible', () => {
    expect(pickRandomFromBench([])).toBeNull()
    expect(pickRandomFromBench([banca('d', 'Kotori', ['SUP'], 'jail')])).toBeNull()
  })

  it('con un generador fijo, elige de forma predecible', () => {
    const b = [banca('a', 'A'), banca('b', 'B'), banca('c', 'C')]
    expect(pickRandomFromBench(b, () => 0)!.displayName).toBe('A')
    expect(pickRandomFromBench(b, () => 0.5)!.displayName).toBe('B')
    expect(pickRandomFromBench(b, () => 0.999)!.displayName).toBe('C')
    // Un generador que devuelva 1 no debe salirse del array.
    expect(pickRandomFromBench(b, () => 1)!.displayName).toBe('C')
  })
})

describe('utilidades', () => {
  it('emptyRoles dice qué falta', () => {
    const team = { teamNumber: 1 as const, members: [miembro('a', 'Target', 'MID')] }
    expect(emptyRoles(team)).toEqual(['TOP', 'JG', 'ADC', 'SUP'])
  })

  it('findMember localiza a alguien y su equipo', () => {
    const s = estado({
      teams: [
        { teamNumber: 1, members: [miembro('a', 'Target', 'MID')] },
        { teamNumber: 2, members: [] },
      ],
    })
    expect(findMember(s, 'a')!.team.teamNumber).toBe(1)
    expect(findMember(s, 'b')).toBeNull()
  })

  it('isOffRole solo aplica si sabemos sus roles', () => {
    expect(isOffRole(['MID', 'JG'], 'MID')).toBe(false)
    expect(isOffRole(['MID', 'JG'], 'SUP')).toBe(true)
    expect(isOffRole([], 'SUP')).toBe(false)
  })

  it('remainingSlots cuenta los huecos de los dos equipos', () => {
    expect(remainingSlots(estado())).toBe(10)
    const s = estado({
      teams: [
        { teamNumber: 1, members: [miembro('a', 'Target', 'MID')] },
        { teamNumber: 2, members: [miembro('b', 'Candy', 'ADC')] },
      ],
    })
    expect(remainingSlots(s)).toBe(8)
  })
})

describe('balance de Demons', () => {
  // Dos Demon en la banca, listos para repartir.
  const conDemons = () =>
    estado({
      bench: [
        banca('d1', 'Demon Uno', ['MID'], 'bench', 'DEMON'),
        banca('d2', 'Demon Dos', ['TOP'], 'bench', 'DEMON'),
        banca('n1', 'Normal Uno', ['ADC'], 'bench', 'CHALLENGER'),
      ],
      teams: [
        { teamNumber: 1, members: [] },
        { teamNumber: 2, members: [] },
      ],
    })

  const conUnDemonEnT1 = () => {
    const s = conDemons()
    s.teams[0].members.push(miembro('d1', 'Demon Uno', 'MID'))
    return s
  }

  it('el primer Demon no dice nada: 1-0 es un paso normal del draft', () => {
    const r = checkAssignment(conDemons(), 'd1', 1, 'MID')
    expect(r.warnings.map((w) => w.code)).not.toContain('demon_balance')
  })

  it('el segundo Demon al otro equipo tampoco: queda 1-1', () => {
    const r = checkAssignment(conUnDemonEnT1(), 'd2', 2, 'TOP')
    expect(r.warnings.map((w) => w.code)).not.toContain('demon_balance')
  })

  it('el segundo Demon al MISMO equipo avisa: quedaría 2-0', () => {
    const r = checkAssignment(conUnDemonEnT1(), 'd2', 1, 'TOP')
    const aviso = r.warnings.find((w) => w.code === 'demon_balance')
    expect(aviso).toBeDefined()
    expect(aviso!.message).toContain('2 Demon')
    expect(aviso!.message).toContain('ninguno')
    // Avisa, no prohíbe: el host manda.
    expect(r.errors).toEqual([])
  })

  it('un jugador normal nunca dispara el aviso', () => {
    const r = checkAssignment(conUnDemonEnT1(), 'n1', 1, 'ADC')
    expect(r.warnings.map((w) => w.code)).not.toContain('demon_balance')
  })

  it('mover un Demon del equipo lleno al vacío no avisa: arregla el balance', () => {
    const s = conUnDemonEnT1()
    s.teams[0].members.push(miembro('d2', 'Demon Dos', 'TOP'))
    // Con 2-0, llevarse uno al Team 2 deja 1-1.
    const r = checkAssignment(s, 'd2', 2, 'TOP')
    expect(r.warnings.map((w) => w.code)).not.toContain('demon_balance')
  })

  it('demonBalance cuenta lo que hay en cada equipo', () => {
    expect(demonBalance(conDemons())).toEqual({ t1: 0, t2: 0, diff: 0, any: true })
    expect(demonBalance(conUnDemonEnT1())).toEqual({ t1: 1, t2: 0, diff: 1, any: true })
  })

  it('sin ningún Demon, el recuento no se enseña', () => {
    expect(demonBalance(estado()).any).toBe(false)
  })

  it('isDemon solo reconoce el elo exacto', () => {
    expect(isDemon('DEMON')).toBe(true)
    expect(isDemon('CHALLENGER')).toBe(false)
    expect(isDemon(null)).toBe(false)
  })
})
