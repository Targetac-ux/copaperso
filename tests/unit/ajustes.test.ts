import { describe, it, expect } from 'vitest'
import {
  CLAVES,
  REDES,
  REDES_SOCIALES,
  enlaceDe,
  esRedConocida,
  leerSegundos,
  normalizarUrl,
} from '../../shared/ajustes'
import { DEFAULT_SECONDS, MAX_SECONDS, MIN_SECONDS } from '../../shared/timer'
import type { EnlaceDeSitio } from '../../shared/ajustes'

describe('las redes', () => {
  it('Twitch y PayPal son las principales: tienen su propio sitio en la página', () => {
    expect(REDES.filter((r) => r.principal).map((r) => r.red)).toEqual(['twitch', 'paypal'])
  })

  it('las demás son la fila de iconos', () => {
    expect(REDES_SOCIALES.map((r) => r.red)).toEqual([
      'instagram',
      'x',
      'tiktok',
      'youtube',
      'discord',
    ])
  })

  it('reconoce lo que viene de fuera', () => {
    expect(esRedConocida('instagram')).toBe(true)
    expect(esRedConocida('myspace')).toBe(false)
    expect(esRedConocida(null)).toBe(false)
  })
})

describe('normalizar la URL que pega el host', () => {
  it('acepta la URL entera', () => {
    expect(normalizarUrl('https://www.twitch.tv/madhusito')).toBe('https://www.twitch.tv/madhusito')
  })

  it('le pone https si no lo trae', () => {
    expect(normalizarUrl('instagram.com/copaperso')).toBe('https://instagram.com/copaperso')
  })

  it('acepta http, que sigue siendo un enlace', () => {
    expect(normalizarUrl('http://ejemplo.com/algo')).toBe('http://ejemplo.com/algo')
  })

  it('un usuario suelto se pega a la base de su red', () => {
    expect(normalizarUrl('@copaperso', 'instagram')).toBe('https://instagram.com/copaperso')
    expect(normalizarUrl('@copaperso', 'tiktok')).toBe('https://tiktok.com/@copaperso')
    expect(normalizarUrl('@copaperso', 'youtube')).toBe('https://youtube.com/@copaperso')
  })

  it('un usuario suelto sin saber de qué red es no vale', () => {
    expect(normalizarUrl('@copaperso')).toBeNull()
  })

  it('perdona los espacios de copiar y pegar', () => {
    expect(normalizarUrl('  https://x.com/copaperso  ')).toBe('https://x.com/copaperso')
  })

  /**
   * La prueba que justifica que esta función exista.
   *
   * Esta es la única puerta por la que entra una URL a la página pública, y lo
   * que salga de aquí acaba en el `href` de un enlace que pulsa cualquiera. Un
   * `javascript:` ahí no es una errata: es ejecución de código en el navegador
   * de quien visita la web.
   */
  it.each([
    ['javascript', 'javascript:alert(1)'],
    ['javascript con mayúsculas', 'JavaScript:alert(1)'],
    ['data', 'data:text/html,<script>alert(1)</script>'],
    ['vbscript', 'vbscript:msgbox(1)'],
    ['file', 'file:///etc/passwd'],
  ])('rechaza un esquema %s', (_caso, malo) => {
    expect(normalizarUrl(malo)).toBeNull()
  })

  it.each([
    ['vacío', '   '],
    ['un anfitrión sin punto', 'hola'],
    ['solo el esquema', 'https://'],
  ])('rechaza %s', (_caso, malo) => {
    expect(normalizarUrl(malo)).toBeNull()
  })
})

describe('la duración guardada del cronómetro', () => {
  it('sin ajuste, la de siempre', () => {
    expect(leerSegundos(null)).toBe(DEFAULT_SECONDS)
    expect(leerSegundos(undefined)).toBe(DEFAULT_SECONDS)
    expect(leerSegundos('  ')).toBe(DEFAULT_SECONDS)
  })

  it('lee un número', () => {
    expect(leerSegundos('600')).toBe(600)
  })

  it('lo que no es un número tampoco rompe nada', () => {
    expect(leerSegundos('quince minutos')).toBe(DEFAULT_SECONDS)
  })

  // Los límites son los mismos que valida la mesa: no se repiten aquí.
  it('acota por debajo y por arriba con las reglas del cronómetro', () => {
    expect(leerSegundos('1')).toBe(MIN_SECONDS)
    expect(leerSegundos('999999')).toBe(MAX_SECONDS)
  })

  it('la clave está en un sitio, no escrita a mano', () => {
    expect(CLAVES.CRONOMETRO).toBe('timer_seconds')
  })
})

describe('el enlace de una red', () => {
  const enlaces: EnlaceDeSitio[] = [
    { network: 'twitch', url: 'https://www.twitch.tv/madhusito', sortOrder: 0, visible: true },
  ]

  it('devuelve el guardado', () => {
    expect(enlaceDe(enlaces, 'twitch')).toBe('https://www.twitch.tv/madhusito')
  })

  it('sin guardar, cae al respaldo: la Home no se queda con un botón muerto', () => {
    expect(enlaceDe(enlaces, 'paypal', 'https://paypal.me/Targetac')).toBe(
      'https://paypal.me/Targetac',
    )
  })

  it('sin guardar y sin respaldo, no hay enlace y no se pinta nada', () => {
    expect(enlaceDe(enlaces, 'instagram')).toBeNull()
  })
})
