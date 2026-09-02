import type { Exercise, LoadType, MuscleGroup, UnitMode } from './types'

type SeedRow = [name: string, group: MuscleGroup, load: LoadType, inc: number, mode?: UnitMode]

// Catálogo precargado (especificaciones §3.1): una app vacía es inservible.
const ROWS: SeedRow[] = [
  // pecho
  ['Press banca', 'pecho', 'barbell', 2.5],
  ['Press banca inclinado', 'pecho', 'barbell', 2.5],
  ['Press con mancuernas', 'pecho', 'dumbbell', 2],
  ['Press inclinado con mancuernas', 'pecho', 'dumbbell', 2],
  ['Aperturas con mancuernas', 'pecho', 'dumbbell', 2],
  ['Cruce de poleas', 'pecho', 'cable', 2.5],
  ['Press en máquina', 'pecho', 'machine', 5],
  ['Fondos en paralelas', 'pecho', 'bodyweight', 2.5],
  ['Flexiones', 'pecho', 'bodyweight', 0, 'reps_only'],
  // espalda
  ['Dominadas', 'espalda', 'bodyweight', 2.5],
  ['Jalón al pecho', 'espalda', 'cable', 5],
  ['Remo con barra', 'espalda', 'barbell', 2.5],
  ['Remo con mancuerna', 'espalda', 'dumbbell', 2],
  ['Remo en máquina', 'espalda', 'machine', 5],
  ['Remo en polea baja', 'espalda', 'cable', 5],
  ['Pullover en polea', 'espalda', 'cable', 2.5],
  ['Peso muerto', 'espalda', 'barbell', 2.5],
  ['Rack pull', 'espalda', 'barbell', 2.5],
  // hombro
  ['Press militar', 'hombro', 'barbell', 2.5],
  ['Press militar sentado', 'hombro', 'barbell', 2.5],
  ['Press de hombro con mancuernas', 'hombro', 'dumbbell', 2],
  ['Elevaciones laterales', 'hombro', 'dumbbell', 2],
  ['Elevaciones laterales en polea', 'hombro', 'cable', 2.5],
  ['Pájaros', 'hombro', 'dumbbell', 2],
  ['Face pull', 'hombro', 'cable', 2.5],
  ['Encogimientos', 'hombro', 'dumbbell', 2],
  // bíceps
  ['Curl con barra', 'biceps', 'barbell', 2.5],
  ['Curl con barra Z', 'biceps', 'barbell', 2.5],
  ['Curl con mancuernas', 'biceps', 'dumbbell', 2],
  ['Curl martillo', 'biceps', 'dumbbell', 2],
  ['Curl en polea', 'biceps', 'cable', 2.5],
  ['Curl inclinado', 'biceps', 'dumbbell', 2],
  ['Curl predicador', 'biceps', 'machine', 2.5],
  // tríceps
  ['Press francés', 'triceps', 'barbell', 2.5],
  ['Extensión de tríceps en polea', 'triceps', 'cable', 2.5],
  ['Extensión sobre la cabeza', 'triceps', 'cable', 2.5],
  ['Press cerrado', 'triceps', 'barbell', 2.5],
  ['Patada de tríceps', 'triceps', 'dumbbell', 2],
  // cuádriceps
  ['Sentadilla', 'cuadriceps', 'barbell', 2.5],
  ['Sentadilla frontal', 'cuadriceps', 'barbell', 2.5],
  ['Prensa', 'cuadriceps', 'machine', 5],
  ['Extensión de cuádriceps', 'cuadriceps', 'machine', 5],
  ['Zancadas', 'cuadriceps', 'dumbbell', 2],
  ['Sentadilla búlgara', 'cuadriceps', 'dumbbell', 2],
  ['Hack squat', 'cuadriceps', 'machine', 5],
  // femoral
  ['Peso muerto rumano', 'femoral', 'barbell', 2.5],
  ['Curl femoral tumbado', 'femoral', 'machine', 5],
  ['Curl femoral sentado', 'femoral', 'machine', 5],
  ['Buenos días', 'femoral', 'barbell', 2.5],
  ['Hiperextensiones', 'femoral', 'bodyweight', 2.5],
  // glúteo
  ['Hip thrust', 'gluteo', 'barbell', 2.5],
  ['Puente de glúteo', 'gluteo', 'barbell', 2.5],
  ['Abducción en máquina', 'gluteo', 'machine', 5],
  // gemelo
  ['Elevación de talones de pie', 'gemelo', 'machine', 5],
  ['Elevación de talones sentado', 'gemelo', 'machine', 5],
  ['Gemelo en prensa', 'gemelo', 'machine', 5],
  // core
  ['Plancha', 'core', 'bodyweight', 0, 'time'],
  ['Crunch en polea', 'core', 'cable', 2.5],
  ['Elevaciones de piernas', 'core', 'bodyweight', 0, 'reps_only'],
  ['Rueda abdominal', 'core', 'bodyweight', 0, 'reps_only'],
  ['Crunch en máquina', 'core', 'machine', 5],
]

export function seedExercises(userId: string): Exercise[] {
  return ROWS.map(([name, muscle_group, load_type, min_increment, mode]) => ({
    id: crypto.randomUUID(),
    user_id: userId,
    name,
    muscle_group,
    load_type,
    min_increment,
    unit_mode: mode ?? 'weight_reps',
    notes: '',
    is_custom: false,
    archived: false,
  }))
}
