<script setup lang="ts">
import { urlDeIncrustado, urlDeClip } from '#shared/clips'

/**
 * Los clips de la Home.
 *
 * Dos decisiones que van juntas:
 *
 * 1. **El `parent` se lee del navegador.** Twitch no reproduce un clip
 *    incrustado si el dominio de la página no viene declarado en la URL del
 *    iframe, y no admite comodines. Como no hay dominio propio todavía y cada
 *    previsualización de Vercel estrena subdominio, escribirlo a mano
 *    significaría romperlo en cada despliegue. Se lee al montar y funciona
 *    igual en local, en una previsualización y con dominio propio.
 *
 * 2. **Los iframes no se montan hasta que la sección entra en pantalla.** Cada
 *    clip carga el reproductor entero de Twitch, que es la pieza más pesada de
 *    la página. Al no existir durante la carga inicial, no le cuestan nada a
 *    quien solo lee el hero, ni a la medición de Lighthouse de la Fase 7.
 *
 * Mientras tanto —en el servidor, y en el cliente hasta que se llega— cada
 * hueco es un enlace al clip en Twitch. Si algo fallara, eso es lo que queda:
 * un enlace que funciona, no un rectángulo negro.
 */
defineProps<{ clips: { slug: string; title: string; edition: string | null }[] }>()

const raiz = ref<HTMLElement | null>(null)
const dominio = ref('')
const cerca = ref(false)

onMounted(() => {
  dominio.value = window.location.hostname

  if (!raiz.value) return

  // Sin IntersectionObserver (navegador viejo) se montan sin más: mejor pesado
  // que vacío.
  if (!('IntersectionObserver' in window)) {
    cerca.value = true
    return
  }

  const vigia = new IntersectionObserver(
    (entradas) => {
      if (entradas.some((e) => e.isIntersecting)) {
        cerca.value = true
        vigia.disconnect()
      }
    },
    // Un margen generoso: se empiezan a cargar justo antes de llegar, así que
    // para cuando la sección está en pantalla ya se ven.
    { rootMargin: '400px' },
  )
  vigia.observe(raiz.value)
  onBeforeUnmount(() => vigia.disconnect())
})

const incrustar = (slug: string) => (cerca.value ? urlDeIncrustado(slug, dominio.value) : null)
</script>

<template>
  <section v-if="clips.length" ref="raiz" class="wrap clips">
    <h2 class="clips__title">Momentos de la CopaPerso</h2>
    <p class="clips__lede">Lo que ha pasado en las copas anteriores, en sus propias palabras.</p>

    <ul class="clips__grid">
      <li v-for="clip in clips" :key="clip.slug" class="clip">
        <div class="clip__marco">
          <iframe
            v-if="incrustar(clip.slug)"
            :src="incrustar(clip.slug)!"
            :title="clip.title"
            allowfullscreen
            loading="lazy"
            referrerpolicy="strict-origin"
          />
          <a
            v-else
            class="clip__espera"
            :href="urlDeClip(clip.slug)"
            target="_blank"
            rel="noopener"
          >
            <span aria-hidden="true">▶</span>
            <span class="clip__espera-txt">Ver en Twitch</span>
          </a>
        </div>

        <h3>{{ clip.title }}</h3>
        <p v-if="clip.edition" class="clip__edicion">{{ clip.edition }}</p>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.clips {
  padding: 62px 24px 0;
}

.clips__title {
  font-size: 26px;
  font-weight: 600;
  margin-bottom: 6px;
}

.clips__lede {
  color: var(--muted);
  font-size: 14.5px;
  margin: 0 0 20px;
}

.clips__grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 18px;
}

.clip h3 {
  font-size: 15px;
  font-weight: 600;
  margin: 10px 0 0;
  line-height: 1.35;
}

.clip__edicion {
  margin: 3px 0 0;
  font-family: var(--f-mono);
  font-size: 10.5px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--violet);
}

/* El marco reserva el sitio desde el primer pintado, así que montar el iframe
   después no mueve nada de lo que hay debajo. */
.clip__marco {
  position: relative;
  aspect-ratio: 16 / 9;
  border-radius: var(--r);
  overflow: hidden;
  background: var(--panel-2);
  border: 1px solid var(--line);
}

.clip__marco iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
}

.clip__espera {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--muted);
  text-decoration: none;
  font-size: 26px;
}

.clip__espera:hover {
  color: var(--text);
  background: var(--panel-3);
}

.clip__espera-txt {
  font-size: 13px;
}
</style>
