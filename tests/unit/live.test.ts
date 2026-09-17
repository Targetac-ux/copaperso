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
    recompensas: [{ codigo: 'BLUE_SHELL', etiqueta: 'Blue Shell', precio: 1497 }],
    banco: [{ displayName: 'Carnitas', bits: 6200, subs: 0 }],
    carcel: [{ displayName: 'Deadly', texto: 'En la cárcel' }],
    restricciones: [{ displayName: 'Emiz', texto: 'No puede MID,SUP' }],
    ultimaAccion: 'Target → Team 1 / MID',
    at: '2026-09-14T19:00:00.000Z',
  }
}

/**
 * La auditoría es una **lista blanca de la forma**, no una de palabras.
 *
 * Cambió el 17 de septiembre de 2026, cuando el host pidió que los saldos, los
 * precios y los castigos se vieran: prohibir la palabra «bits» pasó a ser justo
 * lo contrario de lo que se quería. Lo que protege ahora es que el campo esté
 * declarado en `FORMA_PUBLICA`, se llame como se llame.
 */
describe('la vista en vivo solo publica la forma declarada', () => {
  it('el payload correcto pasa la auditoría', () => {
    expect(auditarEnVivo(bueno())).toEqual([])
  })

  it('el payload vacío también', () => {
    expect(auditarEnVivo(EN_VIVO_VACIO)).toEqual([])
  })

  // Esta es la prueba de cierre: falla si alguien añade un campo sin pasar por
  // `FORMA_PUBLICA`, que es donde se decide qué es público.
  const filtraciones: [string, Record<string, unknown>][] = [
    ['préstamos', { prestamos: [{ persona: 'Emiz', adeudo: 880 }] }],
    ['notas del host', { notas: ['no puede jugar ADC'] }],
    ['canjeos', { canjeos: 2 }],
    ['el cementerio', { cementerio: ['Target'] }],
    ['correos', { email: 'host@copaperso.gg' }],
    ['identificadores internos', { participationId: 'uuid' }],
    ['cualquier campo inventado', { loQueSea: 1 }],
  ]

  for (const [que, extra] of filtraciones) {
    it(`no deja salir ${que}`, () => {
      expect(auditarEnVivo({ ...bueno(), ...extra })).not.toEqual([])
    })
  }

  it('caza un campo de más escondido en lo hondo, y dice dónde', () => {
    const p = bueno()
    const conFuga = {
      ...p,
      equipos: [
        { ...p.equipos[0]!, members: [{ ...p.equipos[0]!.members[0]!, adeudo: 999 }] },
        p.equipos[1]!,
      ],
    }
    const problemas = auditarEnVivo(conFuga)
    expect(problemas).toHaveLength(1)
    expect(problemas[0]).toContain('equipos[0].members[0]')
    expect(problemas[0]).toContain('adeudo')
  })

  it('un saldo de más en una cuenta tampoco pasa', () => {
    const p = bueno()
    const conFuga = { ...p, banco: [{ ...p.banco[0]!, prestamo: 400 }] }
    expect(auditarEnVivo(conFuga)).not.toEqual([])
  })

  // Un valor es el nombre de una persona: quien se llame «Nota» no puede
  // tumbar la vista de todos.
  it('no se asusta con un jugador que se llame como un campo privado', () => {
    const p = bueno()
    p.banca = [{ displayName: 'Bitscoin', roles: ['MID'] }]
    p.equipos[0]!.members[0]!.displayName = 'Nota'
    p.banco = [{ displayName: 'Prestamo', bits: 10, subs: 0 }]
    expect(auditarEnVivo(p)).toEqual([])
  })

  it('el texto de la última acción sí se mira por dentro', () => {
    const p = bueno()
    p.ultimaAccion = 'Préstamo a Emiz: adeudo 880'
    expect(auditarEnVivo(p)).not.toEqual([])
  })

  // Lo que el host pidió ver. Si alguien lo quita de la forma, esto avisa.
  it('los saldos, los precios y los castigos sí salen', () => {
    const p = bueno()
    expect(auditarEnVivo(p)).toEqual([])
    expect(p.banco[0]!.bits).toBe(6200)
    expect(p.recompensas[0]!.precio).toBe(1497)
    expect(p.carcel).toHaveLength(1)
    expect(p.restricciones).toHaveLength(1)
  })
})

describe('qué acciones ve el público', () => {
  it('las del draft y las partidas, sí', () => {
    for (const a of ['draft.assign', 'draft.swap', 'match.start', 'match.finish']) {
      expect(esAccionPublica(a), a).toBe(true)
    }
  })

  // Si el banco se ve, lo que lo mueve tiene que avisar: un saldo congelado en
  // pantalla es peor que no enseñarlo.
  it('y las que mueven el banco, el catálogo o los castigos, también', () => {
    for (const a of [
      'ledger.entry',
      'ledger.open',
      'reward.claim',
      'restriction.create',
      'restriction.lift',
      'catalog.add',
      'catalog.update',
    ]) {
      expect(esAccionPublica(a), a).toBe(true)
    }
  })

  it('los préstamos y las notas del host siguen sin salir', () => {
    for (const a of ['loan.create', 'note.create', 'extra.create', 'player.update']) {
      expect(esAccionPublica(a), a).toBe(false)
    }
  })

  it('una acción privada no tiene resumen público', () => {
    expect(resumenPublico('loan.create', 'Préstamo a Emiz: 400 bits')).toBeNull()
  })

  /**
   * El resumen de estas lo escribe el host —el motivo de un movimiento, la
   * nota de una restricción— así que avisan con texto fijo. La cifra no se
   * pierde: está en el panel, que se acaba de refrescar.
   */
  it('las que llevan texto del host avisan sin repetirlo', () => {
    expect(resumenPublico('ledger.entry', 'Target: +500 bits · me cae bien')).toBe(
      'Movimiento en el banco',
    )
    expect(resumenPublico('restriction.create', 'Restricción: no puede MID')).toBe(
      'Nueva restricción',
    )
    expect(resumenPublico('undo', 'Deshecho: Préstamo a Emiz')).toBe('Se deshizo la última acción')
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
      'ledger.entry': 'Target: +500 bits · propina',
      'ledger.open': 'Cuenta abierta: Target (0 bits)',
      'reward.claim': 'Blue Shell reclamada · 1497 bits (×3)',
      'restriction.create': 'Restricción: no puede MID',
      'restriction.lift': 'Restricción levantada',
      'catalog.add': 'Nueva recompensa: «OTP Open» por 500 bits',
      'catalog.update': 'Blue Shell: 500 → 499 bits',
      undo: 'Deshecho: lo que sea',
    }

    for (const tipo of ACCIONES_PUBLICAS) {
      const texto = resumenPublico(tipo, reales[tipo] ?? '')
      expect(texto, `falta el resumen real de ${tipo}`).not.toBeNull()
      expect(auditarEnVivo({ ultimaAccion: texto }), `${tipo}: "${texto}"`).toEqual([])
    }
  })
})
