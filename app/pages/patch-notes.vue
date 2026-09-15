<script setup lang="ts">
import {
  incrustadoDeYoutube,
  leerCuerpo,
  miniaturaDeYoutube,
  urlDeYoutube,
} from '#shared/patchnotes'
import type { PatchNote } from '#shared/patchnotes'

/**
 * Los patch notes, con sección propia.
 *
 * Estaban dentro de Reglas como una pestaña, y se mudaron aquí porque van a ser
 * muchos: las reglas son un texto que se lee una vez y los parches son una
 * lista que crece. En Reglas se quedan las reglas y los modos.
 *
 * **El detalle vive en el vídeo.** El host graba cada parche y lo explica ahí,
 * así que lo escrito es el resumen y el vídeo la versión completa.
 *
 * El reproductor **no se carga hasta que alguien le da al play**: se enseña la
 * portada del vídeo y un botón. Con varios parches en la página, montar todos
 * los reproductores de golpe sería la parte más pesada de la web, y la mayoría
 * no se verían.
 */
useSeoMeta({
  title: 'Patch notes',
  description:
    'Las notas de parche de la CopaPerso: qué cambia en las reglas, cuándo, y el vídeo donde se ' +
    'explica cada cambio.',
})

const { data: parches } = await useFetch<PatchNote[]>('/api/public/patch-notes', {
  default: () => [],
})

/** Los que ya se han abierto: el reproductor solo existe para estos. */
const reproduciendo = ref<Set<string>>(new Set())
const reproducir = (id: string) => (reproduciendo.value = new Set(reproduciendo.value).add(id))

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
</script>

<template>
  <div class="wrap notas">
    <header class="notas__cab">
      <p class="eyebrow">Qué ha cambiado</p>
      <h1>Patch notes</h1>
      <p class="notas__lede">
        Las reglas se mueven. Cada vez que se añade o se quita algo queda aquí, con su fecha y con
        el vídeo donde se explica.
      </p>
    </header>

    <p v-if="!parches.length" class="vacio">
      Todavía no hay ningún parche publicado. Las reglas son
      <NuxtLink to="/reglas">las que hay</NuxtLink>, tal cual.
    </p>

    <article v-for="p in parches" :key="p.id" class="parche">
      <header>
        <h2>{{ p.title }}</h2>
        <span v-if="p.version" class="version">{{ p.version }}</span>
        <time v-if="p.publishedAt" :datetime="p.publishedAt">{{ fecha(p.publishedAt) }}</time>
      </header>

      <div class="parche__cuerpo" :class="{ 'con-video': !!p.videoId }">
        <ul v-if="leerCuerpo(p.body).length" class="cambios">
          <li v-for="(l, i) in leerCuerpo(p.body)" :key="i" :class="`es-${l.tipo}`">
            <span v-if="l.tipo !== 'texto'" class="signo" aria-hidden="true">
              {{ l.tipo === 'añade' ? '+' : '−' }}
            </span>
            <span>{{ l.texto }}</span>
          </li>
        </ul>
        <p v-else class="sin-texto">Todo el detalle está en el vídeo.</p>

        <!-- La portada primero; el reproductor solo si le dan al play. -->
        <div v-if="p.videoId" class="video">
          <iframe
            v-if="reproduciendo.has(p.id)"
            :src="incrustadoDeYoutube(p.videoId, true)"
            :title="`Vídeo del parche: ${p.title}`"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
            allowfullscreen
          />
          <button v-else type="button" class="video__play" @click="reproducir(p.id)">
            <img
              :src="miniaturaDeYoutube(p.videoId)"
              :alt="''"
              width="480"
              height="360"
              loading="lazy"
            >
            <span class="video__boton" aria-hidden="true">▶</span>
            <span class="sr">Ver el vídeo del parche {{ p.title }}</span>
          </button>

          <a class="video__enlace" :href="urlDeYoutube(p.videoId)" target="_blank" rel="noopener">
            Verlo en YouTube
          </a>
        </div>
      </div>
    </article>
  </div>
</template>

<style scoped>
.notas {
  padding-block: 40px 64px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.notas__cab {
  text-align: center;
}

.eyebrow {
  font-family: var(--f-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--violet-txt);
  margin: 0 0 6px;
}

h1 {
  font-family: var(--f-display);
  font-size: clamp(26px, 4vw, 40px);
  margin: 0;
}

.notas__lede {
  color: var(--muted);
  font-size: 15px;
  line-height: 1.6;
  max-width: 56ch;
  margin: 10px auto 0;
}

.vacio {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--r);
  padding: 28px 24px;
  text-align: center;
  color: var(--dim);
  font-size: 15px;
  margin: 0;
}

.vacio a {
  color: var(--violet-txt);
}

.parche {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--r);
  padding: 22px 26px;
}

.parche header {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.parche h2 {
  font-family: var(--f-display);
  font-size: 20px;
  margin: 0;
}

.version {
  font-family: var(--f-mono);
  font-size: 11px;
  color: var(--violet-txt);
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 2px 9px;
}

.parche time {
  margin-left: auto;
  font-size: 12.5px;
  color: var(--dim);
}

/* Con vídeo, el texto a un lado y la portada al otro; sin vídeo, el texto se
   queda a lo ancho en vez de dejar media tarjeta vacía. */
.parche__cuerpo.con-video {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 24px;
  align-items: start;
}

.cambios {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cambios li {
  display: flex;
  gap: 10px;
  font-size: 15px;
  line-height: 1.55;
  color: var(--muted);
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

.sin-texto {
  margin: 0;
  font-size: 14.5px;
  color: var(--dim);
}

.video {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* El marco reserva el sitio desde el primer pintado, así que cambiar la
   portada por el reproductor no mueve nada de lo que hay alrededor. */
.video iframe,
.video__play {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: var(--r-sm);
  border: 1px solid var(--line);
  display: block;
  background: var(--panel-2);
}

.video iframe {
  border: 0;
}

.video__play {
  position: relative;
  padding: 0;
  overflow: hidden;
  cursor: pointer;
}

.video__play img {
  width: 100%;
  height: 100%;
  /* La miniatura viene en 4:3 con franjas negras arriba y abajo; `cover` sobre
     un marco 16:9 recorta justo esas franjas. */
  object-fit: cover;
  display: block;
}

.video__boton {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34px;
  color: #fff;
  background: rgba(0, 0, 0, 0.35);
  transition: background 0.15s ease;
}

.video__play:hover .video__boton {
  background: rgba(0, 0, 0, 0.15);
}

.video__enlace {
  font-size: 12.5px;
  color: var(--dim);
  text-align: right;
}

.video__enlace:hover {
  color: var(--violet-txt);
}

.sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

@media (max-width: 860px) {
  .parche__cuerpo.con-video {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .parche {
    padding: 18px 18px;
  }

  .parche time {
    margin-left: 0;
  }
}
</style>
