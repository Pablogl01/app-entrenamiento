// Modelo de datos del cliente (especificaciones §3). IndexedDB es la fuente
// de verdad; user_id existe desde el día uno aunque haya un solo usuario.

export type MuscleGroup =
  | 'pecho'
  | 'espalda'
  | 'hombro'
  | 'biceps'
  | 'triceps'
  | 'cuadriceps'
  | 'femoral'
  | 'gluteo'
  | 'gemelo'
  | 'core'

export type LoadType = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight'
export type UnitMode = 'weight_reps' | 'reps_only' | 'time'
export type RoutineType = 'strength' | 'mobility' | null
export type SetKind = 'warmup' | 'work' | 'failure'
export type WeightUnit = 'kg' | 'lb'
/** Modo de color (DESIGN.md v2 §1). `system` sigue a prefers-color-scheme. */
export type Theme = 'system' | 'dark' | 'light'
/** Objetivo de un ciclo o de un bloque (especificaciones §3.8). */
export type BlockGoal = 'fuerza' | 'volumen' | 'hipertrofia' | 'descarga'

export interface Exercise {
  id: string
  user_id: string
  name: string
  muscle_group: MuscleGroup
  load_type: LoadType
  min_increment: number
  unit_mode: UnitMode
  notes: string
  is_custom: boolean
  archived: boolean
  /** Clave de la foto empaquetada (src/assets/exercises). null = marca geométrica. */
  image: string | null
}

export interface Routine {
  id: string
  user_id: string
  name: string
  routine_type: RoutineType
  notes: string
  created_at: number
  archived: boolean
}

export interface RoutineExercise {
  id: string
  user_id: string
  routine_id: string
  exercise_id: string
  position: number
  target_sets: number
  target_reps_min: number
  target_reps_max: number
  /** RPE objetivo (6–10, paso 0,5). null = sin meta. */
  target_rpe: number | null
  /** Descanso sugerido entre series; arranca el temporizador al completar. */
  rest_seconds: number
}

/** weekday: 0 = lunes … 6 = domingo (la rejilla del calendario empieza en lunes). */
export interface RoutineSchedule {
  id: string
  user_id: string
  routine_id: string
  weekday: number
}

/**
 * Reasignación de un día programado (especificaciones §3.9): la sesión de
 * `from_date` pasa a `to_date`. to_date = null la anula sin mover.
 * `replaced_by` (con to_date = null): ese día se entrena OTRA rutina en su
 * lugar. Un solo registro, un solo «deshacer». Los registros anteriores a
 * este campo se leen como «sin sustitución».
 */
export interface ScheduleOverride {
  id: string
  user_id: string
  routine_id: string
  from_date: string
  to_date: string | null
  replaced_by?: string | null
}

export interface Session {
  id: string
  user_id: string
  /** Fecha local YYYY-MM-DD. */
  date: string
  /** null = borrador: la sesión empieza al pulsar el botón (DESIGN.md §9 v1.1). */
  started_at: number | null
  finished_at: number | null
  /** Solo procedencia. No se consulta para renderizar. */
  routine_id: string | null
  routine_name_snapshot: string
  notes: string
  /** RPE global de la sesión, 1–10 (era 1–5 hasta la v2.1). */
  rating: number | null
  /** Pausa en curso y tiempo acumulado en pausa; el cronómetro los descuenta. */
  paused_at: number | null
  paused_ms: number
  /** Series de trabajo planificadas al cerrar (las no hechas se borran al terminar). */
  planned_sets: number | null
}

export interface SessionExercise {
  id: string
  user_id: string
  session_id: string
  exercise_id: string
  position: number
  target_sets: number
  target_reps_min: number
  target_reps_max: number
  target_rpe: number | null
  rest_seconds: number
}

export interface SetEntry {
  id: string
  user_id: string
  session_exercise_id: string
  set_index: number
  weight: number | null
  reps: number
  /** Esfuerzo percibido 6–10 en pasos de 0,5. Sustituye al RIR (v2.1). */
  rpe: number | null
  /** Velocidad media propulsiva en m/s. Sin fuente de datos por ahora. */
  velocity: number | null
  kind: SetKind
  /** false = propuesta (prellenada en gris), true = confirmada. */
  completed: boolean
  logged_at: number | null
}

export interface BodyMetric {
  id: string
  user_id: string
  /** Única por fecha. */
  date: string
  weight: number
  notes: string
  /** Preparados para una fuente de datos futura; sin entrada por ahora. */
  sleep_hours: number | null
  recovery: number | null
}

/** Ciclo de entrenamiento (mesociclo). Uno activo como máximo. */
export interface Cycle {
  id: string
  user_id: string
  name: string
  goal: BlockGoal
  start_date: string
  archived: boolean
}

export interface CycleBlock {
  id: string
  user_id: string
  cycle_id: string
  position: number
  name: string
  weeks: number
  goal: BlockGoal
}

export interface Settings {
  id: 'singleton'
  user_id: string
  unit: WeightUnit
  theme: Theme
  /** Incremento por defecto por tipo de carga, para ejercicios nuevos. */
  increments: Record<LoadType, number>
  /** Si Hoy muestra el bloque de peso por la mañana. */
  weigh_prompt: boolean
  /** Meta de peso corporal; dibuja la línea objetivo en las gráficas. */
  body_weight_goal: number | null
  /** Descanso por defecto para ejercicios nuevos. */
  default_rest_seconds: number
  /** Calculadora de discos. */
  bar_weight: number
  plates: number[]
  /** Token largo generado en el primer arranque (especificaciones §6.6). */
  api_token: string
  notif_weight_enabled: boolean
  notif_weight_time: string
  notif_train_enabled: boolean
  notif_train_time: string
  notif_only_scheduled: boolean
  push_endpoint: string | null
  last_backup_at: number | null
}

/** Cola de hechos pendientes de enviar al servidor (especificaciones §6.2). */
export interface OutboxItem {
  id: string
  user_id: string
  path: string
  body: string
  created_at: number
  retries: number
}
