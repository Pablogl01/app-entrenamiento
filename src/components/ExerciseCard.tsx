import { Link } from 'react-router-dom'
import type { Exercise, SessionExercise, SetEntry, WeightUnit } from '../db/types'
import { addSet, removeSessionExercise } from '../db/repo'
import { ExerciseMark } from './ExerciseMark'
import { SetRow } from './SetRow'

export interface CardData {
  se: SessionExercise
  exercise: Exercise
  sets: SetEntry[]
}

interface Props {
  data: CardData
  open: boolean
  onToggle: () => void
  /** true en sesión en curso o edición de sesión pasada. */
  active: boolean
  /** Quitar ejercicio visible (edición). */
  removable?: boolean
  unit: WeightUnit
  dragging?: boolean
  dragHandlers?: React.HTMLAttributes<HTMLDivElement>
}

export function ExerciseCard({ data, open, onToggle, active, removable = false, unit, dragging = false, dragHandlers }: Props) {
  const { se, exercise, sets } = data
  const ordered = [...sets].sort((a, b) => a.set_index - b.set_index)
  const warmups = ordered.filter((s) => s.kind === 'warmup')
  const work = ordered.filter((s) => s.kind !== 'warmup')
  const done = work.filter((s) => s.completed).length
  const sub = `${se.target_sets}×${se.target_reps_min}-${se.target_reps_max} · ${done}/${work.length}`

  return (
    <section className={`xcard${open ? ' open' : ''}${dragging ? ' dragging' : ''}`} {...dragHandlers}>
      <button className="xcard__head" onClick={onToggle} aria-expanded={open}>
        <span className="xcard__panel">
          <ExerciseMark group={exercise.muscle_group} />
        </span>
        <span className="xcard__meta">
          <span className="xcard__names">
            <span className="t-item">
              {active ? (
                <Link to={`/ejercicio/${exercise.id}`} onClick={(e) => e.stopPropagation()} style={{ color: 'inherit', textDecoration: 'none' }}>
                  {exercise.name}
                </Link>
              ) : (
                exercise.name
              )}
            </span>
            <span className="xcard__sub t-data">{sub}</span>
          </span>
          <span className="xcard__chev" aria-hidden="true">
            ⌄
          </span>
        </span>
      </button>

      <div className={`fold${open ? ' open' : ''}`} inert={!open || undefined}>
        <div>
          {warmups.map((s) => (
            <SetRow key={s.id} set={s} exercise={exercise} workNumber={0} active={active} unit={unit} />
          ))}
          {work.map((s, i) => (
            <SetRow key={s.id} set={s} exercise={exercise} workNumber={i + 1} active={active} unit={unit} />
          ))}
          {active && (
            <div className="xcard__foot">
              <button className="t-info" onClick={() => void addSet(se.id, 'work')}>
                Añadir serie
              </button>
              <button className="t-info" onClick={() => void addSet(se.id, 'warmup')}>
                Calentamiento
              </button>
              {removable && (
                <button className="t-info" onClick={() => void removeSessionExercise(se.id)}>
                  Quitar
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
