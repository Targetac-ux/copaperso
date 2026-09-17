/**
 * Pasa los dos Excel del host a JSON revisable.
 *
 *   node scripts/leer-excel.mjs "~/Downloads/CCPR Roster.xlsm" "~/Downloads/CCTM Manager.xlsm"
 *
 * Deja en `scripts/historico/`:
 *
 *   roster.json            los ocho meses, fila a fila, tal cual están en la hoja
 *   cctm.json              banco, préstamos, cárcel, restricciones y precios
 *   nombres-a-revisar.csv  el informe de fusiones, para que lo mire el host
 *   alias.json             lo que el host devuelve; no se pisa si ya existe
 *
 * **Por qué un paso aparte y no leer el Excel al importar.** Los `.xlsm` no
 * entran al repo —llevan macros y datos personales— así que sin este paso la
 * importación dependería de dos ficheros sueltos en el Descargas de alguien.
 * Con el JSON dentro, cualquiera puede revisar en un diff qué se va a escribir
 * y volver a lanzarla dentro de seis meses y obtener lo mismo.
 *
 * **Y sin dependencias.** Un `.xlsm` es un ZIP con XML dentro: el directorio
 * central se lee a mano y cada entrada se infla con `zlib`. Son cien líneas
 * para no meter un paquete de hojas de cálculo entero en un proyecto que lo
 * necesita exactamente una vez.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { inflateRawSync } from 'node:zlib'

// ------------------------------------------------------------------ ZIP ----

/** El contenido de un `.xlsx`/`.xlsm`, como un mapa de ruta → texto. */
function abrirZip(ruta) {
  const buf = readFileSync(ruta)

  // El directorio central se localiza desde el final: la firma del EOCD está
  // en los últimos 22 bytes, más el comentario, que casi nunca existe.
  let eocd = -1
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 65558; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error(`${ruta} no parece un fichero de Excel (no hay directorio ZIP).`)

  const total = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  const entradas = new Map()

  for (let n = 0; n < total; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break
    const metodo = buf.readUInt16LE(p + 10)
    const comprimido = buf.readUInt32LE(p + 20)
    const nombreLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const comentLen = buf.readUInt16LE(p + 32)
    const local = buf.readUInt32LE(p + 42)
    const nombre = buf.toString('utf8', p + 46, p + 46 + nombreLen)

    // La cabecera local repite el nombre y trae su propio `extra`, que puede
    // medir distinto que el del directorio: hay que leerlo de ahí.
    const lnLen = buf.readUInt16LE(local + 26)
    const leLen = buf.readUInt16LE(local + 28)
    const datos = local + 30 + lnLen + leLen
    const crudo = buf.subarray(datos, datos + comprimido)

    entradas.set(nombre, metodo === 0 ? crudo : inflateRawSync(crudo))
    p += 46 + nombreLen + extraLen + comentLen
  }

  return {
    texto: (ruta) => {
      const b = entradas.get(ruta)
      return b ? b.toString('utf8') : null
    },
  }
}

// ------------------------------------------------------------------ XML ----

const ENTIDADES = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }

function desescapar(s) {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (todo, e) => {
    if (e[0] === '#') return String.fromCodePoint(Number(e[1] === 'x' ? `0x${e.slice(2)}` : e.slice(1)))
    return ENTIDADES[e] ?? todo
  })
}

/** El texto de todos los `<t>` de un fragmento, concatenado. */
function textos(xml) {
  const trozos = xml.match(/<t[^>]*\/>|<t[^>]*>[\s\S]*?<\/t>/g) ?? []
  return trozos.map((t) => desescapar(t.replace(/^<t[^>]*\/>$/, '').replace(/^<t[^>]*>|<\/t>$/g, ''))).join('')
}

/** "AB12" → 27 (índice de columna, base 0). */
function columna(ref) {
  let n = 0
  for (const c of ref.match(/^[A-Z]+/)[0]) n = n * 26 + (c.charCodeAt(0) - 64)
  return n - 1
}

/**
 * Una hoja como `Map<fila, Map<columna, valor>>`.
 *
 * Solo se guardan las celdas con contenido: las hojas del host tienen bordes y
 * colores en filas enteras vacías, y arrastrarlas convertiría un mes de
 * cuarenta jugadores en una matriz de mil celdas nulas.
 */
function leerHoja(xml, sst) {
  const filas = new Map()
  for (const fila of xml.match(/<row[^>]*>[\s\S]*?<\/row>/g) ?? []) {
    const nFila = Number(/\sr="(\d+)"/.exec(fila)?.[1])
    const celdas = new Map()
    for (const c of fila.match(/<c[^>]*\/>|<c[^>]*>[\s\S]*?<\/c>/g) ?? []) {
      const ref = /\sr="([A-Z]+\d+)"/.exec(c)?.[1]
      if (!ref) continue
      const tipo = /\st="([^"]+)"/.exec(c)?.[1]
      let valor
      if (tipo === 's') {
        const i = /<v>([\s\S]*?)<\/v>/.exec(c)?.[1]
        valor = i === undefined ? undefined : sst[Number(i)]
      } else if (tipo === 'inlineStr') {
        valor = textos(c)
      } else {
        const v = /<v>([\s\S]*?)<\/v>/.exec(c)?.[1]
        valor = v === undefined ? undefined : desescapar(v)
      }
      if (valor !== undefined && valor !== '') celdas.set(columna(ref), valor)
    }
    if (celdas.size) filas.set(nFila, celdas)
  }
  return filas
}

/** Las hojas del libro, en el orden en que salen las pestañas. */
export function abrirLibro(ruta) {
  const zip = abrirZip(ruta)
  const sst = (zip.texto('xl/sharedStrings.xml')?.match(/<si>[\s\S]*?<\/si>/g) ?? []).map(textos)

  const rels = new Map(
    [...(zip.texto('xl/_rels/workbook.xml.rels') ?? '').matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)]
      .map(([, id, target]) => [id, target.startsWith('xl/') ? target : `xl/${target.replace(/^\/+/, '')}`]),
  )

  const hojas = []
  for (const [, nombre, rid] of (zip.texto('xl/workbook.xml') ?? '').matchAll(
    /<sheet[^>]*name="([^"]*)"[^>]*r:id="([^"]+)"/g,
  )) {
    const xml = zip.texto(rels.get(rid))
    if (xml) hojas.push({ nombre: desescapar(nombre), filas: leerHoja(xml, sst) })
  }
  return hojas
}

// -------------------------------------------------------------- utilería ----

const txt = (filas, f, c) => {
  const v = filas.get(f)?.get(c)
  return typeof v === 'string' ? v.trim() : v === undefined ? null : String(v)
}

/** Un número, o `null` si la celda está vacía o trae texto. */
const num = (filas, f, c) => {
  const v = filas.get(f)?.get(c)
  if (v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function slugificar(nombre) {
  return (nombre ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/**
 * El nick, sin el veredicto del tryout pegado detrás.
 *
 * «Bonivi TRYOUT DENEGADO» y «Vindex APROBADO» son anotaciones del host en la
 * celda del nombre, no parte del nick: dejarlas convertiría a Bonivi en dos
 * personas distintas. Los paréntesis —«Lunavt (Linie)», «SupKing (Sipi)»— **no**
 * se tocan: ahí el host apuntó otro nick de la misma persona, y decidir cuál
 * manda no es cosa de un script. Salen en el informe.
 */
export function limpiarNombre(nombre) {
  return (nombre ?? '')
    .replace(/\s*\bTRYOUT\s+(DENEGADO|APROBADO)\b\s*/gi, ' ')
    .replace(/\s*\b(DENEGADO|APROBADO)\b\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ------------------------------------------------------------- el roster ----

/** Las columnas que interesan, buscadas por su cabecera de la fila 3. */
const CAMPOS = {
  entradaV: 'ENTRADA V',
  entradaD: 'ENTRADA D',
  offRol: 'OFF ROL',
  mvp: 'MVP',
  ace: 'ACE',
  mas1: '+1 VICTORIA',
  menos1: '-1 VICTORIA',
  victorias: 'VICTORIAS',
  derrotas: 'DERROTAS',
  total: 'TOTAL',
  lp: 'LP',
}

/** "SET-2026" → "SEP-2026", que es como nombra los meses `shared/period.ts`. */
const MES_DEL_HOST = { SET: 'SEP' }

function leerRoster(ruta) {
  const meses = []
  for (const { nombre, filas } of abrirLibro(ruta)) {
    // La cabecera está en la fila 3 y el nombre en la B; lo demás se busca por
    // su etiqueta, porque ENE tiene la mitad de columnas que los otros siete y
    // fijar las letras habría leído derrotas donde pone MVP.
    const cabecera = new Map()
    for (const [c, v] of filas.get(3) ?? []) {
      if (typeof v === 'string' && v.trim()) cabecera.set(v.trim().toUpperCase(), c)
    }
    if (!cabecera.has('USER')) continue

    const columnas = Object.fromEntries(
      Object.entries(CAMPOS).map(([k, etiqueta]) => [k, cabecera.get(etiqueta) ?? null]),
    )
    const colCategoria = cabecera.get('CATEGORY') ?? null

    const jugadores = []
    for (const f of [...filas.keys()].sort((a, b) => a - b)) {
      if (f <= 3) continue
      const bruto = txt(filas, f, cabecera.get('USER'))
      if (!bruto) continue
      const nombreLimpio = limpiarNombre(bruto)
      if (!slugificar(nombreLimpio)) continue

      const fila = { fila: f, nombreEnLaHoja: bruto, nombre: nombreLimpio, slug: slugificar(nombreLimpio) }
      for (const [k, c] of Object.entries(columnas)) fila[k] = c === null ? null : num(filas, f, c)
      fila.categoria = colCategoria === null ? null : txt(filas, f, colCategoria)
      jugadores.push(fila)
    }

    const [mes, anio] = nombre.trim().toUpperCase().split('-')
    meses.push({
      hoja: nombre.trim(),
      periodo: `${MES_DEL_HOST[mes] ?? mes}-${anio}`,
      tieneLp: columnas.lp !== null,
      jugadores,
    })
  }
  return meses
}

// --------------------------------------------------------------- el CCTM ----

/**
 * Los saldos del banco no son todos números.
 *
 * «1SUB+1250» y «4SUB LATAM» son dos monedas en una celda, y `ledger_account`
 * las tiene separadas en `balance_bits` y `balance_subs`. El sabor del sub
 * —NA o LATAM— no cabe en el esquema, así que se devuelve aparte para que el
 * importador lo deje escrito en el asiento en vez de perderlo.
 */
export function parsearSaldo(bruto) {
  const s = String(bruto ?? '').trim()
  if (!s) return null
  const n = Number(s.replace(/\s/g, ''))
  if (Number.isFinite(n)) return { bits: n, subs: 0, sabor: null, literal: s }

  const subs = /(\d+)\s*SUBS?/i.exec(s)
  const bits = /(?:^|\+)\s*(\d+)\s*(?!\s*SUB)(?:BITS?)?\s*$/i.exec(s.replace(/\d+\s*SUBS?/i, ''))
  const sabor = /\b(LATAM|NA|EUW?)\b/i.exec(s)
  if (!subs && !bits) return { bits: 0, subs: 0, sabor: null, literal: s, sinEntender: true }

  return {
    bits: bits ? Number(bits[1]) : 0,
    subs: subs ? Number(subs[1]) : 0,
    sabor: sabor ? sabor[1].toUpperCase() : null,
    literal: s,
  }
}

/** "DEADLY: 3 COPAS" → { nombre: "DEADLY", copas: 3 }. */
function parsearCarcel(linea) {
  const m = /^(.+?)\s*:\s*(\d+)?\s*COPAS?\s*$/i.exec(linea)
  if (!m) return null
  return { nombre: m[1].trim(), slug: slugificar(m[1]), copas: Number(m[2] ?? 1), literal: linea }
}

/** "EMIZ: NO MID/SUP" → { nombre, roles: ["MID","SUP"] }. */
function parsearRestriccion(linea) {
  const m = /^(.+?)\s*:\s*(.+)$/.exec(linea)
  if (!m) return null
  const roles = [...m[2].matchAll(/\b(TOP|JG|JUNGLA|MID|ADC|SUP|SUPP)\b/gi)].map((r) => {
    const v = r[1].toUpperCase()
    return v === 'JUNGLA' ? 'JG' : v === 'SUPP' ? 'SUP' : v
  })
  return {
    nombre: m[1].trim(),
    slug: slugificar(m[1]),
    tipo: /\bNO\b/i.test(m[2]) && roles.length ? 'no_role' : 'custom',
    roles: [...new Set(roles)],
    literal: linea,
  }
}

function leerCctm(ruta) {
  const hoja = abrirLibro(ruta)[0]
  if (!hoja) throw new Error(`${ruta} no tiene ninguna hoja.`)
  const { filas } = hoja
  const ultima = Math.max(...filas.keys())

  /** Dónde está una etiqueta, para no fijar números de fila que el host mueve. */
  const buscar = (texto, col) => {
    for (const f of [...filas.keys()].sort((a, b) => a - b)) {
      const v = txt(filas, f, col)
      if (v && v.toUpperCase().startsWith(texto)) return f
    }
    return null
  }

  // Precios: las filas con la flecha en B, etiqueta en C y bits en E.
  const precios = []
  for (const f of [...filas.keys()].sort((a, b) => a - b)) {
    if (txt(filas, f, 1) !== '→') continue
    const etiqueta = txt(filas, f, 2)
    const bits = num(filas, f, 4)
    if (etiqueta && bits !== null) precios.push({ etiqueta: etiqueta.trim(), bits, celda: `C${f}` })
  }

  // Banco: bajo la cabecera BANCO, nombre en Q y saldo en R o en S —las siete
  // primeras filas llevan Q:R fusionado y el número se va a la S—.
  const banco = []
  const fBanco = buscar('BANCO', 16)
  if (fBanco) {
    for (let f = fBanco + 1; f <= ultima; f++) {
      const nombre = txt(filas, f, 16)
      if (!nombre || !slugificar(nombre)) continue
      const saldo = parsearSaldo(txt(filas, f, 18) ?? txt(filas, f, 17))
      if (!saldo) continue
      banco.push({ nombre: nombre.trim(), slug: slugificar(nombre), ...saldo, celda: `Q${f}` })
    }
  }

  // Préstamos: nombre en J y monto en K, bajo la cabecera.
  const prestamos = []
  const fPrest = buscar('PRÉSTAMO', 9) ?? buscar('PRESTAMO', 9)
  const notaPrestamos = fPrest
    ? [txt(filas, fPrest, 10), txt(filas, fPrest, 11)].filter(Boolean).join(' · ')
    : null
  if (fPrest) {
    for (let f = fPrest + 1; f <= ultima; f++) {
      const nombre = txt(filas, f, 9)
      const bits = num(filas, f, 10)
      if (!nombre || bits === null) continue
      prestamos.push({ nombre: nombre.trim(), slug: slugificar(nombre), bits, celda: `J${f}` })
    }
  }

  // Cárcel y restricciones comparten la columna F, una detrás de la otra.
  const carcel = []
  const restricciones = []
  const fCarcel = buscar('CARCEL', 5) ?? buscar('CÁRCEL', 5)
  const fRestr = buscar('RESTRICCIONES', 5)
  if (fCarcel) {
    for (let f = fCarcel + 1; f <= (fRestr ?? ultima); f++) {
      const l = txt(filas, f, 5)
      const p = l && parsearCarcel(l)
      if (p) carcel.push({ ...p, celda: `F${f}` })
    }
  }
  if (fRestr) {
    for (let f = fRestr + 1; f <= ultima; f++) {
      const l = txt(filas, f, 5)
      const p = l && parsearRestriccion(l)
      if (p) restricciones.push({ ...p, celda: `F${f}` })
    }
  }

  // Notas sueltas del bloque EXTRA, que el host usa como recordatorio en vivo.
  const extras = []
  const fExtra = buscar('EXTRA', 2)
  if (fExtra) {
    for (let f = fExtra + 1; f <= ultima; f++) {
      // El bloque termina donde empieza la tabla de precios, que se reconoce
      // por la flecha de la B. Se mira **antes** de apuntar: si no, la primera
      // fila de precios se colaba como si fuera una nota.
      if (txt(filas, f, 1) === '→') break
      const l = txt(filas, f, 2)
      if (l && l !== '-' && l.length > 3) extras.push({ texto: l, celda: `C${f}` })
    }
  }

  return { precios, banco, prestamos, notaPrestamos, carcel, restricciones, extras }
}

// ------------------------------------------------------ informe de nombres ----

/**
 * Qué nombres podrían ser la misma persona.
 *
 * Dos listas distintas, porque son dos problemas distintos: las que la base
 * funde sola no admiten discusión —`player.slug` las une le guste a quien le
 * guste— y las otras no las puede decidir un script. Saber si «Koann» y
 * «Koanyushi» son la misma persona no está en el fichero.
 */
function informeDeNombres(meses, cctm) {
  const porSlug = new Map()
  const apunta = (nombre, donde) => {
    const s = slugificar(nombre)
    if (!s) return
    if (!porSlug.has(s)) porSlug.set(s, { grafias: new Set(), donde: new Set() })
    porSlug.get(s).grafias.add(nombre)
    porSlug.get(s).donde.add(donde)
  }

  for (const m of meses) for (const j of m.jugadores) apunta(j.nombreEnLaHoja, m.periodo)
  for (const c of cctm.banco) apunta(c.nombre, 'CCTM banco')
  for (const c of cctm.carcel) apunta(c.nombre, 'CCTM cárcel')
  for (const c of cctm.prestamos) apunta(c.nombre, 'CCTM préstamo')

  const filas = []

  for (const [slug, { grafias, donde }] of [...porSlug].sort()) {
    if (grafias.size > 1) {
      filas.push({
        tipo: 'se funde sola',
        slug,
        nombres: [...grafias].join(' | '),
        donde: [...donde].join(' '),
        decision: '',
      })
    }
  }

  const slugs = [...porSlug.keys()].sort()
  for (let i = 0; i < slugs.length; i++) {
    for (let j = i + 1; j < slugs.length; j++) {
      const [a, b] = [slugs[i], slugs[j]]
      // Uno contenido en el otro y con raíz suficiente: «koan»/«koann» sí,
      // «ego»/«egoista» también, pero «ab»/«abi» no, que sería ruido.
      if (!a.startsWith(b) && !b.startsWith(a)) continue
      if (Math.min(a.length, b.length) < 4) continue
      filas.push({
        tipo: '¿la misma persona?',
        slug: `${a} / ${b}`,
        nombres: `${[...porSlug.get(a).grafias].join(' | ')}  ~  ${[...porSlug.get(b).grafias].join(' | ')}`,
        donde: `${[...porSlug.get(a).donde].join(' ')}  ~  ${[...porSlug.get(b).donde].join(' ')}`,
        decision: '',
      })
    }
  }

  // Los paréntesis: el host apuntó ahí otro nick, y casi siempre existe suelto.
  for (const [slug, { grafias, donde }] of porSlug) {
    for (const g of grafias) {
      const dentro = /\(([^)]+)\)/.exec(g)
      if (!dentro) continue
      const otro = slugificar(dentro[1])
      filas.push({
        tipo: porSlug.has(otro) ? '¿alias entre paréntesis?' : 'alias apuntado, sin ficha propia',
        slug: `${slug} / ${otro}`,
        nombres: `${g}  ~  ${otro ? [...(porSlug.get(otro)?.grafias ?? [otro])].join(' | ') : '—'}`,
        donde: [...donde].join(' '),
        decision: '',
      })
    }
  }

  return filas
}

const celdaCsv = (v) => (/[",\n;]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))

// ----------------------------------------------------------------- main ----

// Solo cuando se lanza a mano: el módulo se importa desde las pruebas, y ahí
// no hay dos rutas en `argv` ni nada que escribir en disco.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()

function main() {
const [rutaRoster, rutaCctm] = process.argv.slice(2)
if (!rutaRoster || !rutaCctm) {
  console.error('Uso: node scripts/leer-excel.mjs <CCPR Roster.xlsm> <CCTM Manager.xlsm>')
  process.exit(1)
}

const dir = new URL('./historico/', import.meta.url)
const meses = leerRoster(rutaRoster)
const cctm = leerCctm(rutaCctm)

const roster = {
  origen: rutaRoster.split('/').pop(),
  leidoEl: new Date().toISOString().slice(0, 10),
  meses,
}
writeFileSync(new URL('roster.json', dir), JSON.stringify(roster, null, 2) + '\n')
writeFileSync(
  new URL('cctm.json', dir),
  JSON.stringify({ origen: rutaCctm.split('/').pop(), leidoEl: roster.leidoEl, ...cctm }, null, 2) + '\n',
)

const informe = informeDeNombres(meses, cctm)
writeFileSync(
  new URL('nombres-a-revisar.csv', dir),
  '﻿' +
    ['tipo,slug,nombres,donde,decision', ...informe.map((f) => Object.values(f).map(celdaCsv).join(','))].join('\r\n') +
    '\r\n',
)

// El alias.json es del host: si ya lo ha rellenado, no se pisa.
const alias = new URL('alias.json', dir)
if (!existsSync(alias)) {
  writeFileSync(
    alias,
    JSON.stringify(
      {
        _ayuda: 'Lo que el host decide sobre los nicks repetidos. Vacío = cada grafía es alguien distinto.',
        _informe: 'scripts/historico/nombres-a-revisar.csv',
        fusiones: {},
        nombres: {},
      },
      null,
      2,
    ) + '\n',
  )
}

// ------------------------------------------------------------- el resumen ----

console.log(`\nCCPR Roster · ${roster.origen}`)
let filas = 0
for (const m of meses) {
  filas += m.jugadores.length
  const v = m.jugadores.reduce((t, j) => t + (j.victorias ?? 0), 0)
  const d = m.jugadores.reduce((t, j) => t + (j.derrotas ?? 0), 0)
  console.log(
    `   ${m.hoja.padEnd(9)} → ${m.periodo.padEnd(9)} ${String(m.jugadores.length).padStart(3)} jugadores · ` +
      `${v}V/${d}D${m.tieneLp ? '' : '  (sin columna LP)'}`,
  )
}
const distintos = new Set(meses.flatMap((m) => m.jugadores.map((j) => j.slug)))
console.log(`   ${filas} filas · ${distintos.size} jugadores distintos por slug`)

console.log(`\nCCTM Manager · ${cctm.banco.length} cuentas de banco · ${cctm.prestamos.length} préstamo(s) · ` +
  `${cctm.carcel.length} en la cárcel · ${cctm.restricciones.length} restricción(es) · ${cctm.precios.length} precios`)
for (const p of cctm.precios) console.log(`   ${p.etiqueta.padEnd(24)} ${String(p.bits).padStart(5)}`)
const raros = cctm.banco.filter((c) => c.subs || c.sinEntender)
if (raros.length) {
  console.log('\n   Saldos que no son un número a secas:')
  for (const c of raros) console.log(`     ${c.nombre.padEnd(16)} ${c.literal}  →  ${c.bits} bits + ${c.subs} subs${c.sabor ? ` (${c.sabor})` : ''}`)
}

console.log(`\nInforme de nombres: ${informe.length} líneas en scripts/historico/nombres-a-revisar.csv`)
console.log('   Que lo mire el host y rellene scripts/historico/alias.json antes de importar.\n')
}
