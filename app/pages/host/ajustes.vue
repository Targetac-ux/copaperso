<script setup lang="ts">
import { REDES, enlaceDe, normalizarUrl } from '#shared/ajustes'
import type { EnlaceDeSitio, Red } from '#shared/ajustes'
import { CANAL_TWITCH, PAYPAL } from '#shared/enlaces'
import { formatSeconds, parseDuration } from '#shared/timer'

/**
 * Ajustes del panel (Fase 7).
 *
 * Tres cosas que hasta ahora exigían un despliegue: los precios de los canjeos,
 * los enlaces del sitio y la duración por defecto del cronómetro.
 *
 * Los precios ya tenían endpoint desde la Fase 3B —con su registro en la
 * bitácora y su deshacer— pero ninguna pantalla lo llamaba. Esto es esa
 * pantalla.
 */
definePageMeta({ layout: 'host' })
useSeoMeta({ title: 'Ajustes', robots: 'noindex' })

interface Precio {
  id: string
  code: string
  label: string
  cost_bits: number
  effective: number
}
interface Ajustes {
  enlaces: EnlaceDeSitio[]
  cronometro: number
}

const { data: ajustes, refresh: refrescarAjustes } = await useFetch<Ajustes>('/api/settings', {
  default: () => ({ enlaces: [], cronometro: 900 }),
})
const { data: catalogo, refresh: refrescarCatalogo } = await useFetch<{
  tripled: boolean
  actions: Precio[]
}>('/api/catalog', { default: () => ({ tripled: false, actions: [] }) })

const ocupado = ref(false)
const error = ref('')
const guardado = ref('')

/** El respaldo que usa la Home si no hay enlace guardado. */
const RESPALDO: Partial<Record<Red, string>> = { twitch: CANAL_TWITCH, paypal: PAYPAL }

/** Lo escrito en cada casilla, para no mandar una petición por tecla. */
const escrito = reactive<Record<string, string>>({})
watchEffect(() => {
  for (const r of REDES) escrito[r.red] = enlaceDe(ajustes.value.enlaces, r.red) ?? ''
})

const duracion = ref('')
watchEffect(() => {
  duracion.value = formatSeconds(ajustes.value.cronometro)
})

/** Lo que se guardaría: `null` si no es un enlace válido. */
const limpio = (red: Red) => normalizarUrl(escrito[red] ?? '', red)

async function llamar(fn: () => Promise<unknown>, aviso: string) {
  ocupado.value = true
  error.value = ''
  try {
    await fn()
    guardado.value = aviso
    setTimeout(() => (guardado.value = ''), 2500)
  } catch (e) {
    error.value = (e as { statusMessage?: string }).statusMessage ?? 'No se pudo guardar.'
  } finally {
    ocupado.value = false
  }
}

async function guardarPrecio(p: Precio, valor: string) {
  const bits = Number(valor)
  if (!Number.isFinite(bits) || bits < 0 || bits === p.cost_bits) return
  await llamar(async () => {
    await $fetch(`/api/catalog/${p.id}`, { method: 'PATCH', body: { cost_bits: Math.round(bits) } })
    await refrescarCatalogo()
  }, `${p.label}: ${Math.round(bits)} bits`)
}

async function guardarEnlace(red: Red) {
  const url = limpio(red)
  if (!url) return
  await llamar(async () => {
    ajustes.value = await $fetch<Ajustes>(`/api/settings/links/${red}`, {
      method: 'PUT',
      body: { url: escrito[red] },
    })
  }, 'Enlace guardado')
}

async function quitarEnlace(red: Red) {
  await llamar(async () => {
    ajustes.value = await $fetch<Ajustes>(`/api/settings/links/${red}`, { method: 'DELETE' })
  }, 'Enlace quitado')
}

const segundos = computed(() => parseDuration(duracion.value))

async function guardarCronometro() {
  if (segundos.value === null) return
  await llamar(async () => {
    ajustes.value = await $fetch<Ajustes>('/api/settings', {
      method: 'PATCH',
      body: { cronometro: segundos.value },
    })
    await refrescarAjustes()
  }, 'Duración guardada')
}
</script>

<template>
  <section class="ajustes">
    <header class="cab">
      <h1>Ajustes</h1>
      <span v-if="guardado" class="ok">{{ guardado }}</span>
    </header>

    <p v-if="error" class="alert alert--error">{{ error }}</p>

    <!-- ── Precios ─────────────────────────────────────────────────── -->
    <section class="card">
      <h2>Precios de los canjeos</h2>
      <p class="pista">
        Rigen para el mes en curso. <strong>Cambiar un precio no reescribe lo ya cobrado</strong>:
        cada canjeo guarda lo que costó cuando se registró.
      </p>

      <p v-if="catalogo.tripled" class="alert alert--warn">
        La sesión abierta está con los precios al triple. Lo que se ve en la mesa es el triple de
        estos números, no lo que escribas aquí.
      </p>

      <ul v-if="catalogo.actions.length" class="precios">
        <li v-for="p in catalogo.actions" :key="p.id">
          <span class="precios__nom">{{ p.label }}</span>
          <input
            type="number"
            min="0"
            step="10"
            :value="p.cost_bits"
            :disabled="ocupado"
            :aria-label="`Precio de ${p.label}`"
            @change="guardarPrecio(p, ($event.target as HTMLInputElement).value)"
          >
          <span class="precios__u">bits</span>
        </li>
      </ul>
      <p v-else class="estado">
        No hay catálogo: abre un periodo en <NuxtLink to="/host/periodos">Periodos</NuxtLink> y se
        siembra solo.
      </p>
    </section>

    <!-- ── Enlaces ─────────────────────────────────────────────────── -->
    <section class="card">
      <h2>Enlaces y redes</h2>
      <p class="pista">
        Pega la dirección completa o el usuario con <code>@</code>. Lo que dejes vacío no sale en la
        web: <strong>una fila de iconos muertos es peor que no tenerla</strong>.
      </p>

      <ul class="enlaces">
        <li v-for="r in REDES" :key="r.red" :class="{ 'es-principal': r.principal }">
          <span class="enlaces__marca">
            <AppBrandIcon :name="r.red" :size="18" />
            {{ r.label }}
          </span>

          <input
            v-model="escrito[r.red]"
            type="text"
            :placeholder="r.principal ? RESPALDO[r.red] : r.base"
            :disabled="ocupado"
            :aria-label="`Enlace de ${r.label}`"
            @keyup.enter="guardarEnlace(r.red)"
          >

          <button
            class="btn btn--ghost"
            :disabled="ocupado || !limpio(r.red)"
            @click="guardarEnlace(r.red)"
          >
            Guardar
          </button>
          <button
            class="btn btn--ghost es-peligro"
            :disabled="ocupado || !enlaceDe(ajustes.enlaces, r.red)"
            @click="quitarEnlace(r.red)"
          >
            Quitar
          </button>

          <span v-if="escrito[r.red] && !limpio(r.red)" class="mal">No es un enlace válido</span>
        </li>
      </ul>

      <p class="pista">
        Twitch y PayPal tienen su propio botón en la Home, así que si los dejas vacíos se usa el
        enlace de siempre en vez de esconder el botón.
      </p>
    </section>

    <!-- ── Cronómetro ──────────────────────────────────────────────── -->
    <section class="card">
      <h2>Cronómetro</h2>
      <p class="pista">
        Con cuánto tiempo empieza la negociación al abrir una copa. Admite <code>15</code>,
        <code>90s</code> o <code>12:30</code>.
      </p>

      <div class="crono">
        <label>
          Duración
          <input
            v-model="duracion"
            type="text"
            :disabled="ocupado"
            @keyup.enter="guardarCronometro"
          >
        </label>
        <span class="crono__leido">
          {{ segundos === null ? 'No se entiende' : formatSeconds(segundos) }}
        </span>
        <button
          class="btn btn--primary"
          :disabled="ocupado || segundos === null"
          @click="guardarCronometro"
        >
          Guardar
        </button>
      </div>

      <p class="pista">
        <strong>Solo afecta a las copas nuevas.</strong> La que esté abierta conserva su duración.
      </p>
    </section>
  </section>
</template>

<style scoped>
.ajustes {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.cab {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cab h1 {
  font-family: var(--f-display);
  font-size: 22px;
  margin: 0;
}

.ok {
  font-size: 12.5px;
  color: #7be0a0;
}

.card {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--r);
  padding: 18px 20px;
}

.card h2 {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 8px;
}

.pista,
.estado {
  margin: 0 0 12px;
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--dim);
  max-width: 72ch;
}

.pista:last-child {
  margin: 12px 0 0;
}

strong {
  color: var(--muted);
}

code {
  font-family: var(--f-mono);
  background: var(--panel-3);
  border-radius: 3px;
  padding: 1px 5px;
}

input {
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  padding: 8px 10px;
  color: var(--text);
  font: inherit;
  font-size: 13.5px;
  min-width: 0;
}

.precios,
.enlaces {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.precios li {
  display: flex;
  align-items: center;
  gap: 10px;
}

.precios__nom {
  flex: 1;
  font-size: 13.5px;
  color: var(--muted);
}

.precios input {
  width: 100px;
  text-align: right;
  font-family: var(--f-mono);
}

.precios__u {
  font-family: var(--f-mono);
  font-size: 11px;
  color: var(--dim);
  width: 3ch;
}

.enlaces li {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

/* Twitch y PayPal van marcadas: si faltan, la Home cae al enlace de siempre
   en vez de esconder el botón. */
.enlaces li.es-principal .enlaces__marca {
  color: var(--text);
}

.enlaces__marca {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: 120px;
  flex: none;
  font-size: 13.5px;
  color: var(--muted);
}

.enlaces input {
  flex: 1;
  min-width: 220px;
}

.mal {
  font-size: 12px;
  color: var(--danger);
}

.crono {
  display: flex;
  align-items: flex-end;
  gap: 12px;
}

.crono label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 12px;
  color: var(--muted);
}

.crono input {
  width: 140px;
}

.crono__leido {
  font-family: var(--f-mono);
  font-size: 13px;
  color: var(--dim);
  padding-bottom: 9px;
}

.es-peligro:hover:not(:disabled) {
  border-color: var(--danger);
  color: var(--danger);
}

@media (max-width: 800px) {
  .enlaces__marca {
    width: 100%;
  }

  .enlaces input {
    min-width: 0;
  }
}
</style>
