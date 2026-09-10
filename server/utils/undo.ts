import type { H3Event } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database, PlayerRoleDb } from '#shared/types/database.types'

/**
 * Deshacer (§21).
 *
 * Cada mutación deja en el historial un `inverse_payload`: la receta para
 * volver atrás. Aquí se ejecuta esa receta.
 *
 * Dos principios:
 *
 * 1. **Tolerante.** El host puede deshacer una acción antigua con otras diez
 *    encima. Si lo que había que revertir ya no existe —el jugador salió de la
 *    sesión, la cuenta se borró— no se rompe: se da por deshecho y punto.
 *    Reventar a mitad del stream sería peor que no hacer nada.
 *
 * 2. **Una sola vez.** La entrada se marca como deshecha antes de ejecutar
 *    nada, así que pulsar dos veces no aplica el efecto dos veces.
 */

type Payload = Record<string, unknown>

const str = (p: Payload, k: string) => (typeof p[k] === 'string' ? (p[k] as string) : null)
const num = (p: Payload, k: string) => (typeof p[k] === 'number' ? (p[k] as number) : 0)

export async function runUndo(event: H3Event, payload: Payload, sessionId: string | null) {
  const db = serverSupabaseServiceRole<Database>(event)
  const op = str(payload, 'op')

  if (!op) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Esta acción no guardó cómo deshacerse.',
    })
  }

  switch (op) {
    // ---------------------------------------------------------- draft ----
    case 'assign': {
      const spId = str(payload, 'session_participant_id')
      const team = num(payload, 'team_number') as 1 | 2
      const role = str(payload, 'role') as PlayerRoleDb | null
      if (!spId || !role || !sessionId) return

      const ids = await teamIds(event, sessionId)
      await db.from('team_member').delete().eq('session_participant_id', spId)
      await db.from('team_member').insert({
        team_id: ids[team],
        session_participant_id: spId,
        role,
      })
      await db.from('session_participant').update({ state: 'team' }).eq('id', spId)
      return
    }

    case 'bench': {
      const spId = str(payload, 'session_participant_id')
      if (!spId) return
      await db.from('team_member').delete().eq('session_participant_id', spId)
      await db.from('session_participant').update({ state: 'bench' }).eq('id', spId)
      return
    }

    case 'state': {
      const spId = str(payload, 'session_participant_id')
      const state = str(payload, 'state')
      if (!spId || !state) return
      await db
        .from('session_participant')
        .update({ state: state as 'bench' | 'team' | 'jail' | 'graveyard' | 'removed' })
        .eq('id', spId)
      return
    }

    case 'remove': {
      const spId = str(payload, 'session_participant_id')
      if (!spId) return
      await db.from('team_member').delete().eq('session_participant_id', spId)
      await db.from('session_participant').delete().eq('id', spId)
      return
    }

    case 'restore_teams': {
      if (!sessionId) return
      const miembros = Array.isArray(payload.members) ? (payload.members as Payload[]) : []
      const ids = await teamIds(event, sessionId)
      for (const m of miembros) {
        const spId = str(m, 'session_participant_id')
        const role = str(m, 'role') as PlayerRoleDb | null
        const team = num(m, 'team_number') as 1 | 2
        if (!spId || !role) continue
        await db.from('team_member').delete().eq('session_participant_id', spId)
        await db
          .from('team_member')
          .insert({ team_id: ids[team], session_participant_id: spId, role })
        await db.from('session_participant').update({ state: 'team' }).eq('id', spId)
      }
      return
    }

    // -------------------------------------------------------- economía ----
    case 'triple': {
      if (!sessionId) return
      const tripled = payload.prices_tripled === true
      await db
        .from('session')
        .update({ prices_tripled: tripled, tripled_at: tripled ? new Date().toISOString() : null })
        .eq('id', sessionId)
      return
    }

    case 'delete_claim': {
      const id = str(payload, 'claim_id')
      if (id) await db.from('reward_claim').delete().eq('id', id)
      return
    }

    case 'ledger_entry': {
      // El movimiento compensatorio: se anota, no se borra el original.
      const accountId = str(payload, 'account_id')
      if (!accountId) return
      const { data: cuenta } = await db
        .from('ledger_account')
        .select('balance_bits, balance_subs')
        .eq('id', accountId)
        .maybeSingle()
      if (!cuenta) return

      const bits = num(payload, 'delta_bits')
      const subs = num(payload, 'delta_subs')
      await db.from('ledger_entry').insert({
        account_id: accountId,
        delta_bits: bits,
        delta_subs: subs,
        reason: 'Corrección: movimiento deshecho',
        session_id: sessionId,
      })
      await db
        .from('ledger_account')
        .update({
          balance_bits: cuenta.balance_bits + bits,
          balance_subs: cuenta.balance_subs + subs,
        })
        .eq('id', accountId)
      return
    }

    case 'delete_account': {
      const id = str(payload, 'account_id')
      if (!id) return
      await db.from('ledger_entry').delete().eq('account_id', id)
      await db.from('ledger_account').delete().eq('id', id)
      return
    }

    case 'catalog_cost': {
      const id = str(payload, 'id')
      if (!id) return
      await db
        .from('action_catalog')
        .update({ cost_bits: num(payload, 'cost_bits'), label: str(payload, 'label') ?? undefined })
        .eq('id', id)
      return
    }

    case 'delete_loan': {
      const id = str(payload, 'loan_id')
      if (id) await db.from('loan').delete().eq('id', id)
      return
    }

    case 'loan_status': {
      const id = str(payload, 'loan_id')
      const status = str(payload, 'status')
      if (!id || !status) return
      await db
        .from('loan')
        .update({
          status: status as 'open' | 'settled' | 'forgiven',
          settled_at: status === 'open' ? null : undefined,
          settled_amount: status === 'open' ? null : undefined,
        })
        .eq('id', id)
      return
    }

    // ------------------------------------------------ notas y jugadores ----
    case 'delete_note': {
      const id = str(payload, 'note_id')
      if (id) await db.from('note').delete().eq('id', id)
      return
    }

    case 'delete_extra': {
      const id = str(payload, 'extra_id')
      if (id) await db.from('extra').delete().eq('id', id)
      return
    }

    case 'delete_restriction': {
      const id = str(payload, 'restriction_id')
      if (id) await db.from('restriction').delete().eq('id', id)
      return
    }

    case 'restore_restriction': {
      const id = str(payload, 'restriction_id')
      if (id) await db.from('restriction').update({ active: true }).eq('id', id)
      return
    }

    case 'delete_participation': {
      const id = str(payload, 'participation_id')
      if (!id) return
      const { data: sps } = await db
        .from('session_participant')
        .select('id')
        .eq('participation_id', id)
      for (const sp of sps ?? []) {
        await db.from('team_member').delete().eq('session_participant_id', sp.id)
      }
      await db.from('session_participant').delete().eq('participation_id', id)
      await db.from('participation').delete().eq('id', id)
      return
    }

    case 'restore_participation': {
      const playerId = str(payload, 'player_id')
      const periodId = str(payload, 'period_id')
      if (!playerId || !periodId) return
      const roles = Array.isArray(payload.roles) ? (payload.roles as PlayerRoleDb[]) : []
      await db.from('participation').insert({
        player_id: playerId,
        period_id: periodId,
        roles,
        elo: (str(payload, 'elo') as never) ?? null,
      })
      return
    }

    case 'player_update': {
      const id = str(payload, 'player_id')
      if (!id) return
      await db
        .from('player')
        .update({
          display_name: str(payload, 'display_name') ?? undefined,
          twitch_handle: str(payload, 'twitch_handle'),
        })
        .eq('id', id)
      return
    }

    case 'player_photo': {
      const id = str(payload, 'player_id')
      if (!id) return
      await db.from('player').update({ photo_url: str(payload, 'photo_url') }).eq('id', id)
      return
    }

    case 'delete_player': {
      const id = str(payload, 'player_id')
      if (!id) return
      const { data: parts } = await db.from('participation').select('id').eq('player_id', id)
      // Si ya llegó a jugar, el perfil se queda: borrarlo se llevaría su histórico.
      if (parts?.length) return
      await db.from('player').delete().eq('id', id)
      return
    }

    default:
      throw createError({
        statusCode: 422,
        statusMessage: `No sé deshacer una acción de tipo "${op}".`,
      })
  }
}
