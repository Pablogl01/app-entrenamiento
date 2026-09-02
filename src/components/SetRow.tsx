import { useEffect, useRef, useState } from 'react'
import type { Exercise, SetEntry, WeightUnit } from '../db/types'
import { confirmSet, deleteSet, updateSet } from '../db/repo'
import { fmtNum } from '../lib/format'

interface Props {
  set: SetEntry
  exercise: Exercise
  /** Nº visible de la serie de trabajo (el calentamiento muestra "cal"). */
  workNumber: number
  /** Si la fila responde a gestos (sesión en curso o edición). */
  active: boolean
  unit: WeightUnit
}

/**
 * La fila de serie, 64px (DESIGN.md §4): tres zonas — el número confirma,
 * las cifras abren teclado, el `+` sube un min_increment. Sin botón `−`.
 */
export function SetRow({ set, exercise, workNumber, active, unit }: Props) {
  const [editing, setEditing] = useState<'weight' | 'reps' | null>(null)
  const [text, setText] = useState('')
  const [extras, setExtras] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const pressTimer = useRef<number | null>(null)

  useEffect(() => {
    if (editing !== null) inputRef.current?.select()
  }, [editing])

  const isWeighted = exercise.unit_mode === 'weight_reps'
  const isTime = exercise.unit_mode === 'time'

  function commitEdit() {
    const n = Number(text.replace(',', '.'))
    if (Number.isFinite(n) && text.trim() !== '') {
      if (editing === 'weight') void updateSet(set.id, { weight: n })
      if (editing === 'reps') void updateSet(set.id, { reps: Math.round(n) })
    }
    setEditing(null)
  }

  function onConfirm() {
    // Una fila ya confirmada no responde al toque (deshacer por roce es peor).
    if (!active || set.completed) return
    void confirmSet(set.id)
  }

  function onPlus() {
    if (!active) return
    if (isWeighted) {
      const inc = exercise.min_increment > 0 ? exercise.min_increment : 2.5
      void updateSet(set.id, { weight: (set.weight ?? 0) + inc })
    } else {
      void updateSet(set.id, { reps: set.reps + (isTime ? 5 : 1) })
    }
  }

  function startPress() {
    if (!active) return
    pressTimer.current = window.setTimeout(() => setExtras((v) => !v), 450)
  }

  function endPress() {
    if (pressTimer.current !== null) window.clearTimeout(pressTimer.current)
  }

  const cls = ['set']
  if (set.completed) cls.push('set--done')
  if (set.kind === 'warmup') cls.push('set--warmup')

  return (
    <div className={cls.join(' ')}>
      <button
        className={set.kind === 'warmup' ? 'set__confirm t-data' : 'set__confirm t-datalg'}
        aria-label={set.completed ? 'Serie confirmada' : 'Confirmar serie'}
        onClick={onConfirm}
      >
        {set.kind === 'warmup' ? 'cal' : workNumber}
      </button>

      <button
        className="set__figs t-datalg"
        aria-label="Editar cifras"
        onClick={(e) => {
          if (!active) return
          // decidir campo según mitad tocada
          const rect = e.currentTarget.getBoundingClientRect()
          const left = e.clientX - rect.left < rect.width / 2
          if (isWeighted && left) {
            setText(set.weight === null ? '' : String(set.weight).replace('.', ','))
            setEditing('weight')
          } else {
            setText(String(set.reps))
            setEditing('reps')
          }
        }}
        onPointerDown={startPress}
        onPointerUp={endPress}
        onPointerLeave={endPress}
        onContextMenu={(e) => e.preventDefault()}
      >
        {editing === 'weight' ? (
          <input
            ref={inputRef}
            inputMode="decimal"
            aria-label="Peso"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => e.key === 'Enter' && commitEdit()}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          isWeighted && <span>{set.weight === null ? '—' : fmtNum(set.weight)}&nbsp;{unit}</span>
        )}
        {isWeighted && <span className="soft">×</span>}
        {editing === 'reps' ? (
          <input
            ref={inputRef}
            inputMode="numeric"
            aria-label={isTime ? 'Segundos' : 'Repeticiones'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => e.key === 'Enter' && commitEdit()}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span>
            {set.reps}
            {isTime ? ' s' : ''}
          </span>
        )}
        {set.rir !== null && <span className="t-data soft">RIR {set.rir}</span>}
        {set.kind === 'failure' && <span className="t-data soft">fallo</span>}
      </button>

      {active ? (
        <button className="set__plus" aria-label="Subir peso" onClick={onPlus}>
          +
        </button>
      ) : (
        <span />
      )}

      {extras && active && (
        <div className="set__extra">
          <span className="t-info soft">RIR</span>
          <button
            className="stepbtn"
            aria-label="Bajar RIR"
            onClick={() => void updateSet(set.id, { rir: Math.max(0, (set.rir ?? 2) - 1) })}
          >
            −
          </button>
          <span className="t-data">{set.rir ?? '—'}</span>
          <button
            className="stepbtn"
            aria-label="Subir RIR"
            onClick={() => void updateSet(set.id, { rir: Math.min(9, (set.rir ?? 1) + 1) })}
          >
            +
          </button>
          <button
            className="t-info soft"
            onClick={() => void updateSet(set.id, { kind: set.kind === 'failure' ? 'work' : 'failure' })}
          >
            {set.kind === 'failure' ? 'quitar fallo' : 'al fallo'}
          </button>
          <button className="t-info soft" onClick={() => void deleteSet(set.id)}>
            borrar
          </button>
        </div>
      )}
    </div>
  )
}
