import { describe, it, expect } from 'vitest'
import { contarCambios, leerCuerpo, ordenar } from '../../shared/patchnotes'

describe('leer el cuerpo de un parche', () => {
  it('«+ » es algo que entra', () => {
    expect(leerCuerpo('+ El Blue Shell cuesta 500 bits')).toEqual([
      { tipo: 'añade', texto: 'El Blue Shell cuesta 500 bits' },
    ])
  })

  it('«- » es algo que sale', () => {
    expect(leerCuerpo('- Se quita el cambio de rol gratis')).toEqual([
      { tipo: 'quita', texto: 'Se quita el cambio de rol gratis' },
    ])
  })

  it('lo demás es texto normal', () => {
    expect(leerCuerpo('Este mes probamos algo distinto')).toEqual([
      { tipo: 'texto', texto: 'Este mes probamos algo distinto' },
    ])
  })

  /**
   * El detalle que obliga a exigir el espacio: sin él, una línea que empieza
   * con una cifra negativa se pintaría en rojo como si fuera una regla
   * eliminada. Es el error que más se nota y el más fácil de cometer.
   */
  it('un menos pegado a un número es texto, no una regla quitada', () => {
    expect(leerCuerpo('-15 LP por derrota, como siempre')).toEqual([
      { tipo: 'texto', texto: '-15 LP por derrota, como siempre' },
    ])
  })

  it('lo mismo con un más pegado', () => {
    expect(leerCuerpo('+15 LP por victoria')[0]!.tipo).toBe('texto')
  })

  it('las líneas en blanco se van: sirven para respirar al escribir', () => {
    const cuerpo = '+ Uno\n\n\n- Dos\n   \n+ Tres'
    expect(leerCuerpo(cuerpo).map((l) => l.texto)).toEqual(['Uno', 'Dos', 'Tres'])
  })

  it('el signo no se queda en el texto: ya lo dice el color', () => {
    expect(leerCuerpo('+ Uno')[0]!.texto).toBe('Uno')
  })

  it('perdona los espacios de sobra al principio y al final', () => {
    expect(leerCuerpo('  + Uno  ')).toEqual([{ tipo: 'añade', texto: 'Uno' }])
  })

  it('un cuerpo vacío no da ninguna línea', () => {
    expect(leerCuerpo('')).toEqual([])
    expect(leerCuerpo('\n  \n')).toEqual([])
  })

  it('funciona con saltos de línea de Windows', () => {
    expect(leerCuerpo('+ Uno\r\n- Dos').map((l) => l.tipo)).toEqual(['añade', 'quita'])
  })
})

describe('contar los cambios', () => {
  it('separa lo que entra de lo que sale, y no cuenta el texto', () => {
    const cuerpo = '+ Uno\n+ Dos\n- Tres\nUn comentario'
    expect(contarCambios(cuerpo)).toEqual({ añade: 2, quita: 1 })
  })

  it('sin cambios, cero y cero', () => {
    expect(contarCambios('')).toEqual({ añade: 0, quita: 0 })
  })
})

describe('ordenar los parches', () => {
  const n = (id: string, publishedAt: string | null) => ({ id, publishedAt })

  it('el más reciente primero', () => {
    const lista = [n('viejo', '2026-08-01'), n('nuevo', '2026-09-01')]
    expect(ordenar(lista).map((x) => x.id)).toEqual(['nuevo', 'viejo'])
  })

  it('los borradores van arriba del todo: son en lo que estás trabajando', () => {
    const lista = [n('publicado', '2026-09-01'), n('borrador', null)]
    expect(ordenar(lista).map((x) => x.id)).toEqual(['borrador', 'publicado'])
  })

  it('no toca la lista original', () => {
    const lista = [n('a', '2026-08-01'), n('b', '2026-09-01')]
    ordenar(lista)
    expect(lista.map((x) => x.id)).toEqual(['a', 'b'])
  })
})
