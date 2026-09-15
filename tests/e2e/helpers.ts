import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

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
 * Escribe una línea de registro y espera a que la app confirme el alta.
 *
 * Tres cosas, y cada una está por un motivo:
 *
 * 1. **Comprueba que la app ha entendido la línea**, no solo que el `<input>`
 *    la tenga. `fill()` escribe el valor y dispara un `input` de golpe; si entre
 *    medias llega un re-render —el que provoca el registro anterior al recargar
 *    la banca—, `v-model` reescribe el campo con lo que tiene Vue y se lleva lo
 *    escrito. Escribiendo a mano no pasa: cada tecla dispara su evento al
 *    instante.
 * 2. **Espera el acuse de la propia app** (`.reg__ok`, el «X registrado»). Es la
 *    única señal fiable de que el alta salió; mirar la banca llega mucho después
 *    y confunde un registro perdido con una recarga lenta.
 * 3. **Reintenta si no llega.** Registrar dos veces a la misma persona es
 *    inofensivo —el servidor devuelve la participación que ya existe en vez de
 *    duplicarla—, así que un reintento no puede ensuciar nada.
 */
export async function registrarLinea(page: Page, linea: string) {
  const campo = page.getByLabel('Registrar participante')
  const nombre = linea.split(' ')[0]!
  const acuse = page.locator('.reg__ok')

  await expect(async () => {
    await campo.fill(linea)
    await expect(page.locator('.reg__leido strong')).toHaveText(nombre, { timeout: 2000 })
    await campo.press('Enter')
    await expect(acuse).toContainText(nombre, { timeout: 8000 })
  }).toPass({ timeout: 40_000 })
}

/**
 * Arrastra un jugador a un hueco y se asegura de que cayó.
 *
 * El arrastre de la banca a los equipos es HTML5 nativo, y `dragTo()` lo imita
 * con eventos de ratón sintéticos. Con la suite entera en marcha, de vez en
 * cuando el soltar no llega a registrarse —el hueco sigue visible y sin nada
 * encima, comprobado con `elementFromPoint`— y el jugador se queda donde
 * estaba. Con ratón de verdad no pasa: hay arranque de arrastre e imagen de
 * acompañamiento, y el navegador no se salta el `drop`.
 *
 * Así que se reintenta. Antes de cada intento mira si el hueco ya lo tiene,
 * para no arrastrar dos veces cuando el primero sí funcionó y solo tardó.
 *
 * **Y antes de cada intento cierra el aviso, si hay uno abierto.** Cuando un
 * arrastre cae en el hueco equivocado —otro rol, otro equipo— el panel saca el
 * «¿Seguro?», que es un diálogo a pantalla completa: a partir de ahí ningún
 * reintento puede funcionar, porque la capa se come el ratón, y el test se
 * quedaba girando hasta agotar el tiempo. Se **cancela** y no se confirma: la
 * asignación que lo levantó no es la que el test quería, así que aplicarla
 * dejaría al jugador en el sitio equivocado.
 */
export async function arrastrarJugador(origen: Locator, destino: Locator, nombre: string) {
  const aviso = origen.page().getByRole('alertdialog')

  for (let intento = 0; intento < 3; intento++) {
    if (await aviso.isVisible().catch(() => false)) {
      await aviso.getByRole('button', { name: 'Cancelar' }).click()
      await expect(aviso).toBeHidden()
    }

    if (((await destino.textContent()) ?? '').includes(nombre)) return

    await origen.dragTo(destino)
    try {
      await expect(destino).toContainText(nombre, { timeout: 4000 })
      return
    } catch {
      // Se vuelve a intentar; si era el último, la aserción de abajo lo cuenta.
    }
  }

  if (await aviso.isVisible().catch(() => false)) {
    await aviso.getByRole('button', { name: 'Cancelar' }).click()
  }
  await expect(destino, `no se pudo arrastrar a ${nombre}`).toContainText(nombre)
}
