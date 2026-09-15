<script setup lang="ts">
useSeoMeta({
  title: 'Premios',
  description: 'Los premios de la CopaPerso. El formato está por decidir.',
})
</script>

<template>
  <div class="wrap premios">
    <p class="eyebrow">CopaPerso</p>
    <h1>Premios</h1>
    <p class="txt">
      Todavía se está decidiendo el formato de los premios. En cuanto esté, aparece aquí — y se
      anuncia en el stream antes que en ningún sitio.
    </p>

    <!-- Las tres medallas ya están: enseñarlas es honesto (los puestos sí
         existen) y deja el hueco sin parecer una página rota. -->
    <ul class="podio">
      <li v-for="n in 3" :key="n">
        <picture>
          <source :srcset="`/ui/premio-${n}.webp`" type="image/webp">
          <img :src="`/ui/premio-${n}.png`" :alt="''" width="96" height="96" loading="lazy">
        </picture>
        <b>{{ n }}.º puesto</b>
        <span>Por decidir</span>
      </li>
    </ul>

    <NuxtLink class="btn btn--ghost" to="/reglas">Ver las reglas</NuxtLink>
  </div>
</template>

<style scoped>
.premios {
  padding-block: 70px 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 14px;
}

.eyebrow {
  font-family: var(--f-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--violet);
  margin: 0;
}

h1 {
  font-family: var(--f-display);
  font-size: clamp(26px, 4vw, 40px);
  margin: 0;
}

.txt {
  margin: 0;
  max-width: 52ch;
  color: var(--muted);
  font-size: 15.5px;
  line-height: 1.65;
}

.podio {
  list-style: none;
  margin: 14px 0 6px;
  padding: 0;
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
  justify-content: center;
}

.podio li {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--r);
  padding: 20px 26px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-width: 150px;
}

.podio img {
  display: block;
}

.podio b {
  font-size: 15px;
  font-weight: 600;
}

.podio span {
  font-family: var(--f-mono);
  font-size: 11px;
  color: var(--dim);
}
</style>
