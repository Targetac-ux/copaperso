import { EN_VIVO_VACIO } from '#shared/live'
import type { EnVivo } from '#shared/live'

/** El mismo nombre que usa el servidor para publicar. */
const CANAL = 'copaperso-en-vivo'

export type EstadoConexion = 'conectando' | 'en-vivo' | 'sin-conexion'

/**
 * Mantiene al día la vista pública.
 *
 * El espectador **no consulta la base**: escucha un canal de broadcast y recibe
 * el objeto que el servidor ha decidido publicar. Eso es lo que hace imposible
 * que un fallo de permisos le enseñe los bits de nadie.
 *
 * Como un broadcast que se pierde no se recupera solo, cada vez que el canal
 * vuelve a conectar se pide el estado completo a `/api/live`. Así una caída de
 * red termina en la pantalla correcta, no en una a medias.
 *
 * **El cliente se importa bajo demanda**, y no con `useSupabaseClient()`, por
 * peso: `@supabase/supabase-js` son 330 kB y el plugin del módulo los mete en
 * el chunk de entrada, o sea en todas las páginas. Aquí solo hace falta el
 * canal de realtime —ni auth, ni consultas, ni almacenamiento— y solo al
 * montar, así que el `import()` lo saca del camino de todo el que no entre a
 * esta página. Es lo mismo que hace `scripts/carga-en-vivo.mjs`.
 */
export function useEnVivo() {
  const estado = ref<EnVivo>({ ...EN_VIVO_VACIO })
  const conexion = ref<EstadoConexion>('conectando')
  /** Sube cada vez que llega algo nuevo: la usa la pantalla para destacar el cambio. */
  const version = ref(0)

  const { data, refresh } = useFetch<EnVivo>('/api/live', {
    default: () => ({ ...EN_VIVO_VACIO }),
  })

  watch(
    data,
    (v) => {
      if (v) aplicar(v)
    },
    { immediate: true },
  )

  function aplicar(v: EnVivo) {
    // Un broadcast atrasado no puede pisar algo más nuevo: llegan por caminos
    // distintos (canal y fetch) y el orden no está garantizado.
    if (estado.value.at && v.at && v.at < estado.value.at) return
    estado.value = v
    version.value++
  }

  onMounted(async () => {
    const { url, key } = useRuntimeConfig().public.supabase as { url: string; key: string }
    const { createClient } = await import('@supabase/supabase-js')

    // Sin sesión: el espectador no tiene cuenta y esto solo escucha un canal.
    // Persistirla llenaría su almacenamiento con un token que nadie usa.
    const supabase = createClient(url, key, { auth: { persistSession: false } })
    const canal = supabase.channel(CANAL)

    canal
      .on('broadcast', { event: 'estado' }, ({ payload }) => {
        aplicar(payload as EnVivo)
      })
      .subscribe((s) => {
        if (s === 'SUBSCRIBED') {
          conexion.value = 'en-vivo'
          // Al (re)conectar, ponerse al día de lo que se haya perdido.
          void refresh()
        } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
          conexion.value = 'sin-conexion'
        }
      })

    onBeforeUnmount(() => {
      void supabase.removeChannel(canal)
    })
  })

  return { estado, conexion, version, refrescar: refresh }
}
