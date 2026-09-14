/**
 * Prueba de carga de la vista en vivo (prueba 4 de cierre de la Fase 4B).
 *
 * Abre N espectadores de verdad contra el canal de broadcast, publica un
 * estado y mide cuántos lo reciben y en cuánto tiempo.
 *
 *   node scripts/carga-en-vivo.mjs 200
 *   node scripts/carga-en-vivo.mjs 200 60    # y los mantiene 60 s conectados
 *
 * El segundo argumento sirve para comprobar la otra mitad de la prueba: que el
 * panel del host siga igual de rápido con la grada llena.
 *
 * No va en la suite de e2e a propósito: abre cientos de websockets contra el
 * proyecto real y gasta cuota. Se lanza a mano cuando se quiere comprobar.
 *
 * Medido el 14-09-2026 contra el proyecto real:
 *   200 espectadores → conectan los 200 y reciben el aviso en 174 ms de mediana.
 *   Con esos 200 puestos, el 201 ya NO conecta: se queda en «Sin conexión».
 * O sea que 200 es justo el techo del plan de Supabase contratado, no un número
 * con margen. Si la grada puede pasar de ahí, hace falta plan mayor.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const CANAL = 'copaperso-en-vivo'
const cuantos = Number(process.argv[2] ?? 200)
const aguantar = Number(process.argv[3] ?? 0)

function env() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY) return process.env
  const file = readFileSync(new URL('../.env', import.meta.url), 'utf8')
  return Object.fromEntries(
    file
      .split('\n')
      .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
      .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
  )
}

const e = env()
const publicable = e.SUPABASE_PUBLISHABLE_KEY || e.SUPABASE_KEY

console.log(`Abriendo ${cuantos} espectadores…`)

const espectadores = []
let conectados = 0
let fallos = 0
const recibidos = []
let publicadoEn = 0

for (let i = 0; i < cuantos; i++) {
  const cliente = createClient(e.SUPABASE_URL, publicable, {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 20 } },
  })

  const canal = cliente.channel(CANAL)
  canal
    .on('broadcast', { event: 'estado' }, () => {
      if (publicadoEn) recibidos.push(Date.now() - publicadoEn)
    })
    .subscribe((estado) => {
      if (estado === 'SUBSCRIBED') conectados++
      else if (estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT') fallos++
    })

  espectadores.push({ cliente, canal })

  // Escalonado: 200 saludos a la vez los rechaza el propio servidor.
  if (i % 25 === 24) await new Promise((r) => setTimeout(r, 250))
}

// Margen para que terminen de conectar.
for (let i = 0; i < 40 && conectados + fallos < cuantos; i++) {
  await new Promise((r) => setTimeout(r, 500))
}

console.log(`Conectados: ${conectados} · fallidos: ${fallos} · sin responder: ${cuantos - conectados - fallos}`)

if (conectados === 0) {
  console.log('Ningún espectador conectó: no se puede medir la difusión.')
  process.exit(1)
}

const emisor = createClient(e.SUPABASE_URL, e.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
})

publicadoEn = Date.now()
const r = await emisor.channel(CANAL).httpSend('estado', {
  hay: true,
  sesion: { number: 0, mode: 'perso' },
  equipos: [],
  banca: [],
  marcador: { t1: 0, t2: 0 },
  partida: null,
  cronometro: { endsAt: null, remaining: null, seconds: 900, running: false },
  preciosTriplicados: false,
  ultimaAccion: 'prueba de carga',
  at: new Date().toISOString(),
})

console.log('Publicado:', r.success ? 'ok' : `error ${r.status} ${r.error}`)

await new Promise((r) => setTimeout(r, 4000))

recibidos.sort((a, b) => a - b)
const pct = (p) => recibidos[Math.min(recibidos.length - 1, Math.floor((recibidos.length * p) / 100))]

console.log(`Lo recibieron ${recibidos.length} de ${conectados} conectados`)
if (recibidos.length) {
  console.log(`  el primero: ${recibidos[0]} ms`)
  console.log(`  mediana:    ${pct(50)} ms`)
  console.log(`  el último:  ${recibidos[recibidos.length - 1]} ms`)
}

if (aguantar > 0) {
  console.log(`Manteniendo ${conectados} espectadores ${aguantar} s…`)
  await new Promise((r) => setTimeout(r, aguantar * 1000))
}

for (const { cliente } of espectadores) await cliente.removeAllChannels()
process.exit(0)
