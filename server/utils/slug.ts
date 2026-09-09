/**
 * Misma normalización que player_slug() en la base de datos: sin acentos, sin
 * símbolos, minúsculas. Es lo que hace que "Target", "TARGET" y "Tárget"
 * apunten al mismo perfil y no se dupliquen (§4).
 */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}
