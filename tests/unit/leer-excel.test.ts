import { describe, it, expect } from 'vitest'
import { deflateRawSync } from 'node:zlib'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
// @ts-expect-error — el script es .mjs sin tipos; se prueba su comportamiento.
import { abrirLibro, limpiarNombre, parsearSaldo, slugificar } from '../../scripts/leer-excel.mjs'

/**
 * El lector de los `.xlsm` del host.
 *
 * Se prueba de verdad, con un ZIP armado aquí mismo, y no con los dos ficheros
 * reales: llevan datos personales y no entran al repo, así que una prueba que
 * dependiera de ellos solo pasaría en el portátil de quien los tenga.
 */

// ----------------------------------------------------------- un xlsx a mano ----

/** Un ZIP sin comprimir (método 0), que es todo lo que el lector necesita. */
function zip(entradas: Record<string, string>, comprimir = false): Buffer {
  const locales: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0

  for (const [nombre, texto] of Object.entries(entradas)) {
    const crudo = Buffer.from(texto, 'utf8')
    const datos = comprimir ? deflateRawSync(crudo) : crudo
    const n = Buffer.from(nombre, 'utf8')

    const local = Buffer.alloc(30 + n.length)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(comprimir ? 8 : 0, 8)
    local.writeUInt32LE(datos.length, 18)
    local.writeUInt32LE(crudo.length, 22)
    local.writeUInt16LE(n.length, 26)
    n.copy(local, 30)
    locales.push(local, datos)

    const cen = Buffer.alloc(46 + n.length)
    cen.writeUInt32LE(0x02014b50, 0)
    cen.writeUInt16LE(comprimir ? 8 : 0, 10)
    cen.writeUInt32LE(datos.length, 20)
    cen.writeUInt32LE(crudo.length, 24)
    cen.writeUInt16LE(n.length, 28)
    cen.writeUInt32LE(offset, 42)
    n.copy(cen, 46)
    central.push(cen)

    offset += local.length + datos.length
  }

  const dir = Buffer.concat(central)
  const fin = Buffer.alloc(22)
  fin.writeUInt32LE(0x06054b50, 0)
  fin.writeUInt16LE(central.length, 8)
  fin.writeUInt16LE(central.length, 10)
  fin.writeUInt32LE(dir.length, 12)
  fin.writeUInt32LE(offset, 16)

  return Buffer.concat([...locales, dir, fin])
}

const HOJA = `<?xml version="1.0"?><worksheet><sheetData>
  <row r="3"><c r="B3" t="s"><v>0</v></c><c r="C3" t="s"><v>1</v></c><c r="M3" t="s"><v>2</v></c></row>
  <row r="4"><c r="B4" t="s"><v>3</v></c><c r="C4"><v>9</v></c><c r="M4"><v>265</v></c></row>
  <row r="5"><c r="B5" t="inlineStr"><is><t>Beamer boy</t></is></c><c r="C5"><v>2</v></c></row>
  <row r="6"><c r="B6" t="s"><v>4</v></c></row>
</sheetData></worksheet>`

const SST = `<?xml version="1.0"?><sst>
  <si><t>USER</t></si><si><t>VICTORIAS</t></si><si><t>LP</t></si>
  <si><t>Meg&#252;itan</t></si><si><t>Bonivi TRYOUT DENEGADO</t></si>
</sst>`

function libro(comprimir = false) {
  const ruta = join(mkdtempSync(join(tmpdir(), 'copaperso-')), 'prueba.xlsm')
  writeFileSync(
    ruta,
    zip(
      {
        'xl/workbook.xml': '<workbook><sheets><sheet name="FEB-2026" r:id="rId1"/></sheets></workbook>',
        'xl/_rels/workbook.xml.rels':
          '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
        'xl/worksheets/sheet1.xml': HOJA,
        'xl/sharedStrings.xml': SST,
      },
      comprimir,
    ),
  )
  return abrirLibro(ruta)
}

// --------------------------------------------------------------------------

describe('leer un .xlsm sin dependencias', () => {
  it('saca las hojas, las celdas y las cadenas compartidas', () => {
    const [hoja] = libro()
    expect(hoja.nombre).toBe('FEB-2026')
    expect(hoja.filas.get(3).get(1)).toBe('USER')
    expect(hoja.filas.get(4).get(1)).toBe('Megüitan')
    expect(hoja.filas.get(4).get(12)).toBe('265')
  })

  // Excel comprime; el ZIP a pelo de la prueba no. Los dos tienen que valer.
  it('lee igual una entrada comprimida que una guardada tal cual', () => {
    expect(libro(true)[0].filas.get(4).get(1)).toBe('Megüitan')
  })

  it('entiende el texto en línea y no solo las cadenas compartidas', () => {
    expect(libro()[0].filas.get(5).get(1)).toBe('Beamer boy')
  })

  // Las hojas del host tienen bordes y colores en filas enteras vacías.
  it('no guarda celdas vacías', () => {
    expect(libro()[0].filas.get(5).has(12)).toBe(false)
  })
})

describe('el nombre con el que se queda cada persona', () => {
  it('quita el veredicto del tryout, que es una anotación y no el nick', () => {
    expect(limpiarNombre('Bonivi TRYOUT DENEGADO')).toBe('Bonivi')
    expect(limpiarNombre('Vindex APROBADO')).toBe('Vindex')
    expect(limpiarNombre('  Z Z  ')).toBe('Z Z')
  })

  // «Lunavt (Linie)» es el host apuntando otro nick de la misma persona.
  // Decidir cuál manda no es cosa de un script: sale en el informe.
  it('no toca lo que va entre paréntesis', () => {
    expect(limpiarNombre('Lunavt (Linie)')).toBe('Lunavt (Linie)')
    expect(limpiarNombre('SupKing (Sipi)')).toBe('SupKing (Sipi)')
  })

  // El mismo slug que `player_slug` en la base: si no coincidieran, el
  // importador creería estar creando a alguien nuevo y chocaría con el índice.
  it('slugifica igual que la base', () => {
    expect(slugificar('Beamer boy')).toBe('beamerboy')
    expect(slugificar('Laurita con frío')).toBe('lauritaconfrio')
    expect(slugificar('XIP')).toBe('xip')
    expect(slugificar('♰')).toBe('')
  })
})

describe('los saldos del banco, que no siempre son un número', () => {
  it('un número a secas son bits', () => {
    expect(parsearSaldo('6200')).toMatchObject({ bits: 6200, subs: 0, sabor: null })
  })

  it('separa las dos monedas de una celda', () => {
    expect(parsearSaldo('1SUB+1250')).toMatchObject({ bits: 1250, subs: 1, sabor: null })
  })

  // El sabor del sub no cabe en `ledger_account`, que solo tiene
  // `balance_subs`: se devuelve aparte para que acabe escrito en el asiento.
  it('se queda con el sabor del sub aunque el esquema no lo distinga', () => {
    expect(parsearSaldo('4SUB LATAM')).toMatchObject({ bits: 0, subs: 4, sabor: 'LATAM' })
  })

  it('marca lo que no entiende en vez de inventarse un cero', () => {
    expect(parsearSaldo('pendiente')).toMatchObject({ sinEntender: true, literal: 'pendiente' })
    expect(parsearSaldo('')).toBeNull()
  })
})
