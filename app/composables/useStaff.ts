import type { AppUser } from '#shared/types/models'

/**
 * Perfil del host/moderador que ha iniciado sesión. Se pide una vez por
 * sesión de navegador y se comparte entre componentes.
 */
export function useStaff() {
  const staff = useState<AppUser | null>('staff', () => null)
  const pending = useState<boolean>('staff-pending', () => false)

  async function loadStaff(force = false) {
    if (staff.value && !force) return staff.value
    pending.value = true
    try {
      staff.value = await $fetch<AppUser>('/api/me')
    } catch {
      staff.value = null
    } finally {
      pending.value = false
    }
    return staff.value
  }

  return { staff, pending, loadStaff }
}
