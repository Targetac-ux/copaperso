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
const CLAVE = 'copaperso:tictac'

export function useTicTac() {
  const enabled = useState('tictac', () => true)
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

  function toggle() {
    enabled.value = !enabled.value
    try {
      localStorage.setItem(CLAVE, enabled.value ? '1' : '0')
    } catch {
      // Sin almacenamiento, la elección dura lo que dure la pestaña.
    }
    if (enabled.value) play()
  }

  return { enabled, play, toggle }
}
