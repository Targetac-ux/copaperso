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
  { from: 'brand/isotipo.svg', to: 'brand/isotipo.svg', copy: true },
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
  // La versión cuadrada sirve para avatares de Twitch, Discord e Instagram.
  { from: 'brand/keyart-cuadrado.png', to: 'brand/keyart-cuadrado.webp', width: 800, format: 'webp', quality: 80, flatten: true },

  // El trofeo del hero: webp con alfa + png de respaldo.
  { from: 'brand/trofeo-hero.png', to: 'brand/trofeo-hero.webp', width: 1000, format: 'webp', quality: 82 },
  { from: 'brand/trofeo-hero.png', to: 'brand/trofeo-hero.png', width: 1000, format: 'png' },
  // og-image: 1200x630 exacto y en jpeg, que es lo que leen todos los scrapers.
  { from: 'brand/og-image.png', to: 'brand/og-image.jpg', width: 1200, height: 630, format: 'jpeg', quality: 82 },

  // --- fondos ------------------------------------------------------------
  { from: 'backgrounds/hero-bg.jpg', to: 'backgrounds/hero-bg.webp', width: 1920, format: 'webp', quality: 70 },
  { from: 'backgrounds/hero-bg.jpg', to: 'backgrounds/hero-bg.jpg', width: 1920, format: 'jpeg', quality: 74 },
  { from: 'backgrounds/textura.png', to: 'backgrounds/textura.webp', width: 600, format: 'webp', quality: 60 },
]

// Los SVG sueltos (modos, tiers, ui) se copian tal cual, sin tocar.
const passthroughDirs = ['modes', 'tiers', 'ui', 'sponsors']

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
    for (const file of await readdir(dirPath)) {
      if (file.startsWith('.')) continue
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
