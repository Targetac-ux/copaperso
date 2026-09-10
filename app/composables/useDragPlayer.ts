/**
 * Qué jugador se está arrastrando ahora mismo.
 *
 * Va en un estado compartido y no solo en dataTransfer porque los paneles
 * necesitan saberlo mientras dura el arrastre, para resaltar los huecos donde
 * se puede soltar. dataTransfer solo se puede leer al soltar.
 */
export function useDragPlayer() {
  const dragging = useState<string | null>('cctm-dragging', () => null)

  function start(event: DragEvent, sessionParticipantId: string) {
    dragging.value = sessionParticipantId
    event.dataTransfer?.setData('text/plain', sessionParticipantId)
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
  }

  function end() {
    dragging.value = null
  }

  function read(event: DragEvent): string | null {
    return event.dataTransfer?.getData('text/plain') || dragging.value
  }

  return { dragging, start, end, read }
}
