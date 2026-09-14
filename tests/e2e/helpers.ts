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
 * Comprueba que el campo se quedó con lo que se escribió **antes** de pulsar
 * Enter. Con la suite entera en marcha se vio alguna vez un `fill()` que no
 * llegaba a aplicarse: el Enter salía con el campo vacío, no se registraba a
 * nadie y el fallo aparecía mucho después, en la aserción de que el jugador
 * está en la banca. Verificar aquí lo convierte en una espera, no en un fallo.
 */
export async function registrarLinea(page: Page, linea: string) {
  const campo = page.getByLabel('Registrar participante')
  await campo.fill(linea)
  await expect(campo).toHaveValue(linea)
  await campo.press('Enter')
}
