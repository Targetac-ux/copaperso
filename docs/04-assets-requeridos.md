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

**Lo que se dejó de publicar (15 de septiembre de 2026).** Seis derivados que no carga ninguna
página se han quitado de `public/`, y con ellos sus trabajos del pipeline: `trofeo-hero` (png y webp,
lo sustituyó el key art), `keyart-cuadrado.webp` (es para avatares de redes, no para la web),
`hero-bg` (jpg y webp) y `blue-shell.svg` (la misma imagen que el PNG, vectorizada: 210 kB de puntos).
También la carpeta `sponsors/`, que estaba vacía. El despliegue pasó de **2,5 MB a 1,7 MB**.

> **Tus originales siguen intactos en `assets/`.** Lo que se borró son los derivados que genera el
> pipeline; si alguno vuelve a hacer falta, se añade su línea y reaparece. `blue-shell.svg` tiene su
> propia excepción en el script (`noPublicar`) para que el copiado automático de SVG no lo devuelva.

**Los iconos del torneo ya están colocados (15 de septiembre de 2026).** Estaban publicados sin que
ninguna pantalla los pidiera; ahora los pinta `CopaIcon.vue`:

| Icono | Dónde |
|---|---|
| `bits` | Cabecera de «Canjeos en bits» y del Banco · «La fase de negociación» en las reglas |
| `sub` | Junto al saldo en subs de cada cuenta del banco |
| `dado` | Cabecera del panel Aleatorio (sustituye al emoji 🎲 del botón) |
| `prestamo` | Pestaña de Préstamos |
| `carcel` · `cementerio` | Títulos de la pestaña Estados · fila «Sacar del cementerio» en las reglas |
| `mvp` · `ace` | Leyenda del cierre de partida · tabla de puntuación en las reglas |
| `blue-shell` | Su fila en los canjeos, la cabecera de su modal, la leyenda del cierre, y dos sitios en las reglas |

Van como `<img>` y no en línea —al revés que los logos de marca— porque son ilustraciones a varios
colores, no glifos de una tinta. Y son decorativos: llevan `alt=""` porque siempre acompañan a una
etiqueta que ya dice lo mismo, y un lector de pantalla no tiene que leerlo dos veces.

> En el cierre de partida los iconos van **en la leyenda y no en cada botón**: son diez jugadores por
> tres botones, y treinta iconos minúsculos serían ruido en vez de ayuda. Lo mismo en la tabla de
> canjeos de las reglas: solo llevan icono las dos filas que nombran una cosa del torneo que tiene el
> suyo; ponerle uno a «Cambio de Team» sería inventar un dibujo para rellenar.

**`tier-b.svg`: resuelto (15 de septiembre de 2026).** Llegó con un rectángulo de fondo a pantalla
completa en `#f8f7fa` —las otras cinco lo tienen casi negro y se funden con el panel—, así que en la
página se veía un cuadro blanco. El host la regeneró sin ese fondo y ya pasó por el pipeline: las
seis se ven igual sobre el panel.

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
