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
