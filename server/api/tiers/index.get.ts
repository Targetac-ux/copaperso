/** La edición en preparación, o la que se pida por id. */
export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const { id } = getQuery(event) as { id?: string }
  return await cargarTabla(event, id)
})
