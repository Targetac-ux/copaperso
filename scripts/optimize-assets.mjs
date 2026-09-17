/**
 * assets/ (originales que genera el host) → public/ (derivados que sirve la web)
 *
 *   node scripts/optimize-assets.mjs
 *
 * Los originales nunca se tocan. Todo lo de public/brand, public/modes y
 * public/backgrounds se regenera desde aquí, así que no edites esos archivos
 * a mano: se pisan en la siguiente ejecución.
 */
import { mkdir, copyFile, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { optimize } from 'svgo'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'assets')
const out = join(root, 'public')

/** Cada entrada describe un derivado. `skip` avisa en vez de romper. */
const jobs = [
  // --- marca -------------------------------------------------------------
  /**
   * El escudo, en mapa de bits para la web.
   *
   * El SVG pesa 32 kB —está vectorizado desde una imagen, con miles de puntos
   * por trazo— y se pinta a 28-36 px en la barra de **todas** las páginas. A
   * ese tamaño el vector no aporta nada y el webp cuesta una fracción.
   */
  // El isotipo pasó de ser el escudo vectorial a la ilustración del host
  // (17-09-2026). `isotipo.svg` se queda ahí como el original del anterior,
  // pero ya no lo lee nadie: la fuente de verdad es el .webp.
  { from: 'brand/isotipo.webp', to: 'brand/isotipo.webp', width: 108, format: 'webp', quality: 88 },
  { from: 'brand/logo-horizontal.svg', to: 'brand/logo-horizontal.svg', copy: true },
  { from: 'brand/logo-horizontal-light.svg', to: 'brand/logo-horizontal-light.svg', copy: true },
  { from: 'brand/favicon.png', to: 'favicon.png', width: 48, format: 'png' },
  { from: 'brand/favicon.png', to: 'brand/favicon-32.png', width: 32, format: 'png' },
  { from: 'brand/favicon.png', to: 'brand/favicon-180.png', width: 180, format: 'png' },
  { from: 'brand/favicon.png', to: 'brand/favicon-512.png', width: 512, format: 'png' },
  // El key art del hero. Viene con un canal alfa vacío que solo pesa, así que
  // se aplana. Dos anchos para no mandarle 1424 px a un móvil.
  { from: 'brand/keyart.png', to: 'brand/keyart.webp', width: 1424, format: 'webp', quality: 78, flatten: true },
  { from: 'brand/keyart.png', to: 'brand/keyart-900.webp', width: 900, format: 'webp', quality: 76, flatten: true },
  { from: 'brand/keyart.png', to: 'brand/keyart.jpg', width: 1424, format: 'jpeg', quality: 80 },

  /**
   * El trofeo, en la tarjeta de «Cómo se entra» de las reglas.
   *
   * A 520 px y no a los 1000 de cuando protagonizaba el hero: ahora se pinta en
   * un hueco de 230, así que con el doble para pantallas densas va sobrado.
   * Solo webp, sin respaldo en png: lleva transparencia, y el navegador que no
   * entienda webp tampoco existe ya.
   */
  { from: 'brand/trofeo-hero.png', to: 'brand/trofeo-hero.webp', width: 520, format: 'webp', quality: 82 },

  // og-image: 1200x630 exacto y en jpeg, que es lo que leen todos los scrapers.
  { from: 'brand/og-image.png', to: 'brand/og-image.jpg', width: 1200, height: 630, format: 'jpeg', quality: 82 },

  // --- fondos ------------------------------------------------------------
  // La textura se pinta como una sola copia que cubre la pantalla —el mosaico no
  // casa por los bordes y se le verían las costuras— así que hace falta a su
  // tamaño de origen y no a 600 px, o se ve borrosa en un monitor grande.
  { from: 'backgrounds/textura.png', to: 'backgrounds/textura.webp', width: 1254, format: 'webp', quality: 70 },

  // Los PNG del torneo llegan a 1254×1254 desde el generador de imágenes, que
  // es muchísimo más de lo que se ve en pantalla. Cada uno sale en webp para
  // el navegador y en png como respaldo, ambos al tamaño en que se usan.
  { from: 'ui/blue-shell.png', to: 'ui/blue-shell.webp', width: 512, format: 'webp', quality: 82 },
  { from: 'ui/blue-shell.png', to: 'ui/blue-shell.png', width: 256, format: 'png' },
  { from: 'ui/avatar-default.png', to: 'ui/avatar-default.webp', width: 256, format: 'webp', quality: 82 },
  { from: 'ui/avatar-default.png', to: 'ui/avatar-default.png', width: 256, format: 'png' },
  { from: 'ui/premio-1.png', to: 'ui/premio-1.webp', width: 512, format: 'webp', quality: 82 },
  { from: 'ui/premio-1.png', to: 'ui/premio-1.png', width: 512, format: 'png' },
  { from: 'ui/premio-2.png', to: 'ui/premio-2.webp', width: 512, format: 'webp', quality: 82 },
  { from: 'ui/premio-2.png', to: 'ui/premio-2.png', width: 512, format: 'png' },
  { from: 'ui/premio-3.png', to: 'ui/premio-3.webp', width: 512, format: 'webp', quality: 82 },
  { from: 'ui/premio-3.png', to: 'ui/premio-3.png', width: 512, format: 'png' },
]

/**
 * Los iconos de los modos, en mapa de bits.
 *
 * Mismo caso que el escudo: son SVG vectorizados desde imagen —hasta 25 kB
 * cada uno— y se pintan a 52 px en la Home y a 84 en las reglas. Los cinco
 * juntos eran 74 kB de los 719 de la portada.
 */
const MODOS = ['copa-perso', 'copa-tryhard', 'copa-random', 'copa-analisis', 'copa-aram-afk']
for (const m of MODOS) {
  jobs.push({ from: `modes/${m}.svg`, to: `modes/${m}.webp`, width: 200, format: 'webp', quality: 86 })
}

// Los SVG sueltos (modos, tiers, ui) se copian tal cual, sin tocar.
const passthroughDirs = ['modes', 'tiers', 'ui']

/**
 * Lo que vive en `assets/` pero no se publica.
 *
 * `blue-shell.svg` es la misma imagen que `blue-shell.png`, vectorizada: pesa
 * 210 kB —vectorizar un PNG deja miles de puntos por trazo— y no la carga
 * nadie. **El original no se toca**: es arte del host y sigue donde estaba;
 * simplemente no viaja al despliegue.
 */
const noPublicar = new Set([
  'ui/blue-shell.svg',
  // Los modos se sirven en webp, arriba. El SVG es el original y se queda en
  // assets/: publicarlo además sería mandar la misma imagen dos veces.
  ...MODOS.map((m) => `modes/${m}.svg`),
])

const kb = (n) => `${Math.round(n / 102.4) / 10} kB`

async function run() {
  const done = []
  const missing = []

  for (const job of jobs) {
    const from = join(src, job.from)
    const to = join(out, job.to)
    if (!existsSync(from)) { missing.push(job.from); continue }
    await mkdir(dirname(to), { recursive: true })

    if (job.copy && job.from.endsWith('.svg')) {
      const raw = await readFile(from, 'utf8')
      const { data } = optimize(raw, {
        multipass: true,
        floatPrecision: 1,
        plugins: [{ name: 'preset-default' }],
      })
      await writeFile(to, data)
    } else if (job.copy) {
      await copyFile(from, to)
    } else {
      let img = sharp(from)
      if (job.width || job.height) {
        img = img.resize(job.width, job.height, { fit: job.height ? 'cover' : 'inside', withoutEnlargement: true })
      }
      if (job.flatten) img = img.flatten({ background: '#070A18' })
      if (job.format === 'webp') img = img.webp({ quality: job.quality ?? 80 })
      if (job.format === 'jpeg') img = img.flatten({ background: '#070A18' }).jpeg({ quality: job.quality ?? 80, mozjpeg: true })
      if (job.format === 'png') img = img.png({ compressionLevel: 9, palette: true })
      await img.toFile(to)
    }
    done.push([job.to, (await stat(to)).size])
  }

  for (const dir of passthroughDirs) {
    const dirPath = join(src, dir)
    if (!existsSync(dirPath)) continue
    await mkdir(join(out, dir), { recursive: true })
    const conTrabajoPropio = new Set(jobs.map((j) => j.from))

    for (const file of await readdir(dirPath)) {
      if (file.startsWith('.')) continue
      // Lo que tiene su propio trabajo arriba ya salió con el tamaño correcto;
      // copiarlo aquí lo devolvería al original de 1,4 MB.
      if (conTrabajoPropio.has(`${dir}/${file}`)) continue
      if (noPublicar.has(`${dir}/${file}`)) continue
      const target = join(out, dir, file)

      if (file.endsWith('.svg')) {
        // Los SVG vectorizados desde PNG traen muchísimos decimales por punto.
        // Redondearlos baja el peso a la mitad sin que se note en pantalla.
        const raw = await readFile(join(dirPath, file), 'utf8')
        const { data } = optimize(raw, {
          multipass: true,
          floatPrecision: 1,
          plugins: [{ name: 'preset-default' }, 'removeDimensions'],
        })
        await writeFile(target, data)
      } else {
        await copyFile(join(dirPath, file), target)
      }

      done.push([`${dir}/${file}`, (await stat(target)).size])
    }
  }

  const total = done.reduce((a, [, s]) => a + s, 0)
  for (const [name, size] of done) console.log(`  ${name.padEnd(38)} ${kb(size).padStart(9)}`)
  console.log(`\n  ${done.length} archivos · ${kb(total)} en total`)

  if (missing.length) {
    console.log(`\n  Faltan por generar (${missing.length}):`)
    for (const m of missing) console.log(`    · assets/${m}`)
  }

  await writeFile(join(out, 'brand', '.generated'), `${new Date().toISOString()}\n`)
}

run().catch((err) => { console.error(err); process.exit(1) })
