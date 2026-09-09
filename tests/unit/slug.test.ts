import { describe, it, expect } from 'vitest'
import { slugify } from '../../server/utils/slug'

/**
 * El slug es lo que impide que "Target", "Taget" y "TARGET" acaben siendo tres
 * perfiles distintos (§4). Si esto se rompe, el roster se llena de duplicados.
 */
describe('slugify', () => {
  it('ignora mayúsculas y espacios', () => {
    expect(slugify('Target')).toBe('target')
    expect(slugify('TARGET')).toBe('target')
    expect(slugify('  target  ')).toBe('target')
  })

  it('ignora acentos y eñes', () => {
    expect(slugify('Ramón')).toBe('ramon')
    expect(slugify('Peña')).toBe('pena')
  })

  it('ignora símbolos y adornos del nick', () => {
    expect(slugify('xX_Player_Xx')).toBe('xxplayerxx')
    expect(slugify('Candy♥')).toBe('candy')
    expect(slugify('Zen1x')).toBe('zen1x')
  })

  it('distingue de verdad los nombres parecidos', () => {
    // Estos SÍ son personas distintas: el slug no debe unirlos.
    expect(slugify('Taget')).not.toBe(slugify('Target'))
    expect(slugify('Targte')).not.toBe(slugify('Target'))
  })

  it('devuelve cadena vacía si el nombre no tiene letras ni números', () => {
    expect(slugify('***')).toBe('')
    expect(slugify('')).toBe('')
  })
})
