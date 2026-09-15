<script setup lang="ts">
import { MAX_EN_HOME, cambios, mover, slugDeUrl, urlDeClip, urlDeIncrustado } from '#shared/clips'
import type { Clip } from '#shared/clips'

/**
 * Los clips de la Home.
 *
 * El host pega el enlace que le da el botón de compartir de Twitch y escribe de
 * qué va. **El título lo pone él**: no hay credenciales de la API de Twitch en
 * el proyecto, y tampoco hacen falta, porque quien sabe qué pasó en ese clip es
 * quien estaba ahí.
 *
 * La previsualización se monta en cuanto el enlace es válido, antes de guardar
 * nada: es la única forma de comprobar de un vistazo que el clip es el que se
 * cree y que Twitch lo deja incrustar en este dominio.
 */
definePageMeta({ layout: 'host' })
useSeoMeta({ title: 'Clips', robots: 'noindex' })

const { data, refresh, error: errorCarga } = await useFetch<Clip[]>('/api/clips', {
  default: () => [],
})

const url = ref('')
const titulo = ref('')
const edicion = ref('')
const ocupado = ref(false)
const error = ref('')

const dominio = ref('')
onMounted(() => {
  dominio.value = window.location.hostname
})

const slug = computed(() => slugDeUrl(url.value))
const previa = computed(() =>
  slug.value && dominio.value ? urlDeIncrustado(slug.value, dominio.value) : null,
)

const visibles = computed(() => data.value.filter((c) => c.visible))
const sobran = computed(() => Math.max(0, visibles.value.length - MAX_EN_HOME))

async function llamar(fn: () => Promise<Clip[]>) {
  ocupado.value = true
  error.value = ''
  try {
    data.value = await fn()
  } catch (err) {
    error.value = (err as { statusMessage?: string }).statusMessage ?? 'No se pudo guardar.'
    await refresh()
  } finally {
    ocupado.value = false
  }
}

async function anadir() {
  if (!slug.value || !titulo.value.trim()) return
  const cuerpo = { url: url.value, title: titulo.value, edition: edicion.value || null }
  await llamar(() => $fetch<Clip[]>('/api/clips', { method: 'POST', body: cuerpo }))
  if (!error.value) {
    url.value = ''
    titulo.value = ''
    // La edición se queda puesta: se suelen añadir varios clips de la misma.
  }
}

async function ordenar(id: string, direccion: -1 | 1) {
  const antes = data.value
  const despues = mover(antes, id, direccion)
  const lista = cambios(antes, despues)
  if (!lista.length) return

  data.value = despues
  await llamar(() => $fetch<Clip[]>('/api/clips/order', { method: 'PATCH', body: { cambios: lista } }))
}

const cambiar = (id: string, campos: Record<string, unknown>) =>
  llamar(() => $fetch<Clip[]>(`/api/clips/${id}`, { method: 'PATCH', body: campos }))

async function quitar(clip: Clip) {
  if (!confirm(`¿Quitar «${clip.title}» de la Home?`)) return
  await llamar(() => $fetch<Clip[]>(`/api/clips/${clip.id}`, { method: 'DELETE' }))
}
</script>

<template>
  <section class="clips">
    <header class="cab">
      <h1>Clips</h1>
      <span class="cuenta">{{ visibles.length }} en la Home</span>
      <span class="hueco" />
      <NuxtLink class="btn btn--ghost" to="/" target="_blank">Ver la Home</NuxtLink>
    </header>

    <p v-if="errorCarga" class="alert alert--error">
      No se pudo leer la lista de clips: {{ errorCarga.statusMessage ?? errorCarga.message }}
    </p>
    <p v-if="error" class="alert alert--error">{{ error }}</p>
    <p v-if="sobran" class="alert alert--warn">
      Hay {{ visibles.length }} clips visibles y en la Home solo caben {{ MAX_EN_HOME }}.
      Los {{ sobran }} de más se quedan fuera: súbelos si quieres que salgan.
    </p>

    <section class="nuevo">
      <h2>Añadir un clip</h2>

      <div class="nuevo__campos">
        <label>
          Enlace del clip
          <input
            v-model="url"
            type="url"
            placeholder="https://clips.twitch.tv/…"
            :disabled="ocupado"
          >
        </label>
        <label>
          Título
          <input
            v-model="titulo"
            type="text"
            maxlength="120"
            placeholder="La remontada imposible"
            :disabled="ocupado"
          >
        </label>
        <label class="es-corto">
          Edición <i>(opcional)</i>
          <input
            v-model="edicion"
            type="text"
            maxlength="60"
            placeholder="CopaPerso #12"
            :disabled="ocupado"
          >
        </label>
        <button
          class="btn btn--primary"
          :disabled="ocupado || !slug || !titulo.trim()"
          @click="anadir"
        >
          Añadir
        </button>
      </div>

      <p v-if="url && !slug" class="pista pista--mal">
        Eso no parece un clip de Twitch. Pega el enlace que da el botón de compartir del clip.
      </p>
      <p v-else-if="!url" class="pista">
        Vale tanto <code>clips.twitch.tv/…</code> como <code>twitch.tv/canal/clip/…</code>.
      </p>

      <div v-if="previa" class="previa">
        <iframe :src="previa" title="Previsualización del clip" allowfullscreen />
        <p class="pista">
          Si aquí se ve el clip, en la Home también. Si sale un aviso de Twitch, es que no
          permite incrustarlo en este dominio.
        </p>
      </div>
    </section>

    <p v-if="!data.length" class="estado">
      Todavía no hay ningún clip. El apartado no sale en la Home hasta que añadas el primero.
    </p>

    <ul v-else class="lista">
      <li v-for="(clip, i) in data" :key="clip.id" :class="{ 'is-oculto': !clip.visible }">
        <div class="orden">
          <button :disabled="ocupado || i === 0" title="Subir" @click="ordenar(clip.id, -1)">↑</button>
          <span>{{ i + 1 }}</span>
          <button
            :disabled="ocupado || i === data.length - 1"
            title="Bajar"
            @click="ordenar(clip.id, 1)"
          >↓</button>
        </div>

        <div class="datos">
          <input
            class="datos__titulo"
            type="text"
            maxlength="120"
            :value="clip.title"
            :disabled="ocupado"
            @change="cambiar(clip.id, { title: ($event.target as HTMLInputElement).value })"
          >
          <input
            class="datos__edicion"
            type="text"
            maxlength="60"
            placeholder="Sin edición"
            :value="clip.edition ?? ''"
            :disabled="ocupado"
            @change="cambiar(clip.id, { edition: ($event.target as HTMLInputElement).value })"
          >
          <a class="datos__slug" :href="urlDeClip(clip.slug)" target="_blank" rel="noopener">
            {{ clip.slug }}
          </a>
        </div>

        <div class="acciones">
          <button class="btn btn--ghost" :disabled="ocupado" @click="cambiar(clip.id, { visible: !clip.visible })">
            {{ clip.visible ? 'Ocultar' : 'Enseñar' }}
          </button>
          <button class="btn btn--ghost es-peligro" :disabled="ocupado" @click="quitar(clip)">
            Quitar
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.clips {
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

.cuenta,
.estado,
.pista {
  color: var(--dim);
  font-size: 12.5px;
}

.hueco {
  flex: 1;
}

.nuevo {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--r);
  padding: 16px 18px;
}

.nuevo h2 {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 12px;
}

.nuevo__campos {
  display: grid;
  grid-template-columns: 2fr 2fr 1.2fr auto;
  gap: 10px;
  align-items: end;
}

label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 12px;
  color: var(--muted);
}

label i {
  font-style: normal;
  color: var(--dim);
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

.pista {
  margin: 10px 0 0;
}

.pista--mal {
  color: var(--danger, #ff8080);
}

code {
  font-family: var(--f-mono);
  font-size: 11.5px;
}

.previa {
  margin-top: 14px;
  max-width: 420px;
}

.previa iframe {
  width: 100%;
  aspect-ratio: 16 / 9;
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  display: block;
}

.lista {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.lista li {
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--r);
  padding: 10px 14px;
}

/* Oculto se ve apagado, pero legible: sigue estando en la lista a propósito. */
.lista li.is-oculto {
  opacity: 0.5;
}

.orden {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  font-family: var(--f-mono);
  font-size: 11px;
  color: var(--dim);
}

.orden button {
  background: none;
  border: 0;
  color: var(--muted);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 1px 6px;
}

.orden button:disabled {
  opacity: 0.25;
  cursor: default;
}

.datos {
  flex: 1;
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 4px 10px;
  min-width: 0;
}

.datos__titulo {
  font-weight: 600;
}

.datos__slug {
  grid-column: 1 / -1;
  font-family: var(--f-mono);
  font-size: 10.5px;
  color: var(--dim);
  text-decoration: none;
  overflow-wrap: anywhere;
}

.datos__slug:hover {
  color: var(--violet);
}

.acciones {
  display: flex;
  gap: 8px;
  flex: none;
}

.es-peligro:hover {
  border-color: var(--danger, #ff8080);
  color: var(--danger, #ff8080);
}

@media (max-width: 900px) {
  .nuevo__campos {
    grid-template-columns: 1fr;
  }

  .lista li {
    flex-wrap: wrap;
  }
}
</style>
