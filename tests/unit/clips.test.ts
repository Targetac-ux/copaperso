import { describe, it, expect } from 'vitest'
import {
  MAX_EN_HOME,
  cambios,
  dominioPadre,
  esSlug,
  mover,
  slugDeUrl,
  urlDeClip,
  urlDeIncrustado,
} from '../../shared/clips'

const SLUG = 'AwkwardHelpfulKuduDoritosChip'

describe('leer el enlace que pega el host', () => {
  it('acepta el enlace corto de clips.twitch.tv', () => {
    expect(slugDeUrl(`https://clips.twitch.tv/${SLUG}`)).toBe(SLUG)
  })

  it('acepta el enlace largo del canal', () => {
    expect(slugDeUrl(`https://www.twitch.tv/targetac/clip/${SLUG}`)).toBe(SLUG)
  })

  it('acepta el del móvil', () => {
    expect(slugDeUrl(`https://m.twitch.tv/targetac/clip/${SLUG}`)).toBe(SLUG)
  })

  it('no se atraganta con los parámetros que Twitch añade al compartir', () => {
    expect(slugDeUrl(`https://www.twitch.tv/targetac/clip/${SLUG}?filter=clips&range=7d&sort=time`)).toBe(SLUG)
  })

  it('acepta un enlace de incrustar ya montado', () => {
    expect(slugDeUrl(`https://clips.twitch.tv/embed?clip=${SLUG}&parent=copaperso.app`)).toBe(SLUG)
  })

  it('acepta el slug suelto, que es lo que queda si copian solo el final', () => {
    expect(slugDeUrl(SLUG)).toBe(SLUG)
  })

  it('perdona los espacios de copiar y pegar', () => {
    expect(slugDeUrl(`  https://clips.twitch.tv/${SLUG}  `)).toBe(SLUG)
  })

  it('funciona sin el https delante', () => {
    expect(slugDeUrl(`clips.twitch.tv/${SLUG}`)).toBe(SLUG)
  })

  it('los slugs modernos llevan un sufijo con guión', () => {
    expect(slugDeUrl('https://clips.twitch.tv/SmoothTenderKappaPride-aB3_x9')).toBe(
      'SmoothTenderKappaPride-aB3_x9',
    )
  })

  // Lo importante: que el host vea un aviso, y no un rectángulo negro en la
  // portada, cuando pega cualquier otra cosa.
  it.each([
    ['un vídeo de YouTube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
    ['un vod, que no es un clip', 'https://www.twitch.tv/videos/123456789'],
    ['el canal a secas', 'https://www.twitch.tv/targetac'],
    ['otro dominio que imita a Twitch', 'https://clips.twitch.tv.malo.example/abcdefg'],
    ['vacío', '   '],
    ['un slug con caracteres raros', 'clip con espacios'],
    ['un clip sin slug', 'https://www.twitch.tv/targetac/clip/'],
  ])('rechaza %s', (_caso, entrada) => {
    expect(slugDeUrl(entrada)).toBeNull()
  })

  it('un slug demasiado corto no cuela', () => {
    expect(esSlug('ab')).toBe(false)
  })
})

describe('el dominio que exige Twitch', () => {
  it('quita el puerto, que Twitch no admite', () => {
    expect(dominioPadre('localhost:3000')).toBe('localhost')
  })

  it('localhost vale, que es donde se desarrolla', () => {
    expect(dominioPadre('localhost')).toBe('localhost')
  })

  it('acepta el subdominio irrepetible de cada despliegue de Vercel', () => {
    expect(dominioPadre('copaperso-git-main-targetac.vercel.app')).toBe(
      'copaperso-git-main-targetac.vercel.app',
    )
  })

  it('normaliza mayúsculas', () => {
    expect(dominioPadre('CopaPerso.App')).toBe('copaperso.app')
  })

  it.each(['', '   ', 'no válido', 'sin-punto'])('rechaza «%s»', (mal) => {
    expect(dominioPadre(mal)).toBeNull()
  })
})

describe('la URL del iframe', () => {
  it('lleva el clip, el dominio y el autoplay apagado', () => {
    const url = new URL(urlDeIncrustado(SLUG, 'copaperso.app')!)
    expect(url.origin + url.pathname).toBe('https://clips.twitch.tv/embed')
    expect(url.searchParams.get('clip')).toBe(SLUG)
    expect(url.searchParams.get('parent')).toBe('copaperso.app')
    expect(url.searchParams.get('autoplay')).toBe('false')
  })

  it('el autoplay se puede pedir, para la previsualización', () => {
    const url = new URL(urlDeIncrustado(SLUG, 'copaperso.app', { autoplay: true })!)
    expect(url.searchParams.get('autoplay')).toBe('true')
  })

  it('sin dominio válido no hay iframe que montar', () => {
    expect(urlDeIncrustado(SLUG, '')).toBeNull()
  })

  it('un slug inventado tampoco monta nada', () => {
    expect(urlDeIncrustado('no vale', 'copaperso.app')).toBeNull()
  })

  it('el enlace de respaldo apunta al clip en Twitch', () => {
    expect(urlDeClip(SLUG)).toBe(`https://clips.twitch.tv/${SLUG}`)
  })
})

describe('ordenar los clips', () => {
  const lista = () => [
    { id: 'a', sortOrder: 0 },
    { id: 'b', sortOrder: 1 },
    { id: 'c', sortOrder: 2 },
  ]

  it('subir intercambia con el de arriba', () => {
    expect(mover(lista(), 'c', -1).map((c) => c.id)).toEqual(['a', 'c', 'b'])
  })

  it('bajar intercambia con el de abajo', () => {
    expect(mover(lista(), 'a', 1).map((c) => c.id)).toEqual(['b', 'a', 'c'])
  })

  it('renumera sin huecos', () => {
    expect(mover(lista(), 'a', 1).map((c) => c.sortOrder)).toEqual([0, 1, 2])
  })

  it('en los extremos no pasa nada', () => {
    const antes = lista()
    expect(mover(antes, 'a', -1)).toBe(antes)
    expect(mover(antes, 'c', 1)).toBe(antes)
  })

  it('un id que no existe no cambia nada', () => {
    const antes = lista()
    expect(mover(antes, 'fantasma', 1)).toBe(antes)
  })

  it('no toca la lista original', () => {
    const antes = lista()
    mover(antes, 'a', 1)
    expect(antes.map((c) => c.id)).toEqual(['a', 'b', 'c'])
  })

  it('guarda solo las filas que cambiaron', () => {
    const antes = lista()
    const despues = mover(antes, 'a', 1)
    expect(cambios(antes, despues).map((c) => c.id).sort()).toEqual(['a', 'b'])
  })

  it('sin movimiento, nada que guardar', () => {
    const antes = lista()
    expect(cambios(antes, antes)).toEqual([])
  })
})

describe('el tope de la Home', () => {
  it('es un número pequeño: cada clip carga un reproductor entero', () => {
    expect(MAX_EN_HOME).toBeLessThanOrEqual(6)
  })
})
