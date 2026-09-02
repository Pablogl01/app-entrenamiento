import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { db, getSettings } from '../db/db'
import { addExerciseToRoutine, addExerciseToSession, createExercise, recentExercises } from '../db/repo'
import { TopBar } from '../components/TopBar'
import { ExerciseMark } from '../components/ExerciseMark'
import type { Exercise, LoadType, MuscleGroup } from '../db/types'

const GROUPS: { key: MuscleGroup; label: string }[] = [
  { key: 'pecho', label: 'pecho' },
  { key: 'espalda', label: 'espalda' },
  { key: 'hombro', label: 'hombro' },
  { key: 'biceps', label: 'bíceps' },
  { key: 'triceps', label: 'tríceps' },
  { key: 'cuadriceps', label: 'cuádriceps' },
  { key: 'femoral', label: 'femoral' },
  { key: 'gluteo', label: 'glúteo' },
  { key: 'gemelo', label: 'gemelo' },
  { key: 'core', label: 'core' },
]

const LOADS: { key: LoadType; label: string }[] = [
  { key: 'barbell', label: 'barra' },
  { key: 'dumbbell', label: 'mancuernas' },
  { key: 'machine', label: 'máquina' },
  { key: 'cable', label: 'polea' },
  { key: 'bodyweight', label: 'corporal' },
]

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function Catalogo() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const sessionId = params.get('session')
  const routineId = params.get('routine')
  const picking = sessionId !== null || routineId !== null

  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<MuscleGroup | null>(null)
  const [creating, setCreating] = useState(false)
  /** Selección múltiple al añadir: se marcan varios y se confirman de una vez. */
  const [selected, setSelected] = useState<string[]>([])
  const [newGroup, setNewGroup] = useState<MuscleGroup>('pecho')
  const [newLoad, setNewLoad] = useState<LoadType>('machine')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => inputRef.current?.focus(), [])

  const exercises = useLiveQuery(async () => (await db.exercises.filter((e) => !e.archived).toArray()).sort((a, b) => a.name.localeCompare(b.name)), [])
  const recent = useLiveQuery(() => recentExercises(), [])
  const settings = useLiveQuery(getSettings)

  if (exercises === undefined || settings === undefined) return null

  const q = normalize(query.trim())
  const filtered = exercises.filter(
    (e) => (q === '' || normalize(e.name).includes(q)) && (group === null || e.muscle_group === group),
  )

  function toggle(exercise: Exercise) {
    setSelected((s) => (s.includes(exercise.id) ? s.filter((id) => id !== exercise.id) : [...s, exercise.id]))
  }

  function pick(exercise: Exercise) {
    if (picking) toggle(exercise)
    else navigate(`/ejercicio/${exercise.id}`)
  }

  async function confirmAdd() {
    for (const id of selected) {
      if (sessionId !== null) await addExerciseToSession(sessionId, id)
      else if (routineId !== null) await addExerciseToRoutine(routineId, id)
    }
    navigate(-1)
  }

  async function onCreate() {
    if (settings === undefined) return
    const name = query.trim()
    if (name === '') return
    const exercise = await createExercise({
      name,
      muscle_group: newGroup,
      load_type: newLoad,
      min_increment: settings.increments[newLoad],
      unit_mode: 'weight_reps',
    })
    setCreating(false)
    if (picking) {
      // queda marcado; se confirma junto al resto
      setSelected((s) => [...s, exercise.id])
      setQuery('')
    } else {
      navigate(`/ejercicio/${exercise.id}`)
    }
  }

  function row(e: Exercise) {
    const isSelected = selected.includes(e.id)
    return (
      <button key={e.id} className="row" style={{ width: '100%' }} onClick={() => pick(e)} aria-pressed={picking ? isSelected : undefined}>
        <span style={{ flex: 'none', width: 36 }}>
          <ExerciseMark group={e.muscle_group} size={28} />
        </span>
        <span className="row__main t-item">{e.name}</span>
        <span className="t-data soft">{GROUPS.find((g) => g.key === e.muscle_group)?.label}</span>
        {picking ? <span className={isSelected ? 'cat-check on' : 'cat-check'} aria-hidden="true" /> : <span className="row__chev">›</span>}
      </button>
    )
  }

  return (
    <div className="screen screen--stacked">
      <TopBar />
      <div className="pad">
        <div className="field" style={{ minHeight: 56 }}>
          <input
            ref={inputRef}
            aria-label="Buscar ejercicio"
            placeholder="Buscar ejercicio"
            className="t-item"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setCreating(false)
            }}
          />
        </div>

        <div className="seltext" style={{ marginTop: 'var(--sp-4)' }}>
          <button className={`t-info${group === null ? ' active' : ''}`} onClick={() => setGroup(null)}>
            todos
          </button>
          {GROUPS.map((g) => (
            <button key={g.key} className={`t-info${group === g.key ? ' active' : ''}`} onClick={() => setGroup(group === g.key ? null : g.key)}>
              {g.label}
            </button>
          ))}
        </div>

        {q === '' && group === null && (recent ?? []).length > 0 && (
          <section style={{ marginTop: 'var(--sp-5)' }}>
            <p className="t-body soft">Recientes</p>
            {(recent ?? []).map(row)}
          </section>
        )}

        <section style={{ marginTop: 'var(--sp-5)' }}>
          {filtered.map(row)}
          {filtered.length === 0 && !creating && (
            <button className="btn-text" onClick={() => setCreating(true)}>
              Crear «{query.trim()}»
            </button>
          )}
          {creating && (
            <div style={{ marginTop: 'var(--sp-4)' }}>
              <p className="t-body">Nuevo ejercicio: {query.trim()}</p>
              <div className="seltext" style={{ marginTop: 'var(--sp-3)' }} aria-label="Grupo muscular">
                {GROUPS.map((g) => (
                  <button key={g.key} className={`t-info${newGroup === g.key ? ' active' : ''}`} onClick={() => setNewGroup(g.key)}>
                    {g.label}
                  </button>
                ))}
              </div>
              <div className="seltext" style={{ marginTop: 'var(--sp-3)' }} aria-label="Tipo de carga">
                {LOADS.map((l) => (
                  <button key={l.key} className={`t-info${newLoad === l.key ? ' active' : ''}`} onClick={() => setNewLoad(l.key)}>
                    {l.label}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 'var(--sp-4)' }}>
                <button className="btn-cta" onClick={() => void onCreate()}>
                  Crear ejercicio
                </button>
              </div>
            </div>
          )}
          {!picking && filtered.length > 0 && q === '' && group === null && (
            <p className="t-info soft" style={{ marginTop: 'var(--sp-4)' }}>
              Tocar un ejercicio abre su evolución e histórico.
            </p>
          )}
        </section>
      </div>

      {picking && selected.length > 0 && (
        <div className="cat-cta">
          <button className="btn-cta" onClick={() => void confirmAdd()}>
            Añadir {selected.length} {selected.length === 1 ? 'ejercicio' : 'ejercicios'}
          </button>
        </div>
      )}
    </div>
  )
}
