<script setup lang="ts">
import { TIERS, TIER_INSIGNIA, TIER_LABEL } from '#shared/tiers'
import type { EloTierDb, PlayerRoleDb, TierName } from '#shared/types/database.types'

/**
 * El Tier Ranking público.
 *
 * Enseña la edición **publicada**: mientras el host prepara la siguiente, aquí
 * se sigue viendo la anterior. Eso es lo que permite reordenar cuarenta
 * personas sin que la Home parpadee a media faena.
 */
interface Entrada {
  tier: TierName
  rankOrder: number
  points: number | null
  mainRole: PlayerRoleDb | null
  elo: EloTierDb | null
  displayName: string
  photoUrl: string | null
}

const { data } = await useFetch<{
  edicion: { title: string | null; publishedAt: string | null } | null
  entradas: Entrada[]
}>('/api/public/tier-ranking', { default: () => ({ edicion: null, entradas: [] }) })

useSeoMeta({
  title: 'Tier Ranking',
  description: 'El Tier Ranking de la CopaPerso, de S+ a D.',
})

const porTier = computed(() => {
  const mapa = Object.fromEntries(TIERS.map((t) => [t, [] as Entrada[]])) as Record<TierName, Entrada[]>
  for (const e of data.value.entradas) (mapa[e.tier] ?? mapa.D).push(e)
  for (const t of TIERS) mapa[t].sort((a, b) => a.rankOrder - b.rankOrder)
  return mapa
})

/** Los tiers vacíos no se pintan: una fila en blanco no dice nada. */
const conGente = computed(() => TIERS.filter((t) => porTier.value[t].length))

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
</script>

<template>
  <div class="wrap tier">
    <header class="tier__cab">
      <p class="eyebrow">Tier Ranking</p>
      <h1>{{ data.edicion?.title ?? 'Tier Ranking' }}</h1>
      <p v-if="data.edicion?.publishedAt" class="tier__fecha">
        Publicado el {{ fecha(data.edicion.publishedAt) }}
      </p>
    </header>

    <p v-if="!data.entradas.length" class="tier__vacio">
      Todavía no hay ninguna edición publicada. Vuelve cuando termine la próxima CopaPerso.
    </p>

    <div v-else class="tablero">
      <section v-for="tier in conGente" :key="tier" class="fila" :class="`is-${tier.toLowerCase()}`">
        <!-- La insignia sola no dice de qué tier es: a 64 px no se lee ninguna
             letra dentro. Va acompañada del rótulo. -->
        <div class="fila__etq">
          <img :src="TIER_INSIGNIA[tier]" alt="" width="60" height="60">
          <b>{{ TIER_LABEL[tier] }}</b>
        </div>
        <ul class="fila__gente">
          <li v-for="e in porTier[tier]" :key="e.displayName">
            <img
              :src="e.photoUrl || '/ui/avatar-default.webp'"
              :alt="''"
              width="56"
              height="56"
              loading="lazy"
            >
            <span class="nombre">{{ e.displayName }}</span>
            <span v-if="e.mainRole" class="rol" :class="`rol--${e.mainRole.toLowerCase()}`">
              {{ e.mainRole }}
            </span>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.tier {
  padding-block: 40px 64px;
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.tier__cab {
  text-align: center;
}

.eyebrow {
  font-family: var(--f-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--violet);
  margin: 0 0 6px;
}

h1 {
  font-family: var(--f-display);
  font-size: clamp(26px, 4vw, 40px);
  margin: 0;
}

.tier__fecha,
.tier__vacio {
  margin: 8px 0 0;
  color: var(--dim);
  font-size: 13px;
}

.tier__vacio {
  text-align: center;
  font-size: 15px;
  color: var(--muted);
}

.tablero {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.fila {
  display: flex;
  gap: 12px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--r);
  padding: 10px;
}

.fila__etq {
  width: 92px;
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 8px 0;
  border-radius: var(--r-sm);
  background: var(--panel-2);
}

.fila__etq img {
  width: 60px;
  height: 60px;
  display: block;
}

.fila__etq b {
  font-family: var(--f-display);
  font-size: 20px;
  line-height: 1;
}

.is-s_plus .fila__etq b { color: #ff7ad9; }
.is-s .fila__etq b { color: var(--gold); }
.is-a .fila__etq b { color: #7be0a0; }
.is-b .fila__etq b { color: var(--team-1); }
.is-c .fila__etq b { color: var(--muted); }
.is-d .fila__etq b { color: var(--dim); }


.fila__gente {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  flex: 1;
  align-items: flex-start;
}

.fila__gente li {
  width: 76px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  text-align: center;
}

.fila__gente img {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  object-fit: cover;
  background: var(--panel-3);
  border: 1px solid var(--line);
}

.nombre {
  font-size: 12px;
  color: var(--text);
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.rol {
  font-family: var(--f-mono);
  font-size: 9px;
  font-weight: 700;
}

.rol--top { color: var(--rol-top); }
.rol--jg { color: var(--rol-jg); }
.rol--mid { color: var(--rol-mid); }
.rol--adc { color: var(--rol-adc); }
.rol--sup { color: var(--rol-sup); }

@media (max-width: 560px) {
  .fila {
    flex-direction: column;
  }

  .fila__etq {
    width: 100%;
    flex-direction: row;
    gap: 10px;
    padding: 6px;
  }

  .fila__etq img {
    width: 40px;
    height: 40px;
  }
}
</style>
