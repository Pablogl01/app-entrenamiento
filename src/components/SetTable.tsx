import { useState } from 'react'
import type { Exercise, SessionExercise, SetEntry, WeightUnit } from '../db/types'
import type { PastSet } from '../db/repo'
import { addSet, removeSessionExercise } from '../db/repo'
import { Icon } from './Icon'
import { SetActive, SetHead, SetRow } from './SetRow'

interface Props {
  se: SessionExercise
  exercise: Exercise
  sets: SetEntry[]
  past: PastSet[]
  /** true en sesión en curso o edición de sesión pasada. */
  active: boolean
  removable?: boolean
  unit: WeightUnit
  onSetConfirmed?: () => void
  /** Sin pie de «Añadir serie» (la sesión en vivo pone el suyo). */
  hideFoot?: boolean
}

/**
 * La tabla de series de un ejercicio, calcada de la maqueta: cabecera de 12
 * columnas, filas compactas y una sola serie en curso expandida.
 */
export function SetTable({ se, exercise, sets, past, active, removable = false, unit, onSetConfirmed, hideFoot = false }: Props) {
  const [chosen, setChosen] = useState<string | null>(null)
  const ordered = [...sets].sort((a, b) => a.set_index - b.set_index)
  const warmups = ordered.filter((s) => s.kind === 'warmup')
  const work = ordered.filter((s) => s.kind !== 'warmup')

  const chosenSet = chosen !== null ? ordered.find((s) => s.id === chosen && !s.completed) : undefined
  const activeId = active ? (chosenSet ?? ordered.find((s) => !s.completed))?.id ?? null : null

  function renderSet(s: SetEntry, workNumber: number) {
    const prev = s.kind === 'warmup' ? undefined : past[workNumber - 1]
    if (s.id === activeId) {
      return (
        <SetActive
          key={s.id}
          set={s}
          exercise={exercise}
          workNumber={workNumber}
          prev={prev}
          unit={unit}
          onConfirmed={onSetConfirmed}
          targetMin={se.target_reps_min}
          targetMax={se.target_reps_max}
        />
      )
    }
    return <SetRow key={s.id} set={s} exercise={exercise} workNumber={workNumber} prev={prev} unit={unit} onPick={active && !s.completed ? () => setChosen(s.id) : undefined} />
  }

  return (
    <div className="flex flex-col gap-xs">
      <SetHead />
      {warmups.map((s) => renderSet(s, 0))}
      {work.map((s, i) => renderSet(s, i + 1))}
      {active && !hideFoot && (
        <div className="flex items-center justify-between pt-xs px-1 type-label-sm text-secondary">
          <button className="flex items-center gap-1 press" onClick={() => void addSet(se.id, 'work')}>
            <Icon name="plus" size={16} />
            <span>Añadir serie</span>
          </button>
          <button className="flex items-center gap-1 press" onClick={() => void addSet(se.id, 'warmup')}>
            <Icon name="flame" size={16} />
            <span>Calentamiento</span>
          </button>
          {removable && (
            <button className="flex items-center gap-1 press text-outline" onClick={() => void removeSessionExercise(se.id)}>
              <Icon name="close" size={16} />
              <span>Quitar</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
