// Operaciones sobre IndexedDB. Todo el flujo de entrenar pasa por aquí y
// nunca por la red (especificaciones §2.2).
import { db, USER_ID } from './db'
import type {
  Exercise,
  Routine,
  RoutineExercise,
  Session,
  SessionExercise,
  SetEntry,
  SetKind,
} from './types'
import { todayISO, weekdayMon0 } from '../lib/dates'
import { seedExercises } from './seed'
import { setE1rm, setVolume, type Point } from '../lib/calc'
import { reportFact } from '../lib/outbox'
import { uploadBackup } from '../lib/backup'

function uuid(): string {
  return crypto.randomUUID()
}

// ---- Rutinas ----

export async function activeRoutines(): Promise<Routine[]> {
  return db.routines.filter((r) => !r.archived).sortBy('created_at')
}

export async function scheduledRoutineFor(dateISO: string): Promise<Routine | null> {
  const wd = weekdayMon0(dateISO)
  const schedules = await db.routine_schedules.where('weekday').equals(wd).toArray()
  for (const s of schedules) {
    const r = await db.routines.get(s.routine_id)
    if (r && !r.archived) return r
  }
  return null
}

export async function routineWeekdays(routineId: string): Promise<number[]> {
  const rows = await db.routine_schedules.where('routine_id').equals(routineId).toArray()
  return rows.map((r) => r.weekday).sort((a, b) => a - b)
}

export async function setRoutineWeekdays(routineId: string, weekdays: number[]): Promise<void> {
  await db.transaction('rw', db.routine_schedules, async () => {
    await db.routine_schedules.where('routine_id').equals(routineId).delete()
    await db.routine_schedules.bulkAdd(
      weekdays.map((weekday) => ({ id: uuid(), user_id: USER_ID, routine_id: routineId, weekday })),
    )
  })
}

export async function createRoutine(): Promise<Routine> {
  const routine: Routine = {
    id: uuid(),
    user_id: USER_ID,
    name: 'Nueva rutina',
    routine_type: null,
    notes: '',
    created_at: Date.now(),
    archived: false,
  }
  await db.routines.add(routine)
  return routine
}

export async function addExerciseToRoutine(routineId: string, exerciseId: string): Promise<void> {
  const count = await db.routine_exercises.where('routine_id').equals(routineId).count()
  await db.routine_exercises.add({
    id: uuid(),
    user_id: USER_ID,
    routine_id: routineId,
    exercise_id: exerciseId,
    position: count,
    target_sets: 3,
    target_reps_min: 8,
    target_reps_max: 10,
  })
}

export async function reorderPositions(
  table: 'routine_exercises' | 'session_exercises',
  orderedIds: string[],
): Promise<void> {
  await db.transaction('rw', db.table(table), async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.table(table).update(orderedIds[i], { position: i })
    }
  })
}

export async function lastPerformedAt(routineId: string): Promise<string | null> {
  const sessions = await db.sessions.where('routine_id').equals(routineId).toArray()
  const done = sessions.filter((s) => s.started_at !== null).map((s) => s.date).sort()
  return done.at(-1) ?? null
}

// ---- Última vez de un ejercicio (prellenado) ----

export interface PastSet {
  weight: number | null
  reps: number
  kind: SetKind
}

/** Series de trabajo de la última sesión terminada que incluyó el ejercicio. */
export async function lastPerformance(exerciseId: string): Promise<PastSet[]> {
  const links = await db.session_exercises.where('exercise_id').equals(exerciseId).toArray()
  const sessions = (
    await Promise.all(links.map(async (l) => ({ link: l, session: await db.sessions.get(l.session_id) })))
  )
    .filter((x): x is { link: SessionExercise; session: Session } => x.session != null && x.session.finished_at !== null)
    .sort((a, b) => b.session.date.localeCompare(a.session.date))
  for (const { link } of sessions) {
    const sets = await db.sets.where('session_exercise_id').equals(link.id).toArray()
    const work = sets
      .filter((s) => s.completed && s.kind !== 'warmup')
      .sort((a, b) => a.set_index - b.set_index)
    if (work.length > 0) return work.map((s) => ({ weight: s.weight, reps: s.reps, kind: s.kind }))
  }
  return []
}

// ---- Sesiones: borrador → activa → terminada ----

async function addProposedSets(sessionExercise: SessionExercise): Promise<void> {
  const past = await lastPerformance(sessionExercise.exercise_id)
  const rows: SetEntry[] = []
  for (let i = 0; i < sessionExercise.target_sets; i++) {
    const p = past[i] ?? past.at(-1)
    rows.push({
      id: uuid(),
      user_id: USER_ID,
      session_exercise_id: sessionExercise.id,
      set_index: i,
      weight: p?.weight ?? null,
      reps: p?.reps ?? sessionExercise.target_reps_min,
      rir: null,
      kind: 'work',
      completed: false,
      logged_at: null,
    })
  }
  await db.sets.bulkAdd(rows)
}

export async function createDraftFromRoutine(routine: Routine, dateISO = todayISO()): Promise<Session> {
  const session: Session = {
    id: uuid(),
    user_id: USER_ID,
    date: dateISO,
    started_at: null,
    finished_at: null,
    routine_id: routine.id,
    routine_name_snapshot: routine.name,
    notes: '',
    rating: null,
  }
  const routineExercises = (await db.routine_exercises.where('routine_id').equals(routine.id).toArray()).sort(
    (a, b) => a.position - b.position,
  )
  await db.transaction('rw', [db.sessions, db.session_exercises, db.sets], async () => {
    await db.sessions.add(session)
    for (const re of routineExercises) {
      const se: SessionExercise = {
        id: uuid(),
        user_id: USER_ID,
        session_id: session.id,
        exercise_id: re.exercise_id,
        position: re.position,
        target_sets: re.target_sets,
        target_reps_min: re.target_reps_min,
        target_reps_max: re.target_reps_max,
      }
      await db.session_exercises.add(se)
      await addProposedSets(se)
    }
  })
  return session
}

export async function createEmptySession(dateISO = todayISO()): Promise<Session> {
  const session: Session = {
    id: uuid(),
    user_id: USER_ID,
    date: dateISO,
    started_at: null,
    finished_at: null,
    routine_id: null,
    routine_name_snapshot: 'Sesión libre',
    notes: '',
    rating: null,
  }
  await db.sessions.add(session)
  return session
}

/** La sesión de hoy: la activa si la hay, si no el borrador más reciente. */
export async function todaySession(): Promise<Session | null> {
  const all = await db.sessions.where('date').equals(todayISO()).toArray()
  const started = all.filter((s) => s.started_at !== null && s.finished_at === null)
  if (started.length > 0) return started[0]
  const drafts = all.filter((s) => s.started_at === null)
  if (drafts.length > 0) return drafts[0]
  const finished = all.filter((s) => s.finished_at !== null)
  return finished.at(-1) ?? null
}

async function draftHasProgress(sessionId: string): Promise<boolean> {
  const links = await db.session_exercises.where('session_id').equals(sessionId).toArray()
  for (const link of links) {
    const done = await db.sets
      .where('session_exercise_id')
      .equals(link.id)
      .filter((s) => s.completed)
      .count()
    if (done > 0) return true
  }
  return false
}

async function draftMatchesTemplate(sessionId: string, routineId: string): Promise<boolean> {
  const se = (await db.session_exercises.where('session_id').equals(sessionId).toArray()).sort(
    (a, b) => a.position - b.position,
  )
  const re = (await db.routine_exercises.where('routine_id').equals(routineId).toArray()).sort(
    (a, b) => a.position - b.position,
  )
  if (se.length !== re.length) return false
  return se.every(
    (s, i) =>
      s.exercise_id === re[i].exercise_id &&
      s.target_sets === re[i].target_sets &&
      s.target_reps_min === re[i].target_reps_min &&
      s.target_reps_max === re[i].target_reps_max,
  )
}

/**
 * El borrador de hoy es una proyección (especificaciones §3.4): mientras la
 * sesión no haya empezado y no tenga nada confirmado, sigue a la plantilla.
 * Una sesión improvisada (sin routine_id) no se toca nunca.
 */
export async function syncTodayDraft(routine: Routine | null): Promise<void> {
  const current = await todaySession()
  if (current === null) {
    if (routine !== null) await createDraftFromRoutine(routine)
    return
  }
  if (current.started_at !== null || current.routine_id === null) return
  if (await draftHasProgress(current.id)) return
  if (routine === null) {
    // ya no hay rutina programada hoy: el día vuelve a ser de descanso
    await deleteSession(current.id)
    return
  }
  const upToDate = current.routine_id === routine.id && (await draftMatchesTemplate(current.id, routine.id))
  if (!upToDate) {
    await deleteSession(current.id)
    await createDraftFromRoutine(routine)
  }
}

export async function addExerciseToSession(sessionId: string, exerciseId: string): Promise<void> {
  const count = await db.session_exercises.where('session_id').equals(sessionId).count()
  const se: SessionExercise = {
    id: uuid(),
    user_id: USER_ID,
    session_id: sessionId,
    exercise_id: exerciseId,
    position: count,
    target_sets: 3,
    target_reps_min: 8,
    target_reps_max: 10,
  }
  await db.transaction('rw', [db.session_exercises, db.sets], async () => {
    await db.session_exercises.add(se)
    await addProposedSets(se)
  })
}

export async function startSession(sessionId: string): Promise<void> {
  await db.sessions.update(sessionId, { started_at: Date.now() })
}

export interface PR {
  exercise_id: string
  exercise_name: string
  e1rm: number
  prev_e1rm: number | null
  weight: number
  reps: number
}

/** Mejores e1RM del ejercicio por sesión terminada, opcionalmente excluyendo una. */
export async function bestE1rmSeries(exerciseId: string, excludeSessionId?: string): Promise<Point[]> {
  const links = await db.session_exercises.where('exercise_id').equals(exerciseId).toArray()
  const points: Point[] = []
  for (const link of links) {
    if (link.session_id === excludeSessionId) continue
    const session = await db.sessions.get(link.session_id)
    if (!session || session.finished_at === null) continue
    const sets = await db.sets.where('session_exercise_id').equals(link.id).toArray()
    const best = Math.max(...sets.map((s) => setE1rm(s) ?? 0), 0)
    if (best > 0) points.push({ date: session.date, value: best })
  }
  // dos sesiones el mismo día: se queda la mejor
  const byDate = new Map<string, number>()
  for (const p of points) byDate.set(p.date, Math.max(byDate.get(p.date) ?? 0, p.value))
  return [...byDate.entries()].map(([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date))
}

export async function volumeSeries(exerciseId: string): Promise<Point[]> {
  const links = await db.session_exercises.where('exercise_id').equals(exerciseId).toArray()
  const points: Point[] = []
  for (const link of links) {
    const session = await db.sessions.get(link.session_id)
    if (!session || session.finished_at === null) continue
    const sets = await db.sets.where('session_exercise_id').equals(link.id).toArray()
    const vol = sets.reduce((sum, s) => sum + setVolume(s), 0)
    if (vol > 0) points.push({ date: session.date, value: vol })
  }
  const byDate = new Map<string, number>()
  for (const p of points) byDate.set(p.date, Math.max(byDate.get(p.date) ?? 0, p.value))
  return [...byDate.entries()].map(([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date))
}

async function computePRs(sessionId: string): Promise<PR[]> {
  const links = (await db.session_exercises.where('session_id').equals(sessionId).toArray()).sort(
    (a, b) => a.position - b.position,
  )
  const prs: PR[] = []
  for (const link of links) {
    const sets = await db.sets.where('session_exercise_id').equals(link.id).toArray()
    let best: SetEntry | null = null
    let bestVal = 0
    for (const s of sets) {
      const v = setE1rm(s)
      if (v !== null && v > bestVal) {
        bestVal = v
        best = s
      }
    }
    if (!best || best.weight === null) continue
    const history = await bestE1rmSeries(link.exercise_id, sessionId)
    const prevBest = history.length > 0 ? Math.max(...history.map((p) => p.value)) : null
    if (prevBest === null || bestVal > prevBest) {
      const exercise = await db.exercises.get(link.exercise_id)
      prs.push({
        exercise_id: link.exercise_id,
        exercise_name: exercise?.name ?? '',
        e1rm: bestVal,
        prev_e1rm: prevBest,
        weight: best.weight,
        reps: best.reps,
      })
    }
  }
  return prs
}

export interface SessionStats {
  duration_ms: number | null
  volume: number
  done_sets: number
  prs: PR[]
}

export async function sessionStats(sessionId: string): Promise<SessionStats> {
  const session = await db.sessions.get(sessionId)
  if (!session) return { duration_ms: null, volume: 0, done_sets: 0, prs: [] }
  const links = await db.session_exercises.where('session_id').equals(sessionId).toArray()
  let volume = 0
  let doneSets = 0
  for (const link of links) {
    const sets = await db.sets.where('session_exercise_id').equals(link.id).toArray()
    for (const s of sets) {
      volume += setVolume(s)
      if (s.completed && s.kind !== 'warmup') doneSets++
    }
  }
  const duration =
    session.started_at !== null && session.finished_at !== null
      ? session.finished_at - session.started_at
      : null
  const prs = session.finished_at !== null ? await computePRs(sessionId) : []
  return { duration_ms: duration, volume, done_sets: doneSets, prs }
}

export async function finishSession(sessionId: string): Promise<void> {
  const session = await db.sessions.get(sessionId)
  if (!session) return
  await db.sessions.update(sessionId, { finished_at: Date.now() })
  // series propuestas y nunca confirmadas: fuera, o ensucian el histórico
  const links = await db.session_exercises.where('session_id').equals(sessionId).toArray()
  for (const link of links) {
    await db.sets.where('session_exercise_id').equals(link.id).filter((s) => !s.completed).delete()
  }
  void reportFact('trained', session.date)
  void uploadBackup()
}

export async function deleteSession(sessionId: string): Promise<void> {
  const links = await db.session_exercises.where('session_id').equals(sessionId).toArray()
  await db.transaction('rw', [db.sessions, db.session_exercises, db.sets], async () => {
    for (const link of links) await db.sets.where('session_exercise_id').equals(link.id).delete()
    await db.session_exercises.where('session_id').equals(sessionId).delete()
    await db.sessions.delete(sessionId)
  })
}

/** "Repetir esta sesión": nueva hoy copiando ejercicios y pesos (§4.3). */
export async function repeatSession(sourceId: string): Promise<Session | null> {
  const source = await db.sessions.get(sourceId)
  if (!source) return null
  const links = (await db.session_exercises.where('session_id').equals(sourceId).toArray()).sort(
    (a, b) => a.position - b.position,
  )
  const session: Session = {
    id: uuid(),
    user_id: USER_ID,
    date: todayISO(),
    started_at: null,
    finished_at: null,
    routine_id: source.routine_id,
    routine_name_snapshot: source.routine_name_snapshot,
    notes: '',
    rating: null,
  }
  await db.transaction('rw', [db.sessions, db.session_exercises, db.sets], async () => {
    await db.sessions.add(session)
    for (const link of links) {
      const se: SessionExercise = { ...link, id: uuid(), session_id: session.id }
      await db.session_exercises.add(se)
      const sets = (await db.sets.where('session_exercise_id').equals(link.id).toArray())
        .filter((s) => s.completed)
        .sort((a, b) => a.set_index - b.set_index)
      await db.sets.bulkAdd(
        sets.map((s, i) => ({
          ...s,
          id: uuid(),
          session_exercise_id: se.id,
          set_index: i,
          completed: false,
          logged_at: null,
        })),
      )
    }
  })
  return session
}

/** Guardar como plantilla (§8.4): series de trabajo y rango de reps observados. */
export async function saveSessionAsRoutine(sessionId: string, name: string): Promise<Routine | null> {
  const session = await db.sessions.get(sessionId)
  if (!session) return null
  const links = (await db.session_exercises.where('session_id').equals(sessionId).toArray()).sort(
    (a, b) => a.position - b.position,
  )
  const routine: Routine = {
    id: uuid(),
    user_id: USER_ID,
    name,
    routine_type: null,
    notes: '',
    created_at: Date.now(),
    archived: false,
  }
  await db.transaction('rw', [db.routines, db.routine_exercises, db.sets, db.sessions], async () => {
    await db.routines.add(routine)
    let position = 0
    for (const link of links) {
      const work = (await db.sets.where('session_exercise_id').equals(link.id).toArray()).filter(
        (s) => s.completed && s.kind !== 'warmup',
      )
      if (work.length === 0) continue
      const reps = work.map((s) => s.reps)
      const re: RoutineExercise = {
        id: uuid(),
        user_id: USER_ID,
        routine_id: routine.id,
        exercise_id: link.exercise_id,
        position: position++,
        target_sets: work.length,
        target_reps_min: Math.min(...reps),
        target_reps_max: Math.max(...reps),
      }
      await db.routine_exercises.add(re)
    }
    await db.sessions.update(sessionId, { routine_id: routine.id, routine_name_snapshot: name })
  })
  return routine
}

// ---- Series ----

export async function confirmSet(setId: string): Promise<void> {
  const set = await db.sets.get(setId)
  if (!set || set.completed) return
  await db.sets.update(setId, { completed: true, logged_at: Date.now() })
}

export async function updateSet(setId: string, patch: Partial<SetEntry>): Promise<void> {
  await db.sets.update(setId, patch)
}

export async function addSet(sessionExerciseId: string, kind: SetKind): Promise<void> {
  const existing = await db.sets.where('session_exercise_id').equals(sessionExerciseId).toArray()
  const last = existing.filter((s) => s.kind === kind).sort((a, b) => a.set_index - b.set_index).at(-1)
    ?? existing.sort((a, b) => a.set_index - b.set_index).at(-1)
  await db.sets.add({
    id: uuid(),
    user_id: USER_ID,
    session_exercise_id: sessionExerciseId,
    set_index: existing.length,
    weight: kind === 'warmup' ? (last?.weight != null ? Math.round((last.weight / 2) * 2) / 2 : null) : last?.weight ?? null,
    reps: kind === 'warmup' ? 10 : last?.reps ?? 8,
    rir: null,
    kind,
    completed: false,
    logged_at: null,
  })
}

export async function deleteSet(setId: string): Promise<void> {
  await db.sets.delete(setId)
}

export async function removeSessionExercise(sessionExerciseId: string): Promise<void> {
  await db.transaction('rw', [db.session_exercises, db.sets], async () => {
    await db.sets.where('session_exercise_id').equals(sessionExerciseId).delete()
    await db.session_exercises.delete(sessionExerciseId)
  })
}

// ---- Peso corporal ----

export async function saveBodyWeight(dateISO: string, weight: number): Promise<void> {
  const existing = await db.body_metrics.where('date').equals(dateISO).first()
  if (existing) await db.body_metrics.update(existing.id, { weight })
  else await db.body_metrics.add({ id: uuid(), user_id: USER_ID, date: dateISO, weight, notes: '' })
  void reportFact('weighed_in', dateISO)
}

// ---- Récords y catálogo ----

export interface ExerciseRecords {
  best_e1rm: { value: number; date: string } | null
  best_weight: { value: number; date: string } | null
  by_reps: { reps: number; weight: number }[]
}

export async function exerciseRecords(exerciseId: string): Promise<ExerciseRecords> {
  const links = await db.session_exercises.where('exercise_id').equals(exerciseId).toArray()
  let bestE1rm: { value: number; date: string } | null = null
  let bestWeight: { value: number; date: string } | null = null
  const byReps = new Map<number, number>()
  for (const link of links) {
    const session = await db.sessions.get(link.session_id)
    if (!session || session.finished_at === null) continue
    const sets = await db.sets.where('session_exercise_id').equals(link.id).toArray()
    for (const s of sets) {
      if (!s.completed || s.kind === 'warmup' || s.weight === null) continue
      const e = setE1rm(s)
      if (e !== null && (bestE1rm === null || e > bestE1rm.value)) bestE1rm = { value: e, date: session.date }
      if (bestWeight === null || s.weight > bestWeight.value) bestWeight = { value: s.weight, date: session.date }
      if (s.reps > 0 && s.weight > (byReps.get(s.reps) ?? 0)) byReps.set(s.reps, s.weight)
    }
  }
  const by_reps = [...byReps.entries()]
    .map(([reps, weight]) => ({ reps, weight }))
    .sort((a, b) => a.reps - b.reps)
  return { best_e1rm: bestE1rm, best_weight: bestWeight, by_reps }
}

/** Ejercicios usados recientemente, para el catálogo. */
export async function recentExercises(limit = 8): Promise<Exercise[]> {
  const sessions = (await db.sessions.toArray())
    .filter((s) => s.started_at !== null)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 12)
  const seen: string[] = []
  for (const session of sessions) {
    const links = (await db.session_exercises.where('session_id').equals(session.id).toArray()).sort(
      (a, b) => a.position - b.position,
    )
    for (const l of links) if (!seen.includes(l.exercise_id)) seen.push(l.exercise_id)
    if (seen.length >= limit) break
  }
  const out: Exercise[] = []
  for (const id of seen.slice(0, limit)) {
    const e = await db.exercises.get(id)
    if (e && !e.archived) out.push(e)
  }
  return out
}

export async function createExercise(
  data: Pick<Exercise, 'name' | 'muscle_group' | 'load_type' | 'min_increment' | 'unit_mode'>,
): Promise<Exercise> {
  const exercise: Exercise = {
    id: uuid(),
    user_id: USER_ID,
    ...data,
    notes: '',
    is_custom: true,
    archived: false,
  }
  await db.exercises.add(exercise)
  return exercise
}

function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Añade al catálogo los precargados que falten (nuevas versiones amplían la
 * lista y el populate solo corre en bases vírgenes). No duplica nombres que
 * ya existan, tampoco los creados por el usuario.
 */
export async function syncCatalog(): Promise<void> {
  const existing = await db.exercises.toArray()
  const names = new Set(existing.map((e) => normalizeName(e.name)))
  const missing = seedExercises(USER_ID).filter((e) => !names.has(normalizeName(e.name)))
  if (missing.length > 0) await db.exercises.bulkAdd(missing)
}

/** Borradores de días anteriores: fuera. Lo programado no existe en la BD. */
export async function cleanupStaleDrafts(): Promise<void> {
  const today = todayISO()
  const stale = await db.sessions.filter((s) => s.started_at === null && s.date < today).toArray()
  for (const s of stale) await deleteSession(s.id)
}
