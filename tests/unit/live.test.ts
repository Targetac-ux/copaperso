import { describe, it, expect } from 'vitest'
import {
  ACCIONES_PUBLICAS,
  EN_VIVO_VACIO,
  auditarEnVivo,
  esAccionPublica,
  resumenPublico,
} from '../../shared/live'
import type { EnVivo } from '../../shared/live'

/** Un payload correcto, para partir de algo que sí debe pasar. */
function bueno(): EnVivo {
  return {
    hay: true,
    sesion: { number: 3, mode: 'perso' },
    equipos: [
      {
        teamNumber: 1,
        members: [
          { displayName: 'Target', role: 'MID', isOffRole: false },
          { displayName: 'Madhu', role: 'JG', isOffRole: true },
        ],
      },
      { teamNumber: 2, members: [] },
    ],
    banca: [{ displayName: 'Zenix', roles: ['TOP', 'SUP'] }],
    marcador: { t1: 2, t2: 1 },
    partida: { numero: 4, enJuego: true },
    cronometro: { endsAt: null, remaining: 120, seconds: 900, running: false },
    preciosTriplicados: true,
    ultimaAccion: 'Target → Team 1 / MID',
    at: '2026-09-14T19:00:00.000Z',
  }
}

describe('el payload en vivo no lleva nada privado', () => {
  it('el payload correcto pasa la auditoría', () => {
    expect(auditarEnVivo(bueno())).toEqual([])
  })

  it('el payload vacío también', () => {
    expect(auditarEnVivo(EN_VIVO_VACIO)).toEqual([])
  })

  // Esto es la prueba 1 de cierre: falla si alguien añade un campo privado.
  const filtraciones: [string, Record<string, unknown>][] = [
    ['bits', { balance_bits: 400 }],
    ['saldos', { saldo: 120 }],
    ['préstamos', { loan: { principal_bits: 400 } }],
    ['cárcel', { jail: true }],
    ['cementerio', { graveyard: ['Target'] }],
    ['restricciones', { restrictions: [] }],
    ['notas', { notes: ['no puede jugar ADC'] }],
    ['canjeos', { claims: 2 }],
    ['correos', { email: 'host@copaperso.gg' }],
    ['identificadores internos', { participation_id: 'uuid' }],
  ]

  for (const [que, extra] of filtraciones) {
    it(`cazaría ${que} en la raíz`, () => {
      expect(auditarEnVivo({ ...bueno(), ...extra })).not.toEqual([])
    })
  }

  it('caza un campo privado escondido en lo hondo', () => {
    const p = bueno()
    const conFuga = {
      ...p,
      equipos: [
        {
          ...p.equipos[0]!,
          members: [{ ...p.equipos[0]!.members[0]!, balance_bits: 999 }],
        },
        p.equipos[1]!,
      ],
    }
    const problemas = auditarEnVivo(conFuga)
    // «balance_bits» rompe dos reglas a la vez; lo que importa es que se señale
    // el sitio exacto, para no tener que buscarlo a mano en un objeto anidado.
    expect(problemas.length).toBeGreaterThan(0)
    expect(problemas.every((p) => p.includes('balance_bits'))).toBe(true)
    expect(problemas[0]).toContain('equipos[0].members[0]')
  })

  it('no se asusta con un jugador que se llame como un campo privado', () => {
    const p = bueno()
    p.banca = [{ displayName: 'Bitscoin', roles: ['MID'] }]
    p.equipos[0]!.members[0]!.displayName = 'Nota'
    expect(auditarEnVivo(p)).toEqual([])
  })

  it('sí mira dentro del texto de la última acción', () => {
    const p = bueno()
    p.ultimaAccion = 'Cambio de Team reclamada · 150 bits'
    expect(auditarEnVivo(p)).not.toEqual([])
  })
})

describe('qué acciones ve el público', () => {
  it('las del draft y las partidas, sí', () => {
    for (const a of ['draft.assign', 'draft.swap', 'match.start', 'match.finish']) {
      expect(esAccionPublica(a), a).toBe(true)
    }
  })

  it('las del dinero y los castigos, no', () => {
    for (const a of [
      'reward.claim',
      'ledger.entry',
      'loan.create',
      'note.create',
      'restriction.create',
      'session.jail',
      'session.graveyard',
    ]) {
      expect(esAccionPublica(a), a).toBe(false)
    }
  })

  it('una acción privada no tiene resumen público', () => {
    expect(resumenPublico('reward.claim', 'Cambio de Team reclamada · 150 bits')).toBeNull()
  })

  it('deshacer avisa, pero sin repetir el texto de lo deshecho', () => {
    const texto = resumenPublico('undo', 'Deshecho: Movimiento en el banco: −200 bits')
    expect(texto).toBe('Se deshizo la última acción')
    expect(texto).not.toContain('bits')
  })

  it('ningún resumen de acción pública menciona algo privado', () => {
    // Los resúmenes reales de cada endpoint de la lista blanca.
    const reales: Record<string, string> = {
      'session.create': 'Sesión #3 abierta',
      'session.join': 'Target entra a la banca',
      'participation.create': 'Target entra al periodo con 100 LP',
      'draft.assign': 'Target → Team 1 / MID (off-role)',
      'draft.move': 'Target → Team 2 / JG',
      'draft.bench': 'Target vuelve a la banca',
      'draft.bench_all': 'Los dos equipos vuelven a la banca (10 jugadores)',
      'draft.swap': 'Target → Team 2 / MID',
      'match.start': 'Empieza la partida 2 (5v5)',
      'match.finish': 'Partida 2: gana el Team 1, MVP Target',
      'timer.start': 'Cronómetro en marcha (15 min)',
      'timer.pause': 'Cronómetro en marcha (15 min)',
      'timer.reset': 'Cronómetro reiniciado a 15 min',
      'prices.triple': 'Precios triplicados: empieza el tiempo extra',
      'prices.restore': 'Precios de vuelta a la normalidad',
      'blue_shell.save': 'Blue Shell a Target: Doble derrota',
      undo: 'Deshecho: lo que sea',
    }

    for (const tipo of ACCIONES_PUBLICAS) {
      const texto = resumenPublico(tipo, reales[tipo] ?? '')
      expect(texto, `falta el resumen real de ${tipo}`).not.toBeNull()
      expect(auditarEnVivo({ ultimaAccion: texto }), `${tipo}: "${texto}"`).toEqual([])
    }
  })
})
