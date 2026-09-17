/**
 * Los enlaces de fuera que aparecen en la web pública, **como respaldo**.
 *
 * Desde la Fase 7 los administra el host en `/host/ajustes` y viven en la tabla
 * `site_link`. Estas constantes son lo que se usa cuando la base no tiene fila
 * para esa red: antes de aplicar la migración, o si alguien la borra sin
 * querer. La alternativa era un botón principal que no lleva a ningún sitio.
 *
 * Solo Twitch y PayPal tienen respaldo, porque son las dos que tienen su propio
 * botón en la página. Las demás redes, si no hay enlace, no se pintan.
 */
export const CANAL_TWITCH = 'https://www.twitch.tv/madhusito'

/** El nombre del canal, para enseñarlo. */
export const CANAL_TWITCH_NOMBRE = 'madhusito'

/**
 * Va al desarrollador de la página, **no** a los premios del torneo. Donde
 * salga tiene que decirlo: el visitante no tiene forma de saberlo si no.
 */
export const PAYPAL = 'https://paypal.me/Targetac'

/**
 * El Discord de quien desarrolla la página, para quien quiera una igual.
 *
 * Va aquí y no suelto en la plantilla por lo mismo que el canal de Twitch: ya
 * pasó una vez que un enlace repetido en cinco sitios se quedó apuntando a
 * medias. Es un usuario, no una URL — Discord no tiene enlace público por
 * nombre, hace falta el id numérico— así que se enseña para copiar y ya.
 */
export const DISCORD_DEV = 'targetac'
