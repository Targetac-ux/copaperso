import { describe, it, expect } from 'vitest'
import {
  idDeYoutube,
  incrustadoDeYoutube,
  miniaturaDeYoutube,
  urlDeYoutube,
} from '../../shared/patchnotes'

const ID = 'dQw4w9WgXcQ'

describe('leer el enlace de YouTube que pega el host', () => {
  it.each([
    ['el enlace normal', `https://www.youtube.com/watch?v=${ID}`],
    ['el corto', `https://youtu.be/${ID}`],
    ['el del móvil', `https://m.youtube.com/watch?v=${ID}`],
    ['uno de incrustar', `https://www.youtube.com/embed/${ID}`],
    ['un short', `https://www.youtube.com/shorts/${ID}`],
    ['un directo', `https://www.youtube.com/live/${ID}`],
    ['sin el https delante', `youtube.com/watch?v=${ID}`],
    ['el id suelto', ID],
  ])('acepta %s', (_caso, entrada) => {
    expect(idDeYoutube(entrada)).toBe(ID)
  })

  it('no se atraganta con los parámetros que YouTube añade al compartir', () => {
    expect(idDeYoutube(`https://youtu.be/${ID}?t=42&si=abcdef`)).toBe(ID)
    expect(idDeYoutube(`https://www.youtube.com/watch?v=${ID}&list=PL123&index=2`)).toBe(ID)
  })

  it('perdona los espacios de copiar y pegar', () => {
    expect(idDeYoutube(`  https://youtu.be/${ID}  `)).toBe(ID)
  })

  // Lo importante: que el host vea un aviso, y no un recuadro negro en la web.
  it.each([
    ['un clip de Twitch', 'https://clips.twitch.tv/AlgoAlgoAlgo'],
    ['el canal, que no es un vídeo', 'https://www.youtube.com/@copaperso'],
    ['un dominio que imita a YouTube', 'https://youtube.com.malo.example/watch?v=dQw4w9WgXcQ'],
    ['un id demasiado corto', 'https://youtu.be/abc'],
    ['un id demasiado largo', 'https://youtu.be/dQw4w9WgXcQextra'],
    ['vacío', '   '],
    ['un id con caracteres raros', 'https://www.youtube.com/watch?v=no vale aqui'],
  ])('rechaza %s', (_caso, entrada) => {
    expect(idDeYoutube(entrada)).toBeNull()
  })
})

describe('lo que se construye con el id', () => {
  it('la miniatura usa hqdefault, que existe siempre', () => {
    // maxresdefault solo está si el vídeo se subió en alta: cuando falta
    // devuelve un 404 y se vería como una imagen rota.
    expect(miniaturaDeYoutube(ID)).toBe(`https://i.ytimg.com/vi/${ID}/hqdefault.jpg`)
  })

  it('el reproductor va por nocookie y sin vídeos relacionados', () => {
    const url = new URL(incrustadoDeYoutube(ID))
    expect(url.hostname).toBe('www.youtube-nocookie.com')
    expect(url.pathname).toBe(`/embed/${ID}`)
    expect(url.searchParams.get('rel')).toBe('0')
    expect(url.searchParams.get('autoplay')).toBeNull()
  })

  it('el autoplay se pide aparte: nada arranca solo al abrir la página', () => {
    expect(new URL(incrustadoDeYoutube(ID, true)).searchParams.get('autoplay')).toBe('1')
  })

  it('el enlace de respaldo apunta al vídeo en YouTube', () => {
    expect(urlDeYoutube(ID)).toBe(`https://www.youtube.com/watch?v=${ID}`)
  })
})
