/** Las partidas de la sesión, con la alineación congelada de cada una. */
export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const sessionId = getRouterParam(event, 'id')!
  return await cargarPartidas(event, sessionId)
})
