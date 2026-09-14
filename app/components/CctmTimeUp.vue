<script setup lang="ts">
/**
 * El aviso de fin de tiempo.
 *
 * No bloquea el panel: se puede cerrar y seguir. Y si los precios ya están
 * triplicados, lo dice en vez de ofrecer multiplicar otra vez — el ×3 se
 * aplica una sola vez por sesión.
 */
defineProps<{
  open: boolean
  tripled: boolean
  prices: { label: string; cost_bits: number }[]
}>()

const emit = defineEmits<{ triple: []; close: [] }>()
</script>

<template>
  <div v-if="open" class="capa" @click.self="emit('close')">
    <div class="aviso" role="alertdialog" aria-labelledby="tiempo-titulo">
      <h2 id="tiempo-titulo">⏱ Se acabó la negociación</h2>

      <template v-if="!tripled">
        <p class="sub">Si triplicas los precios, empieza el tiempo extra.</p>
        <ul class="precios">
          <li v-for="p in prices" :key="p.label">
            <span>{{ p.label }}</span>
            <b>{{ p.cost_bits }} → {{ p.cost_bits * 3 }}</b>
          </li>
        </ul>
        <div class="btns">
          <button class="btn btn--primary" @click="emit('triple')">Triplicar precios</button>
          <button class="btn btn--ghost" @click="emit('close')">Solo cerrar</button>
        </div>
        <p class="nota">
          El ×3 se aplica una sola vez y se queda toda la sesión. Se puede deshacer desde el panel
          de canjeos. El catálogo del mes no se toca.
        </p>
      </template>

      <template v-else>
        <p class="sub">Los precios ya están en ×3 desde antes, así que no cambia nada.</p>
        <div class="btns">
          <button class="btn btn--primary" @click="emit('close')">Entendido</button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.capa {
  position: fixed;
  inset: 0;
  z-index: 70;
  background: rgba(var(--ink-rgb), 0.7);
  display: grid;
  place-items: center;
  padding: 20px;
}

.aviso {
  width: 100%;
  max-width: 400px;
  background: var(--panel);
  border: 1px solid var(--gold);
  border-radius: var(--r-lg);
  padding: 22px 24px;
}

h2 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 6px;
}

.sub {
  margin: 0 0 14px;
  font-size: 13.5px;
  color: var(--muted);
}

.precios {
  list-style: none;
  margin: 0 0 16px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.precios li {
  display: flex;
  justify-content: space-between;
  font-family: var(--f-mono);
  font-size: 11.5px;
  color: var(--muted);
  padding: 3px 0;
  border-bottom: 1px solid var(--line-soft);
}

.precios b {
  color: var(--gold);
  font-weight: 500;
}

.btns {
  display: flex;
  gap: 8px;
}

.btns .btn {
  flex: 1;
}

.nota {
  margin: 12px 0 0;
  font-family: var(--f-mono);
  font-size: 10px;
  line-height: 1.7;
  color: var(--dim);
}
</style>
