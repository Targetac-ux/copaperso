/** El roster de un periodo. Sin `period_id`, el que esté activo. */
export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const { period_id: periodId } = getQuery(event) as { period_id?: string }
  return await cargarRoster(event, periodId)
})
