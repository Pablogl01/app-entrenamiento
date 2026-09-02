import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../db/db'
import { MONTHS, WEEKDAY_LETTERS, isoOf, todayISO, weekdayMon0 } from '../lib/dates'
import { fmtDateShort } from '../lib/format'
import type { Session } from '../db/types'

interface DayInfo {
  iso: string
  sessions: Session[]
  scheduled: boolean
}

export function Calendario() {
  const today = todayISO()
  const [cursor, setCursor] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }))

  const data = useLiveQuery(async () => {
    const first = new Date(cursor.y, cursor.m, 1)
    const last = new Date(cursor.y, cursor.m + 1, 0)
    const fromISO = isoOf(first)
    const toISO = isoOf(last)
    const sessions = (await db.sessions.where('date').between(fromISO, toISO, true, true).toArray()).filter(
      (s) => s.started_at !== null,
    )
    const schedules = await db.routine_schedules.toArray()
    const activeWeekdays = new Set<number>()
    for (const s of schedules) {
      const r = await db.routines.get(s.routine_id)
      if (r && !r.archived) activeWeekdays.add(s.weekday)
    }
    const days: DayInfo[] = []
    for (let d = 1; d <= last.getDate(); d++) {
      const iso = isoOf(new Date(cursor.y, cursor.m, d))
      days.push({
        iso,
        sessions: sessions.filter((s) => s.date === iso),
        scheduled: activeWeekdays.has(weekdayMon0(iso)),
      })
    }
    return { days, sessions: sessions.sort((a, b) => b.date.localeCompare(a.date)) }
  }, [cursor.y, cursor.m])

  if (data === undefined) return null

  const firstWeekday = weekdayMon0(isoOf(new Date(cursor.y, cursor.m, 1)))
  const cells: (DayInfo | null)[] = [...Array<null>(firstWeekday).fill(null), ...data.days]

  function dot(day: DayInfo): React.ReactNode {
    const done = day.sessions.length > 0
    if (done) return <span className="cal-dot cal-dot--done" />
    if (!day.scheduled) return null
    if (day.iso === today) return <span className="cal-dot cal-dot--today" />
    if (day.iso < today) return <span className="cal-dot cal-dot--missed" />
    return <span className="cal-dot cal-dot--future" />
  }

  return (
    <div className="screen pad" style={{ paddingTop: 'var(--sp-5)' }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-3)' }}>
        <h1 className="t-title" style={{ flex: 1 }}>
          {MONTHS[cursor.m]}
        </h1>
        <span className="t-data soft">{cursor.y}</span>
        <button
          className="topbar__back"
          aria-label="Mes anterior"
          onClick={() => setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }))}
        >
          ‹
        </button>
        <button
          className="topbar__back"
          aria-label="Mes siguiente"
          onClick={() => setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }))}
        >
          ›
        </button>
      </header>

      <div className="cal-grid" style={{ marginTop: 'var(--sp-4)' }}>
        {WEEKDAY_LETTERS.map((l) => (
          <span key={l} className="t-micro soft cal-cell cal-cell--head">
            {l}
          </span>
        ))}
        {cells.map((day, i) =>
          day === null ? (
            <span key={`x${i}`} className="cal-cell" />
          ) : (
            <span key={day.iso} className="cal-cell">
              <span className={day.iso === today ? 't-micro cal-num cal-num--today' : 't-micro cal-num'}>
                {Number(day.iso.slice(8))}
              </span>
              {dot(day)}
            </span>
          ),
        )}
      </div>

      <div style={{ marginTop: 'var(--sp-6)' }}>
        {data.sessions.length === 0 && (
          <p className="t-body soft">Sin sesiones este mes. Las hechas aparecerán aquí.</p>
        )}
        {data.sessions.map((s) => (
          <Link key={s.id} to={`/sesion/${s.id}`} className="row" style={{ textDecoration: 'none', color: 'inherit' }}>
            <span className="t-data soft" style={{ width: 76, flex: 'none' }}>
              {fmtDateShort(s.date)}
            </span>
            <span className="row__main t-item">{s.routine_name_snapshot}</span>
            <span className="row__chev">›</span>
          </Link>
        ))}
        {data.days
          .filter((d) => d.scheduled && d.iso < today && d.sessions.length === 0)
          .sort((a, b) => b.iso.localeCompare(a.iso))
          .map((d) => (
            <div key={d.iso} className="row">
              <span className="t-data soft" style={{ width: 76, flex: 'none' }}>
                {fmtDateShort(d.iso)}
              </span>
              <span className="row__main">
                <span className="t-item soft">programada, sin hacer</span>
              </span>
            </div>
          ))}
      </div>
    </div>
  )
}
