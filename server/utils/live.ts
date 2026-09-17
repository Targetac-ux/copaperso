import type { H3Event } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { auditarEnVivo, EN_VIVO_VACIO, resumenPublico } from '#shared/live'
import { effectiveCost } from '#shared/economy'
import type {
  CastigoEnVivo,
  CuentaEnVivo,
  EnVivo,
  EquipoEnVivo,
  MiembroEnVivo,
  RecompensaEnVivo,
} from '#shared/live'
import type { Database, PlayerRoleDb } from '#shared/types/database.types'

/** El canal por el que escucha el público. Uno solo: hay una CopaPerso a la vez. */
export const CANAL_EN_VIVO = 'copaperso-en-vivo'

const ORDEN_ROL: Record<PlayerRoleDb, number> = { TOP: 0, JG: 1, MID: 2, ADC: 3, SUP: 4 }

/**
 * Arma lo que ve el público a partir de la sesión abierta.
 *
 * Lee con la llave de servicio y devuelve **solo** los campos de `EnVivo`: el
 * espectador no consulta la base nunca, así que esta función es la única
 * frontera entre lo privado y lo público.
 */
export async function cargarEnVivo(event: H3Event, ultimaAccion?: string | null): Promise<EnVivo> {
  const db = serverSupabaseServiceRole<Database>(event)

  const { data: sesion } = await db
    .from('session')
    .select(
      'id, period_id, number, mode, status, prices_tripled, timer_ends_at, timer_seconds, timer_running, timer_remaining_seconds',
    )
    .neq('status', 'closed')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!sesion) return { ...EN_VIVO_VACIO, at: new Date().toISOString() }

  const [equiposRes, participantesRes, partidasRes, logRes, catalogoRes, bancoRes] =
    await Promise.all([
      db
        .from('team')
        .select('id, team_number, team_member(role, is_off_role, session_participant_id)')
        .eq('session_id', sesion.id)
        .order('team_number'),
      db
        .from('session_participant')
        .select('id, state, participation(id, roles, player(display_name))')
        .eq('session_id', sesion.id)
        .order('joined_at'),
      db.from('match').select('match_number, status, winner_team_id').eq('session_id', sesion.id),
      ultimaAccion === undefined
        ? db
            .from('action_log')
            .select('action_type, summary')
            .eq('session_id', sesion.id)
            .is('undone_at', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),

      // La mesa de negociación del mes. Solo las activas: una recompensa
      // retirada en Ajustes no se puede pedir, y enseñarla sería una trampa.
      db
        .from('action_catalog')
        .select('code, label, cost_bits, sort_order')
        .eq('period_id', sesion.period_id)
        .eq('active', true)
        .order('sort_order'),

      // El banco entero, jugadores y donantes. Es el panel por el que se hizo
      // todo esto: el saldo de cada uno es lo que se mira para negociar.
      db
        .from('ledger_account')
        .select('display_name, balance_bits, balance_subs')
        .order('balance_bits', { ascending: false }),
    ])

  type FilaParticipante = {
    id: string
    state: string
    participation: {
      id: string
      roles: PlayerRoleDb[]
      player: { display_name: string } | null
    } | null
  }

  const participantes = (participantesRes.data ?? []) as unknown as FilaParticipante[]
  const porSp = new Map(participantes.map((p) => [p.id, p]))

  const equipos: EquipoEnVivo[] = [1, 2].map((n) => {
    const fila = (equiposRes.data ?? []).find((t) => t.team_number === n)
    const miembros = (fila?.team_member ?? []) as unknown as {
      role: PlayerRoleDb
      is_off_role: boolean
      session_participant_id: string
    }[]

    const members: MiembroEnVivo[] = miembros
      .map((m) => ({
        displayName:
          porSp.get(m.session_participant_id)?.participation?.player?.display_name ?? '—',
        role: m.role,
        isOffRole: m.is_off_role,
      }))
      .sort((a, b) => ORDEN_ROL[a.role] - ORDEN_ROL[b.role])

    return { teamNumber: n as 1 | 2, members }
  })

  const banca = participantes
    .filter((p) => p.state === 'bench')
    .map((p) => ({
      displayName: p.participation?.player?.display_name ?? '—',
      roles: p.participation?.roles ?? [],
    }))

  // La cárcel sí se enseña; el cementerio no, que nadie lo pidió y es el
  // estado de quien llegó tarde, no un castigo.
  const carcel: CastigoEnVivo[] = participantes
    .filter((p) => p.state === 'jail')
    .map((p) => ({
      displayName: p.participation?.player?.display_name ?? '—',
      texto: 'En la cárcel',
    }))

  // Las restricciones, solo de quien está en esta copa: las de meses viejos no
  // le importan a nadie y serían una lista que no para de crecer.
  const idsParticipacion = participantes
    .map((p) => p.participation?.id)
    .filter((x): x is string => !!x)

  const { data: restriccionesRes } = idsParticipacion.length
    ? await db
        .from('restriction')
        .select('kind, value, note, participation(player(display_name))')
        .in('participation_id', idsParticipacion)
        .eq('active', true)
    : { data: [] }

  type FilaRestriccion = {
    kind: string
    value: string | null
    note: string | null
    participation: { player: { display_name: string } | null } | null
  }

  const restricciones: CastigoEnVivo[] = (
    (restriccionesRes ?? []) as unknown as FilaRestriccion[]
  ).map((r) => ({
    displayName: r.participation?.player?.display_name ?? '—',
    // El texto se arma aquí y no se copia de `note`: la nota la escribe el
    // host para él, y el texto libre del host no sale (ver shared/live.ts).
    texto:
      r.kind === 'no_role'
        ? `No puede ${r.value ?? '—'}`
        : r.value === 'CARCEL'
          ? 'En la cárcel'
          : 'Con restricción',
  }))

  const numeroPorTeamId = new Map(
    (equiposRes.data ?? []).map((t) => [t.id, t.team_number as 1 | 2]),
  )

  const partidas = partidasRes.data ?? []
  const acabadas = partidas.filter((m) => m.status === 'finished')
  const enJuego = partidas.find((m) => m.status === 'live')
  const ultima = [...partidas].sort((a, b) => b.match_number - a.match_number)[0]

  const ultimaEntrada = (logRes as { data: { action_type: string; summary: string } | null }).data

  const payload: EnVivo = {
    hay: true,
    sesion: { number: sesion.number, mode: sesion.mode },
    equipos,
    banca,
    marcador: {
      t1: acabadas.filter((m) => m.winner_team_id && numeroPorTeamId.get(m.winner_team_id) === 1)
        .length,
      t2: acabadas.filter((m) => m.winner_team_id && numeroPorTeamId.get(m.winner_team_id) === 2)
        .length,
    },
    partida: ultima ? { numero: ultima.match_number, enJuego: !!enJuego } : null,
    cronometro: {
      endsAt: sesion.timer_ends_at,
      remaining: sesion.timer_remaining_seconds,
      seconds: sesion.timer_seconds ?? 900,
      running: sesion.timer_running ?? false,
    },
    preciosTriplicados: sesion.prices_tripled ?? false,
    // Ya multiplicados: el espectador tiene que leer lo que va a pagar, no
    // hacer la cuenta. El ×3 se sigue anunciando aparte, que es espectáculo.
    recompensas: (catalogoRes.data ?? []).map((a): RecompensaEnVivo => ({
      codigo: a.code,
      etiqueta: a.label,
      precio: effectiveCost(a.cost_bits, sesion.prices_tripled ?? false),
    })),
    banco: (bancoRes.data ?? []).map((c): CuentaEnVivo => ({
      displayName: c.display_name,
      bits: c.balance_bits,
      subs: c.balance_subs,
    })),
    carcel,
    restricciones,
    ultimaAccion:
      ultimaAccion !== undefined
        ? ultimaAccion
        : ultimaEntrada
          ? resumenPublico(ultimaEntrada.action_type, ultimaEntrada.summary)
          : null,
    at: new Date().toISOString(),
  }

  return sanear(payload)
}

/**
 * La última comprobación antes de que algo salga a la calle.
 *
 * Si el texto de la última acción menciona algo privado, se quita el texto y se
 * publica el resto: el público sigue viendo los equipos moverse. Si el problema
 * está en la forma del objeto —alguien añadió un campo privado— no se publica
 * nada y se grita por consola, porque eso es un error de programación que los
 * tests deberían haber cazado.
 */
function sanear(payload: EnVivo): EnVivo {
  let salida = payload
  if (payload.ultimaAccion) {
    const soloTexto = auditarEnVivo({ ultimaAccion: payload.ultimaAccion })
    if (soloTexto.length) salida = { ...payload, ultimaAccion: null }
  }

  const problemas = auditarEnVivo(salida)
  if (problemas.length) {
    console.error('[en-vivo] payload rechazado:', problemas.join('; '))
    return { ...EN_VIVO_VACIO, at: payload.at }
  }

  return salida
}

/**
 * Publica el estado en el canal del público.
 *
 * Va por *broadcast* y no por cambios de tabla: el espectador escucha un canal
 * con la llave publicable y recibe exactamente este objeto. Nunca consulta las
 * tablas, así que ni un fallo de RLS podría enseñarle lo que no toca.
 *
 * Si falla, no pasa nada: la página se resincroniza sola con `/api/live` al
 * reconectar. Perder un aviso no puede tumbar una acción del host.
 */
export async function publicarEnVivo(event: H3Event, actionType: string, summary: string) {
  try {
    const texto = resumenPublico(actionType, summary)
    const payload = await cargarEnVivo(event, texto)
    const db = serverSupabaseServiceRole<Database>(event)

    // `httpSend` es un POST y ya está. Abrir un websocket por cada acción del
    // host añadiría el saludo de conexión a cada asignación, y cerrar una
    // partida ya es lo bastante apurado.
    const r = await db.channel(CANAL_EN_VIVO).httpSend('estado', payload, { timeout: 4000 })
    if (!r.success) console.error('[en-vivo] el aviso no salió:', r.status, r.error)
  } catch (e) {
    console.error('[en-vivo] no se pudo publicar:', (e as Error).message)
  }
}
