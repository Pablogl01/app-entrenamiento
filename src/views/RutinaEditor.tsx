import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { db } from '../db/db'
import { createDraftFromRoutine, reorderPositions, routineWeekdays, setRoutineWeekdays, todaySession } from '../db/repo'
import { WEEKDAY_LETTERS } from '../lib/dates'
import { syncSchedule } from '../lib/push'
import { TopBar } from '../components/TopBar'
import { ExerciseVisual } from '../components/ExerciseVisual'
import { Icon } from '../components/Icon'
import { Stepper } from '../components/Stepper'
import { useReorder } from '../components/useReorder'
import type { Exercise, RoutineExercise, RoutineType } from '../db/types'
import { radioGroupKeyDown } from '../lib/a11y'

const NAME_MAX = 24 // cabe en dos líneas de display a 320px

const TYPES: { value: RoutineType; label: string }[] = [
  { value: 'strength', label: 'Fuerza' },
  { value: 'mobility', label: 'Movilidad' },
  { value: null, label: 'Sin tipo' },
]

async function pushScheduleToServer(): Promise<void> {
  const schedules = await db.routine_schedules.toArray()
  const days: { weekday: number; routine_name: string }[] = []
  for (const s of schedules) {
    const r = await db.routines.get(s.routine_id)
    if (r && !r.archived) days.push({ weekday: s.weekday, routine_name: r.name })
  }
  void syncSchedule(days)
}

export function RutinaEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [editingName, setEditingName] = useState(false)
  const [nameText, setNameText] = useState('')
  const [openRow, setOpenRow] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const routine = useLiveQuery(async () => (id !== undefined ? ((await db.routines.get(id)) ?? null) : null), [id])
  const items = useLiveQuery(async () => {
    if (id === undefined) return []
    const res = (await db.routine_exercises.where('routine_id').equals(id).toArray()).sort((a, b) => a.position - b.position)
    const out: { re: RoutineExercise; exercise: Exercise }[] = []
    for (const re of res) {
      const exercise = await db.exercises.get(re.exercise_id)
      if (exercise) out.push({ re, exercise })
    }
    return out
  }, [id])
  const weekdays = useLiveQuery(async (): Promise<number[]> => (id !== undefined ? routineWeekdays(id) : []), [id])

  const list = items ?? []
  const { handlers, dragIndex } = useReorder(list.length, (from, to) => {
    const ids = list.map((x) => x.re.id)
    const [moved] = ids.splice(from, 1)
    ids.splice(to, 0, moved)
    markTouched()
    void reorderPositions('routine_exercises', ids)
  })

  if (routine === undefined || routine === null || weekdays === undefined) {
    return routine === null ? (
      <div className="screen screen--stacked pad">
        <TopBar title="Rutina" />
        <p className="t-body">Esta rutina ya no existe.</p>
      </div>
    ) : null
  }

  function markTouched() {
    setTouched(true)
  }

  function commitName() {
    setEditingName(false)
    const clean = nameText.trim()
    if (clean !== '' && routine) {
      markTouched()
      void db.routines.update(routine.id, { name: clean })
      void pushScheduleToServer()
    }
  }

  async function toggleWeekday(d: number) {
    if (!routine) return
    markTouched()
    const current = weekdays ?? []
    const next = current.includes(d) ? current.filter((x) => x !== d) : [...current, d]
    await setRoutineWeekdays(routine.id, next)
    void pushScheduleToServer()
  }

  async function onTrainToday() {
    if (!routine) return
    const existing = await todaySession()
    if (existing === null) await createDraftFromRoutine(routine)
    navigate('/')
  }

  async function onArchive() {
    if (!routine) return
    if (window.confirm('¿Archivar esta rutina? Deja de programarse; el histórico no cambia.')) {
      await db.routines.update(routine.id, { archived: true })
      await db.routine_schedules.where('routine_id').equals(routine.id).delete()
      void pushScheduleToServer()
      navigate(-1)
    }
  }

  const totalSets = list.reduce((acc, x) => acc + x.re.target_sets, 0)

  return (
    <div className="screen screen--stacked pad">
      <TopBar title="Rutina" />
      <div className="stack">
        <section className="card">
          <div className="seg t-label" role="radiogroup" onKeyDown={radioGroupKeyDown} aria-label="Tipo de rutina">
            {TYPES.map((t) => (
              <button
                key={t.label}
                role="radio"
                aria-checked={routine.routine_type === t.value} tabIndex={routine.routine_type === t.value ? 0 : -1}
                className={routine.routine_type === t.value ? 'active' : ''}
                onClick={() => {
                  markTouched()
                  void db.routines.update(routine.id, { routine_type: t.value })
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 'var(--sp-4)' }}>
            <span className="t-label-sm mute">Nombre · toca para editar</span>
            {editingName ? (
              <div>
                <input
                  ref={nameInputRef}
                  className="t-display ed-name-input"
                  aria-label="Nombre de la rutina"
                  value={nameText}
                  maxLength={NAME_MAX}
                  autoFocus
                  onChange={(e) => setNameText(e.target.value)}
                  onBlur={commitName}
                  onKeyDown={(e) => e.key === 'Enter' && commitName()}
                />
                <p className="t-label-sm mute" style={{ marginTop: 4 }}>
                  {NAME_MAX - nameText.length} caracteres
                </p>
              </div>
            ) : (
              <button
                className="t-display"
                style={{ display: 'block', width: '100%', marginTop: 2 }}
                onClick={() => {
                  setNameText(routine.name)
                  setEditingName(true)
                }}
              >
                {routine.name}
              </button>
            )}
          </div>

          <p className="t-body-sm soft" style={{ marginTop: 'var(--sp-2)' }}>
            {list.length} {list.length === 1 ? 'ejercicio' : 'ejercicios'} · {totalSets} series
          </p>

          {touched && (
            <p className="t-caption mute" style={{ marginTop: 'var(--sp-3)' }}>
              Editar la plantilla no cambia las sesiones ya hechas: son copias.
            </p>
          )}
        </section>

        <section className="stack stack--tight" aria-label="Ejercicios">
          <span className="t-label mute">Ejercicios</span>
          {list.length === 0 && <p className="t-body-sm mute">Sin ejercicios. Añade el primero desde el catálogo.</p>}
          {list.map(({ re, exercise }, i) => (
            <div key={re.id} className={`xcard${dragIndex === i ? ' dragging' : ''}${openRow === re.id ? ' open' : ''}`} {...handlers(i)}>
              <button className="xcard__head" onClick={() => setOpenRow(openRow === re.id ? null : re.id)} aria-expanded={openRow === re.id}>
                <ExerciseVisual exercise={exercise} />
                <span className="xcard__names">
                  <span className="t-h3">{exercise.name}</span>
                  <span className="xcard__sub t-metric-sm">
                    {re.target_sets}×{re.target_reps_min}-{re.target_reps_max}
                    {re.target_rpe !== null && ` · RPE ${re.target_rpe}`} · {re.rest_seconds} s
                  </span>
                </span>
                <span className="xcard__chev">
                  <Icon name="chevron-down" />
                </span>
              </button>
              <div className={`fold${openRow === re.id ? ' open' : ''}`} inert={openRow !== re.id || undefined}>
                <div className="ed-controls">
                  <div className="ed-control">
                    <span className="t-body">Series</span>
                    <Stepper
                      small
                      value={re.target_sets}
                      step={1}
                      min={1}
                      integer
                      className="t-metric"
                      ariaLabel="series"
                      onCommit={(n) => {
                        markTouched()
                        void db.routine_exercises.update(re.id, { target_sets: Math.max(1, n) })
                      }}
                    />
                  </div>
                  <div className="ed-control">
                    <span className="t-body">Reps mínimas</span>
                    <Stepper
                      small
                      value={re.target_reps_min}
                      step={1}
                      min={1}
                      integer
                      className="t-metric"
                      ariaLabel="reps mínimas"
                      onCommit={(n) => {
                        markTouched()
                        void db.routine_exercises.update(re.id, { target_reps_min: Math.max(1, n) })
                      }}
                    />
                  </div>
                  <div className="ed-control">
                    <span className="t-body">Reps máximas</span>
                    <Stepper
                      small
                      value={re.target_reps_max}
                      step={1}
                      min={1}
                      integer
                      className="t-metric"
                      ariaLabel="reps máximas"
                      onCommit={(n) => {
                        markTouched()
                        void db.routine_exercises.update(re.id, { target_reps_max: Math.max(1, n) })
                      }}
                    />
                  </div>
                  <div className="ed-control">
                    <span>
                      <span className="t-body" style={{ display: 'block' }}>
                        RPE meta
                      </span>
                      <span className="t-caption mute">6–10, paso 0,5</span>
                    </span>
                    <Stepper
                      small
                      value={re.target_rpe}
                      step={0.5}
                      min={6}
                      className="t-metric"
                      ariaLabel="RPE meta"
                      onCommit={(n) => {
                        markTouched()
                        void db.routine_exercises.update(re.id, { target_rpe: Math.min(10, Math.max(6, n)) })
                      }}
                    />
                  </div>
                  <div className="ed-control">
                    <span>
                      <span className="t-body" style={{ display: 'block' }}>
                        Descanso
                      </span>
                      <span className="t-caption mute">Arranca al completar una serie</span>
                    </span>
                    <Stepper
                      small
                      value={re.rest_seconds}
                      step={15}
                      min={15}
                      integer
                      suffix="s"
                      className="t-metric"
                      ariaLabel="descanso"
                      onCommit={(n) => {
                        markTouched()
                        void db.routine_exercises.update(re.id, { rest_seconds: Math.max(15, n) })
                      }}
                    />
                  </div>
                  <button
                    className="textbtn textbtn--soft textbtn--alert t-label"
                    onClick={() => {
                      markTouched()
                      void db.routine_exercises.delete(re.id)
                    }}
                  >
                    <Icon name="close" size={16} />
                    Quitar de la rutina
                  </button>
                </div>
              </div>
            </div>
          ))}
          <Link to={`/catalogo?routine=${routine.id}`} className="btn btn--secondary">
            <Icon name="plus" size={18} />
            Añadir ejercicio
          </Link>
        </section>

        <section className="card" aria-label="Días asignados">
          <span className="t-label mute">Días asignados</span>
          <div className="ed-days" style={{ marginTop: 'var(--sp-3)' }}>
            {WEEKDAY_LETTERS.map((letter, d) => (
              <button
                key={letter}
                className={`ed-day t-label${(weekdays ?? []).includes(d) ? ' active' : ''}`}
                aria-pressed={(weekdays ?? []).includes(d)}
                onClick={() => void toggleWeekday(d)}
              >
                {letter}
              </button>
            ))}
          </div>
        </section>

        <button className="btn btn--primary" onClick={() => void onTrainToday()}>
          <Icon name="play" size={18} />
          Entrenar hoy
        </button>
        <button className="btn btn--ghost t-label" onClick={() => void onArchive()}>
          <Icon name="archive" size={16} />
          Archivar rutina
        </button>
      </div>
    </div>
  )
}
