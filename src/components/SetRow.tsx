import type { Exercise, SetEntry, WeightUnit } from '../db/types'
import type { PastSet } from '../db/repo'
import { confirmSet, deleteSet, updateSet } from '../db/repo'
import { fmtNum } from '../lib/format'
import { Icon } from './Icon'
import { StepperBare } from './Stepper'

interface RowProps {
  set: SetEntry
  exercise: Exercise
  /** Nº visible de la serie de trabajo; el calentamiento muestra «C». */
  workNumber: number
  prev: PastSet | undefined
  unit: WeightUnit
  /** Solo las pendientes en sesión activa responden: pasan a ser la serie en curso. */
  onPick?: () => void
}

function prevText(prev: PastSet | undefined, exercise: Exercise, unit: string): string {
  if (prev === undefined) return '—'
  if (exercise.unit_mode === 'weight_reps') return `${prev.weight === null ? '—' : fmtNum(prev.weight)} ${unit} × ${prev.reps}`
  return exercise.unit_mode === 'time' ? `${prev.reps} s` : String(prev.reps)
}

/** Cabecera de la tabla de series, calcada de la maqueta (rejilla de 12). */
export function SetHead() {
  return (
    <div className="grid grid-cols-12 gap-1 px-2 py-1 type-label-sm uppercase text-outline tracking-wider">
      <span className="col-span-2 text-center">Serie</span>
      <span className="col-span-3 text-center">Previo</span>
      <span className="col-span-3 text-center">Carga</span>
      <span className="col-span-2 text-center">Reps</span>
      <span className="col-span-2 text-center">Estado</span>
    </div>
  )
}

/** Fila compacta de la tabla: hecha o pendiente, tal cual la maqueta. */
export function SetRow({ set, exercise, workNumber, prev, unit, onPick }: RowProps) {
  const isWeighted = exercise.unit_mode === 'weight_reps'
  const doneRow = set.completed
  const Tag = onPick !== undefined ? 'button' : 'div'
  return (
    <Tag
      className={`grid grid-cols-12 gap-1 items-center rounded-lg p-2p5 w-full text-left bg-sc-low${doneRow ? '' : ' opacity-70'}${set.kind === 'warmup' ? ' opacity-60' : ''}`}
      onClick={onPick}
      aria-label={onPick !== undefined ? 'Hacer esta serie' : undefined}
    >
      <div className="col-span-2 flex items-center justify-center">
        <span className={`w-6 h-6 rounded-full bg-sc-highest flex items-center justify-center type-label-sm font-semibold${doneRow ? ' text-secondary' : ' text-outline'}`}>
          {set.kind === 'warmup' ? 'C' : workNumber}
        </span>
      </div>
      <div className="col-span-3 text-center type-label-sm text-outline truncate">{prevText(prev, exercise, unit)}</div>
      <div className={`col-span-3 text-center type-metric-md nowrap${doneRow ? ' font-semibold text-on-surface' : ' font-normal text-secondary'}`}>
        {isWeighted ? (
          <>
            {set.weight === null ? '—' : fmtNum(set.weight)} <span className={`type-label-sm font-normal${doneRow ? ' text-secondary' : ' text-outline'}`}>{unit}</span>
          </>
        ) : (
          '—'
        )}
      </div>
      <div className={`col-span-2 text-center type-metric-md${doneRow ? ' font-semibold text-on-surface' : ' font-normal text-secondary'}`}>
        {set.reps}
        {exercise.unit_mode === 'time' && <span className="type-label-sm text-outline"> s</span>}
      </div>
      <div className="col-span-2 flex justify-center">
        {doneRow ? (
          <div className="w-7 h-7 rounded bg-volt flex items-center justify-center text-on-volt shadow-sm">
            <Icon name="check" size={18} strokeWidth={2.5} />
          </div>
        ) : (
          <div className="w-7 h-7 rounded bg-sc-high flex items-center justify-center text-outline">
            <Icon name="hourglass" size={16} />
          </div>
        )}
      </div>
    </Tag>
  )
}

interface ActiveProps {
  set: SetEntry
  exercise: Exercise
  workNumber: number
  prev: PastSet | undefined
  unit: WeightUnit
  /** Tras confirmar: arranca el descanso en la sesión en vivo. */
  onConfirmed?: () => void
  targetMin?: number
  targetMax?: number
}

/**
 * La serie en curso, calcada de la maqueta: bloque sc-highest con dos lechos
 * (carga y reps) con −/+ de 40 y cifra a 40px, y «Completar serie» en volt.
 */
export function SetActive({ set, exercise, workNumber, prev, unit, onConfirmed, targetMin, targetMax }: ActiveProps) {
  const isWeighted = exercise.unit_mode === 'weight_reps'
  const isTime = exercise.unit_mode === 'time'
  const inc = exercise.min_increment > 0 ? exercise.min_increment : 2.5
  const isWarmup = set.kind === 'warmup'

  return (
    <div className="rounded-xl p-md bg-sc-highest shadow-md my-xxs">
      <div className="flex items-center justify-between mb-sm">
        <div className="flex items-center gap-xs">
          <span className="w-6 h-6 rounded-full bg-volt flex items-center justify-center type-label-sm font-bold text-on-volt">{isWarmup ? 'C' : workNumber}</span>
          <span className="type-label-md uppercase font-semibold text-volt tracking-wide">{isWarmup ? 'Calentamiento' : 'Serie en curso'}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="type-label-sm text-secondary">Anterior:</span>
          <span className="type-label-sm text-on-surface font-semibold">{prevText(prev, exercise, unit)}</span>
        </div>
      </div>

      <div className={`grid gap-sm mb-md set-grid${isWeighted ? ' grid-cols-2' : ''}`}>
        {isWeighted && (
          <div className="bg-sc-lowest rounded-lg p-2p5">
            <div className="flex justify-between items-center mb-1">
              <span className="type-label-sm text-outline uppercase tracking-wider">Carga ({unit})</span>
              <span className="type-label-sm text-volt font-semibold">
                +{fmtNum(inc)} {unit}
              </span>
            </div>
            <StepperBare value={set.weight} step={inc} ariaLabel="carga" onCommit={(n) => void updateSet(set.id, { weight: n })} />
          </div>
        )}
        <div className="bg-sc-lowest rounded-lg p-2p5">
          <div className="flex justify-between items-center mb-1">
            <span className="type-label-sm text-outline uppercase tracking-wider">{isTime ? 'Segundos' : 'Repeticiones'}</span>
            <span className="type-label-sm text-secondary">
              {targetMin !== undefined && targetMax !== undefined ? `Meta: ${targetMin}-${targetMax}` : set.kind === 'failure' ? 'al fallo' : ''}
            </span>
          </div>
          <StepperBare value={set.reps} step={isTime ? 5 : 1} integer ariaLabel={isTime ? 'segundos' : 'repeticiones'} onCommit={(n) => void updateSet(set.id, { reps: n })} />
        </div>
      </div>

      <button
        className="w-full h-touch rounded-lg bg-volt text-on-volt type-label-md font-bold uppercase tracking-wider flex items-center justify-center gap-sm press shadow-md"
        onClick={() => {
          void confirmSet(set.id).then(() => onConfirmed?.())
        }}
      >
        <Icon name="check-circle" size={20} />
        <span>{isWarmup ? 'Completar calentamiento' : `Completar serie ${workNumber}`}</span>
      </button>

      <div className="flex items-center justify-between mt-sm px-1 type-label-sm">
        <div className="flex items-center gap-sm">
          <span className="text-outline uppercase tracking-wider">RPE</span>
          <StepperBare small value={set.rpe} step={0.5} min={6} ariaLabel="RPE" onCommit={(n) => void updateSet(set.id, { rpe: Math.min(10, Math.max(6, n)) })} />
        </div>
        <div className="flex items-center gap-md">
          <button className="text-secondary uppercase press" onClick={() => void updateSet(set.id, { kind: set.kind === 'failure' ? 'work' : 'failure' })}>
            {set.kind === 'failure' ? 'Quitar fallo' : 'Al fallo'}
          </button>
          <button className="text-error uppercase press" onClick={() => void deleteSet(set.id)}>
            Borrar
          </button>
        </div>
      </div>
    </div>
  )
}
