import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { db, getSettings } from '../db/db'
import { addExerciseToRoutine, addExerciseToSession, createExercise, lastPerformance } from '../db/repo'
import { addDays, todayISO } from '../lib/dates'
import { fmtNum } from '../lib/format'
import { TopBar } from '../components/TopBar'
import { EXERCISE_IMAGES } from '../components/ExerciseVisual'
import { ExerciseMark } from '../components/ExerciseMark'
import { Icon } from '../components/Icon'
import type { Exercise, LoadType, MuscleGroup } from '../db/types'

const GROUPS: { key: MuscleGroup; label: string }[] = [
  { key: 'pecho', label: 'Pecho' },
  { key: 'espalda', label: 'Espalda' },
  { key: 'hombro', label: 'Hombro' },
  { key: 'biceps', label: 'Bíceps' },
  { key: 'triceps', label: 'Tríceps' },
  { key: 'cuadriceps', label: 'Cuádriceps' },
  { key: 'femoral', label: 'Femoral' },
  { key: 'gluteo', label: 'Glúteo' },
  { key: 'gemelo', label: 'Gemelo' },
  { key: 'core', label: 'Core' },
]

const LOADS: { key: LoadType; label: string }[] = [
  { key: 'barbell', label: 'Barra olímpica' },
  { key: 'dumbbell', label: 'Mancuernas' },
  { key: 'machine', label: 'Máquina' },
  { key: 'cable', label: 'Polea / Cable' },
  { key: 'bodyweight', label: 'Corporal + Peso' },
]

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

interface Recent {
  exercise: Exercise
  last: string | null
  isPr: boolean
}

/** Foto de la maqueta (w-12, rounded-lg) o marca geométrica si no hay. */
function Thumb({ exercise, className }: { exercise: Exercise; className: string }) {
  const src = exercise.image !== null ? EXERCISE_IMAGES[exercise.image] : undefined
  return (
    <div className={`${className} rounded-lg overflow-hidden shrink-0 relative bg-sc-highest flex items-center justify-center text-on-surface`}>
      {src !== undefined ? <img src={src} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : <ExerciseMark group={exercise.muscle_group} size={24} />}
    </div>
  )
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
  const [selected, setSelected] = useState<string[]>([])
  const [newGroup, setNewGroup] = useState<MuscleGroup>('pecho')
  const [newLoad, setNewLoad] = useState<LoadType>('machine')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => inputRef.current?.focus(), [])

  const exercises = useLiveQuery(async () => (await db.exercises.filter((e) => !e.archived).toArray()).sort((a, b) => a.name.localeCompare(b.name)), [])
  const settings = useLiveQuery(getSettings)
  const lastByExercise = useLiveQuery(async () => {
    const map = new Map<string, string>()
    if (exercises === undefined) return map
    for (const exercise of exercises) {
      const past = await lastPerformance(exercise.id)
      const top = past.reduce<(typeof past)[number] | null>((best, p) => (best === null || (p.weight ?? 0) > (best.weight ?? 0) ? p : best), null)
      if (top === null) continue
      map.set(exercise.id, exercise.unit_mode === 'weight_reps' ? `${top.weight === null ? '—' : fmtNum(top.weight)} kg × ${top.reps} reps` : `${top.reps}${exercise.unit_mode === 'time' ? ' s' : ' reps'}`)
    }
    return map
  }, [exercises?.length])
  const recent = useLiveQuery(async (): Promise<Recent[]> => {
    const since = addDays(todayISO(), -7)
    const sessions = (await db.sessions.filter((s) => s.started_at !== null && s.date >= since).toArray()).sort((a, b) => b.date.localeCompare(a.date))
    const seen: string[] = []
    for (const session of sessions) {
      const links = (await db.session_exercises.where('session_id').equals(session.id).toArray()).sort((a, b) => a.position - b.position)
      for (const l of links) if (!seen.includes(l.exercise_id)) seen.push(l.exercise_id)
    }
    const out: Recent[] = []
    for (const id of seen.slice(0, 3)) {
      const exercise = await db.exercises.get(id)
      if (!exercise || exercise.archived) continue
      const past = await lastPerformance(exercise.id)
      const top = past.reduce<(typeof past)[number] | null>((best, p) => (best === null || (p.weight ?? 0) > (best.weight ?? 0) ? p : best), null)
      out.push({
        exercise,
        last: top === null ? null : exercise.unit_mode === 'weight_reps' ? `${top.weight === null ? '—' : fmtNum(top.weight)} kg × ${top.reps}` : `${top.reps}${exercise.unit_mode === 'time' ? ' s' : ' reps'}`,
        isPr: false,
      })
    }
    return out
  }, [])

  if (exercises === undefined || settings === undefined) return null

  const q = normalize(query.trim())
  const filtered = exercises.filter((e) => (q === '' || normalize(e.name).includes(q)) && (group === null || e.muscle_group === group))

  function pick(exercise: Exercise) {
    if (picking) setSelected((s) => (s.includes(exercise.id) ? s.filter((id) => id !== exercise.id) : [...s, exercise.id]))
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
    const exercise = await createExercise({ name, muscle_group: newGroup, load_type: newLoad, min_increment: settings.increments[newLoad], unit_mode: 'weight_reps' })
    setCreating(false)
    if (picking) {
      setSelected((s) => [...s, exercise.id])
      setQuery('')
    } else {
      navigate(`/ejercicio/${exercise.id}`)
    }
  }

  const showRecent = q === '' && group === null && (recent ?? []).length > 0

  return (
    <div className="screen screen--stacked">
      <TopBar title="Exercise Detail" />
      <div className="flex flex-col w-full">
        {/* Header */}
        <div className="px-gutter pt-md pb-md flex justify-between items-end">
          <div className="flex flex-col">
            <span className="type-label-sm text-secondary uppercase tracking-wider">Librería de fuerza</span>
            <span className="type-headline-md font-bold tracking-tight text-on-surface">{picking ? 'Añadir ejercicio' : 'Ejercicios'}</span>
          </div>
          <button
            type="button"
            className="h-touch px-md rounded-xl bg-sc-high text-volt flex items-center gap-xs press press-95 shadow-sm"
            onClick={() => {
              setCreating(true)
              inputRef.current?.focus()
            }}
          >
            <Icon name="add-circle" size={18} />
            <span className="type-label-md uppercase tracking-wider font-semibold text-volt">Crear propio</span>
          </button>
        </div>

        {/* Search */}
        <div className="px-gutter mb-md">
          <div className="relative flex items-center w-full bg-sc-low rounded-xl px-md py-xs shadow-sm">
            <Icon name="search" size={22} className="text-secondary select-none" style={{ marginRight: 8, flex: 'none' }} />
            <input
              ref={inputRef}
              className="w-full bare-input text-left text-on-surface type-body-md py-sm"
              aria-label="Buscar ejercicio"
              placeholder="Buscar ejercicio, músculo o equipo..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setCreating(false)
              }}
            />
            {query !== '' && (
              <button type="button" className="w-8 h-8 rounded-full bg-sc-highest text-secondary flex items-center justify-center ml-1 flex-none" aria-label="Borrar búsqueda" onClick={() => setQuery('')}>
                <Icon name="close" size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="w-full overflow-x-auto px-gutter mb-lg flex items-center gap-xs hscroll" role="radiogroup" aria-label="Grupo muscular">
          <button type="button" className={`shrink-0 px-md py-xs rounded-full type-label-md ${group === null ? 'bg-volt text-on-volt font-semibold shadow-sm' : 'bg-sc-high text-secondary'}`} onClick={() => setGroup(null)}>
            Todos
          </button>
          {GROUPS.map((g) => (
            <button
              key={g.key}
              type="button"
              className={`shrink-0 px-md py-xs rounded-full type-label-md flex items-center gap-xxs ${group === g.key ? 'bg-volt text-on-volt font-semibold shadow-sm' : 'bg-sc-high text-secondary'}`}
              onClick={() => setGroup(group === g.key ? null : g.key)}
            >
              <span>{g.label}</span>
              {group === g.key && <span className="w-1p5 h-1p5 rounded-full" style={{ background: 'var(--md-on-primary-fixed)' }} />}
            </button>
          ))}
        </div>

        {/* Create form */}
        {creating && (
          <div className="px-gutter mb-lg">
            <div className="bg-sc-low rounded-xl p-md flex flex-col gap-sm">
              <span className="type-label-sm text-volt uppercase tracking-widest font-semibold">Nuevo ejercicio</span>
              <div className="bg-sc rounded-lg px-md py-sm">
                <input className="w-full bare-input text-left type-headline-sm text-on-surface" aria-label="Nombre del ejercicio" placeholder="Nombre del ejercicio" value={query} autoFocus onChange={(e) => setQuery(e.target.value)} />
              </div>
              <span className="type-label-sm text-secondary uppercase tracking-wider">Grupo muscular</span>
              <div className="flex gap-xs overflow-x-auto hscroll">
                {GROUPS.map((g) => (
                  <button key={g.key} type="button" className={`shrink-0 px-md py-xs rounded-full type-label-md ${newGroup === g.key ? 'bg-volt text-on-volt font-semibold' : 'bg-sc-high text-secondary'}`} onClick={() => setNewGroup(g.key)}>
                    {g.label}
                  </button>
                ))}
              </div>
              <span className="type-label-sm text-secondary uppercase tracking-wider">Tipo de carga</span>
              <div className="flex gap-xs overflow-x-auto hscroll">
                {LOADS.map((l) => (
                  <button key={l.key} type="button" className={`shrink-0 px-md py-xs rounded-full type-label-md ${newLoad === l.key ? 'bg-volt text-on-volt font-semibold' : 'bg-sc-high text-secondary'}`} onClick={() => setNewLoad(l.key)}>
                    {l.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-sm pt-xs">
                <button type="button" className="h-touch rounded-lg bg-volt text-on-volt type-label-md uppercase tracking-wider font-bold press" disabled={query.trim() === ''} onClick={() => void onCreate()}>
                  Crear ejercicio
                </button>
                <button type="button" className="h-touch rounded-lg bg-sc-high text-on-surface type-label-md uppercase tracking-wider press" onClick={() => setCreating(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Recientes */}
        {showRecent && (
          <div className="px-gutter mb-lg">
            <div className="flex items-center justify-between mb-sm">
              <div className="flex items-center gap-xs">
                <span className="w-1p5 h-1p5 rounded-full bg-volt pulse" />
                <h2 className="type-label-sm text-secondary uppercase tracking-widest font-semibold">Recientes en tu ciclo</h2>
              </div>
              <span className="type-label-sm text-secondary-fixed-dim">Últimos 7 días</span>
            </div>
            <div className="grid grid-cols-3 gap-xs">
              {(recent ?? []).map(({ exercise, last }) => {
                const on = selected.includes(exercise.id)
                return (
                  <button key={exercise.id} type="button" className={`relative bg-sc-low p-sm rounded-xl flex flex-col justify-between text-left press press-95${on ? ' border-volt' : ''}`} onClick={() => pick(exercise)}>
                    <div className="w-full h-16 rounded-lg overflow-hidden relative mb-xs">
                      <Thumb exercise={exercise} className="w-full h-16" />
                      <span className={`absolute top-1 right-1 p-0p5 rounded-full flex items-center justify-center ${on ? 'bg-volt text-on-volt' : 'text-volt'}`} style={on ? undefined : { background: 'color-mix(in srgb, var(--md-sc-lowest) 80%, transparent)' }}>
                        <Icon name={on ? 'check' : 'bolt'} size={14} />
                      </span>
                    </div>
                    <div className="min-w-0 w-full">
                      <span className="type-body-sm text-on-surface font-bold line-clamp-1">{exercise.name}</span>
                      <span className="type-label-sm text-secondary font-semibold tracking-tight">{last ?? '—'}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Lista */}
        <div className="px-gutter flex flex-col gap-sm pb-2xl">
          <div className="flex items-center justify-between pt-xs">
            <span className="type-label-sm text-secondary uppercase tracking-widest font-semibold">{q === '' && group === null ? 'Ejercicios sugeridos' : 'Resultados'}</span>
            <span className="type-label-sm text-secondary">{filtered.length} disponibles</span>
          </div>
          {filtered.map((e) => {
            const on = selected.includes(e.id)
            const last = lastByExercise?.get(e.id)
            return (
              <div key={e.id} className={`relative bg-sc-low rounded-xl p-md flex items-center justify-between shadow-sm${on ? ' border-volt' : ''}`}>
                <button type="button" className="flex items-center gap-md min-w-0 pr-xs text-left" onClick={() => pick(e)}>
                  <Thumb exercise={e} className="w-12 h-12" />
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-xs mb-xxs">
                      <span className="type-headline-sm text-on-surface font-bold tracking-tight truncate">{e.name}</span>
                      {e.is_custom && <span className="px-1p5 py-0p5 rounded bg-sc-highest text-volt type-label-sm font-semibold flex-none">Propio</span>}
                    </div>
                    <p className="type-body-sm text-secondary truncate mb-xs">{GROUPS.find((g) => g.key === e.muscle_group)?.label}</p>
                    <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
                      <span className="inline-flex items-center gap-xxs px-xs py-0p5 rounded bg-sc-highest text-secondary type-label-sm uppercase">
                        <Icon name="dumbbell" size={12} />
                        {LOADS.find((l) => l.key === e.load_type)?.label}
                      </span>
                      {last !== undefined && (
                        <span className="inline-flex items-center gap-xxs px-xs py-0p5 rounded bg-sc text-volt type-label-md font-semibold tracking-tight">
                          <Icon name="trophy" size={12} className="text-volt" />
                          {last}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  className={`w-touch h-touch rounded-xl shrink-0 flex items-center justify-center press press-95 ${on ? 'bg-volt text-on-volt' : 'bg-sc-high text-on-surface'}`}
                  aria-label={picking ? (on ? 'Quitar de la selección' : 'Añadir') : 'Ver ejercicio'}
                  onClick={() => pick(e)}
                >
                  <Icon name={picking ? (on ? 'check' : 'plus') : 'chevron-right'} size={24} />
                </button>
              </div>
            )
          })}
          {filtered.length === 0 && !creating && (
            <button type="button" className="h-touch rounded-xl bg-sc-high text-volt type-label-md uppercase tracking-wider font-semibold flex items-center justify-center gap-xs press" onClick={() => setCreating(true)}>
              <Icon name="add-circle" size={18} />
              Crear «{query.trim()}»
            </button>
          )}
        </div>
      </div>

      {/* Toast / CTA de selección múltiple */}
      {picking && selected.length > 0 && (
        <div className="cat-toast" style={{ position: 'fixed', bottom: 24, left: 16, right: 16, zIndex: 40, maxWidth: 528, margin: '0 auto' }}>
          <button type="button" className="w-full bg-volt text-on-volt py-sm px-md rounded-xl flex items-center justify-between shadow-xl press" onClick={() => void confirmAdd()}>
            <div className="flex items-center gap-sm">
              <Icon name="check-circle" size={18} />
              <span className="type-label-md font-bold uppercase tracking-wide">
                {selected.length} {selected.length === 1 ? 'ejercicio seleccionado' : 'ejercicios seleccionados'}
              </span>
            </div>
            <span className="type-label-sm uppercase tracking-wider">Añadir</span>
          </button>
        </div>
      )}
    </div>
  )
}
