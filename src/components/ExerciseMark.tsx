import type { MuscleGroup } from '../db/types'

/**
 * Marca geométrica derivada del grupo muscular (DESIGN.md v2 §5): trazo único
 * de 2px --ink sobre el lecho --well, sin relleno. No hay fotos de ejercicio:
 * no existen offline y una imagen rota o un gris de relleno son peores.
 */
const PATHS: Record<MuscleGroup, string> = {
  pecho: 'M24 10a14 14 0 1 1 0 28a14 14 0 1 1 0-28M10 24h28',
  espalda: 'M24 8l14 16-14 16-14-16z',
  hombro: 'M24 10l15 26H9z',
  biceps: 'M24 9a7 7 0 1 1 0 14a7 7 0 1 1 0-14M24 25a7 7 0 1 1 0 14a7 7 0 1 1 0-14',
  triceps: 'M9 12h30L24 38z',
  cuadriceps: 'M18 9v30M30 9v30',
  femoral: 'M9 18h30M9 30h30',
  gluteo: 'M10 22a14 14 0 0 1 28 0M10 34a14 14 0 0 1 28 0',
  gemelo: 'M10 26l14-12 14 12M10 36l14-12 14 12',
  core: 'M24 9v30M9 24h30',
}

interface Props {
  group: MuscleGroup
  size?: number
}

export function ExerciseMark({ group, size = 28 }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path d={PATHS[group]} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
