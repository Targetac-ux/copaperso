<script setup lang="ts">
useSeoMeta({
  title: 'La copa de la comunidad',
  ogTitle: 'CopaPerso · La copa de la comunidad',
  description:
    'Torneo comunitario 5v5 de League of Legends: draft en vivo, negociación con bits y puro soloQ. Todo se decide en el stream.',
})

const modes = [
  { icon: 'copa-perso', name: 'Copa Perso', desc: 'El formato de siempre. Draft aleatorio y a jugar.' },
  { icon: 'copa-tryhard', name: 'Copa Tryhard', desc: 'Prioridad para Master+. Sin piedad.' },
  { icon: 'copa-random', name: 'Copa Random', desc: 'Roles y campeones al azar, respetando tus roles.' },
  { icon: 'copa-analisis', name: 'Copa Análisis', desc: 'Al terminar se revisa la partida jugada por jugada.' },
  { icon: 'copa-aram-afk', name: 'Copa ARAM AFK', desc: 'ARAM y una sola vida por jugador.' },
]
</script>

<template>
  <div>
    <!--
      El key art manda en el hero: se ancla a la derecha a su altura natural y
      un velo lo funde con el fondo por la izquierda, donde va el texto. En
      móvil el velo sobra y los dos se apilan.
    -->
    <section class="hero">
      <div class="wrap hero__text">
        <p class="eyebrow">Torneo comunitario 5v5</p>
        <h1>La copa de la comunidad,<br>hecha por la <span>comunidad</span>.</h1>
        <p class="hero__lede">
          Draft en vivo, negociación con bits y puro soloQ. La inscripción se abre en el chat de
          Twitch: no hay formularios, solo estar ahí cuando empieza.
        </p>
        <div class="hero__cta">
          <a class="btn btn--primary" href="https://twitch.tv" target="_blank" rel="noopener">
            Ver en Twitch
          </a>
          <NuxtLink class="btn btn--ghost" to="/tier-ranking">Ver el Tier Ranking</NuxtLink>
        </div>
      </div>

      <div class="hero__art">
        <picture>
          <source
            type="image/webp"
            srcset="/brand/keyart-900.webp 900w, /brand/keyart.webp 1424w"
            sizes="(max-width: 860px) 100vw, 70vw"
          >
          <img
            src="/brand/keyart.jpg"
            alt="Póster de CopaPerso: el host sobre un trofeo dorado, rodeado de campeones"
            width="1424"
            height="800"
            fetchpriority="high"
          >
        </picture>
      </div>

      <div class="hero__veil" aria-hidden="true" />
    </section>

    <section class="wrap modes">
      <h2 class="modes__title">Modos de juego</h2>
      <ul class="modes__grid">
        <li v-for="mode in modes" :key="mode.icon" class="mode">
          <img :src="`/modes/${mode.icon}.svg`" :alt="''" width="52" height="52" loading="lazy">
          <h3>{{ mode.name }}</h3>
          <p>{{ mode.desc }}</p>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.hero {
  position: relative;
  /* El alto crece con el ancho para que el arte no se quede pequeño en
     pantallas grandes; el tope evita que el hero se coma la página entera. */
  min-height: clamp(460px, 40vw, 720px);
  display: flex;
  align-items: center;
  overflow: hidden;
  background: var(--ink);
  border-bottom: 1px solid var(--line-soft);
}

/* El arte va después en el orden de lectura, pero en escritorio se sale del
   flujo y se ancla a la derecha, así que visualmente queda al lado del texto. */
.hero__art {
  position: absolute;
  top: 0;
  right: 0;
  height: 100%;
  line-height: 0;
}

.hero__art img {
  height: 100%;
  width: auto;
  display: block;
  /* El fundido viaja con la imagen, no con la ventana: así el borde izquierdo
     del arte se difumina igual de bien en un portátil que en un ultrapanorámico. */
  -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 20%);
  mask-image: linear-gradient(90deg, transparent 0%, #000 20%);
}

.hero__veil {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(
    90deg,
    var(--ink) 0%,
    var(--ink) 22%,
    rgba(var(--ink-rgb), 0.72) 38%,
    transparent 56%
  );
}

.hero__text {
  position: relative;
  z-index: 1;
  padding: 56px 24px;
}

h1 {
  font-size: clamp(32px, 4.6vw, 50px);
  font-weight: 700;
  letter-spacing: -0.01em;
  margin: 12px 0 0;
}

h1 span {
  color: var(--gold);
}

.hero__lede {
  color: var(--muted);
  font-size: 16.5px;
  max-width: 38ch;
  margin: 18px 0 26px;
}

.hero__cta {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.modes {
  padding: 62px 24px 0;
}

.modes__title {
  font-size: 26px;
  font-weight: 600;
  margin-bottom: 20px;
}

.modes__grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(196px, 1fr));
  gap: 14px;
}

.mode {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--r);
  padding: 20px 18px;
}

.mode img {
  display: block;
  margin-bottom: 12px;
}

.mode h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 5px;
}

.mode p {
  margin: 0;
  font-size: 13.5px;
  color: var(--muted);
}

/* Portátil y tablet: el arte es casi tan ancho como la pantalla y se comía el
   titular. Se baja el alto (y con él el ancho del arte) y se refuerza el velo. */
@media (max-width: 1200px) {
  .hero {
    min-height: 460px;
  }

  .hero__veil {
    background: linear-gradient(
      90deg,
      var(--ink) 0%,
      var(--ink) 26%,
      rgba(var(--ink-rgb), 0.88) 46%,
      rgba(var(--ink-rgb), 0.4) 66%,
      transparent 80%
    );
  }

  .hero__lede {
    max-width: 34ch;
  }
}

/* Móvil: uno debajo del otro, y el arte se funde con el texto por arriba. */
@media (max-width: 860px) {
  .hero {
    display: block;
    min-height: 0;
  }

  .hero__text {
    padding: 40px 24px 26px;
  }

  .hero__art {
    position: static;
    height: auto;
    width: 100%;
  }

  .hero__art img {
    width: 100%;
    height: auto;
    /* En vertical el arte va debajo del texto, así que el fundido cambia de eje. */
    -webkit-mask-image: linear-gradient(transparent 0%, #000 16%);
    mask-image: linear-gradient(transparent 0%, #000 16%);
  }

  .hero__veil {
    display: none;
  }
}
</style>
