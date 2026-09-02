import Dexie, { type EntityTable } from 'dexie'
import type {
  BodyMetric,
  Exercise,
  OutboxItem,
  Routine,
  RoutineExercise,
  RoutineSchedule,
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

export function defaultSettings(): Settings {
  return {
    id: 'singleton',
    user_id: USER_ID,
    unit: 'kg',
    increments: { barbell: 2.5, dumbbell: 2, machine: 5, cable: 2.5, bodyweight: 2.5 },
    weigh_prompt: true,
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
  if (s) return s
  const d = defaultSettings()
  await db.settings.add(d)
  return d
}

export async function patchSettings(patch: Partial<Settings>): Promise<void> {
  await db.settings.update('singleton', patch)
}
