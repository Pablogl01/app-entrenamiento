import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { db } from '../db/db'
import {
  createDraftFromRoutine,
  reorderPositions,
  routineWeekdays,
  setRoutineWeekdays,
  todaySession,
} from '../db/repo'
import { WEEKDAY_LETTERS } from '../lib/dates'
import { syncSchedule } from '../lib/push'
import { MaterialHeader, materialFor } from '../components/MaterialHeader'
import { TopBar } from '../components/TopBar'
import { useReorder } from '../components/useReorder'
import type { Exercise, RoutineExercise, RoutineType } from '../db/types'

const NAME_MAX = 24 // cabe en dos líneas de display-xl a 320px (DESIGN.md §3)

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
    const res = (await db.routine_exercises.where('routine_id').equals(id).toArray()).sort(
      (a, b) => a.position - b.position,
    )
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
      <div className="screen screen--stacked">
        <TopBar />
        <p className="t-body pad">Esta rutina ya no existe.</p>
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

  return (
    <div className="screen screen--stacked">
      <MaterialHeader material={materialFor(routine.routine_type, routine.id)} minHeight={200}>
        <TopBar onMaterial />
        <div className="mat__text" style={{ width: '100%' }}>
          <p className="t-body mat__eyebrow">Rutina</p>
          {editingName ? (
            <div>
              <input
                ref={nameInputRef}
                className="t-xl ed-name-input"
                aria-label="Nombre de la rutina"
                value={nameText}
                maxLength={NAME_MAX}
                autoFocus
                onChange={(e) => setNameText(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => e.key === 'Enter' && commitName()}
              />
              <p className="t-data" style={{ color: 'var(--on-material-soft)', marginTop: 4 }}>
                {NAME_MAX - nameText.length}
              </p>
            </div>
          ) : (
            <button
              className="t-xl"
              style={{ color: 'var(--on-material)' }}
              onClick={() => {
                setNameText(routine.name)
                setEditingName(true)
              }}
            >
              {routine.name}
            </button>
          )}
        </div>
      </MaterialHeader>

      <div className="sheet">
        <div className="seltext" role="radiogroup" aria-label="Tipo de rutina">
          {TYPES.map((t) => (
            <button
              key={t.label}
              className={`t-info${routine.routine_type === t.value ? ' active' : ''}`}
              onClick={() => {
                markTouched()
                void db.routines.update(routine.id, { routine_type: t.value })
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {touched && (
          <p className="t-info soft" style={{ marginTop: 'var(--sp-4)' }}>
            Editar la plantilla no cambia las sesiones ya hechas: son copias.
          </p>
        )}

        <div style={{ marginTop: 'var(--sp-5)' }}>
          {list.map(({ re, exercise }, i) => (
            <div key={re.id} className={dragIndex === i ? 'dragging' : undefined} {...handlers(i)}>
              <button className="row" style={{ width: '100%' }} onClick={() => setOpenRow(openRow === re.id ? null : re.id)}>
                <span className="row__main t-item">{exercise.name}</span>
                <span className="t-data soft">
                  {re.target_sets}×{re.target_reps_min}-{re.target_reps_max}
                </span>
                <span className="row__chev">{openRow === re.id ? '⌃' : '⌄'}</span>
              </button>
              <div className={`fold${openRow === re.id ? ' open' : ''}`} inert={openRow !== re.id || undefined}>
                <div className="ed-controls">
                  <div className="ed-control">
                    <span className="t-body">Series</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                      <button
                        className="stepbtn"
                        aria-label="Menos series"
                        onClick={() => {
                          markTouched()
                          void db.routine_exercises.update(re.id, { target_sets: Math.max(1, re.target_sets - 1) })
                        }}
                      >
                        −
                      </button>
                      <span className="t-datalg">{re.target_sets}</span>
                      <button
                        className="stepbtn"
                        aria-label="Más series"
                        onClick={() => {
                          markTouched()
                          void db.routine_exercises.update(re.id, { target_sets: re.target_sets + 1 })
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="ed-control">
                    <span className="t-body">Reps</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                      <NumBox
                        value={re.target_reps_min}
                        label="Reps mínimas"
                        onCommit={(n) => {
                          markTouched()
                          void db.routine_exercises.update(re.id, { target_reps_min: n })
                        }}
                      />
                      <span className="t-data soft">a</span>
                      <NumBox
                        value={re.target_reps_max}
                        label="Reps máximas"
                        onCommit={(n) => {
                          markTouched()
                          void db.routine_exercises.update(re.id, { target_reps_max: n })
                        }}
                      />
                    </div>
                  </div>
                  <button
                    className="btn-text soft"
                    onClick={() => {
                      markTouched()
                      void db.routine_exercises.delete(re.id)
                    }}
                  >
                    Quitar de la rutina
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <Link
          to={`/catalogo?routine=${routine.id}`}
          className="btn-text"
          style={{ textDecoration: 'none', color: 'var(--ink)', marginTop: 'var(--sp-4)' }}
        >
          Añadir ejercicio
        </Link>

        <div style={{ marginTop: 'var(--sp-6)' }}>
          <p className="t-body">Días asignados</p>
          <div className="ed-days" style={{ marginTop: 'var(--sp-3)' }}>
            {WEEKDAY_LETTERS.map((letter, d) => (
              <button
                key={letter}
                className={`ed-day t-info${(weekdays ?? []).includes(d) ? ' active' : ''}`}
                aria-pressed={(weekdays ?? []).includes(d)}
                onClick={() => void toggleWeekday(d)}
              >
                {letter}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 'var(--sp-6)' }}>
          <button className="btn-text" onClick={() => void onTrainToday()}>
            Entrenar hoy
          </button>
          <button className="btn-text soft" onClick={() => void onArchive()}>
            Archivar rutina
          </button>
        </div>
      </div>
    </div>
  )
}

function NumBox({ value, label, onCommit }: { value: number; label: string; onCommit: (n: number) => void }) {
  const [text, setText] = useState(String(value))
  return (
    <span className="numfield t-datalg">
      <input
        inputMode="numeric"
        aria-label={label}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const n = Number(text)
          if (Number.isInteger(n) && n > 0) onCommit(n)
          else setText(String(value))
        }}
      />
    </span>
  )
}
