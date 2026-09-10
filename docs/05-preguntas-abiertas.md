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

## 🆕 Sobre el timer de negociación (septiembre 2026)

Lo suficiente para construirlo está claro, pero estas afinan el comportamiento:

- **¿Cuántos tramos hay?** El flujo que describiste es: 15 min a precio normal → se triplica → tiempo
  extra. ¿Y cuando se acaba el tiempo extra? ¿Se cierra la negociación, vuelve a saltar el aviso, o
  simplemente sigue todo en ×3 hasta que empiece la partida?
- **¿El ×3 es fijo?** ¿O prefieres poder escribir el multiplicador, por si algún día quieres ×2 o ×5?
- **¿Se triplica absolutamente todo?** Cupo, cambio de Team, sacar de banca, rol y reingreso, cementerio
  y Blue Shell. ¿Alguna se queda a precio normal?
- **¿Se puede volver a precio normal** en la misma sesión, o una vez triplicado ya no hay marcha atrás?
  (Lo dejaré deshacible por si lo pulsas sin querer, salvo que digas lo contrario.)
- **¿El cronómetro se ve en la vista pública en vivo?** Que los espectadores vean cuánto queda para que
  suban los precios podría animar bastante las donaciones.
- **¿Quieres aviso sonoro** además del emergente, o solo visual?

## 🆕 Sobre las donaciones de PayPal

- **¿Qué enlace usamos?** ¿Un `paypal.me/…`, el botón de donación de PayPal, o tu correo de PayPal?
- **¿Qué debe decir el apartado?** Ayuda saber a qué van las donaciones (premios, servidor, la copa) —
  la gente dona más cuando sabe para qué.
- **¿Va también en el pie de página**, además del bloque en la Home?

## 🟡 Importantes

8. **Tier Ranking: ¿manual o calculado?** §30 lo describe administrativo, pero el wireframe muestra una
   columna de "Puntos". ¿Lo decides a mano, o se propone desde el LP del periodo y tú ajustas?
9. **Equipos incompletos.** ¿Se puede iniciar una partida 4v5, o el sistema debe bloquearlo hasta tener 5v5?
10. **Rol duplicado.** ¿Puede haber dos MID en el mismo equipo, o debe impedirse?
12. **ACE.** ¿Lo asignas a criterio, o hay una definición fija?
13. **Modos de juego.** ¿Cambian las reglas de LP, o son solo etiquetas de la sesión? En ARAM AFK con una
    sola vida, ¿el LP funciona igual?
14. **Blue Shell.** ¿Los cuatro resultados tienen la misma probabilidad? ¿Quieres editar la lista y sus pesos?
15. **Al usar el cupo, ¿el desplazado recibe algo?** ¿Vuelve a la banca sin más, o se le compensa
    (prioridad en el siguiente draft, bits, etc.)?

## 🟢 Menores

16. **Fotos de jugadores.** ¿Las subes tú, o se toman del avatar de Twitch?
17. **Dominio.** ¿Ya tienes uno reservado (copaperso.gg / .com)?
18. **Idioma.** Todo en español, ¿incluida la interfaz del host?
19. **Datos históricos.** Tienes `CCTM Manager.xlsm` y `CCPR Roster.xlsm` en Descargas. ¿Importamos ese
    historial, o CopaPerso arranca limpio en un periodo nuevo? Importar son ~media semana extra en la Fase 2.
