<script setup lang="ts">
import {
  contarCambios,
  idDeYoutube,
  leerCuerpo,
  miniaturaDeYoutube,
  urlDeYoutube,
} from '#shared/patchnotes'
import type { PatchNote } from '#shared/patchnotes'

/**
 * Los patch notes de las reglas.
 *
 * Se escribe una línea por cambio. **Una línea que empieza por `+ ` es algo que
 * entra y una que empieza por `- ` es algo que sale**; el resto es texto normal.
 * Es la convención de los changelogs de siempre y no obliga a aprender ningún
 * formato: se escribe la lista y ya.
 *
 * **El detalle va en un vídeo.** El host graba cada parche y lo explica ahí, así
 * que lo escrito aquí es el resumen para leer de un vistazo. El vídeo es
 * opcional: un parche de dos líneas no necesita uno.
 *
 * Nace **sin publicar**, y se ve tal cual quedará antes de sacarlo. A diferencia
 * de una edición del Tier Ranking, publicar no lo congela: si trae una errata se
 * corrige donde está.
 */
definePageMeta({ layout: 'host' })
useSeoMeta({ title: 'Patch notes', robots: 'noindex' })

const { data, refresh, error: errorCarga } = await useFetch<PatchNote[]>('/api/patch-notes', {
  default: () => [],
})

const titulo = ref('')
const version = ref('')
const ocupado = ref(false)
const error = ref('')
const abierto = ref<string | null>(null)

/** Lo que se está escribiendo, sin mandarlo en cada tecla. */
const borrador = ref('')
const video = ref('')

/** El id que se guardaría, para enseñar la portada antes de darle a guardar. */
const idVideo = computed(() => idDeYoutube(video.value))

async function llamar(fn: () => Promise<PatchNote[]>) {
  ocupado.value = true
  error.value = ''
  try {
    data.value = await fn()
  } catch (e) {
    error.value = (e as { statusMessage?: string }).statusMessage ?? 'No se pudo guardar.'
    await refresh()
  } finally {
    ocupado.value = false
  }
}

async function crear() {
  if (!titulo.value.trim()) return
  await llamar(() =>
    $fetch<PatchNote[]>('/api/patch-notes', {
      method: 'POST',
      body: { title: titulo.value, version: version.value || null },
    }),
  )
  if (!error.value) {
    titulo.value = ''
    version.value = ''
  }
}

function abrir(p: PatchNote) {
  if (abierto.value === p.id) {
    abierto.value = null
    return
  }
  abierto.value = p.id
  borrador.value = p.body
  // El enlace entero y no el id: es lo que el host reconoce de un vistazo.
  video.value = p.videoId ? urlDeYoutube(p.videoId) : ''
}

const guardar = (p: PatchNote, campos: Record<string, unknown>) =>
  llamar(() => $fetch<PatchNote[]>(`/api/patch-notes/${p.id}`, { method: 'PATCH', body: campos }))

async function borrar(p: PatchNote) {
  if (!confirm(`¿Borrar el parche «${p.title}»?`)) return
  if (abierto.value === p.id) abierto.value = null
  await llamar(() => $fetch<PatchNote[]>(`/api/patch-notes/${p.id}`, { method: 'DELETE' }))
}

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
</script>

<template>
  <section class="patch">
    <header class="cab">
      <h1>Patch notes</h1>
      <span class="cuenta">{{ data.filter((p) => p.publishedAt).length }} publicados</span>
      <span class="hueco" />
      <NuxtLink class="btn btn--ghost" to="/patch-notes" target="_blank">Ver en la web</NuxtLink>
    </header>

    <p v-if="errorCarga" class="alert alert--error">
      No se pudo leer la lista: {{ errorCarga.statusMessage ?? errorCarga.message }}
    </p>
    <p v-if="error" class="alert alert--error">{{ error }}</p>

    <section class="nuevo">
      <h2>Nuevo parche</h2>
      <div class="nuevo__campos">
        <label>
          Título
          <input
            v-model="titulo"
            type="text"
            maxlength="120"
            placeholder="Ajustes al Blue Shell"
            :disabled="ocupado"
            @keyup.enter="crear"
          >
        </label>
        <label class="es-corto">
          Versión <i>(opcional)</i>
          <input v-model="version" type="text" maxlength="40" placeholder="v3" :disabled="ocupado">
        </label>
        <button class="btn btn--primary" :disabled="ocupado || !titulo.trim()" @click="crear">
          Crear
        </button>
      </div>
      <p class="pista">
        Nace sin publicar. Escribe los cambios y publícalo cuando esté listo.
      </p>
    </section>

    <p v-if="!data.length" class="estado">
      Todavía no hay ningún parche. Hasta que publiques el primero, en la web solo están las reglas.
    </p>

    <ul v-else class="lista">
      <li v-for="p in data" :key="p.id" :class="{ 'is-borrador': !p.publishedAt }">
        <div class="fila">
          <button class="fila__abrir" :aria-expanded="abierto === p.id" @click="abrir(p)">
            <span class="flecha" aria-hidden="true">{{ abierto === p.id ? '▾' : '▸' }}</span>
            <b>{{ p.title }}</b>
            <span v-if="p.version" class="version">{{ p.version }}</span>
            <span class="resumen">
              <i class="mas">+{{ contarCambios(p.body).añade }}</i>
              <i class="menos">−{{ contarCambios(p.body).quita }}</i>
              <i v-if="p.videoId" class="tiene-video" title="Lleva vídeo">▶</i>
            </span>
            <span class="cuando">{{ p.publishedAt ? fecha(p.publishedAt) : 'sin publicar' }}</span>
          </button>

          <button
            class="btn btn--ghost"
            :disabled="ocupado"
            @click="guardar(p, { publicado: !p.publishedAt })"
          >
            {{ p.publishedAt ? 'Retirar' : 'Publicar' }}
          </button>
          <button class="btn btn--ghost es-peligro" :disabled="ocupado" @click="borrar(p)">
            Borrar
          </button>
        </div>

        <div v-if="abierto === p.id" class="editor">
          <label>
            Título
            <input
              type="text"
              maxlength="120"
              :value="p.title"
              :disabled="ocupado"
              @change="guardar(p, { title: ($event.target as HTMLInputElement).value })"
            >
          </label>

          <label>
            Los cambios
            <textarea
              v-model="borrador"
              rows="9"
              :disabled="ocupado"
              placeholder="+ El Blue Shell ahora cuesta 500 bits&#10;- Se quita el cambio de rol gratis&#10;&#10;Texto suelto para explicar algo"
            />
          </label>

          <label>
            Vídeo de YouTube <i>(opcional)</i>
            <input
              v-model="video"
              type="text"
              placeholder="https://youtu.be/…"
              :disabled="ocupado"
            >
          </label>

          <p v-if="video && !idVideo" class="pista pista--mal">
            Eso no parece un vídeo de YouTube. Pega el enlace que da «Compartir».
          </p>

          <div class="editor__pie">
            <p class="pista">
              Una línea por cambio. <code>+ </code> para lo que entra, <code>- </code> para lo que
              sale; el resto es texto normal.
            </p>
            <button
              class="btn btn--primary"
              :disabled="
                ocupado ||
                  (borrador === p.body && idVideo === p.videoId) ||
                  (!!video && !idVideo)
              "
              @click="guardar(p, { body: borrador, video })"
            >
              Guardar
            </button>
          </div>

          <div v-if="borrador.trim() || idVideo" class="previa">
            <p class="etq">Así se verá</p>

            <img
              v-if="idVideo"
              class="previa__video"
              :src="miniaturaDeYoutube(idVideo)"
              :alt="''"
              width="320"
              height="240"
            >

            <ul class="cambios">
              <li v-for="(l, i) in leerCuerpo(borrador)" :key="i" :class="`es-${l.tipo}`">
                <span v-if="l.tipo !== 'texto'" class="signo" aria-hidden="true">
                  {{ l.tipo === 'añade' ? '+' : '−' }}
                </span>
                <span>{{ l.texto }}</span>
              </li>
            </ul>
          </div>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.patch {
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
  grid-template-columns: 1fr 200px auto;
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

input,
textarea {
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  padding: 8px 10px;
  color: var(--text);
  font: inherit;
  font-size: 13.5px;
  min-width: 0;
}

textarea {
  font-family: var(--f-mono);
  font-size: 13px;
  line-height: 1.6;
  resize: vertical;
}

.pista {
  margin: 10px 0 0;
}

code {
  font-family: var(--f-mono);
  background: var(--panel-3);
  border-radius: 3px;
  padding: 1px 4px;
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
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--r);
}

/* Un borrador se ve apagado: está ahí, pero no lo lee nadie todavía. */
.lista li.is-borrador {
  border-style: dashed;
}

.fila {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
}

.fila__abrir {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  background: none;
  border: 0;
  padding: 4px 0;
  color: var(--text);
  font: inherit;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  min-width: 0;
}

.flecha {
  color: var(--dim);
  font-size: 11px;
  width: 1ch;
  flex: none;
}

.version {
  font-family: var(--f-mono);
  font-size: 10.5px;
  color: var(--violet);
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 1px 8px;
  flex: none;
}

.resumen {
  display: inline-flex;
  gap: 8px;
  font-family: var(--f-mono);
  font-size: 11.5px;
  flex: none;
}

.mas { color: #7be0a0; }
.menos { color: #ff8da0; }
.tiene-video { color: var(--violet); }

.cuando {
  margin-left: auto;
  font-size: 12px;
  color: var(--dim);
  flex: none;
}

.editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 14px 16px;
  border-top: 1px solid var(--line-soft);
  margin-top: 4px;
  padding-top: 14px;
}

.editor__pie {
  display: flex;
  align-items: center;
  gap: 14px;
}

.editor__pie .pista {
  margin: 0;
  flex: 1;
}

.previa {
  background: var(--panel-2);
  border-radius: var(--r-sm);
  padding: 12px 14px;
}

.etq {
  margin: 0 0 8px;
  font-family: var(--f-mono);
  font-size: 9.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--dim);
}

.previa__video {
  width: 200px;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  border-radius: var(--r-sm);
  border: 1px solid var(--line);
  display: block;
  margin-bottom: 10px;
}

.pista--mal {
  color: var(--danger);
}

.cambios {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cambios li {
  display: flex;
  gap: 9px;
  font-size: 13.5px;
  line-height: 1.5;
  color: var(--muted);
  background: none;
  border: 0;
  border-radius: 0;
}

.signo {
  font-family: var(--f-mono);
  font-weight: 700;
  flex: none;
  width: 1ch;
}

.es-añade .signo { color: #7be0a0; }
.es-quita .signo { color: #ff8da0; }
.es-texto { color: var(--dim); }

.es-peligro:hover {
  border-color: var(--danger);
  color: var(--danger);
}

@media (max-width: 900px) {
  .nuevo__campos {
    grid-template-columns: 1fr;
  }

  .fila {
    flex-wrap: wrap;
  }
}
</style>
