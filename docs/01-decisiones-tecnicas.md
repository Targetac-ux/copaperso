# CopaPerso — Decisiones técnicas

> Respuesta a las dos preguntas abiertas: base de datos y deploy.

## 1. Base de datos: Supabase (PostgreSQL) — sí, es la elección correcta

El modelo de CopaPerso es fuertemente relacional (player → participation → session → match → match_player)
y necesita integridad referencial, transacciones y consultas agregadas (roster, WR, LP). PostgreSQL encaja.
Supabase además resuelve, sin infraestructura extra, cuatro cosas que el plan pide:

| Necesidad del plan | Qué usamos de Supabase |
|---|---|
| Login del host (§35) | Supabase Auth (email + password, 1–3 usuarios) |
| Fotos de jugadores y Tier List (§30, Fase 1) | Supabase Storage (bucket público `players`, bucket `brand`) |
| **Vista pública en vivo (entra al MVP)** | Supabase Realtime sobre las tablas de sesión |
| Separar público / administrativo (§35) | Row Level Security: `anon` solo lee vistas públicas |

**Advertencias reales del plan gratuito**, importantes para un torneo mensual:

- Un proyecto Free se **pausa tras 7 días sin actividad**. CopaPerso se usa intensamente 1–2 noches al mes.
  Solución: un cron semanal (Vercel Cron o GitHub Action) que haga un `SELECT 1`, o pasar a Pro ($25/mes)
  antes de la primera CopaPerso real.
- Free **no tiene Point-in-Time Recovery**. Programar `pg_dump` semanal a un repo/Drive privado desde el día 1.
- Free limita las conexiones concurrentes de Realtime. Con la vista pública en vivo en el MVP, hay que medir
  cuántos espectadores simultáneos aguanta antes del primer stream grande.

**Región recomendada:** `us-east-1` (o `us-west-1` si la mayoría de la audiencia está en el oeste de México),
y desplegar Vercel en la misma región para evitar latencia en cada acción del host durante el stream.

## 2. Stack: un solo proyecto Nuxt, no dos proyectos separados

El plan propone "Vue 3 + TypeScript" en frontend y "Node.js + TypeScript" en backend. Mantener dos
repos/deploys separados para un producto operado por una sola persona multiplica el trabajo sin ganar nada.
Recomendación:

```
Nuxt 4 (Vue 3 + TypeScript)
├── app/          → Home pública, Tier Ranking, Reglas, /en-vivo (SSR, buen SEO)
├── app/host/     → CCTM Manager, Roster, Tier Manager (SPA, protegido)
└── server/api/   → "el backend": todas las mutaciones del host
```

Esto satisface §35 (*"las operaciones administrativas deberán validarse también en backend"*):

- El navegador **nunca** escribe directo a la base de datos.
- El cliente llama a `POST /api/session/:id/assign`, etc.; ahí viven las reglas (LP, costos, validaciones)
  y ahí se escribe el log de acciones.
- La `service_role_key` vive solo en el servidor. El `anon_key` del cliente público solo puede leer
  vistas públicas (`public_tier_ranking`, `public_roster`, `public_session_live`), con RLS denegando todo lo demás.

**Alternativa si prefieres Vue "puro"** (Vite SPA): funciona igual, pero las reglas del servidor tendrían
que ir en Supabase Edge Functions (Deno) — más piezas, dos lenguajes de despliegue y peor SEO en la Home.

## 3. Deploy

| Pieza | Dónde | Costo inicial |
|---|---|---|
| App (Home + Host + API) | **Vercel** (deploy automático desde GitHub) | $0 (Hobby) |
| Base de datos, Auth, Storage, Realtime | **Supabase** | $0 → $25/mes (Pro) |
| Repositorio y CI | **GitHub** + GitHub Actions (lint, tests, `pg_dump`) | $0 |
| Dominio | `copaperso.gg` o `.com` apuntando a Vercel | ~$10–35/año |

Entornos: `production` (rama `main`) y `preview` (cada PR) con **un proyecto Supabase distinto para
staging**. Nunca probar migraciones ni sesiones de prueba contra la base de producción.

> Nota de uso: Vercel Hobby es para proyectos no comerciales. Si CopaPerso llega a tener patrocinadores
> pagados, hay que pasar a Vercel Pro ($20/mes).

## 4. Extras que conviene fijar desde el inicio

- **Migraciones versionadas** con Supabase CLI (`supabase/migrations/*.sql`) en el repo. Nada de cambiar
  el esquema a mano desde el panel.
- **Tipos generados**: `supabase gen types typescript` → tipado end-to-end del esquema.
- **Sentry** (free) para errores en vivo: si algo truena a mitad del stream, quieres saber qué fue.
- **Modo offline defensivo**: el CCTM Manager debe tolerar 10–20 s sin red sin perder el estado en pantalla
  (cola de acciones + reintento). Un corte de internet en vivo no puede tumbar la sesión.
