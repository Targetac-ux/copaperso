<script setup lang="ts">
import { SUBS_NOTE, PAID_WITH_LABEL } from '#shared/economy'
import type { PaidWith } from '#shared/economy'

/**
 * Canjeos en bits (§13).
 *
 * Es una lista de precios de consulta más una bitácora: **aquí no se ejecuta
 * nada**. El host cumple el canjeo moviendo él mismo a los participantes con
 * las herramientas de la mesa, y esto solo deja constancia de qué se canjeó,
 * a qué precio y con qué se pagó.
 */
interface Precio {
  id: string
  code: string
  label: string
  cost_bits: number
  effective: number
}

interface Canjeo {
  id: string
  action_code: string
  cost_bits: number
  tripled: boolean
  paid_with: PaidWith
  created_at: string
}

defineProps<{
  prices: Precio[]
  tripled: boolean
  claims: Canjeo[]
  busy: boolean
}>()

const emit = defineEmits<{
  claim: [payload: { action_code: string; paid_with: PaidWith }]
  restorePrices: []
}>()

const elegido = ref('')
const pagoCon = ref<PaidWith>('bits')

function registrar() {
  if (!elegido.value) return
  emit('claim', { action_code: elegido.value, paid_with: pagoCon.value })
  elegido.value = ''
}

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
</script>

<template>
  <section class="canj">
    <header>
      <CopaIcon name="bits" :size="20" />
      <h2>Canjeos en bits</h2>
      <span v-if="tripled" class="x3">×3</span>
    </header>

    <ul class="precios">
      <li v-for="p in prices" :key="p.id">
        <!-- El Blue Shell es el canjeo que más se busca en la lista: lleva su
             propio icono para encontrarlo sin leer. -->
        <CopaIcon v-if="p.code === 'BLUE_SHELL'" name="blue-shell" :size="18" />
        <span class="etq">{{ p.label }}</span>
        <b :class="{ alto: tripled }">{{ p.effective }}</b>
      </li>
    </ul>

    <button
      v-if="tripled"
      class="btn btn--ghost mini"
      :disabled="busy"
      @click="emit('restorePrices')"
    >
      Deshacer el ×3
    </button>

    <div class="registrar">
      <select v-model="elegido" aria-label="Canjeo">
        <option value="">Registrar canjeo…</option>
        <option v-for="p in prices" :key="p.code" :value="p.code">
          {{ p.label }} · {{ p.effective }}
        </option>
      </select>

      <div class="chips">
        <button
          v-for="(label, key) in PAID_WITH_LABEL"
          :key="key"
          class="chip"
          :class="{ on: pagoCon === key }"
          @click="pagoCon = key as PaidWith"
        >
          {{ label }}
        </button>
      </div>

      <button class="btn btn--primary" :disabled="!elegido || busy" @click="registrar">
        Registrar canjeo
      </button>
    </div>

    <p class="aviso">
      Esto <b>no mueve a nadie ni descuenta saldo</b>. Deja constancia; el cambio lo haces tú.
    </p>

    <div v-if="claims.length" class="hechos">
      <h3>Canjeados hoy</h3>
      <ul>
        <li v-for="c in claims.slice(0, 5)" :key="c.id">
          <time>{{ hora(c.created_at) }}</time>
          <span>{{ c.action_code }}</span>
          <b>{{ c.cost_bits }}<em v-if="c.tripled">×3</em></b>
        </li>
      </ul>
    </div>

    <p class="subs">{{ SUBS_NOTE }}</p>
  </section>
</template>

<style scoped>
.canj {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--r);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 9px;
}

header {
  display: flex;
  align-items: center;
  gap: 8px;
}

h2 {
  font-family: var(--f-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--dim);
  font-weight: 500;
}

.x3 {
  font-family: var(--f-mono);
  font-size: 9.5px;
  color: var(--gold);
  border: 1px solid rgba(243, 185, 77, 0.4);
  border-radius: 20px;
  padding: 1px 7px;
}

.precios {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.precios li {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 12px;
  padding: 3px 0;
  border-bottom: 1px solid var(--line-soft);
}

.etq {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--muted);
}

.precios b {
  margin-left: auto;
  font-family: var(--f-mono);
  font-size: 12px;
  font-weight: 500;
  color: var(--gold);
  flex: none;
}

.precios b.alto {
  color: var(--warn);
}

.registrar {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 4px;
}

select {
  font: inherit;
  font-size: 13px;
  color: var(--text);
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  padding: 7px 9px;
  width: 100%;
}

select:focus {
  border-color: var(--violet);
  outline: none;
}

.chips {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.chip {
  font-family: var(--f-mono);
  font-size: 10px;
  padding: 4px 8px;
  border-radius: 20px;
  border: 1px solid var(--line);
  background: transparent;
  color: var(--muted);
}

.chip.on {
  background: var(--violet);
  border-color: var(--violet);
  color: #fff;
}

.mini {
  font-size: 11px;
  padding: 4px 9px;
  align-self: flex-start;
}

.aviso {
  margin: 0;
  font-family: var(--f-mono);
  font-size: 9.5px;
  line-height: 1.7;
  color: var(--warn);
}

.aviso b {
  color: var(--warn);
}

.hechos h3 {
  font-family: var(--f-mono);
  font-size: 9.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--dim);
  font-weight: 500;
  margin-bottom: 5px;
}

.hechos ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.hechos li {
  display: flex;
  align-items: baseline;
  gap: 7px;
  font-size: 11.5px;
  color: var(--muted);
}

.hechos time {
  font-family: var(--f-mono);
  font-size: 10px;
  color: var(--dim);
  flex: none;
}

.hechos span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hechos b {
  margin-left: auto;
  font-family: var(--f-mono);
  font-size: 11px;
  font-weight: 500;
  color: var(--gold);
  flex: none;
}

.hechos em {
  font-style: normal;
  font-size: 9px;
  color: var(--warn);
}

.subs {
  margin: auto 0 0;
  font-family: var(--f-mono);
  font-size: 9.5px;
  line-height: 1.7;
  color: var(--dim);
}
</style>
