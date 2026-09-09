<script setup lang="ts">
import { parsePlayerLine } from '#shared/parser'
import type { Player } from '#shared/types/models'

/**
 * El campo de registro en directo (§4, §7).
 *
 * Mientras el host teclea "Target Mid/Jg Challenger" muestra dos cosas a la vez:
 * lo que ha entendido (nombre, roles, elo) y los perfiles que se le parecen.
 * Enter registra. Nunca decide por su cuenta: si hay un parecido, lo propone y
 * el host elige.
 */

interface Sugerencia {
  player: Player
  kind: 'exact' | 'prefix' | 'typo' | 'contains' | 'all'
  score?: number
}

const emit = defineEmits<{ registered: [] }>()

const linea = ref('')
const sugerencias = ref<Sugerencia[]>([])
const elegido = ref<Player | null>(null)
const resaltado = ref(-1)
const enviando = ref(false)
const error = ref('')
const aviso = ref('')
const campo = ref<HTMLInputElement | null>(null)

const entendido = computed(() => parsePlayerLine(linea.value))

const ETIQUETA_TIPO: Record<string, string> = {
  exact: 'mismo nombre',
  prefix: 'empieza igual',
  typo: '¿será esta persona?',
  contains: 'contiene',
  all: '',
}

let timer: ReturnType<typeof setTimeout> | undefined

/**
 * Al registrar vaciamos el campo, y eso dispara el watch de abajo. Sin esta
 * bandera, ese disparo borraría el "X registrado" en el mismo instante en que
 * aparece y el host nunca vería la confirmación.
 */
let vaciadoInterno = false

watch(
  () => entendido.value?.name,
  (nombre) => {
    elegido.value = null
    resaltado.value = -1
    clearTimeout(timer)

    if (vaciadoInterno) {
      vaciadoInterno = false
    } else {
      aviso.value = ''
    }

    if (!nombre || nombre.length < 2) {
      sugerencias.value = []
      return
    }

    timer = setTimeout(async () => {
      try {
        sugerencias.value = await $fetch<Sugerencia[]>('/api/players', {
          query: { q: nombre, limit: 5 },
        })
      } catch {
        sugerencias.value = []
      }
    }, 150)
  },
)

function elegir(player: Player) {
  elegido.value = player
  const partes = entendido.value
  linea.value = [player.display_name, partes?.roles.join('/'), partes?.elo].filter(Boolean).join(' ')
  sugerencias.value = []
  campo.value?.focus()
}

function alBajar(e: KeyboardEvent) {
  if (!sugerencias.value.length) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    resaltado.value = (resaltado.value + 1) % sugerencias.value.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    resaltado.value =
      resaltado.value <= 0 ? sugerencias.value.length - 1 : resaltado.value - 1
  } else if (e.key === 'Tab' && resaltado.value >= 0) {
    e.preventDefault()
    elegir(sugerencias.value[resaltado.value]!.player)
  } else if (e.key === 'Escape') {
    sugerencias.value = []
    resaltado.value = -1
  }
}

async function registrar() {
  if (resaltado.value >= 0 && sugerencias.value.length) {
    elegir(sugerencias.value[resaltado.value]!.player)
    return
  }

  const partes = entendido.value
  if (!partes || enviando.value) return

  enviando.value = true
  error.value = ''
  aviso.value = ''

  try {
    const res = await $fetch<{
      player: Player
      created: boolean
      playerCreated: boolean
    }>('/api/participations', {
      method: 'POST',
      body: elegido.value
        ? { player_id: elegido.value.id, roles: partes.roles, elo: partes.elo }
        : { display_name: partes.name, roles: partes.roles, elo: partes.elo },
    })

    aviso.value = res.created
      ? `${res.player.display_name} registrado${res.playerCreated ? ' (perfil nuevo)' : ''}`
      : `${res.player.display_name} ya estaba registrado este mes`

    vaciadoInterno = true
    linea.value = ''
    elegido.value = null
    sugerencias.value = []
    emit('registered')
  } catch (e) {
    error.value = (e as { statusMessage?: string }).statusMessage ?? 'No se pudo registrar.'
  } finally {
    enviando.value = false
    campo.value?.focus()
  }
}
</script>

<template>
  <div class="reg">
    <form class="reg__form" @submit.prevent="registrar">
      <div class="reg__campo">
        <div class="reg__cab">
          <label for="linea">Registrar participante</label>

          <p v-if="entendido" class="reg__leido">
            <strong>{{ entendido.name }}</strong>
            <span v-if="entendido.roles.length" class="reg__rol">
              {{ entendido.roles.join(' · ') }}
            </span>
            <em v-else>sin rol</em>
            <span v-if="entendido.elo" class="reg__elo">{{ entendido.elo }}</span>
            <em v-else>sin elo</em>
            <span v-if="elegido" class="reg__usa">· perfil existente</span>
          </p>
          <p v-else class="reg__leido reg__leido--vacio">
            Nombre, roles y elo en una línea. Ejemplo: <code>Target Mid/Jg Challenger</code>
          </p>
        </div>
        <input
          id="linea"
          ref="campo"
          v-model="linea"
          type="text"
          placeholder="Target Mid/Jg Challenger"
          autocomplete="off"
          spellcheck="false"
          @keydown="alBajar"
        >

        <ul v-if="sugerencias.length" class="reg__sug">
          <li
            v-for="(s, i) in sugerencias"
            :key="s.player.id"
            :class="{ 'is-on': i === resaltado }"
          >
            <button type="button" @click="elegir(s.player)">
              <span class="reg__nombre">{{ s.player.display_name }}</span>
              <span v-if="ETIQUETA_TIPO[s.kind]" class="reg__tipo">{{ ETIQUETA_TIPO[s.kind] }}</span>
            </button>
          </li>
        </ul>
      </div>

      <button class="btn btn--primary" type="submit" :disabled="!entendido || enviando">
        {{ enviando ? 'Registrando…' : 'Registrar' }}
      </button>
    </form>

    <p v-if="error" class="alert alert--error">{{ error }}</p>
    <p v-else-if="aviso" class="reg__ok">{{ aviso }}</p>
  </div>
</template>

<style scoped>
.reg {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.reg__form {
  display: flex;
  gap: 10px;
  align-items: flex-end;
}

.reg__campo {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.reg__cab {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
}

.reg__campo label {
  font-family: var(--f-mono);
  font-size: 10.5px;
  letter-spacing: 0.13em;
  text-transform: uppercase;
  color: var(--dim);
}

.reg__campo input {
  font: inherit;
  font-size: 17px;
  font-family: var(--f-display);
  color: var(--text);
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  padding: 12px 14px;
  width: 100%;
}

.reg__campo input:focus {
  border-color: var(--violet);
  outline: none;
}

.reg__sug {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 10;
  list-style: none;
  margin: 0;
  padding: 4px;
  background: var(--panel-3);
  border: 1px solid var(--violet-dim);
  border-radius: var(--r-sm);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45);
}

.reg__sug button {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  text-align: left;
  background: none;
  border: 0;
  padding: 8px 10px;
  border-radius: 5px;
  font-size: 14px;
}

.reg__sug li.is-on button,
.reg__sug button:hover {
  background: var(--violet);
  color: #fff;
}

.reg__nombre {
  font-family: var(--f-display);
  font-weight: 600;
}

.reg__tipo {
  margin-left: auto;
  font-family: var(--f-mono);
  font-size: 10.5px;
  color: var(--muted);
}

.reg__sug li.is-on .reg__tipo,
.reg__sug button:hover .reg__tipo {
  color: rgba(255, 255, 255, 0.75);
}

.reg__leido {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
  margin: 0 0 0 auto;
  font-size: 13px;
  color: var(--text);
}

.reg__leido strong {
  font-family: var(--f-display);
  font-weight: 600;
}

.reg__rol,
.reg__elo {
  font-family: var(--f-mono);
  font-size: 10.5px;
  letter-spacing: 0.06em;
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 1px 6px;
  color: var(--muted);
}

.reg__elo {
  color: var(--gold);
  border-color: rgba(243, 185, 77, 0.3);
}

.reg__leido--vacio {
  color: var(--dim);
}

.reg__leido code {
  font-family: var(--f-mono);
  font-size: 12.5px;
  color: var(--gold);
}

.reg__etq {
  font-family: var(--f-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--dim);
}

.reg__leido em {
  color: var(--dim);
  font-style: normal;
}

.reg__usa {
  font-family: var(--f-mono);
  font-size: 10.5px;
  color: var(--ok);
}

.reg__ok {
  margin: 0;
  font-size: 13.5px;
  color: var(--ok);
}

@media (max-width: 640px) {
  .reg__form {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
