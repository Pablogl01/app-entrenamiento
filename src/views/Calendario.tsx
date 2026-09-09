import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db, getSettings } from '../db/db'
import { overridesBetween, rescheduleDay, scheduledOn, sessionStats } from '../db/repo'
import { MONTHS, WEEKDAY_SHORT, addDays, isoOf, shortDate, todayISO, weekdayMon0 } from '../lib/dates'
import { fmtDuration, fmtNum } from '../lib/format'
import type { Routine, ScheduleOverride, Session } from '../db/types'
import { RootTopBar } from '../components/TopBar'
import { Icon } from '../components/Icon'
import { MoveSheet } from '../components/MoveSheet'

interface DayInfo {
  iso: string
  sessions: Session[]
  scheduled: Routine[]
}

interface SessionRow {
  session: Session
  duration_ms: number | null
  exercises: number
  names: string[]
  volume: number
  planned: number | null
  done: number
}

const WEEKDAY_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

function longDate(iso: string): string {
  const d = Number(iso.slice(8))
  return `${WEEKDAY_SHORT[weekdayMon0(iso)][0].toUpperCase()}${WEEKDAY_SHORT[weekdayMon0(iso)].slice(1)} ${d} de ${MONTHS[Number(iso.slice(5, 7)) - 1][0].toUpperCase()}${MONTHS[Number(iso.slice(5, 7)) - 1].slice(1)}`
}

export function Calendario() {
  const today = todayISO()
  const [cursor, setCursor] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }))
  const [selected, setSelected] = useState<string | null>(null)
  const [moving, setMoving] = useState<{ routineId: string; name: string; fromDate: string } | null>(null)

  const settings = useLiveQuery(getSettings)
  const live = useLiveQuery(async () => {
    const s = await db.sessions.where('date').equals(today).first()
    return s != null && s.started_at !== null && s.finished_at === null
  }, [today])

  const data = useLiveQuery(async () => {
    const first = new Date(cursor.y, cursor.m, 1)
    const last = new Date(cursor.y, cursor.m + 1, 0)
    const fromISO = isoOf(first)
    const toISO = isoOf(last)
    const sessions = (await db.sessions.where('date').between(fromISO, toISO, true, true).toArray()).filter((s) => s.started_at !== null)
    const prevFirst = new Date(cursor.y, cursor.m - 1, 1)
    const prevLast = new Date(cursor.y, cursor.m, 0)
    const prevCount = (await db.sessions.where('date').between(isoOf(prevFirst), isoOf(prevLast), true, true).toArray()).filter((s) => s.started_at !== null).length
    const days: DayInfo[] = []
    for (let d = 1; d <= last.getDate(); d++) {
      const iso = isoOf(new Date(cursor.y, cursor.m, d))
      days.push({ iso, sessions: sessions.filter((s) => s.date === iso), scheduled: await scheduledOn(iso) })
    }
    const rows: SessionRow[] = []
    for (const session of sessions.sort((a, b) => b.date.localeCompare(a.date))) {
      const stats = await sessionStats(session.id)
      const links = (await db.session_exercises.where('session_id').equals(session.id).toArray()).sort((a, b) => a.position - b.position)
      const names: string[] = []
      for (const l of links.slice(0, 3)) {
        const e = await db.exercises.get(l.exercise_id)
        if (e) names.push(e.name)
      }
      rows.push({ session, duration_ms: stats.duration_ms, exercises: links.length, names, volume: stats.volume, planned: session.planned_sets, done: stats.done_sets })
    }
    const overrides = await overridesBetween(fromISO, toISO)
    const routineNames = new Map<string, string>()
    for (const o of overrides) {
      for (const id of [o.routine_id, o.replaced_by ?? null]) {
        if (id === null || routineNames.has(id)) continue
        const r = await db.routines.get(id)
        if (r) routineNames.set(r.id, r.name)
      }
    }
    let next: { iso: string; name: string } | null = null
    for (let i = 0; i <= 7; i++) {
      const iso = addDays(today, i)
      const sched = await scheduledOn(iso)
      const doneThatDay = i === 0 && sessions.some((s) => s.date === iso)
      if (sched.length > 0 && !doneThatDay) {
        next = { iso, name: sched[0].name }
        break
      }
    }
    return { days, rows, prevCount, next, overrides, routineNames }
  }, [cursor.y, cursor.m, today])

  if (data === undefined || settings === undefined) return null

  const firstWeekday = weekdayMon0(isoOf(new Date(cursor.y, cursor.m, 1)))
  const prevMonthLast = new Date(cursor.y, cursor.m, 0).getDate()
  const leading = Array.from({ length: firstWeekday }, (_, i) => prevMonthLast - firstWeekday + 1 + i)
  const done = data.rows.length
  const pastScheduled = data.days.filter((d) => d.scheduled.length > 0 && (d.iso < today || (d.iso === today && d.sessions.length > 0))).length
  const missed = data.days.filter((d) => d.scheduled.length > 0 && d.iso < today && d.sessions.length === 0)
  const adherence = pastScheduled === 0 ? null : Math.round(((pastScheduled - missed.length) / pastScheduled) * 100)
  const pending = data.days.filter((d) => d.scheduled.length > 0 && d.iso > today).length
  const delta = done - data.prevCount
  const target = new Set(data.days.filter((d) => d.scheduled.length > 0).map((d) => weekdayMon0(d.iso))).size
  const movedFrom = new Set(data.overrides.map((o) => o.from_date))

  const shownRows = selected === null ? data.rows : data.rows.filter((r) => r.session.date === selected)
  const shownMissed = missed.filter((d) => !movedFrom.has(d.iso) && (selected === null || d.iso === selected)).sort((a, b) => b.iso.localeCompare(a.iso))
  const shownOverrides = data.overrides.filter((o) => selected === null || o.from_date === selected || o.to_date === selected)
  const detailDate = selected ?? data.rows[0]?.session.date ?? today
  // Día programado (hoy o futuro) sin sesión hecha: se puede mover, intercambiar o descansar.
  const selectedDay = selected === null ? null : (data.days.find((d) => d.iso === selected) ?? null)
  const scheduledHere = selectedDay !== null && selectedDay.iso >= today && selectedDay.sessions.length === 0 ? selectedDay.scheduled : []

  return (
    <div className="screen">
      <RootTopBar tab="Calendario" live={live === true} />
      <h1 className="sr-only">Calendario</h1>
      <main className="flex-1 w-full pb-24 px-gutter flex flex-col relative">
        <div className="flex flex-col w-full gap-lg select-none">
          {/* Month header */}
          <div className="flex items-center justify-between bg-sc-low px-base py-md rounded-xl">
            <div className="flex items-center gap-xs">
              <span className="type-headline-sm text-on-surface tracking-tight uppercase">{MONTHS[cursor.m]}</span>
              <span className="type-label-md text-volt px-xs py-0p5 rounded bg-sc-highest">{cursor.y}</span>
            </div>
            <div className="flex items-center gap-xs">
              <button
                className="w-touch h-touch flex items-center justify-center rounded-lg bg-sc text-on-surface-variant press press-95"
                aria-label="Mes anterior"
                onClick={() => {
                  setSelected(null)
                  setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }))
                }}
              >
                <Icon name="chevron-left" size={20} />
              </button>
              <button
                className="w-touch h-touch flex items-center justify-center rounded-lg bg-sc text-on-surface-variant press press-95"
                aria-label="Mes siguiente"
                onClick={() => {
                  setSelected(null)
                  setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }))
                }}
              >
                <Icon name="chevron-right" size={20} />
              </button>
            </div>
          </div>

          {/* Adherence stats */}
          <div className="grid grid-cols-3 gap-xs">
            <div className="bg-sc-low p-md rounded-xl flex flex-col justify-between">
              <div className="flex items-center gap-xxs">
                <span className="w-1p5 h-1p5 rounded-full bg-volt" />
                <span className="type-label-sm uppercase text-on-surface-variant tracking-wider">Adherencia</span>
              </div>
              <div className="mt-xs flex items-baseline gap-xxs">
                <span className="type-metric-xl text-on-surface font-semibold">{adherence === null ? '—' : adherence}</span>
                <span className="type-label-md text-volt">%</span>
              </div>
              <span className="type-body-sm text-on-surface-variant opacity-80 mt-xxs">{target > 0 ? `Objetivo: ${target}/sem` : 'Sin programación'}</span>
            </div>
            <div className="bg-sc-low p-md rounded-xl flex flex-col justify-between">
              <div className="flex items-center gap-xxs">
                <span className="w-1p5 h-1p5 rounded-full bg-on-surface-variant" />
                <span className="type-label-sm uppercase text-on-surface-variant tracking-wider">Hechas</span>
              </div>
              <div className="mt-xs flex items-baseline gap-xxs">
                <span className="type-metric-xl text-on-surface font-semibold">{done}</span>
                <span className="type-label-md text-on-surface-variant">ses</span>
              </div>
              <span className={`type-body-sm mt-xxs ${delta > 0 ? 'text-volt' : 'text-on-surface-variant opacity-80'}`}>
                {delta === 0 ? '= mes anterior' : `${delta > 0 ? '+' : '−'}${Math.abs(delta)} vs ${MONTHS[(cursor.m + 11) % 12].slice(0, 3)}`}
              </span>
            </div>
            <div className="bg-sc-low p-md rounded-xl flex flex-col justify-between">
              <div className="flex items-center gap-xxs">
                <span className="w-1p5 h-1p5 rounded-full bg-secondary-container" />
                <span className="type-label-sm uppercase text-on-surface-variant tracking-wider">Pendientes</span>
              </div>
              <div className="mt-xs flex items-baseline gap-xxs">
                <span className="type-metric-xl text-on-surface font-semibold">{pending}</span>
                <span className="type-label-md text-on-surface-variant">ses</span>
              </div>
              <span className="type-body-sm text-on-surface-variant opacity-80 mt-xxs">
                Cierre {data.days.length} {MONTHS[cursor.m].slice(0, 3)}
              </span>
            </div>
          </div>

          {/* Calendar grid */}
          <div className="bg-sc-low p-md rounded-xl flex flex-col gap-sm">
            <div className="grid grid-cols-7 text-center">
              {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((l, i) => (
                <span key={i} className="type-label-sm uppercase text-on-surface-variant font-medium">
                  {l}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-xs text-center">
              {leading.map((n) => (
                <button key={`p${n}`} className="h-11 flex flex-col items-center justify-center rounded text-on-surface-variant opacity-30 type-label-md" disabled>
                  {String(n).padStart(2, '0')}
                </button>
              ))}
              {data.days.map((day) => {
                const isToday = day.iso === today
                const isDone = day.sessions.length > 0
                const isSched = day.scheduled.length > 0
                const isMoved = movedFrom.has(day.iso)
                const isMissed = isSched && day.iso < today && !isDone
                return (
                  <button
                    key={day.iso}
                    className={`h-11 flex flex-col items-center justify-center rounded type-label-md gap-0p5 relative${isToday || selected === day.iso ? ' bg-sc-highest text-primary' : isSched || isDone ? ' text-on-surface' : ' text-on-surface-variant'}`}
                    aria-label={longDate(day.iso)}
                    aria-pressed={selected === day.iso}
                    onClick={() => setSelected(selected === day.iso ? null : day.iso)}
                  >
                    <span className={isToday ? 'text-on-surface font-bold' : ''}>{String(Number(day.iso.slice(8))).padStart(2, '0')}</span>
                    {isDone ? (
                      <span className="w-1p5 h-1p5 rounded-full bg-volt glow-dot" />
                    ) : isMoved || isMissed ? (
                      <span className="w-1 h-1 rounded-full bg-secondary-container" />
                    ) : isSched ? (
                      <span className="w-1 h-1 rounded-full bg-outline" />
                    ) : null}
                  </button>
                )
              })}
            </div>
            <div className="flex items-center justify-between pt-xs mt-xxs text-on-surface-variant">
              <div className="flex items-center gap-xs">
                <span className="w-2 h-2 rounded-full bg-volt" />
                <span className="type-label-sm">Completada</span>
              </div>
              <div className="flex items-center gap-xs">
                <span className="w-2 h-2 rounded-full bg-outline" />
                <span className="type-label-sm">Programada</span>
              </div>
              <div className="flex items-center gap-xs">
                <span className="w-2 h-2 rounded-full bg-secondary-container" />
                <span className="type-label-sm">Pospuesta</span>
              </div>
            </div>
          </div>

          {/* Session detail */}
          <div className="flex flex-col gap-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-xs">
                <span className="type-label-sm uppercase tracking-widest text-volt font-semibold">Detalle de sesión</span>
                <span className="w-1 h-1 rounded-full bg-outline-variant" />
                <span className="type-body-sm text-on-surface-variant">{selected === null ? `${MONTHS[cursor.m][0].toUpperCase()}${MONTHS[cursor.m].slice(1)} · ${done} ${done === 1 ? 'sesión' : 'sesiones'}` : longDate(detailDate)}</span>
              </div>
              {shownRows[0] !== undefined && <span className="type-label-sm text-on-surface-variant font-mono-ish">ID: SES-{shownRows[0].session.id.slice(0, 3).toUpperCase()}</span>}
            </div>

            {shownRows.length === 0 && shownMissed.length === 0 && shownOverrides.length === 0 && scheduledHere.length === 0 && (
              <p className="type-body-sm text-on-surface-variant">{selected === null ? 'Sin sesiones este mes. Las hechas aparecerán aquí.' : 'Nada ese día.'}</p>
            )}

            {shownRows.map(({ session, duration_ms, exercises, names, volume, planned, done: doneSets }) => {
              const pct = planned === null || planned === 0 ? 100 : Math.round((doneSets / planned) * 100)
              return (
                <div key={session.id} className="bg-sc-low p-base rounded-xl flex flex-col gap-md shadow-md">
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-xs mb-xxs">
                        <Icon name="check-circle" size={18} className="text-volt flex-none" />
                        <span className="type-headline-sm text-on-surface font-semibold truncate">{session.routine_name_snapshot}</span>
                      </div>
                      <span className="type-body-sm text-on-surface-variant truncate">{names.join(' · ')}</span>
                    </div>
                    <span className="bg-volt text-on-primary-container type-label-sm px-xs py-1 rounded font-bold uppercase tracking-wider flex-none">
                      {session.finished_at === null ? 'En curso' : `${pct}% hecho`}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-xs bg-sc p-sm rounded-lg">
                    <div className="flex flex-col">
                      <span className="type-label-sm uppercase text-on-surface-variant">Duración</span>
                      <span className="type-metric-md text-on-surface font-semibold mt-0p5">
                        {duration_ms === null ? '—' : Math.round(duration_ms / 60_000)} <span className="type-label-sm text-on-surface-variant font-normal">min</span>
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="type-label-sm uppercase text-on-surface-variant">Ejercicios</span>
                      <span className="type-metric-md text-on-surface font-semibold mt-0p5">
                        {exercises} <span className="type-label-sm text-on-surface-variant font-normal">bloques</span>
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="type-label-sm uppercase text-on-surface-variant">Volumen</span>
                      <span className="type-metric-md text-volt font-semibold mt-0p5">
                        {fmtNum(Math.round(volume))} <span className="type-label-sm text-on-surface-variant font-normal">{settings.unit}</span>
                      </span>
                    </div>
                  </div>
                  <Link to={session.finished_at === null ? '/entrenar' : `/resumen/${session.id}`} className="w-full h-touch bg-sc-high press rounded-lg flex items-center justify-between px-base text-on-surface">
                    <span className="type-label-md uppercase tracking-wider font-semibold">{session.finished_at === null ? 'Continuar sesión' : 'Ver resumen de cargas y RPE'}</span>
                    <Icon name="arrow-right" size={20} className="text-volt" />
                  </Link>
                  {session.finished_at !== null && duration_ms !== null && (
                    <Link to={`/sesion/${session.id}`} className="type-label-sm uppercase tracking-wider text-on-surface-variant text-center">
                      Ver series · {fmtDuration(duration_ms)}
                    </Link>
                  )}
                </div>
              )
            })}

            {selectedDay !== null &&
              scheduledHere.map((r) => (
                <div key={r.id} className="bg-sc-low p-base rounded-xl flex flex-col gap-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-xs">
                      <span className="w-1p5 h-1p5 rounded-full bg-outline" />
                      <span className="type-body-md text-on-surface font-medium">{selectedDay.iso === today ? 'Hoy' : shortDate(selectedDay.iso)} · Programada</span>
                    </div>
                    <span className="type-label-sm text-on-surface-variant uppercase px-2 py-0p5 rounded bg-sc">Pendiente</span>
                  </div>
                  <p className="type-body-lg text-on-surface font-semibold">{r.name}</p>
                  <div className="flex gap-sm pt-xxs">
                    <button
                      className="h-8 px-base hit rounded bg-sc text-on-surface type-label-sm uppercase tracking-wider flex items-center gap-1 press press-95"
                      onClick={() => setMoving({ routineId: r.id, name: r.name, fromDate: selectedDay.iso })}
                    >
                      <Icon name="swap" size={16} />
                      Mover
                    </button>
                    <button className="h-8 px-base hit rounded bg-sc text-on-surface-variant type-label-sm uppercase tracking-wider flex items-center gap-1 press press-95" onClick={() => void rescheduleDay(r.id, selectedDay.iso, null)}>
                      <Icon name="moon" size={16} />
                      Descansar
                    </button>
                  </div>
                </div>
              ))}

            {moving !== null && <MoveSheet routineId={moving.routineId} routineName={moving.name} fromDate={moving.fromDate} onClose={() => setMoving(null)} />}

            {selected === null && data.next !== null && (
              <div className="bg-sc-low p-base rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-base min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-sc flex items-center justify-center text-volt flex-none">
                    <Icon name="clock" size={22} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="type-label-sm uppercase tracking-wider text-on-surface-variant">
                      Próxima sesión · {data.next.iso === today ? 'Hoy' : data.next.iso === addDays(today, 1) ? 'Mañana' : WEEKDAY_FULL[weekdayMon0(data.next.iso)]}
                      {settings.notif_train_enabled ? ` ${settings.notif_train_time}` : ''}
                    </span>
                    <span className="type-body-lg font-semibold text-on-surface truncate">
                      {shortDate(data.next.iso)} · {data.next.name}
                    </span>
                  </div>
                </div>
                <Link to="/ajustes#avisos" className="w-touch h-touch flex items-center justify-center rounded-lg bg-sc text-on-surface-variant flex-none" aria-label="Avisos">
                  <Icon name="bell" size={20} />
                </Link>
              </div>
            )}

            {shownMissed.map((d) => (
              <div key={d.iso} className="bg-sc-low p-base rounded-xl flex flex-col gap-sm opacity-85">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-xs">
                    <Icon name="history" size={18} className="text-secondary" />
                    <span className="type-body-md text-on-surface font-medium">
                      {shortDate(d.iso)} · Sesión pospuesta
                    </span>
                  </div>
                  <span className="type-label-sm text-on-surface-variant uppercase px-2 py-0p5 rounded bg-sc">Descanso activo</span>
                </div>
                <p className="type-body-sm text-on-surface-variant">
                  {d.scheduled[0]?.name ?? 'Sesión'} programada y sin hacer. Puedes moverla a otro día o dejarla como descanso.
                </p>
                <div className="flex gap-sm pt-xxs items-center">
                  {d.scheduled[0] !== undefined && (
                    <>
                      <button
                        className="h-8 px-base hit rounded bg-sc text-on-surface type-label-sm uppercase tracking-wider flex items-center gap-1 press press-95"
                        onClick={() => setMoving({ routineId: d.scheduled[0].id, name: d.scheduled[0].name, fromDate: d.iso })}
                      >
                        <Icon name="swap" size={16} />
                        Mover
                      </button>
                      <button className="h-8 px-base hit rounded bg-sc text-on-surface-variant type-label-sm uppercase tracking-wider flex items-center gap-1 press press-95" onClick={() => void rescheduleDay(d.scheduled[0].id, d.iso, null)}>
                        <Icon name="moon" size={16} />
                        Descansar
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}

            {shownOverrides.map((o: ScheduleOverride) => (
              <div key={o.id} className="bg-sc-low p-base rounded-xl flex flex-col gap-sm opacity-85">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-xs">
                    <Icon name="history" size={18} className="text-secondary" />
                    <span className="type-body-md text-on-surface font-medium">
                      {shortDate(o.from_date)} · {o.replaced_by != null ? 'Rutina cambiada' : 'Sesión pospuesta'}
                    </span>
                  </div>
                  <span className="type-label-sm text-on-surface-variant uppercase px-2 py-0p5 rounded bg-sc">{o.replaced_by != null ? 'Cambio' : 'Descanso activo'}</span>
                </div>
                <p className="type-body-sm text-on-surface-variant">
                  {data.routineNames.get(o.routine_id) ?? 'Rutina'}
                  {o.replaced_by != null
                    ? ` sustituida por ${data.routineNames.get(o.replaced_by) ?? 'otra rutina'} ese día.`
                    : o.to_date === null
                      ? ' anulada ese día.'
                      : ` reasignada al ${shortDate(o.to_date)}.`}
                </p>
                <div className="flex gap-sm pt-xxs">
                  <button className="h-8 px-base hit rounded bg-sc text-on-surface type-label-sm uppercase tracking-wider flex items-center gap-1 press press-95" onClick={() => void db.schedule_overrides.delete(o.id)}>
                    <Icon name="swap" size={16} />
                    Deshacer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
