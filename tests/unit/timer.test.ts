import { describe, it, expect } from 'vitest'
import {
  remainingSeconds, formatSeconds, hasExpired, clampSeconds, parseDuration, DEFAULT_SECONDS,
} from '../../shared/timer'

const enFuturo = (segundos: number) => new Date(Date.now() + segundos * 1000).toISOString()

describe('cronómetro', () => {
  it('arranca en 15 minutos', () => {
    expect(DEFAULT_SECONDS).toBe(900)
    expect(formatSeconds(DEFAULT_SECONDS)).toBe('15:00')
  })

  it('cuenta lo que falta', () => {
    const t = { endsAt: enFuturo(90), seconds: 900, running: true }
    expect(remainingSeconds(t)).toBeGreaterThan(88)
    expect(remainingSeconds(t)).toBeLessThanOrEqual(90)
  })

  it('parado enseña su duración, no una cuenta atrás', () => {
    expect(remainingSeconds({ endsAt: null, seconds: 600, running: false })).toBe(600)
  })

  it('nunca baja de cero', () => {
    const t = { endsAt: new Date(Date.now() - 60_000).toISOString(), seconds: 900, running: true }
    expect(remainingSeconds(t)).toBe(0)
  })

  it('formatea minutos y horas', () => {
    expect(formatSeconds(0)).toBe('00:00')
    expect(formatSeconds(59)).toBe('00:59')
    expect(formatSeconds(600)).toBe('10:00')
    expect(formatSeconds(3723)).toBe('1:02:03')
  })

  it('solo expira si estaba corriendo', () => {
    const vencido = new Date(Date.now() - 1000).toISOString()
    expect(hasExpired({ endsAt: vencido, seconds: 900, running: true })).toBe(true)
    // Un cronómetro pausado no dispara el aviso aunque su hora haya pasado.
    expect(hasExpired({ endsAt: vencido, seconds: 900, running: false })).toBe(false)
    expect(hasExpired({ endsAt: null, seconds: 900, running: true })).toBe(false)
  })

  it('todavía corriendo no ha expirado', () => {
    expect(hasExpired({ endsAt: enFuturo(30), seconds: 900, running: true })).toBe(false)
  })

  it('acota duraciones absurdas', () => {
    expect(clampSeconds(5)).toBe(30)
    expect(clampSeconds(99999)).toBe(7200)
    expect(clampSeconds(900)).toBe(900)
    expect(clampSeconds(Number.NaN)).toBe(DEFAULT_SECONDS)
  })

  it('entiende lo que teclea el host', () => {
    expect(parseDuration('15')).toBe(900)
    expect(parseDuration('10 min')).toBe(600)
    expect(parseDuration('5m')).toBe(300)
    expect(parseDuration('12:30')).toBe(750)
    expect(parseDuration('90s')).toBe(90)
    expect(parseDuration('  20  ')).toBe(1200)
  })

  it('devuelve null con lo que no entiende', () => {
    expect(parseDuration('')).toBeNull()
    expect(parseDuration('un rato')).toBeNull()
    expect(parseDuration('abc')).toBeNull()
  })
})
