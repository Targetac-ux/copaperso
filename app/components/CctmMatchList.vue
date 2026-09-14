<script setup lang="ts">
import type { PartidaCargada } from '#shared/match'

/**
 * Las partidas de la sesión, con quién ganó y quién se llevó los premios.
 *
 * Enseña la alineación **congelada**, no los equipos de ahora: es lo que pasó
 * de verdad. Por eso alguien puede aparecer aquí en el Team 1 y estar ya en el
 * Team 2 en la mesa de arriba.
 */
defineProps<{ matches: PartidaCargada[] }>()

function premios(m: PartidaCargada) {
  const out: string[] = []
  const mvp = m.players.find((p) => p.isMvp)
  const ace = m.players.find((p) => p.isAce)
  const dobles = m.players.filter((p) => p.result === 'double_loss')
  if (mvp) out.push(`MVP ${mvp.displayName}`)
  if (ace) out.push(`ACE ${ace.displayName}`)
  for (const d of dobles) out.push(`doble derrota ${d.displayName}`)
  return out
}
</script>

<template>
  <section v-if="matches.length" class="partidas">
    <h2>Partidas</h2>
    <ol>
      <li v-for="m in matches" :key="m.id" :class="`is-${m.status}`">
        <span class="num">{{ m.matchNumber }}</span>

        <span v-if="m.status === 'live'" class="estado">en juego</span>
        <span v-else-if="m.winnerTeam" class="gana" :class="`is-t${m.winnerTeam}`">
          gana Team {{ m.winnerTeam }}
        </span>
        <span v-else class="estado">sin resultado</span>

        <span class="premio">{{ premios(m).join(' · ') }}</span>
        <span class="cuantos">{{ m.players.length }} jugadores</span>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.partidas {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 11px 13px 12px;
}

h2 {
  font-family: var(--f-mono);
  font-size: 9.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--dim);
  margin: 0 0 8px;
}

ol {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

li {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: 7px;
  padding: 5px 9px;
  font-size: 12px;
}

li.is-live {
  border-color: var(--ok);
}

.num {
  font-family: var(--f-mono);
  font-size: 12px;
  color: var(--dim);
  width: 14px;
}

.gana {
  font-family: var(--f-mono);
  font-size: 10.5px;
  letter-spacing: 0.04em;
}

.gana.is-t1 {
  color: var(--team-1);
}

.gana.is-t2 {
  color: var(--team-2);
}

.estado {
  font-family: var(--f-mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ok);
}

li:not(.is-live) .estado {
  color: var(--dim);
}

.premio {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--gold);
  font-size: 11.5px;
}

.cuantos {
  font-family: var(--f-mono);
  font-size: 10px;
  color: var(--dim);
}
</style>
