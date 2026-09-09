import type { MuscleGroup } from '../db/types'

/** Nombre visible de cada grupo muscular. */
export const GROUP_LABEL: Record<MuscleGroup, string> = {
  pecho: 'Pectoral',
  espalda: 'Espalda',
  hombro: 'Hombro',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  cuadriceps: 'Cuádriceps',
  femoral: 'Femoral',
  gluteo: 'Glúteo',
  gemelo: 'Gemelo',
  core: 'Core',
}
