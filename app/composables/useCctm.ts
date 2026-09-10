import type { DraftState, BenchPlayer } from '#shared/draft'
import type { PlayerRole } from '#shared/types/models'

export interface SessionInfo {
  id: string
  number: number
  mode: string
  status: 'open' | 'live' | 'closed'
  started_at: string
}

interface Aviso {
  code: string
  message: string
}

/**
 * Estado de la mesa de control.
 *
 * Cada acción devuelve el draft entero recalculado por el servidor y lo
 * reemplaza aquí: durante el stream vale más una pantalla que siempre dice la
 * verdad que una que va rápido pero puede quedar desincronizada.
 */
export function useCctm(sessionId: Ref<string | undefined>) {
  const draft = useState<DraftState | null>(`draft-${sessionId.value}`, () => null)
  const session = useState<SessionInfo | null>(`session-${sessionId.value}`, () => null)
  const busy = ref(false)
  const error = ref('')
  const warnings = ref<Aviso[]>([])
  /** La acción que quedó pendiente de confirmar tras un aviso. */
  const pending = ref<(() => Promise<void>) | null>(null)

  async function load() {
    if (!sessionId.value) return
    const res = await $fetch<{ session: SessionInfo; draft: DraftState }>(
      `/api/sessions/${sessionId.value}`,
    )
    session.value = res.session
    draft.value = res.draft
  }

  async function call<T = unknown>(
    path: string,
    body: Record<string, unknown>,
    reintento?: () => Promise<void>,
  ): Promise<T | null> {
    if (!sessionId.value) return null
    busy.value = true
    error.value = ''

    try {
      const res = (await $fetch<unknown>(`/api/sessions/${sessionId.value}${path}`, {
        method: 'POST' as const,
        body,
      })) as T & { draft?: DraftState }
      if (res.draft) draft.value = res.draft
      warnings.value = []
      pending.value = null
      return res
    } catch (e) {
      const err = e as { statusCode?: number; data?: { warnings?: Aviso[] }; statusMessage?: string }
      // 409 con avisos: no es un fallo, es "¿seguro?".
      if (err.statusCode === 409 && err.data?.warnings?.length) {
        warnings.value = err.data.warnings
        pending.value = reintento ?? null
        return null
      }
      error.value = err.statusMessage ?? 'No se pudo completar la acción.'
      return null
    } finally {
      busy.value = false
    }
  }

  async function assign(spId: string, teamNumber: 1 | 2, role: PlayerRole, force = false) {
    await call(
      '/assign',
      { session_participant_id: spId, team_number: teamNumber, role, force },
      () => assign(spId, teamNumber, role, true),
    )
  }

  async function swap(a: string, b: string, force = false) {
    await call('/swap', { a, b, force }, () => swap(a, b, true))
  }

  const toBench = (spId: string) => call('/bench', { session_participant_id: spId })
  const benchAll = () => call('/bench', {})

  async function setState(spId: string, state: 'bench' | 'jail' | 'graveyard' | 'removed') {
    if (!sessionId.value) return
    busy.value = true
    error.value = ''
    try {
      const res = await $fetch<{ draft: DraftState }>(
        `/api/sessions/${sessionId.value}/participants/${spId}`,
        { method: 'PATCH', body: { state } },
      )
      draft.value = res.draft
    } catch (e) {
      error.value = (e as { statusMessage?: string }).statusMessage ?? 'No se pudo cambiar el estado.'
    } finally {
      busy.value = false
    }
  }

  async function roll(): Promise<BenchPlayer | null> {
    const res = await call<{ player: BenchPlayer }>('/random', {})
    return res?.player ?? null
  }

  function confirmWarnings() {
    const accion = pending.value
    warnings.value = []
    pending.value = null
    return accion?.()
  }

  function dismissWarnings() {
    warnings.value = []
    pending.value = null
  }

  const available = computed(() => draft.value?.bench.filter((b) => b.state === 'bench') ?? [])
  const jailed = computed(() => draft.value?.bench.filter((b) => b.state === 'jail') ?? [])
  const graveyard = computed(() => draft.value?.bench.filter((b) => b.state === 'graveyard') ?? [])

  return {
    draft, session, busy, error, warnings, pending,
    available, jailed, graveyard,
    load, assign, swap, toBench, benchAll, setState, roll,
    confirmWarnings, dismissWarnings,
  }
}
