// Teclado para los grupos role="radiogroup" hechos con botones (patrón roving tabindex):
// flechas mueven la selección, Home/End van a los extremos, y solo la opción activa
// entra en el orden de tabulación. Se cuelga del contenedor con onKeyDown.
import type { KeyboardEvent } from 'react'

const KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'])

export function radioGroupKeyDown(e: KeyboardEvent<HTMLElement>): void {
  if (!KEYS.has(e.key)) return
  const radios = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]'))
  const current = radios.indexOf(document.activeElement as HTMLElement)
  if (current === -1) return
  e.preventDefault()
  let next: number
  switch (e.key) {
    case 'ArrowLeft':
    case 'ArrowUp':
      next = (current - 1 + radios.length) % radios.length
      break
    case 'ArrowRight':
    case 'ArrowDown':
      next = (current + 1) % radios.length
      break
    case 'Home':
      next = 0
      break
    default:
      next = radios.length - 1
  }
  radios[next].focus()
  radios[next].click()
}
