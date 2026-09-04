// Datos de demostración para desarrollo (?demo=1): una rutina programada,
// cinco semanas de sesiones con progresión (y un ejercicio estancado a
// propósito) y pesajes diarios con tendencia. Determinista, sin azar.
import { db, USER_ID } from './db'
import type { Cycle, Routine, Session, SessionExercise, SetEntry } from './types'
import { addDays, todayISO, weekdayMon0 } from '../lib/dates'

function uuid(): string {
  return crypto.randomUUID()
}

let seeding = false

export async function seedDemo(): Promise<void> {
  if (seeding) return
  seeding = true
  if ((await db.sessions.count()) > 0 || (await db.routines.count()) > 0) return
  const today = todayISO()
  const exercises = await db.exercises.toArray()
  const pick = (name: string) => exercises.find((e) => e.name === name)
  const plan = [
    { ex: pick('Press banca'), base: 60, inc: 2.5, plateau: false },
    { ex: pick('Remo con barra'), base: 55, inc: 2.5, plateau: false },
    { ex: pick('Press militar'), base: 40, inc: 0, plateau: true },
    { ex: pick('Curl con barra'), base: 25, inc: 1.25, plateau: false },
  ].filter((p): p is { ex: NonNullable<ReturnType<typeof pick>>; base: number; inc: number; plateau: boolean } => p.ex !== undefined)

  const routine: Routine = {
    id: uuid(),
    user_id: USER_ID,
    name: 'Torso superior',
    routine_type: 'strength',
    notes: '',
    created_at: Date.now() - 40 * 86_400_000,
    archived: false,
  }
  await db.routines.add(routine)
  await db.routine_exercises.bulkAdd(
    plan.map((p, i) => ({
      id: uuid(),
      user_id: USER_ID,
      routine_id: routine.id,
      exercise_id: p.ex.id,
      position: i,
      target_sets: 3,
      target_reps_min: 8,
      target_reps_max: 10,
      target_rpe: 8,
      rest_seconds: 90,
    })),
  )
  // programada hoy y hace 3 días de la semana
  const wdToday = weekdayMon0(today)
  await db.routine_schedules.bulkAdd(
    [wdToday, (wdToday + 3) % 7].map((weekday) => ({ id: uuid(), user_id: USER_ID, routine_id: routine.id, weekday })),
  )

  // segunda rutina, dos días después, sin historial: sirve para mover e intercambiar
  const legs: Routine = {
    id: uuid(),
    user_id: USER_ID,
    name: 'Pierna',
    routine_type: 'strength',
    notes: '',
    created_at: Date.now() - 30 * 86_400_000,
    archived: false,
  }
  await db.routines.add(legs)
  const legPlan = [pick('Sentadilla'), pick('Peso muerto'), pick('Prensa')].filter((e) => e !== undefined)
  await db.routine_exercises.bulkAdd(
    legPlan.map((ex, i) => ({
      id: uuid(),
      user_id: USER_ID,
      routine_id: legs.id,
      exercise_id: ex.id,
      position: i,
      target_sets: 3,
      target_reps_min: 6,
      target_reps_max: 8,
      target_rpe: 8,
      rest_seconds: 120,
    })),
  )
  await db.routine_schedules.add({ id: uuid(), user_id: USER_ID, routine_id: legs.id, weekday: (wdToday + 2) % 7 })

  // ciclo activo de 6 semanas, empezado hace 3 semanas y media (semana 4)
  const cycle: Cycle = {
    id: uuid(),
    user_id: USER_ID,
    name: 'Fuerza-Volumen',
    goal: 'hipertrofia',
    start_date: addDays(today, -24),
    archived: false,
  }
  await db.cycles.add(cycle)
  await db.cycle_blocks.bulkAdd(
    [
      ['Acumulación', 3, 'volumen'],
      ['Intensificación', 2, 'fuerza'],
      ['Descarga', 1, 'descarga'],
    ].map(([name, weeks, goal], position) => ({
      id: uuid(),
      user_id: USER_ID,
      cycle_id: cycle.id,
      position,
      name: String(name),
      weeks: Number(weeks),
      goal: goal as 'volumen' | 'fuerza' | 'descarga',
    })),
  )
  // un día programado de la semana pasada, reasignado al día siguiente
  const lastWeekSlot = addDays(today, -7)
  await db.schedule_overrides.add({
    id: uuid(),
    user_id: USER_ID,
    routine_id: routine.id,
    from_date: lastWeekSlot,
    to_date: addDays(lastWeekSlot, 1),
  })

  // pesajes: 38 días bajando ~0,3 kg/semana con ruido determinista
  for (let i = 38; i >= 1; i--) {
    const date = addDays(today, -i)
    const weight = 80.5 - ((38 - i) * 0.3) / 7 + Math.sin(i * 1.7) * 0.5
    await db.body_metrics.add({ id: uuid(), user_id: USER_ID, date, weight: Math.round(weight * 10) / 10, notes: '', sleep_hours: null, recovery: null })
  }

  // 10 sesiones terminadas: dos por semana, las últimas 5 semanas
  for (let s = 10; s >= 1; s--) {
    const date = addDays(today, -Math.ceil(s * 3.5))
    const startedAt = new Date(`${date}T19:00:00`).getTime()
    const session: Session = {
      id: uuid(),
      user_id: USER_ID,
      date,
      started_at: startedAt,
      finished_at: startedAt + 55 * 60_000,
      routine_id: routine.id,
      routine_name_snapshot: routine.name,
      notes: '',
      rating: 7 + ((s * 7) % 3),
      paused_at: null,
      paused_ms: 0,
      planned_sets: plan.length * 3,
    }
    await db.sessions.add(session)
    for (let i = 0; i < plan.length; i++) {
      const p = plan[i]
      const se: SessionExercise = {
        id: uuid(),
        user_id: USER_ID,
        session_id: session.id,
        exercise_id: p.ex.id,
        position: i,
        target_sets: 3,
        target_reps_min: 8,
        target_reps_max: 10,
        target_rpe: 8,
        rest_seconds: 90,
      }
      await db.session_exercises.add(se)
      const progress = p.plateau ? 0 : Math.floor((10 - s) / 2) * p.inc
      const sets: SetEntry[] = [0, 1, 2].map((idx) => ({
        id: uuid(),
        user_id: USER_ID,
        session_exercise_id: se.id,
        set_index: idx,
        weight: p.base + progress,
        reps: 10 - idx,
        rpe: 7.5 + ((idx + s) % 3) * 0.5,
        velocity: null,
        kind: 'work',
        completed: true,
        logged_at: startedAt + (i * 8 + idx * 2) * 60_000,
      }))
      await db.sets.bulkAdd(sets)
    }
  }

  // si un borrador de hoy se creó a mitad del sembrado, fuera: se recreará
  // con el histórico completo y el prellenado correcto
  const drafts = await db.sessions.filter((s) => s.started_at === null).toArray()
  for (const d of drafts) {
    const links = await db.session_exercises.where('session_id').equals(d.id).toArray()
    for (const l of links) await db.sets.where('session_exercise_id').equals(l.id).delete()
    await db.session_exercises.where('session_id').equals(d.id).delete()
    await db.sessions.delete(d.id)
  }
}
