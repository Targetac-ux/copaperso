<script setup lang="ts">
/**
 * El banco de bits y subs (§17).
 *
 * Tiene card propia, debajo de los equipos: es lo que más se consulta durante
 * la negociación —quién tiene saldo para pujar— y estaba escondido tras una
 * pestaña al final de la página.
 *
 * Como todo lo demás en la mesa, aquí no se ejecuta nada solo: los movimientos
 * los anota el host.
 */
interface Cuenta {
  id: string
  display_name: string
  kind: 'player' | 'supporter'
  balance_bits: number
  balance_subs: number
}

const props = defineProps<{
  accounts: Cuenta[]
  busy: boolean
}>()

const emit = defineEmits<{
  entry: [payload: { account_id: string; delta_bits: number; reason: string }]
  openAccount: [payload: { display_name: string; balance_bits: number }]
}>()

const nuevaCuenta = ref('')
const saldoInicial = ref('')
const movimiento = reactive({ cuenta: '', bits: '', motivo: '' })

function abrirCuenta() {
  const nombre = nuevaCuenta.value.trim()
  if (!nombre) return
  emit('openAccount', { display_name: nombre, balance_bits: Number(saldoInicial.value) || 0 })
  nuevaCuenta.value = ''
  saldoInicial.value = ''
}

function registrarMovimiento() {
  const bits = Number(movimiento.bits)
  if (!movimiento.cuenta || !bits || !movimiento.motivo.trim()) return
  emit('entry', {
    account_id: movimiento.cuenta,
    delta_bits: bits,
    reason: movimiento.motivo.trim(),
  })
  movimiento.bits = ''
  movimiento.motivo = ''
}

const conSaldo = computed(() => props.accounts.filter((a) => a.balance_bits !== 0).length)
</script>

<template>
  <section class="banco">
    <header class="cab">
      <CopaIcon name="bits" :size="20" />
      <h2>Banco de bits</h2>
      <span v-if="accounts.length" class="cnt">
        {{ conSaldo }} con saldo de {{ accounts.length }}
      </span>
    </header>

    <div class="cuerpo">
      <div class="col">
        <h3>Saldos</h3>
        <ul v-if="accounts.length" class="lista">
          <li v-for="a in accounts" :key="a.id">
            <span>{{ a.display_name }}<em v-if="a.kind === 'supporter'"> ✦</em></span>
            <b>{{ a.balance_bits }}</b>
            <em v-if="a.balance_subs" class="subs">
              <CopaIcon name="sub" :size="15" />{{ a.balance_subs }}
            </em>
          </li>
        </ul>
        <p v-else class="vacio">Nadie tiene saldo todavía.</p>
        <p class="nota">✦ donador externo: tiene saldo pero no juega.</p>
      </div>

      <div class="col">
        <h3>Registrar movimiento</h3>
        <select v-model="movimiento.cuenta" aria-label="Cuenta">
          <option value="">Elegir cuenta…</option>
          <option v-for="a in accounts" :key="a.id" :value="a.id">
            {{ a.display_name }} ({{ a.balance_bits }})
          </option>
        </select>
        <input v-model="movimiento.bits" type="number" placeholder="Bits (negativo para restar)">
        <input v-model="movimiento.motivo" type="text" placeholder="Motivo">
        <button class="btn btn--primary" :disabled="busy" @click="registrarMovimiento">
          Anotar
        </button>
      </div>

      <div class="col">
        <h3>Abrir cuenta</h3>
        <input v-model="nuevaCuenta" type="text" placeholder="Nombre o nick de Twitch">
        <input v-model="saldoInicial" type="number" placeholder="Saldo inicial en bits">
        <button class="btn btn--ghost" :disabled="busy" @click="abrirCuenta">Abrir</button>
        <p class="nota">Los saldos se conservan entre sesiones y entre meses.</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.banco {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--r);
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.cab {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 10px 14px 0;
}

h2 {
  font-family: var(--f-mono);
  font-size: 9.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--dim);
  margin: 0;
  font-weight: 500;
}

.cnt {
  font-family: var(--f-mono);
  font-size: 9.5px;
  border: 1px solid var(--line);
  border-radius: 20px;
  padding: 1px 7px;
  color: var(--dim);
}

.cuerpo {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 18px;
  padding: 12px 14px 14px;
}

.col {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-width: 0;
}

h3 {
  font-family: var(--f-mono);
  font-size: 9.5px;
  letter-spacing: 0.13em;
  text-transform: uppercase;
  color: var(--dim);
  font-weight: 500;
  margin: 0;
}

.lista {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 168px;
  overflow-y: auto;
}

.lista li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  padding: 4px 0;
  border-bottom: 1px solid var(--line-soft);
}

.lista b {
  margin-left: auto;
  font-family: var(--f-mono);
  font-size: 12px;
  color: var(--gold);
  font-weight: 500;
  flex: none;
}

.lista em {
  font-family: var(--f-mono);
  font-size: 9.5px;
  font-style: normal;
  color: var(--dim);
  flex: none;
}

.lista span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

select,
input {
  font: inherit;
  font-size: 13px;
  color: var(--text);
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  padding: 7px 9px;
  width: 100%;
}

select:focus,
input:focus {
  border-color: var(--violet);
  outline: none;
}

.nota {
  margin: auto 0 0;
  font-family: var(--f-mono);
  font-size: 9.5px;
  line-height: 1.7;
  color: var(--dim);
}

.vacio {
  margin: 0;
  font-size: 12.5px;
  color: var(--dim);
}
</style>
