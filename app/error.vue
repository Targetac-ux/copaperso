<script setup lang="ts">
import type { NuxtError } from '#app'

/**
 * La página de error.
 *
 * Sin esto, un enlace roto o una dirección mal escrita enseñan la pantalla gris
 * de Nuxt: sin marca, sin menú y sin forma de volver. Quien llega ahí desde el
 * stream se encuentra algo que no parece la página.
 *
 * **No usa el layout público** a propósito. El layout carga los enlaces del
 * sitio desde la base, y si lo que ha fallado es justamente la base, el error
 * intentaría pintarse con la misma pieza rota. Aquí se pinta solo, con el
 * escudo y dos enlaces que no dependen de nada.
 */
const props = defineProps<{ error: NuxtError }>()

const esPerdida = computed(() => props.error?.statusCode === 404)

useSeoMeta({
  title: () => (esPerdida.value ? 'Página no encontrada' : 'Algo se rompió'),
  robots: 'noindex',
})

/**
 * `clearError` y no un `<NuxtLink>`: mientras se enseña el error la aplicación
 * está en un estado aparte, y navegar sin limpiarlo deja el error puesto.
 */
const volver = () => clearError({ redirect: '/' })
</script>

<template>
  <div class="err">
    <div class="err__caja">
      <AppLogo :size="44" />

      <p class="err__num">{{ error?.statusCode ?? 500 }}</p>

      <h1 v-if="esPerdida">Esta página no existe</h1>
      <h1 v-else>Algo se rompió</h1>

      <p class="err__txt">
        <template v-if="esPerdida">
          El enlace está mal escrito o lo que había aquí ya no está. Desde el inicio se llega a
          todo.
        </template>
        <template v-else>
          No es culpa tuya. Vuelve a intentarlo en un momento; si sigue igual, avísale al host por
          el chat.
        </template>
      </p>

      <div class="err__botones">
        <button class="btn btn--primary" @click="volver">Volver al inicio</button>
        <NuxtLink class="btn btn--ghost" to="/reglas" @click="clearError()">Ver las reglas</NuxtLink>
      </div>

      <!-- El mensaje técnico solo si lo hay y no es un 404: en un 404 no dice
           nada que el texto de arriba no diga ya. -->
      <p v-if="!esPerdida && error?.message" class="err__detalle">{{ error.message }}</p>
    </div>
  </div>
</template>

<style scoped>
.err {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--ink);
}

.err__caja {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 14px;
  max-width: 480px;
}

.err__num {
  margin: 8px 0 0;
  font-family: var(--f-mono);
  font-size: 13px;
  letter-spacing: 0.2em;
  color: var(--violet-txt);
}

h1 {
  font-family: var(--f-display);
  font-size: clamp(24px, 5vw, 34px);
  margin: 0;
}

.err__txt {
  margin: 0;
  color: var(--muted);
  font-size: 15.5px;
  line-height: 1.6;
}

.err__botones {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 6px;
}

.err__detalle {
  margin: 10px 0 0;
  font-family: var(--f-mono);
  font-size: 11px;
  line-height: 1.6;
  color: var(--dim);
  overflow-wrap: anywhere;
}
</style>
