import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import { fmtNum } from '../lib/format'

interface Props {
  value: number | null
  onCommit: (n: number) => void
  step: number
  min?: number
  /** Enteros (reps, series) o decimales (carga). */
  integer?: boolean
  suffix?: string
  ariaLabel: string
  /** Clase tipográfica de la cifra. */
  className?: string
  small?: boolean
}

function useEditing(value: number | null, integer: boolean, onCommit: (n: number) => void) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])
  function commit() {
    setEditing(false)
    const n = Number(text.replace(',', '.'))
    if (Number.isFinite(n) && text.trim() !== '') onCommit(integer ? Math.round(n) : n)
  }
  function start() {
    setText(value === null ? '' : String(value).replace('.', ','))
    setEditing(true)
  }
  return { editing, text, setText, inputRef, commit, start, cancel: () => setEditing(false) }
}

/**
 * Stepper − valor + con lecho propio (editor de rutina, ajustes). Los botones
 * ajustan un paso; tocar la cifra abre el teclado numérico.
 */
export function Stepper({ value, onCommit, step, min = 0, integer = false, suffix, ariaLabel, className = 't-metric-xl', small = false }: Props) {
  const { editing, text, setText, inputRef, commit, start, cancel } = useEditing(value, integer, onCommit)

  function nudge(dir: 1 | -1) {
    const base = value ?? 0
    onCommit(Math.max(min, Math.round((base + dir * step) * 1000) / 1000))
  }

  return (
    <div className={small ? 'stepper stepper--sm' : 'stepper'}>
      <button className="stepper__btn" aria-label={`Bajar ${ariaLabel}`} onClick={() => nudge(-1)}>
        <Icon name="minus" size={small ? 18 : 22} />
      </button>
      <div className={`stepper__val ${className}`}>
        {editing ? (
          <input
            ref={inputRef}
            inputMode={integer ? 'numeric' : 'decimal'}
            aria-label={ariaLabel}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') cancel()
            }}
          />
        ) : (
          <button className={className} style={{ width: '100%', textAlign: 'center', color: 'inherit' }} aria-label={`Editar ${ariaLabel}`} onClick={start}>
            {value === null ? '—' : fmtNum(value)}
            {suffix !== undefined && (
              <span className="t-label-sm" style={{ color: 'var(--ink-soft)', marginLeft: 4 }}>
                {suffix}
              </span>
            )}
          </button>
        )}
      </div>
      <button className="stepper__btn" aria-label={`Subir ${ariaLabel}`} onClick={() => nudge(1)}>
        <Icon name="plus" size={small ? 18 : 22} />
      </button>
    </div>
  )
}

interface BareProps {
  value: number | null
  onCommit: (n: number) => void
  step: number
  min?: number
  integer?: boolean
  ariaLabel: string
  small?: boolean
}

/**
 * Stepper de la serie en curso, calcado de la maqueta: botones −/+ de 40×40
 * sobre sc-high, cifra desnuda a 40px en el centro (input al tocarla).
 */
export function StepperBare({ value, onCommit, step, min = 0, integer = false, ariaLabel, small = false }: BareProps) {
  const { editing, text, setText, inputRef, commit, start, cancel } = useEditing(value, integer, onCommit)
  function nudge(dir: 1 | -1) {
    const base = value ?? 0
    onCommit(Math.max(min, Math.round((base + dir * step) * 1000) / 1000))
  }
  const btn = small ? 'w-7 h-7 rounded bg-sc-high ibtn press press-95' : 'w-10 h-10 rounded bg-sc-high ibtn press press-95'
  const num = small ? 'type-label-md text-on-surface font-semibold' : 'type-metric-xl text-primary font-bold'
  return (
    <div className={`flex items-center ${small ? 'gap-xs' : 'justify-between'}`}>
      <button className={btn} aria-label={`Bajar ${ariaLabel}`} onClick={() => nudge(-1)}>
        <Icon name="minus" size={18} />
      </button>
      <div className="text-center">
        {editing ? (
          <input
            ref={inputRef}
            className={`bare-input ${num}`}
            style={{ width: small ? 40 : 80 }}
            inputMode={integer ? 'numeric' : 'decimal'}
            aria-label={ariaLabel}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') cancel()
            }}
          />
        ) : (
          <button className={`bare-input ${num}`} style={{ width: small ? 40 : 80 }} aria-label={`Editar ${ariaLabel}`} onClick={start}>
            {value === null ? '—' : fmtNum(value)}
          </button>
        )}
      </div>
      <button className={btn} aria-label={`Subir ${ariaLabel}`} onClick={() => nudge(1)}>
        <Icon name="plus" size={18} />
      </button>
    </div>
  )
}
