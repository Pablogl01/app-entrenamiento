import { useRef, useState, type PointerEvent } from 'react'

/**
 * Reordenar arrastrando con pulsación larga: el asa es el elemento entero.
 * Devuelve handlers por índice y el índice en vuelo para pintarlo.
 */
export function useReorder(count: number, onMove: (from: number, to: number) => void) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const timer = useRef<number | null>(null)
  const startY = useRef(0)
  const from = useRef(0)
  const itemH = useRef(0)

  function clear() {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
  }

  function handlers(index: number) {
    return {
      onPointerDown: (e: PointerEvent<HTMLElement>) => {
        const el = e.currentTarget
        startY.current = e.clientY
        from.current = index
        itemH.current = el.getBoundingClientRect().height + 8
        clear()
        timer.current = window.setTimeout(() => {
          setDragIndex(index)
          el.setPointerCapture(e.pointerId)
        }, 300)
      },
      onPointerMove: (e: PointerEvent<HTMLElement>) => {
        if (dragIndex === null) {
          // si se mueve antes de la pulsación larga, es scroll: cancelar
          if (Math.abs(e.clientY - startY.current) > 8) clear()
          return
        }
        const delta = Math.round((e.clientY - startY.current) / itemH.current)
        const to = Math.max(0, Math.min(count - 1, from.current + delta))
        if (to !== dragIndex) setDragIndex(to)
      },
      onPointerUp: (e: PointerEvent<HTMLElement>) => {
        clear()
        if (dragIndex !== null) {
          e.currentTarget.releasePointerCapture(e.pointerId)
          if (dragIndex !== from.current) onMove(from.current, dragIndex)
          setDragIndex(null)
        }
      },
      onPointerCancel: () => {
        clear()
        setDragIndex(null)
      },
    }
  }

  return { handlers, dragIndex }
}
