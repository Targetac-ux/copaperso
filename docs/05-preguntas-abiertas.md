# CopaPerso — Preguntas abiertas

## ✅ Resueltas

1. **Costos** → rigen los de **§13**: cupo (entrar en lugar de alguien ya seleccionado) 200, cambio de Team 150,
   sacar de la banca 200, cambio de rol y reingreso 300, sacar del cementerio 300, Blue Shell 500.
2. **Cárcel, cementerio, cupo y reingreso son cosas distintas:**
   - **Cementerio:** no alcanzó a inscribirse; aplica **con el draft ya arrancado** → 300 bits para salir.
   - **Cupo:** con los equipos ya hechos, alguien del cementerio entra **en lugar de** un jugador ya
     seleccionado, saltándose el aleatorio → 200 bits. El desplazado vuelve a la banca.
   - **Cambio de rol y reingreso:** ya salió sorteado y quiere entrar con otro rol → 300 bits.
   - **Cárcel:** el castigo manual del host (§17).
3. **Los 100 LP se reinician cada mes (periodo).** Todas las sesiones del mes acumulan sobre el mismo LP.
4. **La vista pública en vivo entra al MVP.** Realtime desde la Fase 1 y nueva Fase 4B.
5. **Interés de préstamos:** 10 % del monto original por cada día transcurrido, **lineal**.
   `adeudo = principal + principal × 0.10 × días`. 400 bits → 440, 480, 520… y 880 al día 12.
6. **Bits ↔ subs:** no hay tipo de cambio. `1 sub NA/EUW` o `2 subs LATAM` valen *cualquiera* de las
   recompensas y al final lo decide el streamer. Va como nota en la tabla, no como columna calculada.
7. **El CCTM lo usa una sola persona a la vez.** No hay que resolver conflictos de edición
   concurrente en la Fase 3: se asume un único operador. El esquema mantiene el rol `moderator`
   por si algún día hace falta, pero no se diseña para uso simultáneo.
8. **Las recompensas no ejecutan nada.** El catálogo es una lista de precios de consulta; el host cumple la
   recompensa moviendo él mismo a los participantes. El sistema solo deja constancia en la bitácora.
9. **El Tier Ranking es manual** (14 de septiembre de 2026). El host coloca a cada jugador en su tier;
   el LP del periodo no lo decide ni lo propone. La columna de «Puntos» del wireframe es un valor que
   se escribe a mano, no un cálculo. Desbloquea la Fase 6.

## ✅ Timer de negociación — cerrado (10 de septiembre de 2026)

- **Tramos libres.** El streamer reinicia el cronómetro con la duración que quiera, las veces que quiera.
- **El ×3 se aplica una sola vez por sesión** y se mantiene. Si el cronómetro vuelve a agotarse estando
  ya triplicado, el aviso lo dice y no vuelve a ofrecerlo.
- **El ×3 es fijo**, no configurable.
- **Hay botón para deshacerlo** y volver a precio normal.
- **Se ve en la vista pública en vivo**, con aviso sonoro sutil.

- **El ×3 dura una partida, no la sesión** (14 de septiembre de 2026). Cada partida tiene su propia
  negociación y empieza a precio normal, así que al cerrar una partida los precios vuelven solos.
  Deshacer la partida devuelve el ×3, para no perderlo sin querer.

## ✅ Donaciones de PayPal — cerrado (14 de septiembre de 2026)

- **Enlace:** <https://paypal.me/Targetac>
- **Es del desarrollador, no del torneo.** No van a premios ni al servidor: van a quien programa la
  página. El apartado lo dice explícitamente para que nadie done creyendo otra cosa.
- **Tono:** el desarrollo se hizo sin esperar compensación; la donación es opcional y para ir
  mejorando la página.
- **Dónde:** apartado propio al final de la Home. Abre PayPal en pestaña nueva con `rel="noopener"`;
  **ningún formulario de pago vive dentro de CopaPerso**.

> Ojo: el blueprint publicado todavía dice «Las donaciones van a los premios y al servidor», que era
> la idea vieja. Hay que corregirlo cuando se actualice.

## ✅ Confirmadas por el host (14 de septiembre de 2026)

Estas cuatro las había resuelto yo por defecto para poder seguir construyendo. El host las revisó y
**se quedan como estaban**:

| Pregunta | Queda así | Dónde vive |
|---|---|---|
| **Equipos incompletos** | Se puede jugar y cerrar un 4v5: avisa, no bloquea | `shared/lp.ts` |
| **Rol duplicado** | Dos MID en el mismo equipo: avisa, no bloquea | `shared/draft.ts` |
| **ACE** | A mano como el MVP, uno por partida, acumula (+30 con victoria y MVP) | `shared/lp.ts` |
| **Blue Shell** | Los cuatro resultados al 25 % | `shared/blueshell.ts` |

Y estas tres las contestó el host:

- **Todos los modos dan y quitan el mismo LP.** No hay reglas por modo; el modo es una etiqueta de la
  sesión. Confirma lo que ya estaba construido en la Fase 4.
- **Al usar el cupo, el desplazado no recibe nada:** vuelve a la banca y ya. Confirma el
  comportamiento actual.
- **Todo en español**, interfaz del host incluida.

## 🕓 Pendientes de fecha, no de decisión

- ✅ **Fotos de jugadores** — hecho en la Fase 5. Las sube el host desde la ficha del jugador y
  **elige el encuadre**: arrastra y amplía dentro de un marco redondo, y se guarda lo que ve. Si no
  toca nada, el servidor recorta solo buscando la parte con más detalle.
- **Datos históricos:** el host pasará el Excel al día **cuando el desarrollo esté terminado**; el
  que hay ahora está desactualizado en banco y puntos. La importación va después de la Fase 7, no
  dentro de ninguna fase.
- **Dominio:** no hay todavía. Se despliega en Vercel y se usa esa URL. Cuando haya dominio, basta
  con cambiar `NUXT_PUBLIC_SITE_URL` para que las og:image y los enlaces absolutos apunten bien.

## 📅 Fecha objetivo

**Empezar a usarlo en octubre de 2026.** Lo que hace falta para operar una CopaPerso —registro,
banca, sorteo, equipos, negociación, economía, partidas, LP e historial— **ya está construido y
probado**. El roster, el tier manager y la Home terminada son lo que queda, y ninguno hace falta
para dirigir el torneo en vivo.
