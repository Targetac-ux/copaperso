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
    <section class="hero">
      <div class="wrap hero__inner">
        <div class="hero__text">
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

        <picture class="hero__art">
          <source srcset="/brand/trofeo-hero.webp" type="image/webp">
          <img src="/brand/trofeo-hero.png" alt="" width="1000" height="1000" fetchpriority="high">
        </picture>
      </div>
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
  overflow: hidden;
  border-bottom: 1px solid var(--line-soft);
}

.hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(760px 420px at 72% 18%, rgba(123, 92, 255, 0.28), transparent 62%),
    url('/backgrounds/hero-bg.webp') center / cover no-repeat;
  opacity: 0.55;
}

.hero__inner {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
  gap: 30px;
  align-items: center;
  padding: 64px 24px 72px;
}

h1 {
  font-size: clamp(34px, 5.4vw, 58px);
  font-weight: 700;
  letter-spacing: -0.01em;
  margin: 12px 0 0;
}

h1 span {
  color: var(--gold);
}

.hero__lede {
  color: var(--muted);
  font-size: 17px;
  max-width: 46ch;
  margin: 18px 0 26px;
}

.hero__cta {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.hero__art img {
  display: block;
  width: 100%;
  height: auto;
  filter: drop-shadow(0 24px 60px rgba(123, 92, 255, 0.35));
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

@media (max-width: 860px) {
  .hero__inner {
    grid-template-columns: 1fr;
    padding: 40px 24px 48px;
  }

  .hero__art {
    max-width: 340px;
  }
}
</style>
