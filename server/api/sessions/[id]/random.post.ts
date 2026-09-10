import { pickRandomFromBench } from '#shared/draft'

/**
 * El botón 🎲 ALEATORIO (§9).
 *
 * Solo sortea: no asigna. Quien salga se le enseña al host, que decide rol y
 * equipo. Quien está en la cárcel, el cementerio o ya en un equipo no entra en
 * el sorteo.
 */
export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const sessionId = getRouterParam(event, 'id')!

  const state = await loadDraftState(event, sessionId)
  const elegido = pickRandomFromBench(state.bench)

  if (!elegido) {
    throw createError({
      statusCode: 409,
      statusMessage: 'No queda nadie disponible en la banca para sortear.',
    })
  }

  const disponibles = state.bench.filter((b) => b.state === 'bench').length
  return { player: elegido, remaining: disponibles }
})
