/**
 * Mete en la base el histórico de los dos Excel.
 *
 *   node scripts/importar-historico.mjs             enseña qué escribiría, sin tocar nada
 *   node scripts/importar-historico.mjs --hazlo     lo escribe
 *   node scripts/importar-historico.mjs --comprobar lo relee y lo cuadra contra el JSON
 *
 * Lee de `scripts/historico/`, que sale de `node scripts/leer-excel.mjs`. No
 * abre ningún `.xlsm`: lo que se escribe es exactamente lo que está en el JSON
 * del repo, y eso se puede revisar en un diff antes de lanzarlo.
 *
 * Por defecto trabaja sobre el `.env`, que es el de desarrollo. Para la base de
 * producción hay que pedirlo a mano, igual que en `limpiar-datos.mjs`:
 *
 *   node scripts/importar-historico.mjs --env=.env.produccion --hazlo
 *
 * **Se puede volver a lanzar.** Todo va por las claves naturales —`player.slug`,
 * `period.name`, `participation(player_id, period_id)`, `action_catalog(period,
 * code)`— y los apuntes que no tienen clave (banco, préstamos, restricciones)
 * se buscan antes de insertarlos. Correr el alias de alguien y repetir no
 * duplica nada.
 *
 * **Lo que NO trae, y no por olvido:**
 *
 *   · Roles y elo. No están en ninguna hoja del CCPR Roster; las ocho celdas de
 *     elo del CCTM son texto libre («MASTER+», «PEAK CHALL») que el enum
 *     `elo_tier` no admite.
 *   · Partidas. El Excel guardaba totales del mes, no partidas, y ni siquiera
 *     cuadran entre sí para poder inventarlas. Van a las columnas
 *     `historic_*` de `participation` (ver la migración 20260916000001).
 *   · ENE-2026 no tiene columna LP: sus 45 participaciones se quedan a 100.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { slugificar } from './leer-excel.mjs'

const archivoEnv = process.argv.find((a) => a.startsWith('--env='))?.slice(6) ?? '.env'
const hazlo = process.argv.includes('--hazlo')
const soloComprobar = process.argv.includes('--comprobar')

/**
 * En qué mes se ponen la cárcel y las restricciones del CCTM.
 *
 * No es un detalle: los castigos son **estado de ahora**, no historia. Cuelgan
 * de una `participation`, o sea de un mes concreto, y ninguno de los seis
 * castigados jugó en SEP-2026 —el último mes del Excel—, así que por defecto
 * no hay dónde ponerlos y el importador lo dice en vez de tragárselo.
 *
 * Cuando exista el mes que se va a jugar:
 *
 *   node scripts/importar-historico.mjs --castigos-en=OCT-2026 --hazlo
 *
 * y ahí sí **se registra** al castigado si no estaba: entrar al mes es lo que
 * el host iba a hacer igualmente, y sin participación no hay castigo posible.
 * Lo que no se hace nunca es meter a nadie en un mes ya cerrado para poder
 * colgarle una restricción: eso le inventaría un roster que no tuvo.
 */
const castigosEn = process.argv.find((a) => a.startsWith('--castigos-en='))?.slice(14) ?? null

function cargarEnv() {
  if (archivoEnv === '.env' && process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY) {
    return process.env
  }
  const file = readFileSync(new URL(`../${archivoEnv}`, import.meta.url), 'utf8')
  return Object.fromEntries(
    file
      .split('\n')
      .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
      .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
  )
}

const env = cargarEnv()
if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
  console.error(`A \`${archivoEnv}\` le falta SUPABASE_URL o SUPABASE_SECRET_KEY.`)
  process.exit(1)
}
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
})

/**
 * ¿Está aplicada la migración 20260916000001?
 *
 * Se comprueba **antes de escribir nada**. Sin las columnas `historic_*` el
 * import revienta en la primera participación, y para entonces ya ha creado
 * ocho periodos y doscientos y pico jugadores: una base a medio escribir, que
 * es mucho peor que no haber empezado. Con dos bases que se parecen por
 * dentro, aplicar la migración en una y lanzar el import contra la otra es un
 * despiste de diez segundos.
 */
async function migracionAplicada() {
  const { error } = await db.from('participation').select('historic_wins, imported_from').limit(1)
  return !error
}

const leer = (f) => JSON.parse(readFileSync(new URL(`./historico/${f}`, import.meta.url), 'utf8'))
const roster = leer('roster.json')
const cctm = leer('cctm.json')
const aliasBruto = leer('alias.json')

/**
 * Lo que el host decidió sobre los nicks repetidos.
 *
 *   fusiones  `{"koann": "koan"}` — el slug que sobra apunta al bueno.
 *   nombres   `{"koan": "Koan"}`  — con qué nombre se queda la persona.
 *
 * Los nombres van aparte porque no se deducen de la fusión: el importador, por
 * su cuenta, se queda con la grafía del mes más reciente, y eso deja
 * «Koanyushi» donde el host dijo «Koan». Cuando él ha escrito un nombre, manda
 * el suyo.
 */
const ALIAS = aliasBruto.fusiones ?? {}
const NOMBRES_ELEGIDOS = aliasBruto.nombres ?? {}

/** El slug que manda para alguien, después de aplicar lo que decidió el host. */
const canonico = (slug) => ALIAS[slug] ?? slug

const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']

/** "SEP-2026" → { starts_at: "2026-09-01", ends_at: "2026-09-30" }. */
function fechasDe(nombre) {
  const [mes, anio] = nombre.split('-')
  const i = MESES.indexOf(mes)
  if (i < 0) throw new Error(`No sé qué mes es "${nombre}".`)
  const dd = (d) => String(d).padStart(2, '0')
  return {
    starts_at: `${anio}-${dd(i + 1)}-01`,
    ends_at: `${anio}-${dd(i + 1)}-${dd(new Date(Number(anio), i + 1, 0).getDate())}`,
  }
}

const err = (e, donde) => {
  if (e) { console.error(`\n  ✗ ${donde}: ${e.message}`); process.exit(1) }
}

// ------------------------------------------------------------ el reparto ----

/**
 * Cómo se llama cada persona, cuando el Excel la escribió de varias maneras.
 *
 * Sin nada dicho, manda **la grafía más reciente del roster**: es la última vez
 * que el host tecleó ese nick, y el roster lleva las mayúsculas puestas donde
 * van. Los nombres del CCTM van todos en mayúscula —«GODESU», «CARNITAS»— y
 * solo se usan cuando esa persona no aparece en ningún mes.
 *
 * Pero cuando se funden varios nicks esa regla falla: la grafía más reciente de
 * un grupo puede ser justo la que el host no quería. Por eso `alias.json` puede
 * fijar el nombre, y lo que diga ahí gana a todo.
 */
function nombresCanonicos() {
  const delRoster = new Map()
  const delCctm = new Map()
  for (const mes of roster.meses) {
    for (const j of mes.jugadores) delRoster.set(canonico(j.slug), j.nombre)
  }
  for (const lista of [cctm.banco, cctm.prestamos, cctm.carcel, cctm.restricciones]) {
    for (const x of lista) {
      const s = canonico(x.slug)
      if (!delRoster.has(s) && !delCctm.has(s)) delCctm.set(s, x.nombre)
    }
  }
  // Y por encima de todo, el nombre que escribió el host en `alias.json`.
  return new Map([...delCctm, ...delRoster, ...Object.entries(NOMBRES_ELEGIDOS)])
}

const NOMBRES = nombresCanonicos()

/**
 * La clave con la que agrupo aquí no es la que usa la base.
 *
 * `player.slug` lo genera Postgres desde `display_name`, así que el slug real
 * de alguien sale de **su nombre**, no de la clave con la que yo lo he ido
 * juntando. Mientras las dos coincidían no se notaba; en cuanto el host eligió
 * «Kennedy revelations» para el grupo `kennedy`, la base lo guardó como
 * `kennedyrevelations` y todas las búsquedas de ese jugador devolvían nada.
 *
 * Esta función es el único puente entre las dos, y todo lo que busque a un
 * jugador pasa por aquí.
 */
const slugEnLaBase = (canon) => slugificar(NOMBRES.get(canon) ?? canon)

// Dos grupos distintos que acabaran con el mismo nombre chocarían contra
// `player_slug_key` y se fundirían sin que nadie lo hubiera pedido. Mejor
// plantarse antes de escribir que descubrirlo con el histórico ya mezclado.
{
  const porSlug = new Map()
  for (const canon of NOMBRES.keys()) {
    const s = slugEnLaBase(canon)
    if (porSlug.has(s)) {
      console.error(
        `Dos personas distintas acabarían siendo la misma en la base:\n` +
          `  «${NOMBRES.get(porSlug.get(s))}» (${porSlug.get(s)}) y «${NOMBRES.get(canon)}» (${canon})\n` +
          `  comparten el slug «${s}». Dales nombres distintos en alias.json.`,
      )
      process.exit(1)
    }
    porSlug.set(s, canon)
  }
}

/**
 * Lo que se va a escribir de cada mes.
 *
 * Se toma **lo que muestra la hoja**: las columnas VICTORIAS y DERROTAS, y el
 * LP tal cual, sin recalcularlo. En diez jugadores esas dos cosas no cuadran
 * entre sí —las columnas «+1 / −1 VICTORIA» mueven el récord pero no el LP—,
 * y reproducir la incoherencia es más honesto que elegir cuál de las dos
 * cifras del host era la buena.
 *
 * Si el host funde dos nicks en `alias.json` y ambos estaban en el mismo mes,
 * las filas **se suman**: son la misma persona jugando, y una sola
 * participación puede haber por mes.
 */
function participacionesDe(mes) {
  const por = new Map()
  for (const j of mes.jugadores) {
    const slug = canonico(j.slug)
    const a = por.get(slug) ?? {
      slug, filas: [], wins: 0, losses: 0, mvps: 0, aces: 0, offRoles: 0, tieneLp: false, deltaLp: 0,
    }
    a.filas.push(j.fila)
    a.wins += j.victorias ?? 0
    a.losses += j.derrotas ?? 0
    a.mvps += j.mvp ?? 0
    a.aces += j.ace ?? 0
    a.offRoles += j.offRol ?? 0
    // Al fundir dos filas se suman los LP **por encima de los 100 de salida**:
    // sumar los LP a pelo le regalaría cien puntos por cada nick extra.
    if (j.lp !== null) { a.tieneLp = true; a.deltaLp += j.lp - 100 }
    por.set(slug, a)
  }
  return [...por.values()].map((a) => ({ ...a, lp: a.tieneLp ? 100 + a.deltaLp : null }))
}

// ----------------------------------------------------------- la escritura ----

async function importar() {
  const marca = (p) => `CCPR Roster · ${p}`

  // --- 1. Periodos. El último queda abierto para que al abrir el mes siguiente
  //        `POST /api/periods` herede de él el catálogo ya corregido.
  const nombresPeriodo = roster.meses.map((m) => m.periodo)
  const ultimo = nombresPeriodo[nombresPeriodo.length - 1]

  const idPeriodo = new Map()
  const periodosAdoptados = []
  for (const nombre of nombresPeriodo) {
    const { data: ya } = await db.from('period').select('id').eq('name', nombre).maybeSingle()
    if (ya) {
      periodosAdoptados.push(nombre)
      idPeriodo.set(nombre, ya.id)
      const { error } = await db
        .from('period')
        .update({ ...fechasDe(nombre), status: nombre === ultimo ? 'active' : 'closed' })
        .eq('id', ya.id)
      err(error, `periodo ${nombre}`)
    } else {
      const { data, error } = await db
        .from('period')
        .insert({ name: nombre, ...fechasDe(nombre), status: nombre === ultimo ? 'active' : 'closed' })
        .select('id')
        .single()
      err(error, `periodo ${nombre}`)
      idPeriodo.set(nombre, data.id)
    }
  }
  console.log(`  ✓ ${nombresPeriodo.length} periodos (${ultimo} queda abierto)`)
  if (periodosAdoptados.length) {
    console.log(`     · ya existían y se han reutilizado: ${periodosAdoptados.join(', ')}`)
  }

  // Cualquier otro mes que estuviera abierto se cierra: solo hay uno a la vez.
  await db.from('period').update({ status: 'closed' }).eq('status', 'active').neq('name', ultimo)

  // --- 2. Jugadores. El slug lo genera la base, así que insertar "Beamer boy"
  //        y "Beamerboy" choca contra `player_slug_key`: se lee antes.
  const { data: yaHay } = await db.from('player').select('id, slug')
  const idJugador = new Map((yaHay ?? []).map((p) => [p.slug, p.id]))

  /**
   * Los perfiles que ya estaban y el import adopta.
   *
   * Reutilizar un perfil por slug es lo correcto —es la misma persona— pero
   * hay que **decirlo**. En staging había un jugador de pruebas llamado
   * «deadly», y el import lo adoptó como si fuera el Deadly del Excel y le
   * colgó su cárcel: nadie se enteró hasta mirar la tabla a mano. Una base que
   * no está en blanco puede tener cualquier cosa, y el host tiene que poder
   * reconocer de un vistazo lo que no creó este import.
   */
  const adoptados = [...NOMBRES]
    .filter(([canon]) => idJugador.has(slugEnLaBase(canon)))
    .map(([canon]) => NOMBRES.get(canon))

  const nuevos = [...NOMBRES].filter(([canon]) => !idJugador.has(slugEnLaBase(canon)))
  for (let i = 0; i < nuevos.length; i += 200) {
    const lote = nuevos.slice(i, i + 200).map(([, display_name]) => ({ display_name }))
    const { data, error } = await db.from('player').insert(lote).select('id, slug')
    err(error, 'jugadores')
    for (const p of data) idJugador.set(p.slug, p.id)
  }
  console.log(`  ✓ ${nuevos.length} jugadores nuevos`)
  // En una repetición esto son *todos*: los creó la pasada anterior, y es
  // justo lo que hace que el import se pueda relanzar. Solo merece mirarse
  // cuando son unos pocos sobre una base que debería estar en blanco, que es
  // el caso en el que uno de ellos puede ser una cuenta de pruebas quedándose
  // con el historial de alguien real. El aviso que de verdad importa es el del
  // cuadre: participaciones que no vienen del Excel.
  if (adoptados.length) {
    const muestra = adoptados.slice(0, 12).join(', ')
    console.log(
      `     · ${adoptados.length} perfiles ya existían y se reutilizan` +
        (adoptados.length > 12 ? ` (${muestra}…)` : `: ${muestra}`),
    )
  }

  // --- 3. Participaciones y su LP.
  let nParticipaciones = 0
  let nEventos = 0
  for (const mes of roster.meses) {
    const periodId = idPeriodo.get(mes.periodo)
    const cuentas = participacionesDe(mes)
    const filas = cuentas.map((a) => ({
      player_id: idJugador.get(slugEnLaBase(a.slug)),
      period_id: periodId,
      initial_lp: 100,
      current_lp: a.lp ?? 100,
      historic_wins: a.wins,
      historic_losses: a.losses,
      historic_mvps: a.mvps,
      historic_aces: a.aces,
      historic_off_roles: a.offRoles,
      imported_from: marca(mes.periodo),
    }))

    const perdidos = cuentas.filter((a) => !idJugador.get(slugEnLaBase(a.slug)))
    if (perdidos.length) {
      console.error(
        `\n  ✗ ${mes.periodo}: no encuentro el perfil de ` +
          perdidos.map((a) => `${a.slug} → «${NOMBRES.get(a.slug)}»`).join(', '),
      )
      process.exit(1)
    }

    const { data, error } = await db
      .from('participation')
      .upsert(filas, { onConflict: 'player_id,period_id' })
      .select('id, player_id')
    err(error, `participaciones de ${mes.periodo}`)
    nParticipaciones += data.length

    const idPorJugador = new Map(data.map((p) => [p.player_id, p.id]))

    /**
     * El LP, como un `MANUAL` y no como un número suelto.
     *
     * `current_lp` es una caché que `recalcular_lp()` reconstruye desde
     * `lp_event` (A3): escribir solo el número dejaría un valor que la primera
     * llamada a esa función —cerrar una partida, deshacer algo— borraría sin
     * avisar. Con el evento puesto, recalcular devuelve exactamente el número
     * del Excel.
     */
    const ids = filas.map((f) => idPorJugador.get(f.player_id))
    await db
      .from('lp_event')
      .delete()
      .in('participation_id', ids)
      .eq('type', 'MANUAL')
      .like('note', 'Importado del CCPR Roster%')

    const eventos = cuentas
      .filter((a) => a.lp !== null && a.lp !== 100)
      .map((a) => ({
        participation_id: idPorJugador.get(idJugador.get(slugEnLaBase(a.slug))),
        type: 'MANUAL',
        delta: a.lp - 100,
        note: `Importado del CCPR Roster · ${mes.periodo}`,
      }))
    if (eventos.length) {
      const { error: e } = await db.from('lp_event').insert(eventos)
      err(e, `LP de ${mes.periodo}`)
      nEventos += eventos.length
    }
  }
  console.log(`  ✓ ${nParticipaciones} participaciones · ${nEventos} apuntes de LP`)

  // --- 4. El catálogo del mes abierto, con los precios que usa hoy el host.
  //
  // Primero se siembra. Los periodos se insertan aquí a pelo y no por
  // `POST /api/periods`, así que nadie ha llamado a `seed_action_catalog`: sin
  // esto el catálogo saldría con las seis líneas del Excel y **sin** «sacar a
  // alguien de la banca», que el Excel ya no nombra pero tampoco consta que el
  // host haya retirado. Sembrar primero la deja puesta y apagable de un clic.
  // El RPC es `on conflict do nothing`, así que repetirlo no pisa precios.
  //
  // Los meses cerrados no llevan catálogo: nadie lo lee, y no sabemos a qué
  // precio se cobraba en febrero.
  const periodoActivo = idPeriodo.get(ultimo)
  const { error: eSeed } = await db.rpc('seed_action_catalog', { p_period_id: periodoActivo })
  err(eSeed, 'catálogo de partida')

  const { data: catalogo } = await db
    .from('action_catalog')
    .select('id, code, label, cost_bits, sort_order, active')
    .eq('period_id', periodoActivo)

  const cambios = precios(catalogo ?? [])
  for (const c of cambios.actualizar) {
    const { error } = await db.from('action_catalog').update({ cost_bits: c.bits }).eq('id', c.id)
    err(error, `precio de ${c.code}`)
  }
  if (cambios.altas.length) {
    const { error } = await db.from('action_catalog').insert(
      cambios.altas.map((a, i) => ({
        period_id: periodoActivo,
        code: a.code,
        label: a.label,
        cost_bits: a.bits,
        sort_order: (catalogo?.length ?? 0) + i + 1,
      })),
    )
    err(error, 'altas del catálogo')
  }
  console.log(`  ✓ catálogo: ${cambios.actualizar.length} precios ajustados · ${cambios.altas.length} altas`)

  // --- 5. El banco. Cada saldo con su asiento, para que el número venga de
  //        algún sitio y el historial de la cuenta no nazca en blanco.
  const { data: cuentas } = await db.from('ledger_account').select('id, player_id, display_name')
  const porJugador = new Map((cuentas ?? []).filter((c) => c.player_id).map((c) => [c.player_id, c]))
  const porNombre = new Map((cuentas ?? []).map((c) => [c.display_name.toUpperCase(), c]))

  let nCuentas = 0
  for (const c of cctm.banco) {
    const playerId = idJugador.get(slugEnLaBase(canonico(c.slug))) ?? null
    const ya = (playerId && porJugador.get(playerId)) || porNombre.get(c.nombre.toUpperCase())
    const razon =
      `Saldo importado del CCTM · «${c.literal}»` + (c.sabor ? ` · subs ${c.sabor}` : '')

    let cuentaId = ya?.id
    if (ya) {
      const { error } = await db
        .from('ledger_account')
        .update({ balance_bits: c.bits, balance_subs: c.subs, player_id: playerId ?? ya.player_id })
        .eq('id', ya.id)
      err(error, `cuenta de ${c.nombre}`)
    } else {
      const { data, error } = await db
        .from('ledger_account')
        .insert({
          display_name: c.nombre,
          player_id: playerId,
          kind: playerId ? 'player' : 'supporter',
          balance_bits: c.bits,
          balance_subs: c.subs,
        })
        .select('id')
        .single()
      err(error, `cuenta de ${c.nombre}`)
      cuentaId = data.id
      nCuentas++
    }

    const { data: asiento } = await db
      .from('ledger_entry')
      .select('id')
      .eq('account_id', cuentaId)
      .like('reason', 'Saldo importado del CCTM%')
      .maybeSingle()

    const apunte = { account_id: cuentaId, delta_bits: c.bits, delta_subs: c.subs, reason: razon }
    const { error } = asiento
      ? await db.from('ledger_entry').update(apunte).eq('id', asiento.id)
      : await db.from('ledger_entry').insert(apunte)
    err(error, `asiento de ${c.nombre}`)
  }
  console.log(`  ✓ banco: ${cctm.banco.length} cuentas (${nCuentas} nuevas), cada una con su asiento`)

  // --- 6. Préstamos.
  for (const p of cctm.prestamos) {
    const playerId = idJugador.get(slugEnLaBase(canonico(p.slug))) ?? null
    const { data: ya } = await db
      .from('loan')
      .select('id')
      .eq('person_name', p.nombre)
      .eq('principal_bits', p.bits)
      .maybeSingle()
    if (ya) continue
    const { error } = await db.from('loan').insert({
      person_name: p.nombre,
      player_id: playerId,
      principal_bits: p.bits,
      daily_rate: 0.1,
      note: `Importado del CCTM · ${cctm.notaPrestamos ?? 'sin anotación'}`,
    })
    err(error, `préstamo de ${p.nombre}`)
  }
  console.log(`  ✓ ${cctm.prestamos.length} préstamo(s)`)

  // --- 7. Cárcel y restricciones. Ver `castigosEn`: van al mes que se vaya a
  //        jugar, no al último del Excel, y en un mes nuevo se registra al
  //        castigado si hace falta.
  const nombreCastigos = castigosEn ?? ultimo
  let idCastigos = idPeriodo.get(nombreCastigos)
  if (!idCastigos) {
    const { data: p } = await db.from('period').select('id').eq('name', nombreCastigos).maybeSingle()
    idCastigos = p?.id
  }
  const puedeRegistrar = castigosEn !== null && !nombresPeriodo.includes(nombreCastigos)

  if (!idCastigos) {
    console.log(`  ⚠  castigos: el periodo ${nombreCastigos} no existe todavía; no se ha puesto ninguno`)
    return resumenFinal()
  }

  const { data: delMes } = await db
    .from('participation')
    .select('id, player_id')
    .eq('period_id', idCastigos)
  const participacionDe = new Map((delMes ?? []).map((p) => [p.player_id, p.id]))

  let puestas = 0
  const sinFicha = []
  for (const r of restriccionesAEscribir()) {
    const playerId = idJugador.get(slugEnLaBase(canonico(r.slug)))
    let participationId = playerId && participacionDe.get(playerId)

    if (!participationId && playerId && puedeRegistrar) {
      const { data, error } = await db
        .from('participation')
        .insert({ player_id: playerId, period_id: idCastigos, initial_lp: 100, current_lp: 100 })
        .select('id')
        .single()
      err(error, `registrar a ${r.nombre} en ${nombreCastigos}`)
      participationId = data.id
      participacionDe.set(playerId, data.id)
    }

    if (!participationId) { sinFicha.push(r); continue }

    const { data: ya } = await db
      .from('restriction')
      .select('id')
      .eq('participation_id', participationId)
      .eq('kind', r.kind)
      .eq('value', r.value)
      .maybeSingle()
    if (ya) {
      await db.from('restriction').update({ note: r.note, active: true }).eq('id', ya.id)
    } else {
      const { error } = await db
        .from('restriction')
        .insert({ participation_id: participationId, kind: r.kind, value: r.value, note: r.note })
      err(error, `restricción de ${r.nombre}`)
    }
    puestas++
  }
  console.log(`  ✓ ${puestas} restricciones en ${nombreCastigos}`)
  if (sinFicha.length) avisoDeCastigos(sinFicha, nombreCastigos)

  /**
   * El bloque EXTRA del CCTM **no se importa**, y es a propósito.
   *
   * «500 BOO Y HANZO EN LA BOT» son recordatorios de una copa concreta que ya
   * se jugó, y `extra` cuelga de una sesión: sin sesión a la que engancharlos
   * no los leería nadie —`GET /sessions/:id/notes` filtra por `ref_id`—, así
   * que serían filas muertas con un `scope` que miente. Quedan en
   * `scripts/historico/cctm.json` por si el host los quiere copiar a mano.
   */
  return resumenFinal()

  function resumenFinal() {
    if (cctm.extras.length) {
      console.log(`  · ${cctm.extras.length} notas del bloque EXTRA, sin importar (ver cctm.json)`)
    }
  }
}

/**
 * Los castigos que se han quedado fuera, dichos de forma que se puedan poner.
 *
 * Callarlo sería lo peor: el host cree que la cárcel está importada, arma la
 * copa y no le avisa nadie de que Deadly debía tres.
 */
function avisoDeCastigos(sinFicha, periodo) {
  console.log(`\n  ⚠  ${sinFicha.length} castigos sin colocar: nadie de esa lista está registrado en ${periodo}.`)
  const nicks = [...new Set(roster.meses.flatMap((m) => m.jugadores.map((j) => ({ slug: canonico(j.slug), nombre: j.nombre }))).map((x) => JSON.stringify(x)))].map((x) => JSON.parse(x))
  for (const r of sinFicha) {
    const slug = canonico(r.slug)
    // Casi todos están en el Excel con el nombre largo —«CRONO» es «Cronomus»—,
    // y esa es la pista que necesita el host para rellenar alias.json.
    const parecidos = nicks.filter((n) => n.slug !== slug && (n.slug.startsWith(slug) || slug.startsWith(n.slug)))
    console.log(
      `       ${r.nombre.padEnd(10)} ${r.note}` +
        (parecidos.length ? `   ¿es ${parecidos.map((p) => p.nombre).join(' o ')}?` : '   (no aparece en ningún mes)'),
    )
  }
  console.log(
    `\n     Dos salidas: apuntar el alias en scripts/historico/alias.json, o volver a\n` +
      `     lanzarlo con --castigos-en=<el mes que se va a jugar> cuando exista, que\n` +
      `     registra al castigado en ese mes y le cuelga la restricción.`,
  )
}

/**
 * Los precios del Excel contra los que tiene el catálogo.
 *
 * El Excel del host ya no dice lo mismo que `seed_action_catalog`: el Blue
 * Shell vale 499 y no 500, y hay un «OTP OPEN» que nunca existió en el código.
 * Lo que **no** se toca es lo que el Excel dejó de nombrar —«sacar de la
 * banca»—: quitar una recompensa es `active: false` y un clic reversible en
 * Ajustes, y de que el host la haya retirado a propósito no hay constancia.
 */
/**
 * Lo que `seed_action_catalog` deja puesto al abrir un mes sin mes anterior.
 *
 * Duplicado aquí solo para que el ensayo en seco pueda decir la verdad: si el
 * periodo todavía no existe, no hay catálogo que leer, y sin esto el ensayo
 * anunciaría seis altas donde en realidad va a haber un precio ajustado y una
 * sola alta. Manda el SQL; esto es una predicción.
 */
const SEMILLA = [
  { code: 'SPOT_TAKEOVER', cost_bits: 200 },
  { code: 'TEAM_CHANGE', cost_bits: 150 },
  { code: 'BENCH_PULL', cost_bits: 200 },
  { code: 'ROLE_CHANGE_REENTRY', cost_bits: 300 },
  { code: 'GRAVEYARD_EXIT', cost_bits: 300 },
  { code: 'BLUE_SHELL', cost_bits: 500 },
]

const DEL_EXCEL = {
  'CUPO': 'SPOT_TAKEOVER',
  'CAMBIO DE TEAM': 'TEAM_CHANGE',
  'BLUE SHELL': 'BLUE_SHELL',
  'SACADA DE CEMENTERIO': 'GRAVEYARD_EXIT',
  'CAMBIO DE ROL + CUPO': 'ROLE_CHANGE_REENTRY',
}

function precios(catalogo) {
  const porCodigo = new Map(catalogo.map((a) => [a.code, a]))
  const actualizar = []
  const altas = []

  for (const p of cctm.precios) {
    const etiqueta = p.etiqueta.trim().toUpperCase().replace(/\s+/g, ' ')
    const code = DEL_EXCEL[etiqueta] ?? codigoDeRecompensa(p.etiqueta)
    const ya = porCodigo.get(code)
    if (!ya) altas.push({ code, label: p.etiqueta.trim(), bits: p.bits })
    else if (ya.cost_bits !== p.bits) actualizar.push({ id: ya.id, code, bits: p.bits, antes: ya.cost_bits })
  }
  return { actualizar, altas }
}

/** El mismo código que `shared/economy.ts`, para que un canjeo viejo se siga entendiendo. */
function codigoDeRecompensa(label) {
  return (
    (label ?? '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'RECOMPENSA'
  )
}

/**
 * La cárcel, convertida en lo único que el panel enseña por participación.
 *
 * El Excel la cuenta en **copas pendientes** («DEADLY: 3 COPAS») y el modelo no
 * sabe decir eso: `state_record` cuelga de un `session_participant`, o sea de
 * **una** sesión concreta. Es un hueco del modelo, no del Excel.
 *
 * Entra como `restriction` porque las restricciones son lo que
 * `GET /sessions/:id/notes` saca junto a cada jugador de la copa abierta: es
 * donde el host la va a ver al armar los equipos. Un `extra` con
 * `scope: 'participation'` cabría en la base, pero no lo lee nadie.
 */
function restriccionesAEscribir() {
  return [
    ...cctm.carcel.map((c) => ({
      nombre: c.nombre,
      slug: c.slug,
      kind: 'custom',
      value: 'CARCEL',
      note: `${c.copas} copa${c.copas === 1 ? '' : 's'} pendiente${c.copas === 1 ? '' : 's'} · importado del CCTM`,
    })),
    ...cctm.restricciones.map((r) => ({
      nombre: r.nombre,
      slug: r.slug,
      kind: r.tipo,
      value: r.roles.join(','),
      note: `${r.literal} · importado del CCTM`,
    })),
  ]
}

// ------------------------------------------------------------- el cuadre ----

/**
 * Relee la base y la compara con el JSON, fila a fila.
 *
 * Es el único paso que de verdad dice si la importación salió bien: que no
 * reviente no significa que los números coincidan.
 */
async function comprobar() {
  console.log('\nCUADRE CONTRA EL EXCEL\n')
  let bien = 0
  const mal = []

  for (const mes of roster.meses) {
    const { data: periodo } = await db.from('period').select('id').eq('name', mes.periodo).maybeSingle()
    if (!periodo) { mal.push([mes.periodo, '—', 'el periodo no está en la base']); continue }

    const { data } = await db
      .from('participation')
      .select('current_lp, historic_wins, historic_losses, historic_mvps, historic_aces, player(slug)')
      .eq('period_id', periodo.id)

    const enBase = new Map((data ?? []).map((p) => [p.player.slug, p]))

    for (const a of participacionesDe(mes)) {
      const p = enBase.get(slugEnLaBase(a.slug))
      if (!p) { mal.push([mes.periodo, a.slug, 'no está en la base']); continue }
      const esperado = { lp: a.lp ?? 100, v: a.wins, d: a.losses, mvp: a.mvps, ace: a.aces }
      const hay = {
        lp: p.current_lp, v: p.historic_wins, d: p.historic_losses,
        mvp: p.historic_mvps, ace: p.historic_aces,
      }
      const diff = Object.keys(esperado).filter((k) => esperado[k] !== hay[k])
      if (diff.length) {
        mal.push([mes.periodo, a.slug, diff.map((k) => `${k}: Excel ${esperado[k]} ≠ base ${hay[k]}`).join(' · ')])
      } else bien++
    }
  }

  // Filas que viven en un mes importado pero no las escribió el import: o son
  // de una prueba anterior, o alguien ha estado tocando la base.
  const { data: periodos } = await db
    .from('period')
    .select('id, name')
    .in('name', roster.meses.map((m) => m.periodo))
  const { data: ajenas } = await db
    .from('participation')
    .select('period(name), player(display_name)')
    .in('period_id', (periodos ?? []).map((p) => p.id))
    .is('imported_from', null)
  if (ajenas?.length) {
    console.log(`\n  ⚠  ${ajenas.length} participaciones en meses importados que NO vienen del Excel:`)
    for (const a of ajenas) console.log(`       ${a.period.name}  ${a.player?.display_name ?? '—'}`)
  }

  // Y que el LP se sostenga solo: `recalcular_lp()` tiene que devolver lo mismo
  // que la caché. Si no, la primera partida que se cierre borraría el histórico.
  const { data: eventos } = await db
    .from('lp_event')
    .select('participation_id, delta')
    .like('note', 'Importado del CCPR Roster%')
    .is('reverted_at', null)
  const suma = new Map()
  for (const e of eventos ?? []) suma.set(e.participation_id, (suma.get(e.participation_id) ?? 0) + e.delta)

  const { data: todas } = await db.from('participation').select('id, current_lp, initial_lp').not('imported_from', 'is', null)
  const descuadreLp = (todas ?? []).filter(
    (p) => p.initial_lp + (suma.get(p.id) ?? 0) !== p.current_lp,
  )

  for (const [periodo, quien, que] of mal) console.log(`  ✗ ${periodo}  ${quien.padEnd(20)} ${que}`)
  console.log(`\n  ${bien} de ${bien + mal.length} participaciones cuadran.`)
  console.log(
    descuadreLp.length
      ? `  ✗ ${descuadreLp.length} con el LP que no se sostiene: recalcular_lp() lo cambiaría.`
      : '  ✓ el LP se sostiene solo: recalcular_lp() devolvería lo mismo.',
  )
  return mal.length === 0 && descuadreLp.length === 0
}

// ---------------------------------------------------------------- main ----

async function main() {
  // A qué base se está entrando, siempre y lo primero.
  console.log(`Proyecto:  ${env.SUPABASE_URL}   (leído de ${archivoEnv})\n`)

  if (soloComprobar) process.exit((await comprobar()) ? 0 : 1)


  const lista = await migracionAplicada()
  console.log(
    lista
      ? 'Migración 20260916000001: aplicada.\n'
      : 'Migración 20260916000001: NO APLICADA en esta base.\n',
  )

  const totalFilas = roster.meses.reduce((t, m) => t + m.jugadores.length, 0)
  const conAlias = Object.keys(ALIAS).length

  console.log(hazlo ? 'SE VA A ESCRIBIR:' : 'SE ESCRIBIRÍA (nada se ha tocado):')
  for (const m of roster.meses) {
    const p = participacionesDe(m)
    console.log(
      `   ${m.periodo.padEnd(9)} ${String(p.length).padStart(3)} participaciones` +
        (p.length !== m.jugadores.length ? `  (${m.jugadores.length} filas, ${m.jugadores.length - p.length} fundidas)` : '') +
        (m.tieneLp ? '' : '   sin LP: se quedan a 100'),
    )
  }
  const soloCctm = NOMBRES.size - new Set(roster.meses.flatMap((m) => m.jugadores.map((j) => canonico(j.slug)))).size
  console.log(
    `   ${'jugadores'.padEnd(9)} ${String(NOMBRES.size).padStart(3)} perfiles de ${totalFilas} filas` +
      (soloCctm ? `  (${soloCctm} salen solo del CCTM: banco, cárcel o préstamo)` : ''),
  )
  console.log(`   ${'banco'.padEnd(9)} ${String(cctm.banco.length).padStart(3)} cuentas`)
  const destinoCastigos = castigosEn ?? roster.meses.at(-1).periodo
  const enElRoster = new Set(
    roster.meses.at(-1).jugadores.map((j) => canonico(j.slug)),
  )
  const colocables = castigosEn
    ? cctm.carcel.length + cctm.restricciones.length
    : [...cctm.carcel, ...cctm.restricciones].filter((c) => enElRoster.has(canonico(c.slug))).length
  console.log(
    `   ${'castigos'.padEnd(9)} ${String(colocables).padStart(3)} de ` +
      `${cctm.carcel.length + cctm.restricciones.length} restricciones, en ${destinoCastigos}`,
  )

  const { data: abierto } = await db
    .from('period')
    .select('id')
    .eq('name', roster.meses.at(-1).periodo)
    .maybeSingle()
  const { data: catalogo } = abierto
    ? await db.from('action_catalog').select('id, code, cost_bits').eq('period_id', abierto.id)
    : { data: null }
  // Sin periodo todavía, el catálogo que habrá es el que siembre el RPC.
  const cambios = precios(catalogo?.length ? catalogo : SEMILLA)
  for (const c of cambios.actualizar) console.log(`   precio    ${c.code}: ${c.antes} → ${c.bits}`)
  for (const a of cambios.altas) console.log(`   alta      ${a.code}: ${a.bits} bits`)

  if (!castigosEn && colocables < cctm.carcel.length + cctm.restricciones.length) {
    console.log(
      `\n   ⚠  La cárcel y las restricciones son estado de AHORA, y cuelgan de un mes.\n` +
        `      Los castigados no jugaron en ${destinoCastigos}, así que no hay dónde ponerlos.\n` +
        `      Cuando exista el mes que se va a jugar:  --castigos-en=OCT-2026`,
    )
  }

  if (!conAlias) {
    console.log(
      '\n   ⚠  `alias.json` está vacío: cada grafía entra como una persona distinta.\n' +
        '      El informe está en scripts/historico/nombres-a-revisar.csv, y conviene\n' +
        '      que lo mire el host antes, porque fundir después es a mano.',
    )
  } else {
    console.log(`\n   ${conAlias} nicks fundidos según alias.json.`)
  }

  if (!lista) {
    console.error(
      '\nA esta base le faltan las columnas del histórico. Aplica primero\n' +
        'supabase/migrations/20260916000001_historico_importado.sql desde el SQL\n' +
        'Editor de Supabase, en ESTE proyecto, y vuelve a lanzarlo.',
    )
    process.exit(1)
  }

  if (!hazlo) {
    console.log('\nPara hacerlo de verdad:  node scripts/importar-historico.mjs --hazlo')
    return
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const dicho = await rl.question('\nEscribe IMPORTAR para confirmar: ')
  rl.close()
  if (dicho.trim() !== 'IMPORTAR') {
    console.log('Cancelado. No se ha tocado nada.')
    return
  }

  console.log()
  await importar()
  console.log()
  const ok = await comprobar()
  console.log(ok ? '\nListo.\n' : '\nImportado, pero hay descuadres arriba.\n')
  process.exitCode = ok ? 0 : 1
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
