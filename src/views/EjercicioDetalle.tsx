import { useLiveQuery } from 'dexie-react-hooks'
import { useParams } from 'react-router-dom'
import { db, getSettings } from '../db/db'
import { bestE1rmSeries, exerciseRecords } from '../db/repo'
import { fmtDateShort, fmtNum } from '../lib/format'
import { TopBar } from '../components/TopBar'
import { LineChart } from '../components/charts'
import { ExerciseVisual } from '../components/ExerciseVisual'
import { Icon } from '../components/Icon'
import { Stepper } from '../components/Stepper'
import type { SetEntry } from '../db/types'

const GROUP_LABEL: Record<string, string> = {
  pecho: 'Pecho', espalda: 'Espalda', hombro: 'Hombro', biceps: 'Bíceps', triceps: 'Tríceps',
  cuadriceps: 'Cuádriceps', femoral: 'Femoral', gluteo: 'Glúteo', gemelo: 'Gemelo', core: 'Core',
}
const LOAD_LABEL: Record<string, string> = {
  barbell: 'Barra', dumbbell: 'Mancuernas', machine: 'Máquina', cable: 'Polea', bodyweight: 'Corporal',
}

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
      <div className="screen screen--stacked pad">
        <TopBar as="p" title="Ejercicio" />
        <p className="t-body">Este ejercicio ya no existe.</p>
      </div>
    )
  }

  const unit = settings.unit

  return (
    <div className="screen screen--stacked pad">
      <TopBar as="p" title="Ejercicio" />
      <div className="stack">
        <header className="between" style={{ alignItems: 'flex-start' }}>
          <div>
            <h1 className="t-h1">{exercise.name}</h1>
            <div className="inline t-label-sm" style={{ marginTop: 'var(--sp-2)' }}>
              <span className="chip">{GROUP_LABEL[exercise.muscle_group]}</span>
              <span className="chip">{LOAD_LABEL[exercise.load_type]}</span>
              {exercise.is_custom && <span className="chip chip--line">Propio</span>}
            </div>
          </div>
          <span style={{ textAlign: 'center' }}>
            <ExerciseVisual exercise={exercise} size="lg" zoom />
            {exercise.image === null && (
              <span className="t-label-sm mute inline" style={{ display: 'flex', justifyContent: 'center', marginTop: 4, gap: 4 }}>
                <Icon name="camera" size={10} /> sin foto
              </span>
            )}
          </span>
        </header>

        {records != null && (records.best_e1rm !== null || records.best_weight !== null) && (
          <section className="tiles tiles--2" aria-label="Récords">
            <div className="tile tile--card">
              <span className="tile__label t-label-sm">Mejor e1RM</span>
              <span className="tile__value">
                <span className="t-metric-xl" style={{ fontSize: 30, lineHeight: '34px' }}>
                  {records.best_e1rm === null ? '—' : fmtNum(Math.round(records.best_e1rm.value * 10) / 10)}
                </span>
                <span className="tile__unit t-label">{unit}</span>
              </span>
              {records.best_e1rm !== null && <span className="t-caption mute">{fmtDateShort(records.best_e1rm.date)}</span>}
            </div>
            <div className="tile tile--card">
              <span className="tile__label t-label-sm">Mejor peso</span>
              <span className="tile__value">
                <span className="t-metric-xl" style={{ fontSize: 30, lineHeight: '34px' }}>
                  {records.best_weight === null ? '—' : fmtNum(records.best_weight.value)}
                </span>
                <span className="tile__unit t-label">{unit}</span>
              </span>
              {records.best_weight !== null && <span className="t-caption mute">{fmtDateShort(records.best_weight.date)}</span>}
            </div>
          </section>
        )}

        <section className="card" aria-label="Evolución">
          <span className="inline mute t-label-sm">
            <Icon name="trending" size={16} />
            e1RM en el tiempo
          </span>
          {series !== undefined && series.length > 0 ? (
            <div style={{ marginTop: 'var(--sp-3)' }}>
              <LineChart main={series} ariaLabel="e1RM en el tiempo" />
            </div>
          ) : (
            <p className="t-body-sm mute" style={{ marginTop: 'var(--sp-3)' }}>
              Sin series todavía. La primera sesión con este ejercicio dibuja la gráfica.
            </p>
          )}
        </section>

        {records != null && records.by_reps.length > 0 && (
          <section className="card" aria-label="Récords por repeticiones">
            <span className="t-label-sm mute">Récords por reps</span>
            <div style={{ marginTop: 'var(--sp-1)' }}>
              {records.by_reps.slice(0, 8).map((r) => (
                <div key={r.reps} className="bestrow">
                  <span className="t-metric-sm soft">{r.reps} reps</span>
                  <span className="t-metric-sm">
                    {fmtNum(r.weight)} <span className="t-label-sm soft">{unit}</span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {history !== undefined && history.length > 0 && (
          <section className="card" aria-label="Histórico">
            <span className="t-label-sm mute">Histórico</span>
            <div style={{ marginTop: 'var(--sp-1)' }}>
              {history.map((h) => (
                <div key={h.date} className="row" style={{ alignItems: 'flex-start' }}>
                  <span className="t-metric-sm mute" style={{ width: 80, flex: 'none' }}>
                    {fmtDateShort(h.date)}
                  </span>
                  <span className="row__main t-metric-sm" style={{ lineHeight: 1.7 }}>
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
            </div>
          </section>
        )}

        <section className="card stack stack--tight" aria-label="Datos">
          <span className="t-label-sm mute">Datos</span>
          <div className="between">
            <span>
              <span className="t-body" style={{ display: 'block' }}>
                Incremento mínimo
              </span>
              <span className="t-caption mute">Paso de los botones − y +</span>
            </span>
            <Stepper
              small
              value={exercise.min_increment}
              step={0.5}
              min={0.5}
              suffix={unit}
              className="t-metric-sm"
              ariaLabel="incremento mínimo"
              onCommit={(n) => void db.exercises.update(exercise.id, { min_increment: n })}
            />
          </div>
          <span className="t-body-sm soft">Notas</span>
          <textarea
            className="field t-body"
            aria-label="Notas del ejercicio"
            placeholder="agarre a 75 cm, asiento en el 4"
            defaultValue={exercise.notes}
            onBlur={(e) => void db.exercises.update(exercise.id, { notes: e.target.value })}
          />
        </section>
      </div>
    </div>
  )
}
