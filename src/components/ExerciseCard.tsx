import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Exercise, SessionExercise, SetEntry, WeightUnit } from '../db/types'
import { lastPerformance } from '../db/repo'
import { fmtNum } from '../lib/format'
import { ExerciseVisual } from './ExerciseVisual'
import { Icon } from './Icon'
import { SetTable } from './SetTable'

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
  onSetConfirmed?: () => void
}

export function ExerciseCard({ data, open, onToggle, active, removable = false, unit, dragging = false, dragHandlers, onSetConfirmed }: Props) {
  const { se, exercise, sets } = data
  const past = useLiveQuery(() => lastPerformance(exercise.id), [exercise.id]) ?? []

  const work = sets.filter((s) => s.kind !== 'warmup')
  const done = work.filter((s) => s.completed).length
  const sub = `${se.target_sets}×${se.target_reps_min}-${se.target_reps_max} · ${done}/${work.length}`
  const isCurrent = active && sets.some((s) => !s.completed)
  const lastWeight = past.find((p) => p.weight !== null)?.weight ?? null

  return (
    <section className={`xcard${open ? ' open' : ''}${dragging ? ' dragging' : ''}${isCurrent && open ? ' is-current' : ''}`} {...dragHandlers}>
      <div className="xcard__head">
        <ExerciseVisual exercise={exercise} zoom />
        <button className="xcard__toggle" onClick={onToggle} aria-expanded={open}>
        <span className="xcard__names">
          <span className="t-h3">
            {active ? (
              <Link to={`/ejercicio/${exercise.id}`} onClick={(e) => e.stopPropagation()}>
                {exercise.name}
              </Link>
            ) : (
              exercise.name
            )}
          </span>
          <span className="xcard__sub t-metric-sm">{sub}</span>
        </span>
        {lastWeight !== null && exercise.unit_mode === 'weight_reps' && (
          <span className="xcard__last">
            <span className="t-metric-sm">
              {fmtNum(lastWeight)} <span className="t-label-sm soft">{unit}</span>
            </span>
            <span className="t-label-sm">último</span>
          </span>
        )}
        <span className="xcard__chev">
          <Icon name="chevron-down" />
        </span>
        </button>
      </div>

      <div className={`fold${open ? ' open' : ''}`} inert={!open || undefined}>
        <div>
          <SetTable se={se} exercise={exercise} sets={sets} past={past} active={active} removable={removable} unit={unit} onSetConfirmed={onSetConfirmed} />
        </div>
      </div>
    </section>
  )
}
