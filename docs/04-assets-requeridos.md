# CopaPerso — Imágenes que necesito de ti

Colócalas en `~/Downloads/copaperso/assets/`, en la subcarpeta que corresponde (ya están creadas).
Formato preferido **SVG** cuando sea vectorial (logos, iconos) y **PNG con transparencia** cuando sea
ilustración. Nombres exactos, en minúsculas.

## brand/ — identidad (bloquea Fase 1)

| Archivo | Uso | Especificación |
|---|---|---|
| `logo-horizontal.svg` | Barra de navegación pública y del host | Alto de referencia 40 px, versión para fondo oscuro |
| `logo-horizontal-light.svg` | Por si algún día hay fondo claro | Misma forma, tinta oscura |
| `isotipo.svg` | Avatar, favicon, esquinas | Cuadrado, legible a 32 px |
| `favicon.png` | Pestaña del navegador | 512×512 PNG |
| `trofeo-hero.png` | Ilustración principal del hero | ≥ 1600 px de ancho, fondo transparente |
| `og-image.png` | Vista previa al compartir el enlace | 1200×630 PNG, con logo y claim |
| `wordmark.svg` | Solo el texto "COPAPERSO" | Para overlays y footer |

## tiers/ — insignias de tier

`tier-s-plus.svg`, `tier-s.svg`, `tier-a.svg`, `tier-b.svg`, `tier-c.svg`, `tier-d.svg`
Cuadradas, legibles a 48 px. Si prefieres, las genero yo con CSS y te ahorras estas seis.

## modes/ — iconos de modos de juego (§32)

`copa-perso.svg`, `copa-tryhard.svg`, `copa-random.svg`, `copa-analisis.svg`, `copa-aram-afk.svg`
Monocromáticas o de dos tintas, 64×64, trazo consistente entre las cinco.

## ui/ — iconos propios del torneo

| Archivo | Dónde aparece |
|---|---|
| `blue-shell.png` | Botón y ruleta (§16), 256×256 |
| `bits.svg` / `sub.svg` | Banco de bits/subs |
| `carcel.svg` | Panel de cárcel |
| `cementerio.svg` | Panel de cementerio (es un estado distinto de la cárcel) |
| `dado.svg` | Botón Aleatorio |
| `avatar-default.png` | Jugador sin foto, 512×512 |

Los iconos genéricos (Twitch, Discord, X, TikTok, YouTube, Instagram, flechas, lupa) los pongo yo desde una
librería. No los dibujes.

## backgrounds/ — atmósfera

`hero-bg.jpg` (1920×1080, oscuro y de bajo contraste para que el texto se lea encima) y opcionalmente
`textura.png`.

## players/ — fotos de jugadores

No hacen falta ahora: se suben desde el Tier Manager a Supabase Storage. Si quieres precargar algunas para la
demo, ponlas aquí como `nombre.jpg`, **cuadradas de 512×512**.

## sponsors/ — patrocinadores

`logo-1.svg`, `logo-2.svg`, … en versión para fondo oscuro, alto de referencia 32 px.

---

### Prioridad

1. **Bloquea Fase 1:** `logo-horizontal.svg`, `isotipo.svg`, `favicon.png`.
2. **Bloquea Fase 7 (Home):** `trofeo-hero.png`, `og-image.png`, `hero-bg.jpg`, iconos de modos.
3. **Cuando puedas:** tiers, iconos de UI, patrocinadores.

Mientras no lleguen, uso placeholders con las mismas medidas para que no se retrase nada.
