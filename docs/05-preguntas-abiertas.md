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

> Queda un matiz menor sin cerrar, que no bloquea nada: si una sesión tiene varias partidas y entre
> ellas hay otra ronda de negociación, asumo que **los precios siguen en ×3** (una vez triplicados, se
> quedan así toda la sesión). Si prefieres que vuelvan a precio normal al empezar cada partida, dilo
> y se cambia en una línea.

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

## 🔵 Decididas por defecto al construir — **confirma o cámbialas**

Estas cuatro hacían falta para poder seguir, así que las resolví con el criterio de la casa («el host
manda», §1) y **ya están construidas**. No son decisiones tuyas todavía: si alguna no te cuadra,
dilo y se cambia.

| # | Pregunta | Lo que hace hoy | Dónde se cambia |
|---|---|---|---|
| 9 | **Equipos incompletos** | Se puede empezar y cerrar un 4v5. Al cerrar avisa de con cuántos jugó cada lado, pero no bloquea | `shared/lp.ts` (`avisosDeCierre`) |
| 10 | **Rol duplicado** | Dos MID en el mismo equipo se permiten **con aviso**, igual que el off-role | `shared/draft.ts` (`duplicate_role`) |
| 12 | **ACE** | A mano como el MVP, uno por partida, sin restricción de equipo, y acumula: victoria + MVP + ACE son +30 | `shared/lp.ts` |
| 14 | **Blue Shell** | Los cuatro resultados al 25 % | `shared/blueshell.ts` (`girar`) |

## 🟡 Importantes — siguen abiertas

13. **Modos de juego.** ¿Cambian las reglas de LP, o son solo etiquetas de la sesión? En ARAM AFK con una
    sola vida, ¿el LP funciona igual? **Construido asumiendo que el LP es el mismo en todos los modos.**
    Si cambia, hay que volver sobre la Fase 4, que ya está cerrada.
15. **Al usar el cupo, ¿el desplazado recibe algo?** ¿Vuelve a la banca sin más, o se le compensa
    (prioridad en el siguiente draft, bits, etc.)? Hoy vuelve a la banca sin más. Toca la Fase 3B,
    ya cerrada.

## 🟢 Menores

16. **Fotos de jugadores.** ¿Las subes tú, o se toman del avatar de Twitch?
17. **Dominio.** ¿Ya tienes uno reservado (copaperso.gg / .com)?
18. **Idioma.** Todo en español, ¿incluida la interfaz del host?
19. **Datos históricos.** Tienes `CCTM Manager.xlsm` y `CCPR Roster.xlsm` en Descargas. ¿Importamos ese
    historial, o CopaPerso arranca limpio en un periodo nuevo? **La Fase 2 ya está cerrada sin importar
    nada**, así que a estas alturas sería trabajo aparte, no parte de una fase.
