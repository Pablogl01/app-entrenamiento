import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import { activeRoutines, createEmptySession, createRoutine, lastPerformedAt, routineWeekdays, todaySession } from '../db/repo'
import { fmtRelative, fmtRelativeAbbr, fmtWeekdays } from '../lib/format'

interface RoutineRow {
  id: string
  name: string
  exercises: number
  weekdays: number[]
  last: string | null
}

export function Rutinas() {
  const navigate = useNavigate()

  const rows = useLiveQuery(async () => {
    const routines = await activeRoutines()
    const out: RoutineRow[] = []
    for (const r of routines) {
      out.push({
        id: r.id,
        name: r.name,
        exercises: await db.routine_exercises.where('routine_id').equals(r.id).count(),
        weekdays: await routineWeekdays(r.id),
        last: await lastPerformedAt(r.id),
      })
    }
    return out
  }, [])

  async function onCreate() {
    const r = await createRoutine()
    navigate(`/rutinas/${r.id}`)
  }

  async function onEmptySession() {
    const existing = await todaySession()
    if (existing === null) await createEmptySession()
    navigate('/')
  }

  if (rows === undefined) return null

  return (
    <div className="screen pad" style={{ paddingTop: 'var(--sp-5)' }}>
      {rows.length === 0 && (
        <p className="t-body soft">Sin rutinas todavía. Crea la primera o empieza una sesión vacía y guárdala al acabar.</p>
      )}
      {rows.map((r) => (
        <Link key={r.id} to={`/rutinas/${r.id}`} className="row rut-row" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="row__main">
            <span className="t-item">{r.name}</span>
            <span className="t-data soft" style={{ display: 'block', marginTop: 4 }}>
              {r.exercises} ejercicios · {fmtWeekdays(r.weekdays)}
            </span>
          </span>
          <span className="t-data soft rut-last">
            {r.last === null ? (
              'nunca'
            ) : (
              <>
                <span className="rut-last-full">{fmtRelative(r.last)}</span>
                <span className="rut-last-abbr">{fmtRelativeAbbr(r.last)}</span>
              </>
            )}
          </span>
          <span className="row__chev">›</span>
        </Link>
      ))}

      <div style={{ marginTop: 'var(--sp-6)' }}>
        <button className="btn-text" onClick={() => void onCreate()}>
          Crear rutina
        </button>
        <button className="btn-text" onClick={() => void onEmptySession()}>
          Sesión vacía
        </button>
        <Link to="/ajustes" className="btn-text soft" style={{ textDecoration: 'none' }}>
          Ajustes
        </Link>
      </div>
    </div>
  )
}
