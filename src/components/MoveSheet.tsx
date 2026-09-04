import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { rescheduleDay, scheduledOn, swapDays } from '../db/repo'
import type { Routine } from '../db/types'
import { WEEKDAY_LETTERS, addDays, shortDate, startOfWeek, todayISO } from '../lib/dates'
import { Icon } from './Icon'

interface Props {
  routineId: string
  routineName: string
  /** Día programado que se mueve (puede ser pasado: un día que no se hizo). */
  fromDate: string
  onClose: () => void
  /** Tras mover, intercambiar o anular. */
  onDone?: () => void
}

interface DayCell {
  iso: string
  others: Routine[]
  done: boolean
}

/**
 * Hoja «Mover»: catorce días (esta semana y la siguiente) con el estado real de
 * cada uno. Un toque en un día libre mueve; en un día con otro entreno ofrece
 * «Mover aquí» o «Intercambiar» (solo si el otro entreno es otra rutina).
 * «Dejar como descanso» anula el día.
 */
export function MoveSheet({ routineId, routineName, fromDate, onClose, onDone }: Props) {
  const today = todayISO()
  const base = startOfWeek(today)
  const start = fromDate > addDays(base, 13) ? startOfWeek(fromDate) : base
  const [picked, setPicked] = useState<string | null>(null)

  const cells = useLiveQuery(async () => {
    const out: DayCell[] = []
    for (let i = 0; i < 14; i++) {
      const iso = addDays(start, i)
      const scheduled = await scheduledOn(iso)
      const sessions = await db.sessions.where('date').equals(iso).toArray()
      out.push({ iso, others: scheduled, done: sessions.some((s) => s.started_at !== null) })
    }
    return out
  }, [start, routineId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function finish(action: Promise<void>) {
    await action
    onDone?.()
    onClose()
  }

  const pickedCell = cells?.find((c) => c.iso === picked) ?? null
  // Intercambiar solo con OTRA rutina; si el día ya tiene esta misma, «Mover aquí» las funde en una.
  const canSwap = pickedCell !== null && pickedCell.others.length === 1 && pickedCell.others[0].id !== routineId && fromDate >= today

  // Portal a body: el área de scroll de la app es contenedor de los fijos y la hoja debe cubrir toda la pantalla.
  return createPortal(
    <div className="sheet" role="dialog" aria-modal="true" aria-label={`Mover ${routineName}`}>
      <button type="button" className="sheet__scrim" aria-label="Cerrar" onClick={onClose} />
      <div className="sheet__panel enter-sheet">
        <div className="flex items-start justify-between gap-sm">
          <div className="min-w-0">
            <h2 className="type-headline-sm text-on-surface uppercase font-bold tracking-tight truncate">Mover {routineName}</h2>
            <p className="type-body-sm text-on-surface-variant">
              {fromDate === today ? 'Programada hoy' : `Programada el ${shortDate(fromDate)}`}
              {picked === null ? ' · elige el nuevo día' : ''}
            </p>
          </div>
          <button type="button" className="w-touch h-touch -mr-sm flex items-center justify-center text-on-surface-variant press" aria-label="Cerrar" onClick={onClose}>
            <Icon name="close" size={22} />
          </button>
        </div>

        <div className="sheet__grid type-label-sm">
          {WEEKDAY_LETTERS.map((l, i) => (
            <span key={i} className="sheet__wd uppercase">
              {l}
            </span>
          ))}
          {(cells ?? []).map((c) => {
            const isPast = c.iso < today
            const isOrigin = c.iso === fromDate
            return (
              <button
                type="button"
                key={c.iso}
                className={`sheet__day type-label-md press${isOrigin ? ' is-origin' : ''}${picked === c.iso ? ' is-picked' : ''}`}
                disabled={isPast || isOrigin}
                aria-label={`${shortDate(c.iso)}${c.others.length > 0 ? ` · ${c.others.map((r) => r.name).join(', ')}` : ''}`}
                aria-pressed={picked === c.iso}
                onClick={() => {
                  if (c.others.length === 0) void finish(rescheduleDay(routineId, fromDate, c.iso))
                  else setPicked(picked === c.iso ? null : c.iso)
                }}
              >
                <span>{String(Number(c.iso.slice(8))).padStart(2, '0')}</span>
                <span className="sheet__dots">
                  {c.done && <span className="sheet__dot sheet__dot--done" />}
                  {c.others.map((r) => (
                    <span key={r.id} className="sheet__dot" />
                  ))}
                </span>
              </button>
            )
          })}
        </div>

        {pickedCell !== null && (
          <div className="bg-sc-high rounded-lg p-md flex flex-col gap-sm enter-panel">
            <p className="type-body-sm text-on-surface">
              El {shortDate(pickedCell.iso)} ya tiene {pickedCell.others.map((r) => r.name).join(' y ')}.
            </p>
            <div className="flex gap-sm">
              <button
                type="button"
                className="flex-1 h-touch rounded-lg bg-sc-highest text-on-surface type-label-md uppercase tracking-wider font-semibold press"
                onClick={() => void finish(rescheduleDay(routineId, fromDate, pickedCell.iso))}
              >
                Mover aquí
              </button>
              {canSwap && (
                <button
                  type="button"
                  className="flex-1 h-touch rounded-lg bg-volt text-on-volt type-label-md uppercase tracking-wider font-bold flex items-center justify-center gap-xs press"
                  onClick={() => void finish(swapDays(routineId, fromDate, pickedCell.others[0].id, pickedCell.iso))}
                >
                  <Icon name="swap" size={18} />
                  Intercambiar
                </button>
              )}
            </div>
          </div>
        )}

        <button
          type="button"
          className="w-full h-touch rounded-lg bg-sc-high text-on-surface-variant type-label-md uppercase tracking-wider font-semibold flex items-center justify-center gap-xs press"
          onClick={() => void finish(rescheduleDay(routineId, fromDate, null))}
        >
          <Icon name="moon" size={18} />
          Dejar como descanso
        </button>
      </div>
    </div>,
    document.body,
  )
}
