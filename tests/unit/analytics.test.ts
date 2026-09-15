import { describe, it, expect } from 'vitest'
import { seMide } from '../../shared/analytics'

describe('qué se mide', () => {
  it('el sitio público, sí', () => {
    for (const u of ['https://copaperso.gg/', 'https://copaperso.gg/en-vivo', '/tier-ranking', '/reglas']) {
      expect(seMide(u), u).toBe(true)
    }
  })

  it('el panel del host, no', () => {
    for (const u of [
      'https://copaperso.gg/host',
      'https://copaperso.gg/host/roster',
      'https://copaperso.gg/host/login',
      '/host/jugadores?buscar=target',
    ]) {
      expect(seMide(u), u).toBe(false)
    }
  })

  it('una ruta que solo empieza parecido sí se mide', () => {
    // «/hostal» no es el panel.
    expect(seMide('https://copaperso.gg/hostal')).toBe(true)
  })

  it('el panel sigue fuera con parámetros y ancla', () => {
    expect(seMide('https://copaperso.gg/host/roster?periodo=sep#tabla')).toBe(false)
  })

  it('una ruta relativa sin barra también se reconoce', () => {
    // El evento puede traer la url sin origen; «host/roster» es el panel igual.
    expect(seMide('host/roster')).toBe(false)
  })
})
