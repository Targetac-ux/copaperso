/** La lista de clips para el panel: incluye los ocultos. */
export default defineEventHandler(async (event) => {
  await requireStaff(event)
  return await cargarClips(event)
})
