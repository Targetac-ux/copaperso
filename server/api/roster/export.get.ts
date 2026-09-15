import { ordenar, rosterACsv } from '#shared/roster'

/**
 * El mismo roster, en CSV.
 *
 * Sale del mismo cargador y de las mismas funciones que la tabla: si el CSV
 * dijera otro winrate que la pantalla, el host no sabría a cuál creerle.
 */
export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const { period_id: periodId } = getQuery(event) as { period_id?: string }
  const { period, filas } = await cargarRoster(event, periodId)

  const nombre = `copaperso-roster-${period.name.toLowerCase()}.csv`
  setHeader(event, 'content-type', 'text/csv; charset=utf-8')
  setHeader(event, 'content-disposition', `attachment; filename="${nombre}"`)

  return rosterACsv(ordenar(filas, 'lp'))
})
