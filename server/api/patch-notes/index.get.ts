/** La lista para el panel: incluye los borradores. */
export default defineEventHandler(async (event) => {
  await requireStaff(event)
  return await cargarParches(event)
})
