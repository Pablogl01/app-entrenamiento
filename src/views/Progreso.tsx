import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSettings } from '../db/db'
import { bestE1rmSeries, volumeSeries } from '../db/repo'
import { exerciseRecords } from '../db/repo'
import { addDays, daysBetween, todayISO } from '../lib/dates'
import { exerciseTrend, movingAvg7, weightTrendPerWeek, type Point } from '../lib/calc'
import { fmtNum, fmtWeight } from '../lib/format'
import { bodyWeightVerdict, exerciseVerdicts, weeklySessions, weeklyVerdict } from '../lib/verdicts'
import { Bars, LineChart } from '../components/charts'

const RANGES = [
  { key: '4s', label: '4 sem', days: 28 },
  { key: '3m', label: '3 meses', days: 91 },
  { key: '1a', label: 'año', days: 365 },
  { key: 'todo', label: 'todo', days: 36500 },
] as const

export function Progreso() {
  const today = todayISO()
  const [range, setRange] = useState<(typeof RANGES)[number]['key']>('3m')
  const [exerciseId, setExerciseId] = useState<string | null>(null)

  const settings = useLiveQuery(getSettings)
  const verdicts = useLiveQuery(() => exerciseVerdicts(), [])
  const weekly = useLiveQuery(() => weeklySessions(), [])
  const metrics = useLiveQuery(async () => {
    const rows = await db.body_metrics.toArray()
    return rows.sort((a, b) => a.date.localeCompare(b.date)).map((m): Point => ({ date: m.date, value: m.weight }))
  }, [])
  const trained = useLiveQuery(async () => {
    const links = await db.session_exercises.toArray()
    const ids = [...new Set(links.map((l) => l.exercise_id))]
    const out = []
    for (const id of ids) {
      const e = await db.exercises.get(id)
      if (e) out.push(e)
    }
    return out.sort((a, b) => a.name.localeCompare(b.name))
  }, [])

  const selectedId = exerciseId ?? trained?.[0]?.id ?? null
  const e1rm = useLiveQuery(async () => (selectedId !== null ? bestE1rmSeries(selectedId) : []), [selectedId])
  const volume = useLiveQuery(async () => (selectedId !== null ? volumeSeries(selectedId) : []), [selectedId])
  const records = useLiveQuery(async () => (selectedId !== null ? exerciseRecords(selectedId) : null), [selectedId])

  if (settings === undefined || metrics === undefined || weekly === undefined) return null

  const unit = settings.unit
  const rangeDays = RANGES.find((r) => r.key === range)?.days ?? 91
  const from = addDays(today, -rangeDays)
  const windowed = metrics.filter((m) => m.date >= from)
  const ma = movingAvg7(windowed)
  const trend = weightTrendPerWeek(metrics)

  const trendE = e1rm !== undefined && e1rm.length > 0 ? exerciseTrend(e1rm) : null
  let projection: Point[] = []
  if (trendE !== null && trendE.kind !== 'insufficient') {
    const w = trendE.window
    const x0 = w[0].date
    const lastDate = w[w.length - 1].date
    const val = (iso: string) => trendE.projection.intercept + trendE.projection.slope * daysBetween(x0, iso)
    const future = addDays(lastDate, 14)
    projection = [
      { date: lastDate, value: val(lastDate) },
      { date: future, value: val(future) },
    ]
  }
  const selectedVerdict =
    trendE === null
      ? null
      : trendE.kind === 'insufficient'
        ? 'Aún pocas sesiones para un veredicto: hacen falta 4.'
        : trendE.kind === 'plateau'
          ? `e1RM plano desde hace ${trendE.sinceWeeks} semanas.`
          : `${trendE.pctChange > 0 ? '+' : '−'}${fmtNum(Math.abs(trendE.pctChange * 100))} % de e1RM en las últimas ${trendE.window.length} sesiones.`

  return (
    <div className="screen pad" style={{ paddingTop: 'var(--sp-5)' }}>
      {/* Feed de veredictos: la voz del producto, encima de todo. */}
      <section aria-label="Veredictos">
        <p className="t-body">{bodyWeightVerdict(metrics)}</p>
        {(verdicts ?? []).map((v) => (
          <p key={v.exercise_id} className="t-body" style={{ marginTop: 'var(--sp-2)' }}>
            {v.text}
          </p>
        ))}
      </section>

      {/* Peso corporal */}
      <section style={{ marginTop: 'var(--sp-6)' }} aria-label="Peso corporal">
        {trend !== null && (
          <>
            <p className="t-hero">
              {trend > 0 ? '+' : '−'}
              {fmtNum(Math.abs(trend), 2)}
            </p>
            <p className="t-info soft" style={{ marginTop: 'var(--sp-2)' }}>
              kg/semana · media de las últimas 4 semanas
            </p>
          </>
        )}
        <div className="seltext" style={{ marginTop: 'var(--sp-4)' }}>
          {RANGES.map((r) => (
            <button key={r.key} className={`t-info${range === r.key ? ' active' : ''}`} onClick={() => setRange(r.key)}>
              {r.label}
            </button>
          ))}
        </div>
        {windowed.length > 0 ? (
          <div style={{ marginTop: 'var(--sp-3)' }}>
            <LineChart main={ma} dots={windowed} ariaLabel="Peso corporal y media de 7 días" />
          </div>
        ) : (
          <p className="t-body soft" style={{ marginTop: 'var(--sp-3)' }}>
            Sin pesajes en este rango. El primero se registra en Hoy.
          </p>
        )}
      </section>

      {/* Sesiones por semana */}
      <section style={{ marginTop: 'var(--sp-6)' }} aria-label="Sesiones por semana">
        <p className="t-body">{weeklyVerdict(weekly.bars, weekly.target)}</p>
        <div style={{ marginTop: 'var(--sp-3)' }}>
          <Bars
            bars={weekly.bars.map((b) => ({ label: b.weekStart.slice(8), value: b.done }))}
            target={weekly.target}
            ariaLabel="Sesiones hechas por semana"
          />
        </div>
      </section>

      {/* Por ejercicio */}
      <section style={{ marginTop: 'var(--sp-6)' }} aria-label="Progreso por ejercicio">
        {trained !== undefined && trained.length === 0 && (
          <p className="t-body soft">Sin sesiones todavía. El progreso por ejercicio aparece al entrenar.</p>
        )}
        {trained !== undefined && trained.length > 0 && (
          <>
            <div className="field" style={{ minHeight: 48 }}>
              <select
                aria-label="Ejercicio"
                className="t-item"
                value={selectedId ?? ''}
                onChange={(e) => setExerciseId(e.target.value)}
                style={{ width: '100%', outline: 'none' }}
              >
                {trained.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
            {selectedVerdict !== null && (
              <p className="t-body" style={{ marginTop: 'var(--sp-4)' }}>
                {selectedVerdict}
              </p>
            )}
            {e1rm !== undefined && e1rm.length > 0 && (
              <div style={{ marginTop: 'var(--sp-3)' }}>
                <LineChart main={e1rm} projection={projection} ariaLabel="e1RM en el tiempo" />
              </div>
            )}
            {volume !== undefined && volume.length > 1 && (
              <>
                <p className="t-body" style={{ marginTop: 'var(--sp-5)' }}>
                  Volumen por sesión
                </p>
                <div style={{ marginTop: 'var(--sp-3)' }}>
                  <LineChart main={volume} ariaLabel="Volumen por sesión" />
                </div>
              </>
            )}
            {records !== null && records !== undefined && records.by_reps.length > 0 && (
              <div style={{ marginTop: 'var(--sp-5)' }}>
                <p className="t-body">Mejores series</p>
                {records.by_reps.map((r) => (
                  <div key={r.reps} className="bestrow">
                    <span className="t-data soft">{r.reps} reps</span>
                    <span className="t-data">{fmtWeight(r.weight, unit)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
