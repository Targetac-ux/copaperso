import { CANAL_TWITCH, PAYPAL } from '#shared/enlaces'
import { REDES_SOCIALES, enlaceDe } from '#shared/ajustes'
import type { EnlaceDeSitio, Red } from '#shared/ajustes'

/**
 * Los enlaces del sitio, una sola vez por visita.
 *
 * **Con `useFetch` y una clave fija, no con `$fetch`.** La petición se hace en
 * el servidor, el resultado viaja dentro del HTML y el navegador no la repite:
 * con `$fetch` en el `setup` se pedía dos veces —una por lado— y si las dos
 * respuestas no coincidían, la hidratación se quejaba. Es el mismo tropiezo que
 * hubo en la vista en vivo de la Fase 4B.
 *
 * **Twitch y PayPal caen a la constante si no hay nada guardado.** Son los dos
 * que tienen su propio botón, y un botón que no lleva a ningún sitio es peor
 * que uno desactualizado. Las demás redes, sin enlace, no se pintan.
 *
 * Si la petición falla —la tabla todavía no existe, la base no responde— se
 * sigue con la lista vacía: que la Home no cargue por esto sería mucho peor.
 */
export function useEnlaces() {
  const { data } = useFetch<EnlaceDeSitio[]>('/api/public/links', {
    key: 'enlaces-sitio',
    default: () => [],
    // Un fallo aquí no puede tumbar la página.
    onResponseError: () => {},
  })

  const de = (red: Red, respaldo?: string) => enlaceDe(data.value ?? [], red, respaldo)

  return {
    enlaces: data,
    de,
    twitch: computed(() => de('twitch', CANAL_TWITCH)!),
    paypal: computed(() => de('paypal', PAYPAL)!),
    /** Solo las que tienen enlace: el resto no se pinta. */
    sociales: computed(() =>
      REDES_SOCIALES.map((r) => ({ ...r, url: de(r.red) })).filter(
        (r): r is typeof r & { url: string } => !!r.url,
      ),
    ),
  }
}
