<script setup lang="ts">
/**
 * Los avisos del draft no son errores: el host manda (§1). Se le enseña qué
 * tiene de raro lo que va a hacer y decide.
 */
defineProps<{ warnings: { code: string; message: string }[] }>()
const emit = defineEmits<{ confirm: []; cancel: [] }>()
</script>

<template>
  <div v-if="warnings.length" class="capa" @click.self="emit('cancel')">
    <div class="aviso" role="alertdialog" aria-labelledby="aviso-titulo">
      <h2 id="aviso-titulo">¿Seguro?</h2>
      <ul>
        <li v-for="w in warnings" :key="w.code">{{ w.message }}</li>
      </ul>
      <div class="btns">
        <button class="btn btn--primary" @click="emit('confirm')">Hacerlo igual</button>
        <button class="btn btn--ghost" @click="emit('cancel')">Cancelar</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.capa {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(var(--ink-rgb), 0.72);
  display: grid;
  place-items: center;
  padding: 20px;
}

.aviso {
  width: 100%;
  max-width: 380px;
  background: var(--panel);
  border: 1px solid var(--warn);
  border-radius: var(--r-lg);
  padding: 20px 22px;
}

h2 {
  font-size: 17px;
  font-weight: 600;
  margin-bottom: 10px;
}

ul {
  margin: 0 0 16px;
  padding-left: 18px;
  font-size: 13.5px;
  color: var(--muted);
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.btns {
  display: flex;
  gap: 8px;
}

.btns .btn {
  flex: 1;
}
</style>
