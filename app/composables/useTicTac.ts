/**
 * El tic-tac del cronómetro.
 *
 * El sonido se genera con la Web Audio API en vez de reproducir un archivo: un
 * oscilador de treinta milisegundos con una envolvente rápida suena a clic de
 * reloj y no hay que cargar ningún asset ni esperar a que descargue.
 *
 * Los navegadores no dejan sonar nada hasta que el usuario ha interactuado con
 * la página, así que el AudioContext se crea en el primer intento de sonar
 * —que siempre viene de un clic del host— y no al montar el componente.
 */
/**
 * El host y el espectador guardan su elección por separado: silenciar el panel
 * no debe callar la vista pública abierta en otra pestaña, ni al revés.
 */
export interface OpcionesSonido {
  clave?: string
  estado?: string
}

export function useTicTac(opciones: OpcionesSonido = {}) {
  const CLAVE = opciones.clave ?? 'copaperso:tictac'
  const enabled = useState(opciones.estado ?? 'tictac', () => true)
  let ctx: AudioContext | null = null

  onMounted(() => {
    try {
      const guardado = localStorage.getItem(CLAVE)
      if (guardado !== null) enabled.value = guardado === '1'
    } catch {
      // Navegación privada o cookies bloqueadas: se queda con el valor por defecto.
    }
  })

  function contexto(): AudioContext | null {
    if (ctx) return ctx
    const Clase = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Clase) return null
    ctx = new Clase()
    return ctx
  }

  /**
   * Un clic corto. `alto` lo hace un poco más agudo, para marcar los últimos
   * segundos sin que el host tenga que mirar la pantalla.
   */
  function play(alto = false) {
    if (!enabled.value) return
    const audio = contexto()
    if (!audio) return
    if (audio.state === 'suspended') void audio.resume()

    const osc = audio.createOscillator()
    const vol = audio.createGain()

    osc.type = 'square'
    osc.frequency.value = alto ? 1400 : 900

    // Ataque instantáneo y caída rápida: un golpe seco, no un pitido.
    const ahora = audio.currentTime
    vol.gain.setValueAtTime(0.0001, ahora)
    vol.gain.exponentialRampToValueAtTime(alto ? 0.05 : 0.03, ahora + 0.005)
    vol.gain.exponentialRampToValueAtTime(0.0001, ahora + 0.03)

    osc.connect(vol).connect(audio.destination)
    osc.start(ahora)
    osc.stop(ahora + 0.04)
  }

  /**
   * El aviso de que se acabó el tiempo, para el público.
   *
   * Dos notas cortas que bajan, con onda triangular en vez de cuadrada: se oye
   * por encima del juego sin competir con el streamer. El plan lo pide
   * «sutil», así que va a menos volumen que el tic-tac del host.
   */
  function chime() {
    if (!enabled.value) return
    const audio = contexto()
    if (!audio) return
    if (audio.state === 'suspended') void audio.resume()

    const ahora = audio.currentTime
    for (const [i, hz] of [880, 587].entries()) {
      const osc = audio.createOscillator()
      const vol = audio.createGain()
      const en = ahora + i * 0.16

      osc.type = 'triangle'
      osc.frequency.value = hz

      vol.gain.setValueAtTime(0.0001, en)
      vol.gain.exponentialRampToValueAtTime(0.04, en + 0.02)
      vol.gain.exponentialRampToValueAtTime(0.0001, en + 0.3)

      osc.connect(vol).connect(audio.destination)
      osc.start(en)
      osc.stop(en + 0.32)
    }
  }

  function toggle() {
    enabled.value = !enabled.value
    try {
      localStorage.setItem(CLAVE, enabled.value ? '1' : '0')
    } catch {
      // Sin almacenamiento, la elección dura lo que dure la pestaña.
    }
    if (enabled.value) play()
  }

  return { enabled, play, chime, toggle }
}
