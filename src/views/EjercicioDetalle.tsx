import { useLiveQuery } from 'dexie-react-hooks'
import { useParams } from 'react-router-dom'
import { db, getSettings } from '../db/db'
import { bestE1rmSeries, exerciseRecords } from '../db/repo'
import { fmtDateShort, fmtNum, fmtWeight } from '../lib/format'
import { TopBar } from '../components/TopBar'
import { LineChart } from '../components/charts'
import { NumberField } from '../components/NumberField'
import type { SetEntry } from '../db/types'

interface HistoryEntry {
  date: string
  sets: SetEntry[]
}

export function EjercicioDetalle() {
  const { id } = useParams()

  const settings = useLiveQuery(getSettings)
  const exercise = useLiveQuery(async () => (id !== undefined ? ((await db.exercises.get(id)) ?? null) : null), [id])
  const series = useLiveQuery(async () => (id !== undefined ? bestE1rmSeries(id) : []), [id])
  const records = useLiveQuery(async () => (id !== undefined ? exerciseRecords(id) : null), [id])
  const history = useLiveQuery(async () => {
    if (id === undefined) return []
    const links = await db.session_exercises.where('exercise_id').equals(id).toArray()
    const out: HistoryEntry[] = []
    for (const link of links) {
      const session = await db.sessions.get(link.session_id)
      if (!session || session.finished_at === null) continue
      const sets = (await db.sets.where('session_exercise_id').equals(link.id).toArray())
        .filter((s) => s.completed)
        .sort((a, b) => a.set_index - b.set_index)
      if (sets.length > 0) out.push({ date: session.date, sets })
    }
    return out.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20)
  }, [id])

  if (settings === undefined || exercise === undefined) return null
  if (exercise === null) {
    return (
      <div className="screen screen--stacked">
        <TopBar />
        <p className="t-body pad">Este ejercicio ya no existe.</p>
      </div>
    )
  }

  const unit = settings.unit

  return (
    <div className="screen screen--stacked">
      <TopBar />
      <div className="pad">
        <h1 className="t-title">{exercise.name}</h1>

        {series !== undefined && series.length > 0 ? (
          <div style={{ marginTop: 'var(--sp-4)' }}>
            <LineChart main={series} ariaLabel="e1RM en el tiempo" />
          </div>
        ) : (
          <p className="t-body soft" style={{ marginTop: 'var(--sp-4)' }}>
            Sin series todavía. La primera sesión con este ejercicio dibuja la gráfica.
          </p>
        )}

        {records != null && (records.best_e1rm !== null || records.by_reps.length > 0) && (
          <section style={{ marginTop: 'var(--sp-5)' }}>
            <p className="t-body">Récords</p>
            {records.best_e1rm !== null && (
              <div className="bestrow">
                <span className="t-data soft">mejor e1RM</span>
                <span className="t-data">{fmtWeight(Math.round(records.best_e1rm.value * 10) / 10, unit)}</span>
              </div>
            )}
            {records.best_weight !== null && (
              <div className="bestrow">
                <span className="t-data soft">mejor peso</span>
                <span className="t-data">{fmtWeight(records.best_weight.value, unit)}</span>
              </div>
            )}
            {records.by_reps.slice(0, 8).map((r) => (
              <div key={r.reps} className="bestrow">
                <span className="t-data soft">{r.reps} reps</span>
                <span className="t-data">{fmtWeight(r.weight, unit)}</span>
              </div>
            ))}
          </section>
        )}

        {history !== undefined && history.length > 0 && (
          <section style={{ marginTop: 'var(--sp-5)' }}>
            <p className="t-body">Histórico</p>
            {history.map((h) => (
              <div key={h.date} className="row" style={{ alignItems: 'flex-start', paddingTop: 'var(--sp-3)', paddingBottom: 'var(--sp-3)' }}>
                <span className="t-data soft" style={{ width: 76, flex: 'none' }}>
                  {fmtDateShort(h.date)}
                </span>
                <span className="row__main t-data" style={{ lineHeight: 1.6 }}>
                  {h.sets
                    .map((s) =>
                      s.kind === 'warmup'
                        ? null
                        : exercise.unit_mode === 'weight_reps'
                          ? `${s.weight === null ? '—' : fmtNum(s.weight)}×${s.reps}`
                          : `${s.reps}${exercise.unit_mode === 'time' ? ' s' : ''}`,
                    )
                    .filter(Boolean)
                    .join('  ')}
                </span>
              </div>
            ))}
          </section>
        )}

        <section style={{ marginTop: 'var(--sp-5)' }}>
          <p className="t-body">Datos</p>
          <div className="row">
            <span className="row__main t-body">Incremento mínimo</span>
            <NumberField
              value={exercise.min_increment}
              suffix={unit}
              ariaLabel="Incremento mínimo"
              onCommit={(n) => void db.exercises.update(exercise.id, { min_increment: n })}
            />
          </div>
          <div style={{ marginTop: 'var(--sp-4)' }}>
            <p className="t-body soft">Notas</p>
            <textarea
              className="field t-body"
              style={{ marginTop: 'var(--sp-2)' }}
              aria-label="Notas del ejercicio"
              placeholder="agarre a 75 cm, asiento en el 4"
              defaultValue={exercise.notes}
              onBlur={(e) => void db.exercises.update(exercise.id, { notes: e.target.value })}
            />
          </div>
        </section>
      </div>
    </div>
  )
}
