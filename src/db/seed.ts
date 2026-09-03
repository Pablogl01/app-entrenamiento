import type { Exercise, LoadType, MuscleGroup, UnitMode } from './types'
import imageMap from '../assets/exercises/map.json'

/** Nombre del catálogo → clave de la foto (src/assets/exercises, dominio público). */
export const SEED_IMAGES: Record<string, string> = imageMap

type SeedRow = [name: string, group: MuscleGroup, load: LoadType, inc: number, mode?: UnitMode]

// Catálogo precargado (especificaciones §3.1): una app vacía es inservible.
const ROWS: SeedRow[] = [
  // pecho
  ['Press banca', 'pecho', 'barbell', 2.5],
  ['Press inclinado en máquina', 'pecho', 'machine', 5],
  ['Aperturas en máquina', 'pecho', 'machine', 5],
  ['Press declinado', 'pecho', 'barbell', 2.5],
  ['Pullover con mancuerna', 'pecho', 'dumbbell', 2],
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
  ['Jalón agarre estrecho', 'espalda', 'cable', 5],
  ['Remo T', 'espalda', 'barbell', 2.5],
  ['Remo Pendlay', 'espalda', 'barbell', 2.5],
  ['Remo unilateral en polea', 'espalda', 'cable', 2.5],
  // hombro
  ['Press militar', 'hombro', 'barbell', 2.5],
  ['Press militar sentado', 'hombro', 'barbell', 2.5],
  ['Press de hombro con mancuernas', 'hombro', 'dumbbell', 2],
  ['Elevaciones laterales', 'hombro', 'dumbbell', 2],
  ['Elevaciones laterales en polea', 'hombro', 'cable', 2.5],
  ['Pájaros', 'hombro', 'dumbbell', 2],
  ['Face pull', 'hombro', 'cable', 2.5],
  ['Encogimientos', 'hombro', 'dumbbell', 2],
  ['Press Arnold', 'hombro', 'dumbbell', 2],
  ['Remo al mentón', 'hombro', 'barbell', 2.5],
  ['Elevación frontal', 'hombro', 'dumbbell', 2],
  ['Press de hombro en máquina', 'hombro', 'machine', 5],
  // bíceps
  ['Curl con barra', 'biceps', 'barbell', 2.5],
  ['Curl con barra Z', 'biceps', 'barbell', 2.5],
  ['Curl con mancuernas', 'biceps', 'dumbbell', 2],
  ['Curl martillo', 'biceps', 'dumbbell', 2],
  ['Curl en polea', 'biceps', 'cable', 2.5],
  ['Curl inclinado', 'biceps', 'dumbbell', 2],
  ['Curl predicador', 'biceps', 'machine', 2.5],
  ['Curl concentrado', 'biceps', 'dumbbell', 2],
  ['Curl araña', 'biceps', 'dumbbell', 2],
  ['Curl en máquina', 'biceps', 'machine', 5],
  // tríceps
  ['Press francés', 'triceps', 'barbell', 2.5],
  ['Extensión de tríceps en polea', 'triceps', 'cable', 2.5],
  ['Extensión sobre la cabeza', 'triceps', 'cable', 2.5],
  ['Press cerrado', 'triceps', 'barbell', 2.5],
  ['Patada de tríceps', 'triceps', 'dumbbell', 2],
  ['Tríceps unilateral en polea', 'triceps', 'cable', 2.5],
  ['Extensión con cuerda', 'triceps', 'cable', 2.5],
  ['Tríceps en máquina', 'triceps', 'machine', 5],
  ['Fondos entre bancos', 'triceps', 'bodyweight', 0, 'reps_only'],
  // cuádriceps
  ['Sentadilla', 'cuadriceps', 'barbell', 2.5],
  ['Sentadilla frontal', 'cuadriceps', 'barbell', 2.5],
  ['Prensa', 'cuadriceps', 'machine', 5],
  ['Extensión de cuádriceps', 'cuadriceps', 'machine', 5],
  ['Zancadas', 'cuadriceps', 'dumbbell', 2],
  ['Sentadilla búlgara', 'cuadriceps', 'dumbbell', 2],
  ['Hack squat', 'cuadriceps', 'machine', 5],
  ['Prensa inclinada', 'cuadriceps', 'machine', 5],
  ['Sentadilla en multipower', 'cuadriceps', 'machine', 2.5],
  ['Sentadilla goblet', 'cuadriceps', 'dumbbell', 2],
  ['Zancadas caminando', 'cuadriceps', 'dumbbell', 2],
  // femoral
  ['Peso muerto rumano', 'femoral', 'barbell', 2.5],
  ['Curl femoral tumbado', 'femoral', 'machine', 5],
  ['Curl femoral sentado', 'femoral', 'machine', 5],
  ['Buenos días', 'femoral', 'barbell', 2.5],
  ['Hiperextensiones', 'femoral', 'bodyweight', 2.5],
  ['Curl femoral unilateral', 'femoral', 'machine', 5],
  ['Peso muerto rumano con mancuernas', 'femoral', 'dumbbell', 2],
  ['Curl nórdico', 'femoral', 'bodyweight', 0, 'reps_only'],
  // glúteo
  ['Hip thrust', 'gluteo', 'barbell', 2.5],
  ['Puente de glúteo', 'gluteo', 'barbell', 2.5],
  ['Abducción en máquina', 'gluteo', 'machine', 5],
  ['Aductores en máquina', 'gluteo', 'machine', 5],
  ['Patada de glúteo en polea', 'gluteo', 'cable', 2.5],
  ['Hip thrust en máquina', 'gluteo', 'machine', 5],
  // gemelo
  ['Elevación de talones de pie', 'gemelo', 'machine', 5],
  ['Elevación de talones sentado', 'gemelo', 'machine', 5],
  ['Gemelo en prensa', 'gemelo', 'machine', 5],
  ['Elevación de talones en multipower', 'gemelo', 'machine', 2.5],
  // core
  ['Plancha', 'core', 'bodyweight', 0, 'time'],
  ['Crunch en polea', 'core', 'cable', 2.5],
  ['Elevaciones de piernas', 'core', 'bodyweight', 0, 'reps_only'],
  ['Rueda abdominal', 'core', 'bodyweight', 0, 'reps_only'],
  ['Crunch en máquina', 'core', 'machine', 5],
  ['Plancha lateral', 'core', 'bodyweight', 0, 'time'],
  ['Press Pallof', 'core', 'cable', 2.5],
  ['Crunch declinado', 'core', 'bodyweight', 0, 'reps_only'],
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
    image: SEED_IMAGES[name] ?? null,
  }))
}
