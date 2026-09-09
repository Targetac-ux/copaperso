/**
 * El módulo de Supabase ya bloquea /host/* para quien no ha iniciado sesión.
 * Esto es la segunda vuelta: comprueba que además esté dado de alta en
 * app_user. Un usuario de Supabase que no sea staff no entra al panel.
 *
 * La comprobación de verdad vive en el servidor (server/utils/guard.ts);
 * esto solo evita que se vea una pantalla rota.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith('/host') || to.path === '/host/login') return

  const user = useSupabaseUser()
  if (!user.value) {
    return navigateTo({ path: '/host/login', query: { next: to.fullPath } })
  }

  const { staff, loadStaff } = useStaff()
  if (!staff.value) await loadStaff()

  if (!staff.value) {
    return navigateTo({ path: '/host/login', query: { error: 'sin-acceso' } })
  }
})
