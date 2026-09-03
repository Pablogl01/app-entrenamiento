// Modo de color (DESIGN.md v2 §1): sistema por defecto, forzable desde
// Ajustes. El script inline de index.html pinta el primer frame con lo que
// haya en localStorage; aquí se mantiene sincronizado con Dexie y con los
// cambios del sistema.
import type { Theme } from '../db/types'

const KEY = 'theme'
const media = window.matchMedia('(prefers-color-scheme: dark)')
let current: Theme = 'system'

function resolve(theme: Theme): 'dark' | 'light' {
  if (theme === 'system') return media.matches ? 'dark' : 'light'
  return theme
}

function paint(): void {
  const resolved = resolve(current)
  document.documentElement.dataset.theme = resolved
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (meta) meta.content = resolved === 'dark' ? '#121315' : '#f8f7f4'
}

export function applyTheme(theme: Theme): void {
  current = theme
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    /* sin almacenamiento: se pinta igual */
  }
  paint()
}

media.addEventListener('change', () => {
  if (current === 'system') paint()
})
