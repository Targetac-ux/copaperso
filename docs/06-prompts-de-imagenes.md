# CopaPerso — Lista completa de imágenes con prompts para IA

**33 archivos** (32 se generan con IA, 1 es tipografía). Todos nuevos: nada del wireframe se reutiliza.
Colócalas en `~/Downloads/copaperso/assets/<carpeta>/` con el nombre exacto en minúsculas.

---

## Reglas generales (léelas antes de generar nada)

**1. Paleta oficial.** Va en todos los prompts para que las 33 piezas parezcan una sola familia:

```
Violeta   #7B5CFF   (acento principal)
Oro       #F3B94D   (corona, trofeo, tier S+)
Azul      #4C8DFF   (Team 1)
Rojo      #FF5A6E   (Team 2)
Fondo     #070A18    (azul noche casi negro)
```

**2. Nunca dejes que la IA escriba texto.** Los modelos deforman las letras. Genera **solo el símbolo** y el
texto "COPAPERSO" lo pongo yo con tipografía real (Chakra Petch, la del blueprint). Por eso todos los prompts
llevan `no text, no lettering`.

**3. Genera grande y reduce después.** Todo a **1024×1024** (o 1536×1024 lo apaisado), aunque el archivo final
sea de 64 px. Nunca al revés.

**4. Los SVG no los genera la IA.** Genera PNG y vectoriza después (Illustrator → Image Trace, Inkscape →
Trazar mapa de bits, o vectorizer.ai). Si algo no se deja vectorizar bien, mándamelo en PNG y lo resuelvo.

**5. Fondo transparente.** Casi ningún modelo lo hace bien. Pide **fondo plano de un solo color** (magenta o
verde puro) y quítalo después con remove.bg o Photoshop. Está indicado en los prompts que lo necesitan.

**6. Copia esto al final de cada prompt** (el "sufijo de estilo" que mantiene todo consistente):

```
flat vector esports emblem style, bold geometric shapes, thick clean outlines, limited palette of violet #7B5CFF, gold #F3B94D, electric blue #4C8DFF and deep navy #070A18, high contrast, crisp edges, centered composition, no text, no lettering, no watermark
```

**7. Negativos** (donde el modelo los acepte):

```
no text, no letters, no watermark, no photorealism, no gradient mesh, no League of Legends characters, no Riot Games art, no Nintendo characters or items, no blurry edges
```

**8. Marca registrada — importante.** El "Blue Shell" no puede parecerse al caparazón azul de Mario Kart, ni
los iconos a campeones de League of Legends. Los prompts de abajo ya están redactados para evitarlo: pide un
caparazón con púas y alas **genérico**, no el de Nintendo.

---

## 🟥 BLOQUEA LA FASE 1 — genera estas tres primero

### 1. `assets/brand/isotipo.svg`
**Genera:** 1024×1024 PNG → vectorizar · **Fondo:** transparente
El escudo de CopaPerso. Es la pieza madre: de aquí salen el favicon, el logo horizontal y el avatar.

> An esports team crest: a hexagonal shield with a bold violet border, containing a stylized golden
> tournament cup with two handles, topped by a small five-point golden crown. Symmetrical, iconic,
> readable at very small sizes, thick outlines, flat solid colors, on a plain magenta background.
> *(+ sufijo de estilo)*

### 2. `assets/brand/logo-horizontal.svg`
**Genera:** 1536×512 PNG → vectorizar · **Fondo:** transparente
El isotipo a la izquierda y espacio a la derecha donde yo monto el texto "COPAPERSO" con tipografía real.
**No pidas el texto.**

> The same hexagonal esports crest with golden cup and crown, placed on the left side of a wide horizontal
> canvas, with the right two thirds completely empty flat magenta background. Emblem only.
> *(+ sufijo de estilo)*

### 3. `assets/brand/favicon.png`
**Genera:** 512×512 PNG · **Fondo:** sólido (aquí sí, azul noche #070A18)
La misma corona/copa pero **simplificada al máximo**: a 16 px un escudo detallado se ve como una mancha.

> Extremely simplified app icon: a single golden crown shape over a violet rounded square background,
> minimal detail, only two colors, designed to stay readable at 16 pixels, bold thick forms.
> *(+ sufijo de estilo)*

---

## 🎨 Marca — el resto

### 4. `assets/brand/logo-horizontal-light.svg`
**Genera:** 1536×512 PNG → vectorizar
La misma versión horizontal pero con las tintas invertidas para fondo claro (por si algún día hay que
ponerlo en blanco o en un documento impreso).

> Same hexagonal crest emblem but recolored for light backgrounds: deep navy #070A18 outlines and details,
> gold #F3B94D accents, no violet fill, on a plain white background. Emblem only, left aligned.
> *(+ sufijo de estilo)*

### 5. `assets/brand/wordmark.svg`
**No la generes con IA.** Es solo la palabra COPAPERSO en tipografía. La armo yo con Chakra Petch y te la
entrego vectorizada — la IA escribiría "COPAPRESO" o "COPAPERSD".

### 6. `assets/brand/trofeo-hero.png`
**Genera:** 1536×1536 PNG · **Fondo:** transparente (quitar después) · Es la imagen más grande de la Home.
El trofeo protagonista del hero, en tres cuartos y con presencia.

> A large ornate golden tournament trophy with two curved handles, seen at a three-quarter angle, glowing
> with violet rim light from behind, small floating light particles around the base, dramatic esports key
> art, rich metallic gold with violet reflections, on a plain flat magenta background for cutout.
> Semi-realistic stylized 3D render, sharp details, no text.

### 7. `assets/brand/og-image.png`
**Genera:** 1200×630 PNG · **Fondo:** completo, sin transparencia
Es lo que se ve al pegar el enlace en Discord, X o WhatsApp. Yo le monto encima el logo y el claim, así que
**genera solo el fondo con el trofeo descentrado a la derecha**.

> Wide banner background for a gaming tournament: deep navy #070A18 base with subtle violet radial glow in
> the upper right, faint hexagonal grid pattern, a golden trophy silhouette positioned on the right third,
> the left half kept dark and empty for text overlay. Cinematic esports key visual, no text.

---

## 🌌 Fondos

### 8. `assets/backgrounds/hero-bg.jpg`
**Genera:** 1920×1080 JPG · **Fondo:** completo
Va detrás del hero de la Home. Tiene que ser **oscuro y de bajo contraste**: si compite con el texto, no sirve.

> Dark atmospheric esports arena background, deep navy #070A18, soft violet and blue stage lights in the
> distance, heavy bokeh, out of focus crowd silhouettes at the bottom, low contrast, muted, lots of empty
> dark space in the center for text overlay. Cinematic, moody, no text, no people in focus.

### 9. `assets/backgrounds/textura.png` *(opcional)*
**Genera:** 512×512 PNG **tileable** · Patrón sutil para las secciones interiores.

> Seamless tileable dark pattern, thin violet hexagonal outlines on deep navy #070A18, very low opacity,
> subtle, repeating grid, flat vector, no text.

---

## 🎮 Modos de juego — `assets/modes/`

Los cinco tienen que verse **hermanos**: mismo grosor de trazo, mismo encuadre, misma cantidad de detalle.
Truco: genera el primero, y usa esa imagen como referencia de estilo para los otros cuatro.
**Genera:** 512×512 PNG cada uno · **Fondo:** transparente · **Uso final:** 64×64

### 10. `copa-perso.svg` — el modo principal
> Icon of a tournament cup with a crown above it, violet and gold, simple bold vector icon, uniform thick
> stroke, centered on plain magenta background. *(+ sufijo de estilo)*

### 11. `copa-tryhard.svg` — se priorizan jugadores Master+
> Icon of a clenched fist gripping a sword hilt with a small flame above, aggressive but simple, violet and
> gold, uniform thick stroke, centered on plain magenta background. *(+ sufijo de estilo)*

### 12. `copa-random.svg` — roles y campeones aleatorios
> Icon of a tumbling six-sided die with a swirl of motion lines around it, violet and gold, uniform thick
> stroke, centered on plain magenta background. *(+ sufijo de estilo)*

### 13. `copa-analisis.svg` — análisis después de la partida
> Icon of a magnifying glass over a rising bar chart, violet and gold, uniform thick stroke, centered on
> plain magenta background. *(+ sufijo de estilo)*

### 14. `copa-aram-afk.svg` — ARAM, una sola vida
> Icon of a single glowing heart with a crack running through it over a narrow bridge shape, violet and
> gold, uniform thick stroke, centered on plain magenta background. *(+ sufijo de estilo)*

---

## 🏅 Insignias de tier (15–20) — `assets/tiers/`

Seis rombos idénticos en forma, distintos en color. **Aquí sí lleva letra**, y por eso conviene generar
**el rombo vacío una sola vez** y que yo monte la letra encima con tipografía real. Si prefieres pedirle la
letra a la IA, revísala con lupa: confunde S con 5 y B con 8.
**Genera:** 512×512 PNG cada uno · **Fondo:** transparente

| Archivo | Color | Detalle extra |
|---|---|---|
| `tier-s-plus.svg` | Oro #F3B94D | Alas pequeñas a los lados y brillo |
| `tier-s.svg` | Violeta claro #C8A6FF | Brillo suave |
| `tier-a.svg` | Azul #7FB4FF | Liso |
| `tier-b.svg` | Verde #6FD9AE | Liso |
| `tier-c.svg` | Gris azulado #A9B0D6 | Liso |
| `tier-d.svg` | Gris oscuro #7A82AD | Mate, sin brillo |

> Empty diamond-shaped rank badge with a thick metallic bevel border in [COLOR], hollow center for a letter
> to be placed later, subtle inner glow, game rank insignia style, symmetrical, on plain magenta background,
> no text, no letters. *(+ sufijo de estilo)*

---

## 🧩 Iconos del torneo — `assets/ui/`

### 21. `blue-shell.png`
**Genera:** 512×512 PNG · **Fondo:** transparente · Protagoniza la ruleta, por eso va con más detalle.
⚠️ **No debe parecerse al caparazón azul de Mario Kart.** Pide un diseño original con púas y alas.

> An original spiked turtle-like shell icon, electric blue #4C8DFF with violet #7B5CFF spikes, small angular
> wings on both sides, menacing and energetic, glowing edges, game power-up item, on plain magenta
> background. Original design, not based on any existing video game item. *(+ sufijo de estilo)*

### 22. `bits.svg`
**Genera:** 512×512 PNG → vectorizar · **Fondo:** transparente
> Icon of a stack of three glowing violet gem coins, simple bold vector, uniform thick stroke, on plain
> magenta background. *(+ sufijo de estilo)*

### 23. `sub.svg`
**Genera:** 512×512 PNG → vectorizar · **Fondo:** transparente
> Icon of a star inside a rounded speech bubble, violet and gold, simple bold vector, uniform thick stroke,
> on plain magenta background. *(+ sufijo de estilo)*

### 24. `carcel.svg`
**Genera:** 512×512 PNG → vectorizar · **Fondo:** transparente
> Icon of vertical prison bars with a small padlock in front, red #FF5A6E and navy, simple bold vector,
> uniform thick stroke, on plain magenta background. *(+ sufijo de estilo)*

### 25. `cementerio.svg` *(nuevo — lo pide el estado del cementerio)*
**Genera:** 512×512 PNG → vectorizar · **Fondo:** transparente
> Icon of a simple rounded tombstone with a small cross-shaped notch, muted violet and grey, simple bold
> vector, uniform thick stroke, on plain magenta background. *(+ sufijo de estilo)*

### 26. `dado.svg`
**Genera:** 512×512 PNG → vectorizar · **Fondo:** transparente
> Icon of a six-sided die showing the five face, violet with gold pips, simple bold vector, uniform thick
> stroke, on plain magenta background. *(+ sufijo de estilo)*

### 27. `prestamo.svg` *(nuevo — panel de préstamos)*
**Genera:** 512×512 PNG → vectorizar · **Fondo:** transparente
> Icon of a coin with a circular arrow looping around it and a small upward arrow, gold and violet, simple
> bold vector, uniform thick stroke, on plain magenta background. *(+ sufijo de estilo)*

### 28. `avatar-default.png`
**Genera:** 512×512 PNG · **Fondo:** sólido, no transparente
Lo que se ve cuando un jugador no tiene foto. Tiene que ser **neutro y aburrido**: aparece muchas veces.
> Neutral default user avatar: a simple flat silhouette of a head and shoulders in muted violet-grey on a
> dark navy #070A18 circular background, extremely simple, no facial features, no text.

### 29. `mvp.svg` *(nuevo — se marca en cada partida)*
**Genera:** 512×512 PNG → vectorizar · **Fondo:** transparente
> Icon of a laurel wreath surrounding an empty center, gold, simple bold vector, uniform thick stroke, on
> plain magenta background, no text. *(+ sufijo de estilo)*

### 30. `ace.svg` *(nuevo)*
**Genera:** 512×512 PNG → vectorizar · **Fondo:** transparente
> Icon of a five-point star with a sharp sword crossing behind it diagonally, gold and violet, simple bold
> vector, uniform thick stroke, on plain magenta background. *(+ sufijo de estilo)*

---

## 🏆 Premios (31–33) — `assets/ui/`

### 31–33. `premio-1.png` / `premio-2.png` / `premio-3.png`
**Genera:** 768×768 PNG cada uno · **Fondo:** transparente
Para la sección de Premios de la Home. Tres medallas del mismo diseño en oro, plata y bronce.

> A single hanging medal with a violet ribbon and a [gold / silver / bronze] circular medallion embossed
> with a small crown, three-quarter view, semi-realistic stylized 3D render, soft violet rim light, on a
> plain flat magenta background.

---

## 📸 Lo que NO se genera con IA

| Carpeta | Por qué |
|---|---|
| `assets/players/` | Son fotos reales de los jugadores. Se suben desde el Tier Manager a Supabase Storage. |
| `assets/sponsors/` | Te los pasan los propios patrocinadores. Solo pídelos en SVG para fondo oscuro, alto 32 px. |
| Iconos de redes | Twitch, Discord, X, TikTok, YouTube, Instagram: los pongo yo desde una librería de iconos. |
| `wordmark.svg` | Es tipografía, no ilustración. |

---

## Resumen para ir tachando

| # | Archivo | Carpeta | Genera a | Final |
|---|---|---|---|---|
| 1 | isotipo.svg 🟥 | brand | 1024×1024 | SVG |
| 2 | logo-horizontal.svg 🟥 | brand | 1536×512 | SVG |
| 3 | favicon.png 🟥 | brand | 512×512 | PNG |
| 4 | logo-horizontal-light.svg | brand | 1536×512 | SVG |
| 5 | wordmark.svg | brand | — (tipografía) | SVG |
| 6 | trofeo-hero.png | brand | 1536×1536 | PNG |
| 7 | og-image.png | brand | 1200×630 | PNG |
| 8 | hero-bg.jpg | backgrounds | 1920×1080 | JPG |
| 9 | textura.png | backgrounds | 512×512 | PNG |
| 10–14 | los 5 modos | modes | 512×512 | SVG |
| 15–20 | los 6 tiers | tiers | 512×512 | SVG |
| 21 | blue-shell.png | ui | 512×512 | PNG |
| 22–29 | bits, sub, cárcel, cementerio, dado, préstamo, mvp, ace | ui | 512×512 | SVG |
| 30 | avatar-default.png | ui | 512×512 | PNG |
| 31–33 | premio-1/2/3.png | ui | 768×768 | PNG |

🟥 = bloquea la Fase 1. Con esas tres puedo arrancar.
