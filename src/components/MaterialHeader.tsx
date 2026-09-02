import type { ReactNode } from 'react'
import stone from '../assets/textures/stone.webp'
import iron from '../assets/textures/iron.webp'
import sand from '../assets/textures/sand.webp'
import neutral from '../assets/textures/neutral.webp'
import type { RoutineType } from '../db/types'

const TEXTURES = { stone, iron, sand, neutral } as const

export type MaterialKey = keyof typeof TEXTURES

/** strength alterna stone/iron por rutina (determinista); mobility = sand. */
export function materialFor(type: RoutineType, seed = ''): MaterialKey {
  if (type === 'strength') {
    let h = 0
    for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0
    return (h & 1) === 0 ? 'stone' : 'iron'
  }
  if (type === 'mobility') return 'sand'
  return 'neutral'
}

interface Props {
  material: MaterialKey
  eyebrow?: string
  /** Va en display-xl, mayúsculas, dos líneas como regla. */
  title?: string
  /** Título tranquilo (día de descanso): title blanco, sin display-xl. */
  quietTitle?: string
  minHeight?: number
  /** Parte de la secuencia orquestada de Hoy (una vez por sesión de app). */
  animate?: boolean
  children?: ReactNode
}

export function MaterialHeader({ material, eyebrow, title, quietTitle, minHeight = 240, animate = false, children }: Props) {
  return (
    <header className="mat" style={{ minHeight }}>
      <img className="mat__img" src={TEXTURES[material]} alt="" decoding="async" />
      <div className="mat__scrim" />
      {children}
      <div className={animate ? 'mat__text anim-enter' : 'mat__text'}>
        {eyebrow !== undefined && <p className="t-body mat__eyebrow">{eyebrow}</p>}
        {title !== undefined && <h1 className="t-xl">{title}</h1>}
        {quietTitle !== undefined && <h1 className="t-title">{quietTitle}</h1>}
      </div>
    </header>
  )
}
