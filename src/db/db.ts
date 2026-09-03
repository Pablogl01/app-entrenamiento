import Dexie, { type EntityTable } from 'dexie'
import type {
  BodyMetric,
  Cycle,
  CycleBlock,
  Exercise,
  OutboxItem,
  Routine,
  RoutineExercise,
  RoutineSchedule,
  ScheduleOverride,
  Session,
  SessionExercise,
  SetEntry,
  Settings,
} from './types'
import { seedExercises } from './seed'

export const USER_ID = 'local'

class TrainingDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>
  routines!: EntityTable<Routine, 'id'>
  routine_exercises!: EntityTable<RoutineExercise, 'id'>
  routine_schedules!: EntityTable<RoutineSchedule, 'id'>
  sessions!: EntityTable<Session, 'id'>
  session_exercises!: EntityTable<SessionExercise, 'id'>
  sets!: EntityTable<SetEntry, 'id'>
  body_metrics!: EntityTable<BodyMetric, 'id'>
  settings!: EntityTable<Settings, 'id'>
  outbox!: EntityTable<OutboxItem, 'id'>
  cycles!: EntityTable<Cycle, 'id'>
  cycle_blocks!: EntityTable<CycleBlock, 'id'>
  schedule_overrides!: EntityTable<ScheduleOverride, 'id'>
}

export const db = new TrainingDB('entrenamiento')

db.version(1).stores({
  exercises: 'id, name, muscle_group, archived',
  routines: 'id, archived, created_at',
  routine_exercises: 'id, routine_id, exercise_id',
  routine_schedules: 'id, routine_id, weekday',
  sessions: 'id, date, routine_id',
  session_exercises: 'id, session_id, exercise_id',
  sets: 'id, session_exercise_id',
  body_metrics: 'id, &date',
  settings: 'id',
  outbox: 'id, created_at',
})

// v2.1: RPE sustituye a RIR, vuelve rest_seconds, pausa y series planificadas
// en la sesión, foto por ejercicio, ciclos con bloques y reasignaciones.
db.version(2)
  .stores({
    cycles: 'id, archived',
    cycle_blocks: 'id, cycle_id',
    schedule_overrides: 'id, routine_id, from_date, to_date',
  })
  .upgrade(async (tx) => {
    await tx
      .table('sets')
      .toCollection()
      .modify((s: Record<string, unknown>) => {
        const rir = s.rir
        s.rpe = typeof rir === 'number' ? Math.max(6, Math.min(10, 10 - rir)) : null
        s.velocity = null
        delete s.rir
      })
    await tx
      .table('sessions')
      .toCollection()
      .modify((s: Record<string, unknown>) => {
        // la valoración 1–5 pasa a RPE global 1–10
        if (typeof s.rating === 'number' && s.rating <= 5) s.rating = s.rating * 2
        s.paused_at = null
        s.paused_ms = 0
        s.planned_sets = null
      })
    for (const table of ['routine_exercises', 'session_exercises']) {
      await tx
        .table(table)
        .toCollection()
        .modify((r: Record<string, unknown>) => {
          r.target_rpe = null
          r.rest_seconds = 90
        })
    }
    await tx
      .table('exercises')
      .toCollection()
      .modify((e: Record<string, unknown>) => {
        e.image = null
      })
    await tx
      .table('body_metrics')
      .toCollection()
      .modify((m: Record<string, unknown>) => {
        m.sleep_hours = null
        m.recovery = null
      })
  })

export function defaultSettings(): Settings {
  return {
    id: 'singleton',
    user_id: USER_ID,
    unit: 'kg',
    theme: 'system',
    increments: { barbell: 2.5, dumbbell: 2, machine: 5, cable: 2.5, bodyweight: 2.5 },
    weigh_prompt: true,
    body_weight_goal: null,
    default_rest_seconds: 90,
    bar_weight: 20,
    plates: [25, 20, 15, 10, 5, 2.5, 1.25],
    api_token: crypto.randomUUID() + crypto.randomUUID(),
    notif_weight_enabled: false,
    notif_weight_time: '08:00',
    notif_train_enabled: false,
    notif_train_time: '18:30',
    notif_only_scheduled: true,
    push_endpoint: null,
    last_backup_at: null,
  }
}

db.on('populate', (tx) => {
  void tx.table('exercises').bulkAdd(seedExercises(USER_ID))
  void tx.table('settings').add(defaultSettings())
})

export async function getSettings(): Promise<Settings> {
  const s = await db.settings.get('singleton')
  // Campos añadidos después del primer arranque (p. ej. theme) toman su defecto.
  if (s) return { ...defaultSettings(), ...s }
  const d = defaultSettings()
  await db.settings.add(d)
  return d
}

export async function patchSettings(patch: Partial<Settings>): Promise<void> {
  await db.settings.update('singleton', patch)
}
