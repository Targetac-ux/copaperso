/** Los ajustes del panel: enlaces y cronómetro. */
export default defineEventHandler(async (event) => {
  await requireStaff(event)
  return await cargarAjustes(event)
})
