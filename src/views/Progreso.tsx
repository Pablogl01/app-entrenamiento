import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSettings } from '../db/db'
import { bestE1rmSeries } from '../db/repo'
import { addDays, startOfWeek, todayISO, weekdayMon0 } from '../lib/dates'
import { exerciseTrend, movingAvg7, setE1rm, weightTrendPerWeek, type Point } from '../lib/calc'
import { fmtNum } from '../lib/format'
import { weeklySessions } from '../lib/verdicts'
import { RootTopBar } from '../components/TopBar'
import { Icon } from '../components/Icon'
import type { MuscleGroup } from '../db/types'

const RANGES = [
  { key: '4s', label: '4 sem', days: 28 },
  { key: '3m', label: '3 meses', days: 91 },
  { key: '1a', label: '1 año', days: 365 },
  { key: 'todo', label: 'Todo', days: 36500 },
] as const

const GROUP_ABBR: Record<MuscleGroup, string> = {
  pecho: 'PECHO', espalda: 'ESPALDA', hombro: 'HOMBRO', biceps: 'BÍCEPS', triceps: 'TRÍCEPS',
  cuadriceps: 'CUÁDRI', femoral: 'ISQUIO', gluteo: 'GLÚTEO', gemelo: 'GEMELO', core: 'CORE',
}

const MONTH_ABBR = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']
const MONTH_LOWER = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function dateLabel(iso: string): string {
  return `${iso.slice(8)} ${MONTH_ABBR[Number(iso.slice(5, 7)) - 1]}`
}

function isoWeek(iso: string): number {
  const d = new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8))))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const y0 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - y0.getTime()) / 86_400_000 + 1) / 7)
}

interface TopSet {
  date: string
  weight: number
  reps: number
  rpe: number | null
  e1rm: number
}

/** Gráfica de línea calcada de la maqueta: área volt, objetivo discontinuo, puntos y última cifra. */
function MockLine({ points, target, unit, today }: { points: Point[]; target: number | null; unit: string; today: string }) {
  if (points.length === 0) return null
  const first = points[0]
  const last = points[points.length - 1]
  const values = points.map((p) => p.value)
  if (target !== null) values.push(target)
  const vMin = Math.min(...values)
  const vMax = Math.max(...values)
  const span = Math.max(0.5, vMax - vMin)
  const x = (i: number) => (points.length === 1 ? 160 : (i / (points.length - 1)) * 320)
  const y = (v: number) => 12 + (1 - (v - vMin) / span) * 76
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const area = `${line} L 320,100 L 0,100 Z`
  const marks = [0, Math.round((points.length - 1) * 0.25), Math.round((points.length - 1) * 0.5), Math.round((points.length - 1) * 0.75)].filter((i, k, arr) => arr.indexOf(i) === k && i < points.length - 1)
  const mid = points[Math.round((points.length - 1) / 2)]
  return (
    <div className="w-full relative h-36 flex flex-col justify-end pt-2">
      {target !== null && (
        <div className="absolute w-full flex items-center justify-between pointer-events-none opacity-40" style={{ top: `${8 + (y(target) / 100) * 112}px` }}>
          <div className="w-full border-t-dashed" />
          <span className="type-label-sm text-9 text-on-surface-variant pl-2 nowrap">
            {fmtNum(target)} OBJ
          </span>
        </div>
      )}
      <svg className="w-full h-28" preserveAspectRatio="none" viewBox="0 0 320 100" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="progGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" style={{ stopColor: 'var(--md-primary-fixed)', stopOpacity: 0.28 }} />
            <stop offset="100%" style={{ stopColor: 'var(--md-primary-fixed)', stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#progGrad)" />
        <path d={line} fill="none" strokeLinecap="round" strokeWidth={2.5} style={{ stroke: 'var(--md-primary-fixed)' }} />
        {marks.map((i) => (
          <circle key={i} cx={x(i)} cy={y(points[i].value)} r={i === 0 ? 3.5 : 3} strokeWidth={i === 0 ? 2 : 1.5} style={{ fill: 'var(--md-surface)', stroke: 'var(--md-primary-fixed)' }} />
        ))}
        <circle cx={x(points.length - 1)} cy={y(last.value)} r={4.5} strokeWidth={2} style={{ fill: 'var(--md-primary-fixed)', stroke: 'var(--md-surface)' }} />
      </svg>
      <div className="flex justify-between items-center pt-2 text-on-surface-variant type-label-sm text-10">
        <span>
          {dateLabel(first.date)} ({fmtNum(Math.round(first.value * 10) / 10)})
        </span>
        {points.length > 2 && (
          <span>
            {dateLabel(mid.date)} ({fmtNum(Math.round(mid.value * 10) / 10)})
          </span>
        )}
        <span className="text-volt font-semibold">
          {last.date === today ? 'HOY' : dateLabel(last.date)} ({fmtNum(Math.round(last.value * 10) / 10)} {unit === 'kg' ? '' : unit})
        </span>
      </div>
    </div>
  )
}

export function Progreso() {
  const today = todayISO()
  const [range, setRange] = useState<(typeof RANGES)[number]['key']>('3m')
  const [exerciseId, setExerciseId] = useState<string | null>(null)

  const settings = useLiveQuery(getSettings)
  const weekly = useLiveQuery(() => weeklySessions(1), [])
  const live = useLiveQuery(async () => {
    const s = await db.sessions.where('date').equals(today).first()
    return s != null && s.started_at !== null && s.finished_at === null
  }, [today])
  const metrics = useLiveQuery(async () => {
    const rows = await db.body_metrics.toArray()
    return rows.sort((a, b) => a.date.localeCompare(b.date)).map((m): Point => ({ date: m.date, value: m.weight }))
  }, [])
  const week = useLiveQuery(async () => {
    const monday = startOfWeek(today)
    const sessions = (await db.sessions.where('date').between(monday, addDays(monday, 6), true, true).toArray()).filter((s) => s.started_at !== null)
    const scheduled = new Set((await db.routine_schedules.toArray()).map((s) => s.weekday))
    return Array.from({ length: 7 }, (_, i) => {
      const iso = addDays(monday, i)
      return { iso, done: sessions.some((s) => s.date === iso), scheduled: scheduled.has(weekdayMon0(iso)) }
    })
  }, [today])
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
  const topSets = useLiveQuery(async (): Promise<TopSet[]> => {
    if (selectedId === null) return []
    const links = await db.session_exercises.where('exercise_id').equals(selectedId).toArray()
    const out: TopSet[] = []
    for (const link of links) {
      const session = await db.sessions.get(link.session_id)
      if (!session || session.finished_at === null) continue
      const sets = await db.sets.where('session_exercise_id').equals(link.id).toArray()
      let best: TopSet | null = null
      for (const s of sets) {
        const v = setE1rm(s)
        if (v !== null && s.weight !== null && (best === null || v > best.e1rm)) best = { date: session.date, weight: s.weight, reps: s.reps, rpe: s.rpe, e1rm: v }
      }
      if (best) out.push(best)
    }
    return out.sort((a, b) => a.date.localeCompare(b.date))
  }, [selectedId])

  if (settings === undefined || metrics === undefined || weekly === undefined || week === undefined) return null

  const unit = settings.unit
  const rangeDays = RANGES.find((r) => r.key === range)?.days ?? 91
  const from = addDays(today, -rangeDays)
  const windowed = metrics.filter((m) => m.date >= from)
  const ma = movingAvg7(windowed)
  const trend = weightTrendPerWeek(metrics)
  const current = metrics.at(-1) ?? null
  const first = windowed[0] ?? null
  const rangeDelta = current !== null && first !== null && first !== current ? current.value - first.value : null
  const goal = settings.body_weight_goal

  const trendE = e1rm !== undefined && e1rm.length > 0 ? exerciseTrend(e1rm) : null
  const calibrated = trendE !== null && trendE.kind !== 'insufficient'
  const verdict =
    trendE === null
      ? null
      : trendE.kind === 'insufficient'
        ? `Aún pocas sesiones para un veredicto: hacen falta ${Math.max(1, 4 - (e1rm?.length ?? 0))} más para estabilizar el cálculo del coeficiente de sobrecarga.`
        : trendE.kind === 'plateau'
          ? `e1RM plano desde hace ${trendE.sinceWeeks} semanas. El coeficiente de sobrecarga no crece.`
          : `${trendE.pctChange > 0 ? '+' : '−'}${fmtNum(Math.abs(trendE.pctChange * 100))} % de e1RM en las últimas ${trendE.window.length} sesiones.`

  const last3 = (topSets ?? []).slice(-3)
  const maxTop = Math.max(...last3.map((t) => t.weight), 1)
  const monthAgoTop = (topSets ?? []).filter((t) => t.date <= addDays(today, -30)).at(-1) ?? null
  const latestTop = (topSets ?? []).at(-1) ?? null
  const monthPct = monthAgoTop && latestTop && monthAgoTop.e1rm > 0 ? ((latestTop.e1rm - monthAgoTop.e1rm) / monthAgoTop.e1rm) * 100 : null
  const prSet = (topSets ?? []).reduce<TopSet | null>((acc, t) => (acc === null || t.e1rm > acc.e1rm ? t : acc), null)
  const weekDone = week.filter((d) => d.done).length
  const weekPct = weekly.target === 0 ? 0 : Math.round((weekDone / weekly.target) * 100)
  const selectedExercise = (trained ?? []).find((e) => e.id === selectedId) ?? null

  return (
    <div className="screen" style={{ paddingLeft: 0, paddingRight: 0, paddingTop: 64, paddingBottom: 0 }}>
      <RootTopBar tab="Progreso" live={live === true} />
      <main className="flex-1 w-full pb-24 px-gutter flex flex-col relative">
        <div className="flex flex-col w-full gap-lg pb-6">
          {/* Header + range */}
          <div className="flex flex-col gap-sm pt-xs">
            <div className="flex items-center justify-between">
              <div>
                <span className="type-label-sm uppercase tracking-widest text-on-surface-variant block">Métricas atléticas</span>
                <h1 className="type-headline-lg font-bold text-on-surface uppercase tracking-tight">Progreso y analítica</h1>
              </div>
              <div className="flex items-center gap-xs bg-sc-low px-xs py-1 rounded-full shadow-inner flex-none">
                <span className={`w-2 h-2 rounded-full ${calibrated ? 'bg-volt ping' : 'bg-outline'}`} />
                <span className={`type-label-sm uppercase font-semibold ${calibrated ? 'text-volt' : 'text-on-surface-variant'}`}>{calibrated ? 'Calibrado' : 'Calibrando'}</span>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-xs p-1 bg-sc-low rounded-xl" role="radiogroup" aria-label="Rango">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  role="radio"
                  aria-checked={range === r.key}
                  className={`py-2 text-center rounded-lg type-label-sm uppercase ${range === r.key ? 'font-semibold bg-volt text-on-volt shadow-sm' : 'text-on-surface-variant'}`}
                  onClick={() => setRange(r.key)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Body weight */}
          <section className="bg-sc rounded-xl p-base flex flex-col gap-md relative overflow-hidden shadow-md">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <div className="flex items-center gap-xs">
                  <Icon name="weight" size={18} className="text-volt" />
                  <span className="type-label-sm uppercase tracking-wider text-on-surface-variant">Peso corporal</span>
                </div>
                <div className="flex items-baseline gap-xs mt-1">
                  <span className="type-metric-xl text-on-surface font-bold tracking-tight">{current === null ? '—' : fmtNum(current.value)}</span>
                  <span className="type-label-md text-on-surface-variant font-medium uppercase">{unit}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {rangeDelta !== null && (
                  <div className="inline-flex items-center gap-1 px-2 py-0p5 rounded bg-volt-15 text-volt">
                    <Icon name={rangeDelta < 0 ? 'trending-down' : 'trending'} size={14} />
                    <span className="type-label-sm font-bold">
                      {rangeDelta > 0 ? '+' : '−'}
                      {fmtNum(Math.abs(rangeDelta))} {unit}
                    </span>
                  </div>
                )}
                <span className="type-label-sm text-on-surface-variant">
                  Meta: <strong className="text-on-surface font-semibold">{goal === null ? 'sin fijar' : `${fmtNum(goal)} ${unit}`}</strong>
                </span>
                {trend !== null && (
                  <span className="type-label-sm text-on-surface-variant">
                    {trend > 0 ? '+' : '−'}
                    {fmtNum(Math.abs(trend), 2)} {unit}/sem
                  </span>
                )}
              </div>
            </div>
            {ma.length > 0 ? (
              <MockLine points={ma} target={goal} unit={unit} today={today} />
            ) : (
              <p className="type-body-sm text-on-surface-variant">Sin pesajes en este rango. El primero se registra en Hoy.</p>
            )}
          </section>

          {/* Frequency */}
          <section className="bg-sc rounded-xl p-base flex flex-col gap-md shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-xs">
                <Icon name="calendar" size={18} className="text-volt" />
                <span className="type-label-sm uppercase tracking-wider text-on-surface-variant">Frecuencia y sesiones</span>
              </div>
              <span className="type-label-sm px-2 py-0p5 rounded bg-sc-high text-on-surface font-semibold">Semana {isoWeek(today)}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <div>
                <span className="type-metric-md text-on-surface font-bold">
                  {weekDone} {weekly.target > 0 && <span className="text-on-surface-variant font-normal">de</span>} {weekly.target > 0 ? weekly.target : ''}
                </span>
                <span className="type-body-sm text-on-surface-variant ml-1">sesiones completadas</span>
              </div>
              {weekly.target > 0 && <span className="type-label-sm text-volt font-semibold">{weekPct}% completado</span>}
            </div>
            <div className="grid grid-cols-7 gap-2 pt-1">
              {week.map((d, i) => {
                const isToday = d.iso === today
                const none = !d.done && !d.scheduled
                return (
                  <div key={d.iso} className={`flex flex-col items-center gap-2${none ? ' opacity-50' : ''}`}>
                    <div className="w-full h-16 bg-sc-low rounded-lg p-1 flex flex-col justify-end relative">
                      {d.done ? (
                        <div className="w-full bg-volt rounded-sm glow-bar" style={{ height: '100%' }} />
                      ) : d.scheduled ? (
                        <div className={`w-full bg-sc-highest rounded-sm${isToday ? ' pulse' : ''}`} style={{ height: isToday ? '55%' : '45%', opacity: isToday ? 1 : 0.6 }} />
                      ) : (
                        <div className="w-full border-t-dashed-variant h-1" />
                      )}
                    </div>
                    <span className={`type-label-sm ${d.done ? 'text-volt font-bold' : isToday ? 'text-on-surface font-bold' : 'text-on-surface-variant'}`}>{['L', 'M', 'X', 'J', 'V', 'S', 'D'][i]}</span>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Progressive overload */}
          <section className="bg-sc rounded-xl p-base flex flex-col gap-md shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-xs">
                <Icon name="trending" size={18} className="text-volt" />
                <span className="type-label-sm uppercase tracking-wider text-on-surface-variant">Sobrecarga progresiva</span>
              </div>
              <span className={`w-2 h-2 rounded-full ${calibrated ? 'bg-volt' : 'bg-outline'}`} />
            </div>

            {trained !== undefined && trained.length === 0 && <p className="type-body-sm text-on-surface-variant">Sin sesiones todavía. El progreso por ejercicio aparece al entrenar.</p>}

            {trained !== undefined && trained.length > 0 && (
              <>
                <div className="relative">
                  <div className="w-full flex items-center justify-between bg-sc-high px-md py-3 rounded-lg text-left">
                    <div className="flex flex-col min-w-0">
                      <span className="type-label-sm text-10 text-on-surface-variant uppercase tracking-wider">Patrón seleccionado</span>
                      <span className="type-headline-sm text-on-surface font-semibold truncate">{selectedExercise?.name ?? '—'}</span>
                    </div>
                    <div className="flex items-center gap-1 bg-sc-highest px-2 py-1 rounded flex-none">
                      <span className="type-label-sm text-volt">{selectedExercise ? GROUP_ABBR[selectedExercise.muscle_group] : '—'}</span>
                      <Icon name="chevron-down" size={18} className="text-on-surface" />
                    </div>
                  </div>
                  <select className="select-overlay" aria-label="Ejercicio" value={selectedId ?? ''} onChange={(e) => setExerciseId(e.target.value)}>
                    {trained.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </div>

                {verdict !== null && (
                  <div className="bg-sc-low rounded-lg p-md flex gap-sm items-start">
                    <div className="w-8 h-8 rounded-lg bg-sc-highest shrink-0 flex items-center justify-center text-volt">
                      <Icon name="trending" size={18} />
                    </div>
                    <div className="flex flex-col gap-0p5">
                      <span className="type-label-sm font-semibold text-on-surface uppercase tracking-wide">{calibrated ? 'Modelo de 1RM calibrado' : 'Modelo de 1RM en calibración'}</span>
                      <p className="type-body-sm text-on-surface-variant leading-snug">{verdict}</p>
                    </div>
                  </div>
                )}

                {calibrated && e1rm !== undefined && e1rm.length > 1 && <MockLine points={e1rm} target={null} unit={unit} today={today} />}

                {last3.length > 0 && (
                  <div className="flex flex-col gap-xs pt-1">
                    <div className="flex items-center justify-between text-on-surface-variant type-label-sm">
                      <span className="uppercase">Carga efectiva (últimas series)</span>
                      {monthPct !== null && (
                        <span className="text-volt font-semibold">
                          {monthPct > 0 ? '+' : '−'}
                          {fmtNum(Math.abs(monthPct))}% este mes
                        </span>
                      )}
                    </div>
                    <div className="w-full h-24 bg-sc-low rounded-lg p-sm flex items-end justify-between gap-3">
                      {last3.map((t, i) => {
                        const isLast = i === last3.length - 1
                        const h = Math.max(6, Math.round((t.weight / maxTop) * 40))
                        return (
                          <div key={t.date} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                            {isLast ? (
                              <div className="flex items-center gap-0p5 text-volt font-bold">
                                <Icon name="bolt" size={12} />
                                <span className="type-label-sm text-10">
                                  {fmtNum(t.weight)} {unit}
                                </span>
                              </div>
                            ) : (
                              <span className="type-label-sm text-10 text-on-surface-variant">
                                {fmtNum(t.weight)} {unit}
                              </span>
                            )}
                            <div className={`w-full rounded-t-sm ${isLast ? 'bg-volt glow-bar-10' : 'bg-sc-highest'}`} style={{ height: h }} />
                            <span className={`type-label-sm text-9 ${isLast ? 'text-volt font-semibold' : 'text-on-surface-variant'}`}>
                              {Number(t.date.slice(8))} {MONTH_LOWER[Number(t.date.slice(5, 7)) - 1]}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {prSet !== null && (
                  <div className="bg-sc-low rounded-lg p-md flex items-center justify-between">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1p5 mb-1">
                        <span className="px-1p5 py-0p5 rounded bg-volt text-on-volt type-label-sm text-9 font-bold uppercase">PR actual</span>
                        <span className="type-label-sm text-10 text-on-surface-variant uppercase">RPE {prSet.rpe === null ? '—' : fmtNum(prSet.rpe)}</span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="type-headline-md text-on-surface font-bold">{prSet.reps}</span>
                        <span className="type-label-sm text-on-surface-variant font-medium uppercase">reps ×</span>
                        <span className="type-metric-md text-volt font-bold">{fmtNum(prSet.weight)}</span>
                        <span className="type-label-sm text-on-surface-variant font-medium uppercase">{unit}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="type-label-sm text-10 text-on-surface-variant uppercase tracking-wider">Vel. media propulsiva</span>
                      <div className="flex items-center gap-1 bg-sc-high px-2 py-1 rounded">
                        <Icon name="gauge" size={14} className="text-volt" />
                        <span className="type-metric-md text-14 text-on-surface font-semibold">— m/s</span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
