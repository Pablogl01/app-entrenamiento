import { useEffect, useRef, useState } from 'react'
import { fmtNum } from '../lib/format'

interface Props {
  value: number | null
  onCommit: (n: number) => void
  /** Texto tras la cifra (unidad). */
  suffix?: string
  placeholder?: string
  className?: string
  ariaLabel: string
}

/** Cifra editable: se toca el valor y se escribe encima (fondo --panel-deep). */
export function NumberField({ value, onCommit, suffix, placeholder = '—', className = 't-data', ariaLabel }: Props) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  function commit() {
    setEditing(false)
    const n = Number(text.replace(',', '.'))
    if (Number.isFinite(n) && text.trim() !== '') onCommit(n)
  }

  if (editing) {
    return (
      <span className={`numfield ${className}`}>
        <input
          ref={inputRef}
          inputMode="decimal"
          aria-label={ariaLabel}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') setEditing(false)
          }}
        />
        {suffix !== undefined && <span className="soft">{suffix}</span>}
      </span>
    )
  }

  return (
    <button
      className={`numfield ${className}`}
      aria-label={ariaLabel}
      onClick={() => {
        setText(value === null ? '' : String(value).replace('.', ','))
        setEditing(true)
      }}
    >
      {value === null ? <span className="soft">{placeholder}</span> : fmtNum(value)}
      {suffix !== undefined && <span className="soft">&nbsp;{suffix}</span>}
    </button>
  )
}
