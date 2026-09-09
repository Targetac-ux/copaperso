import { describe, it, expect } from 'vitest'
import { parsePlayerLine, formatPlayerLine } from '../../shared/parser'

/**
 * El host teclea estas líneas en directo, con el chat gritando y sin tiempo
 * para revisar. El parser tiene que aguantar mayúsculas, acentos, separadores
 * distintos y nicks raros sin equivocarse de nombre.
 */
describe('parsePlayerLine', () => {
  it('la línea canónica del plan', () => {
    expect(parsePlayerLine('Target Mid/Jg Challenger')).toEqual({
      name: 'Target',
      roles: ['MID', 'JG'],
      elo: 'CHALLENGER',
    })
  })

  it('todo en minúsculas y con abreviaturas', () => {
    expect(parsePlayerLine('target mid jg chall')).toEqual({
      name: 'target',
      roles: ['MID', 'JG'],
      elo: 'CHALLENGER',
    })
  })

  it('un solo rol y sin elo', () => {
    expect(parsePlayerLine('Candy ADC')).toEqual({ name: 'Candy', roles: ['ADC'], elo: null })
  })

  it('espacios de más', () => {
    expect(parsePlayerLine('  Zenix   MID    Challenger ')).toEqual({
      name: 'Zenix',
      roles: ['MID'],
      elo: 'CHALLENGER',
    })
  })

  it('acentos en el nombre', () => {
    expect(parsePlayerLine('Ramón Mid')).toEqual({ name: 'Ramón', roles: ['MID'], elo: null })
  })

  it('nick con símbolos y elo abreviado', () => {
    expect(parsePlayerLine('xX_Player_Xx TOP/JG GM')).toEqual({
      name: 'xX_Player_Xx',
      roles: ['TOP', 'JG'],
      elo: 'GRANDMASTER',
    })
  })

  it('nick con emoji', () => {
    expect(parsePlayerLine('Candy♥ ADC Master')).toEqual({
      name: 'Candy♥',
      roles: ['ADC'],
      elo: 'MASTER',
    })
  })

  it('nick con espacios', () => {
    expect(parsePlayerLine('xX Player Xx TOP GM')).toEqual({
      name: 'xX Player Xx',
      roles: ['TOP'],
      elo: 'GRANDMASTER',
    })
  })

  it('separador de comas', () => {
    expect(parsePlayerLine('Kotori SUP, MID Diamante')).toEqual({
      name: 'Kotori',
      roles: ['SUP', 'MID'],
      elo: 'DIAMOND',
    })
  })

  it('solo el nombre', () => {
    expect(parsePlayerLine('Target')).toEqual({ name: 'Target', roles: [], elo: null })
  })

  it('nombre y elo, sin roles', () => {
    expect(parsePlayerLine('Omega Master')).toEqual({ name: 'Omega', roles: [], elo: 'MASTER' })
  })

  it('el elo puede ir antes de los roles', () => {
    expect(parsePlayerLine('Szeta Challenger ADC')).toEqual({
      name: 'Szeta',
      roles: ['ADC'],
      elo: 'CHALLENGER',
    })
  })

  it('un rol que no existe se queda en el nombre, no se descarta', () => {
    expect(parsePlayerLine('Target FOO')).toEqual({ name: 'Target FOO', roles: [], elo: null })
  })

  it('un elo que no existe se queda en el nombre', () => {
    expect(parsePlayerLine('Target MID Radiante')).toEqual({
      name: 'Target MID Radiante',
      roles: [],
      elo: null,
    })
  })

  it('no repite un rol escrito dos veces', () => {
    expect(parsePlayerLine('Rayito TOP/top GM')).toEqual({
      name: 'Rayito',
      roles: ['TOP'],
      elo: 'GRANDMASTER',
    })
  })

  it('un nick que se llama como un rol sigue siendo el nombre', () => {
    expect(parsePlayerLine('Mid MID Oro')).toEqual({ name: 'Mid', roles: ['MID'], elo: 'GOLD' })
    expect(parsePlayerLine('Support SUP')).toEqual({ name: 'Support', roles: ['SUP'], elo: null })
  })

  it('sinónimos en español', () => {
    expect(parsePlayerLine('Aliencero jungla plata')).toEqual({
      name: 'Aliencero',
      roles: ['JG'],
      elo: 'SILVER',
    })
    expect(parsePlayerLine('PlayerZ soporte esmeralda')).toEqual({
      name: 'PlayerZ',
      roles: ['SUP'],
      elo: 'EMERALD',
    })
  })

  it('cadena vacía o basura devuelve null', () => {
    expect(parsePlayerLine('')).toBeNull()
    expect(parsePlayerLine('   ')).toBeNull()
    expect(parsePlayerLine('  /,  ')).toBeNull()
  })

  it('formatPlayerLine deshace el parseo', () => {
    const linea = 'Target MID/JG CHALLENGER'
    expect(formatPlayerLine(parsePlayerLine(linea)!)).toBe(linea)
  })
})
