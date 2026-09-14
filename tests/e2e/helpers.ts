import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * Navega y espera a que la app esté hidratada.
 *
 * Sin esta espera, Playwright puede pulsar un botón renderizado por el
 * servidor pero todavía sin manejador de Vue: el clic no hace nada y el test
 * falla aunque la aplicación funcione.
 */
export async function gotoHydrated(page: Page, path: string) {
  await page.goto(path)
  await page.waitForSelector('html[data-hydrated]', { timeout: 15_000 })
}

/**
 * Lo que tarda un registro en aparecer.
 *
 * Registrar a alguien son varias escrituras contra un Supabase remoto y, con la
 * suite entera en marcha, pasa de los cinco segundos que Playwright espera por
 * omisión. Las aserciones de «aparece en la lista» son de corrección, no de
 * velocidad: de la velocidad se ocupa `cctm-velocidad.spec.ts`, que sí mide y
 * falla si el draft de diez se va de tiempo.
 */
export const ESPERA_REGISTRO = { timeout: 15_000 }

/**
 * Escribe una línea de registro y la envía.
 *
 * Comprueba que la app ha **entendido** la línea antes de pulsar Enter, no solo
 * que el `<input>` la tenga: son cosas distintas y esa diferencia era el fallo
 * intermitente que aparecía en media suite.
 *
 * `fill()` escribe el valor y dispara un `input` de golpe. Si entre medias
 * llega un re-render —el que provoca el registro anterior al recargar la
 * banca—, la directiva `v-model` reescribe el `value` del input con lo que
 * tiene Vue (vacío) y se lleva por delante lo recién escrito. El Enter salía
 * entonces con el campo vacío, no se registraba a nadie, y el fallo aparecía
 * mucho después, en la aserción de que el jugador está en la banca.
 *
 * Escribiendo a mano no pasa: cada tecla dispara su `input` al instante, así
 * que Vue nunca va por detrás. Es un efecto de escribir la línea entera de una
 * vez, y por eso se arregla aquí y no en el componente.
 */
export async function registrarLinea(page: Page, linea: string) {
  const campo = page.getByLabel('Registrar participante')
  const nombre = linea.split(' ')[0]!

  await expect(async () => {
    await campo.fill(linea)
    // `reg__leido` es lo que la app dice haber entendido: si ahí está el
    // nombre, la línea llegó al estado de Vue y no solo al DOM.
    await expect(page.locator('.reg__leido strong')).toHaveText(nombre, { timeout: 1500 })
  }).toPass({ timeout: 20_000 })

  await campo.press('Enter')
}
