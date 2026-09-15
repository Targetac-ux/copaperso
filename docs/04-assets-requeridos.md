# CopaPerso — Imágenes que necesito de ti

## Estado (9 de septiembre de 2026)

**Key art (nuevo, septiembre 2026):** `assets/brand/keyart.png` es el arte apaisado 16:9 que
protagoniza el hero de la Home; `assets/brand/keyart-cuadrado.png` es la versión cuadrada, para
avatares de Twitch, Discord e Instagram. El pipeline los deja en 150 kB y 122 kB. El escudo
(`isotipo.svg`) sigue siendo la marca en nav, favicon y avatar del panel, donde una ilustración no
se puede leer.

**Todas recibidas e integradas (14 de septiembre de 2026).** Las 6 insignias de tier, los iconos del
torneo y las 3 medallas de premios ya están en `public/`.

**Los PNG llegaban a 1254×1254**, que es mucho más de lo que se ve en pantalla: `blue-shell.png`
pesaba 1,4 MB y cada medalla unos 800 kB. Ahora pasan por el pipeline como el resto —webp para el
navegador y png de respaldo, al tamaño en que se usan— y el total bajó de **6,7 MB a 2,4 MB**.

**Lo que sigue pesando son los SVG vectorizados desde PNG:** `blue-shell.svg` (205 kB), `bits.svg`
(151 kB), `tier-s.svg` (109 kB). Traen miles de puntos por trazo, que es lo normal al vectorizar una
imagen. Ya pasan por SVGO; para bajarlos más habría que redibujarlos como vector de verdad. Para
iconos de 24–48 px no compensa, salvo que Lighthouse se queje en la Fase 7.

> `blue-shell.svg` y `blue-shell.png` son la misma imagen. El código usa la versión PNG/webp; el SVG
> está publicado pero no lo carga nadie. Si no lo quieres, se borra y son 205 kB menos.

**`tier-b.svg` tiene el fondo blanco.** Las seis insignias llevan un rectángulo de fondo a pantalla
completa; cinco lo tienen casi negro (`#040732`, `#05052d`…) y se funden con el panel, pero la de B
lo tiene en `#f8f7fa` y se ve un cuadro blanco en la página. **Hay que regenerarla con el fondo
oscuro**, o quitárselo a las seis para que queden transparentes. No se ha tocado el archivo: es tu
arte y la corrección es de origen.

**Las insignias no dicen de qué tier son.** A 60 px no se lee ninguna letra dentro, así que en la
página pública van acompañadas del rótulo (S+, S, A…). Si alguna vez llevan la letra grabada, el
rótulo sobra.

> El `wordmark.svg` no hace falta: la palabra CopaPerso se compone con tipografía real
> (Chakra Petch) en el componente `AppLogo`, así se ve nítida a cualquier tamaño.

---

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
