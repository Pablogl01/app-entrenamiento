import { useState } from 'react'
import type { Exercise } from '../db/types'
import { ExerciseMark } from './ExerciseMark'
import { PhotoLightbox } from './PhotoLightbox'

/**
 * Fotos de ejercicio empaquetadas (DESIGN.md v2.1 §5): free-exercise-db,
 * dominio público, ver src/assets/exercises/SOURCES.md. Clave = nombre del
 * fichero sin extensión. Sin foto (o si no carga), marca geométrica.
 */
const files = import.meta.glob('../assets/exercises/*.webp', { eager: true, import: 'default' }) as Record<string, string>

export const EXERCISE_IMAGES: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -'.webp'.length), url]),
)

interface Props {
  exercise: Exercise
  size?: 'sm' | 'md' | 'lg' | 'wide'
  /**
   * La foto se puede tocar para verla en grande. Solo donde la foto no está ya
   * dentro de otro botón o enlace: aquí se renderiza un <button>.
   */
  zoom?: boolean
}

export function ExerciseVisual({ exercise, size = 'md', zoom = false }: Props) {
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)
  const src = exercise.image !== null ? EXERCISE_IMAGES[exercise.image] : undefined
  const cls = size === 'sm' ? 'mark mark--sm' : size === 'lg' ? 'mark mark--lg' : size === 'wide' ? 'mark mark--wide' : 'mark'
  if (src !== undefined && !failed) {
    const img = <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
    if (!zoom) return <span className={`${cls} mark--photo`}>{img}</span>
    return (
      <>
        <button type="button" className={`${cls} mark--photo mark--zoom`} aria-label={`Ver foto de ${exercise.name}`} onClick={() => setOpen(true)}>
          {img}
        </button>
        {open && <PhotoLightbox exercise={exercise} src={src} onClose={() => setOpen(false)} />}
      </>
    )
  }
  return (
    <span className={cls}>
      <ExerciseMark group={exercise.muscle_group} size={size === 'sm' ? 22 : size === 'lg' || size === 'wide' ? 30 : 28} />
    </span>
  )
}
