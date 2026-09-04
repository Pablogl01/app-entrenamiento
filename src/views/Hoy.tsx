import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, Link } from 'react-router-dom'
import { db, getSettings } from '../db/db'
import {
  cancelStart,
  cycleState,
  movedAwayFrom,
  replacementOn,
  elapsedMs,
  estimatedDurationMin,
  lastPerformance,
  recoveryEstimate,
  reopenSession,
  saveBodyWeight,
  scheduledRoutineFor,
  startSession,
  streakDays,
  syncTodayDraft,
  todaySession,
} from '../db/repo'
import { addDays, parseISO, shortDate, todayISO } from '../lib/dates'
import { fmtNum } from '../lib/format'
import { movingAvg7, type Point } from '../lib/calc'
import { bodyWeightVerdict, weeklySessions } from '../lib/verdicts'
import { fmtClock, useNow } from '../lib/useNow'
import { RootTopBar } from '../components/TopBar'
import { EXERCISE_IMAGES } from '../components/ExerciseVisual'
import { Icon } from '../components/Icon'
import { useSessionCards } from '../components/useSessionCards'
import { MoveSheet } from '../components/MoveSheet'
import type { CardData } from '../components/ExerciseCard'
import { goalLabel } from './Ciclo'

let draftCreationInFlight = false

const DAY_ABBR = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

/** Sparkline de 7 días calcado de la maqueta: polilínea volt con relleno, sin ejes. */
function WeekLine({ ma, dots, today, goal }: { ma: Point[]; dots: Point[]; today: string; goal: number | null }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, -(6 - i)))
  const src = ma.length > 0 ? ma : dots
  const pts = days.map((d, i) => ({ x: (i / 6) * 320, v: src.find((p) => p.date === d)?.value ?? null }))
  const known = pts.filter((p) => p.v !== null) as { x: number; v: number }[]
  if (known.length === 0) return null
  const values = known.map((p) => p.v)
  if (goal !== null) values.push(goal)
  const vMin = Math.min(...values) - 0.3
  const vMax = Math.max(...values) + 0.3
  const y = (v: number) => 8 + (1 - (v - vMin) / (vMax - vMin)) * 44
  const line = known.map((p) => `${p.x.toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')
  const poly = `${known[0].x.toFixed(1)},55 ${line} ${known[known.length - 1].x.toFixed(1)},55`
  const last = known[known.length - 1]
  return (
    <div className="w-full h-20 relative pt-xs">
      <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 320 60" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="weightGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" style={{ stopColor: 'var(--md-primary-fixed)', stopOpacity: 0.3 }} />
            <stop offset="100%" style={{ stopColor: 'var(--md-primary-fixed)', stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        {goal !== null && <line x1={0} x2={320} y1={y(goal)} y2={y(goal)} strokeDasharray="3 3" strokeWidth={1} style={{ stroke: 'var(--md-outline-variant)' }} />}
        <polygon fill="url(#weightGrad)" points={poly} />
        <polyline fill="none" points={line} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} style={{ stroke: 'var(--md-primary-fixed)' }} />
        {known.map((p) =>
          p === last ? (
            <circle key={p.x} cx={p.x} cy={y(p.v)} r={4} strokeWidth={2} style={{ fill: 'var(--md-primary-fixed)', stroke: 'var(--md-surface)' }} />
          ) : (
            <circle key={p.x} cx={p.x} cy={y(p.v)} r={2.5} strokeWidth={1.5} style={{ fill: 'var(--md-surface)', stroke: 'var(--md-primary-fixed)' }} />
          ),
        )}
      </svg>
    </div>
  )
}

export function Hoy() {
  const navigate = useNavigate()
  const today = todayISO()

  const settings = useLiveQuery(getSettings)
  const routine = useLiveQuery(() => scheduledRoutineFor(today), [today])
  const session = useLiveQuery(todaySession, [today])
  const weekly = useLiveQuery(() => weeklySessions(1), [])
  const streak = useLiveQuery(() => streakDays(), [today])
  const recovery = useLiveQuery(() => recoveryEstimate(), [])
  const cycle = useLiveQuery(() => cycleState(today), [today])
  const metrics = useLiveQuery(async () => {
    const from = addDays(today, -42)
    const rows = await db.body_metrics.filter((m) => m.date >= from).toArray()
    return rows.sort((a, b) => a.date.localeCompare(b.date))
  }, [today])
  const cards = useSessionCards(session?.id)
  // Entrenos movidos desde hoy a otro día (o anulados): Hoy lo dice y ofrece deshacer.
  const movedToday = useLiveQuery(async () => {
    const rows = (await movedAwayFrom(today)).filter((o) => o.replaced_by == null)
    const out: { id: string; name: string; to: string | null }[] = []
    for (const o of rows) {
      const r = await db.routines.get(o.routine_id)
      if (r) out.push({ id: o.id, name: r.name, to: o.to_date })
    }
    return out
  }, [today])
  // Hoy se entrena otra rutina en lugar de la programada: la hero lo dice.
  const replacedName = useLiveQuery(async () => {
    const o = await replacementOn(today)
    if (o === null) return null
    return (await db.routines.get(o.routine_id))?.name ?? null
  }, [today])
  const [moving, setMoving] = useState(false)

  useEffect(() => {
    if (routine === undefined || session === undefined || draftCreationInFlight) return
    draftCreationInFlight = true
    void syncTodayDraft(routine).finally(() => {
      draftCreationInFlight = false
    })
  }, [routine, session])

  const hasTraining = session != null || routine != null
  const weighedToday = metrics?.some((m) => m.date === today) ?? false
  const yesterdayWeight = metrics?.filter((m) => m.date < today).at(-1)?.weight ?? null
  const todayWeight = metrics?.find((m) => m.date === today)?.weight ?? null
  const [weightText, setWeightText] = useState('')
  const weightInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!weighedToday && new Date().getHours() < 15) weightInputRef.current?.focus()
  }, [weighedToday])

  function commitWeight() {
    const n = Number(weightText.replace(',', '.'))
    if (Number.isFinite(n) && n > 20 && n < 400) {
      void saveBodyWeight(today, n)
      setWeightText('')
    }
  }

  const started = session?.started_at != null
  const finished = session?.finished_at != null
  const live = started && !finished
  const now = useNow(live && session.paused_at === null)
  const cardList = cards ?? []
  const totalWork = cardList.flatMap((c) => c.sets.filter((s) => s.kind !== 'warmup')).length
  const doneWork = cardList.flatMap((c) => c.sets.filter((s) => s.kind !== 'warmup' && s.completed)).length
  const pct = totalWork === 0 ? 0 : Math.round((doneWork / totalWork) * 100)
  const estimate = useLiveQuery(() => estimatedDurationMin(session?.routine_id ?? routine?.id ?? null, totalWork), [session?.routine_id, routine?.id, totalWork])
  const firstImage = cardList.find((c) => c.exercise.image !== null)?.exercise.image ?? null

  async function onStart() {
    if (!session) return
    await startSession(session.id)
    navigate('/entrenar')
  }

  if (settings === undefined || session === undefined || routine === undefined) return null

  const unit = settings.unit
  const dots: Point[] = (metrics ?? []).map((m) => ({ date: m.date, value: m.weight }))
  const ma = movingAvg7(dots)
  const trainingName = session?.routine_name_snapshot ?? routine?.name ?? 'Sesión libre'
  const weekDone = weekly?.bars.at(-1)?.done ?? 0
  const weekTarget = weekly?.target ?? 0
  const delta = todayWeight !== null && yesterdayWeight !== null ? todayWeight - yesterdayWeight : null
  const monthAgo = dots.find((d) => d.date >= addDays(today, -30))
  const latest = dots.at(-1)
  const monthDelta = monthAgo && latest && monthAgo !== latest ? latest.value - monthAgo.value : null
  const goal = settings.body_weight_goal
  const blockGoal = cycle?.block?.goal ?? cycle?.cycle.goal ?? null
  const rpeTargets = cardList.map((c) => c.se.target_rpe).filter((r): r is number => r !== null)
  const rpeObj = rpeTargets.length === 0 ? null : Math.min(...rpeTargets) === Math.max(...rpeTargets) ? fmtNum(rpeTargets[0]) : `${fmtNum(Math.min(...rpeTargets))}-${fmtNum(Math.max(...rpeTargets))}`
  const ringC = 94.2

  return (
    <div className="screen">
      <RootTopBar tab="Hoy" live={live} />
      <main className="flex-1 w-full pb-24 px-gutter flex flex-col relative">
        <div className="flex flex-col w-full space-y-lg">
          {/* Micro Performance Adherence Bar: las tres a la vista, sin scroll */}
          <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
            <div className="chipbar flex items-center justify-center gap-xs bg-sc-low px-sm py-xs rounded-full shadow-sm">
              <Icon name="flame" size={16} className="text-volt flex-none" />
              <span className="type-label-sm text-on-surface uppercase nowrap">
                Racha {streak ?? 0} {streak === 1 ? 'día' : 'días'}
              </span>
            </div>
            <div className="chipbar flex items-center justify-center gap-xs bg-sc-low px-sm py-xs rounded-full shadow-sm">
              <Icon name="calendar" size={16} className="text-secondary flex-none" />
              <span className="type-label-sm text-on-surface-variant uppercase nowrap">
                Semana {weekDone}/{weekTarget > 0 ? weekTarget : '—'}
              </span>
            </div>
            <div className="chipbar flex items-center justify-center gap-xs bg-sc-low px-sm py-xs rounded-full shadow-sm">
              <span className={`w-2 h-2 rounded-full flex-none ${recovery == null ? 'bg-sc-highest' : 'bg-volt'}`} />
              <span className="type-label-sm text-on-surface uppercase nowrap">Recup. {recovery == null ? '—' : `${recovery.pct}%`}</span>
            </div>
          </div>

          {/* Hero Session Card */}
          {hasTraining && (
            <div className="relative w-full rounded-xl bg-sc p-lg shadow-xl overflow-hidden">
              <div className="absolute -right-12 -top-12 w-48 h-48 rounded-circle blur-3xl pointer-events-none" style={{ background: 'color-mix(in srgb, var(--md-primary-fixed) 10%, transparent)' }} />
              <div className="relative z-10 flex flex-col space-y-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-xs bg-sc-high px-sm py-xxs rounded-lg">
                    <span className={`w-1p5 h-1p5 rounded-full bg-volt${live ? ' pulse' : ''}`} />
                    <span className="type-label-sm text-volt uppercase tracking-wider">
                      {finished ? 'Sesión hecha' : live ? (session?.paused_at !== null ? 'En pausa' : 'Sesión en curso') : 'Día de entreno'}
                    </span>
                  </div>
                  <span className="type-label-sm text-on-surface-variant">
                    {live && session ? `${fmtClock(elapsedMs(session, now))} · ${doneWork}/${totalWork} series` : finished ? `${doneWork} series hechas` : estimate !== undefined ? `~${estimate} min estimados` : ''}
                  </span>
                </div>
                <div className="flex flex-col space-y-xxs">
                  <h1 className="type-display-sm text-on-surface uppercase font-extrabold" style={{ letterSpacing: '-0.03em' }}>
                    {trainingName}
                  </h1>
                  <p className="type-body-sm text-on-surface-variant">
                    {finished
                      ? 'Sesión completada · ver el resumen'
                      : live
                        ? 'Sesión en curso · continúa donde la dejaste'
                        : session?.routine_id === null && routine === null
                          ? 'Sesión libre, sin plantilla'
                          : `${replacedName != null ? `En lugar de ${replacedName}` : 'Sesión programada para hoy'}${blockGoal !== null ? ` · Enfoque ${goalLabel(blockGoal).toLowerCase()}` : ''}`}
                  </p>
                </div>
                <div className="pt-xs flex items-center gap-sm">
                  {!started && session && (
                    <button className="flex-1 h-touch bg-volt press rounded-lg flex items-center justify-center gap-sm px-lg shadow-md" onClick={() => void onStart()}>
                      <Icon name="play" size={20} className="text-on-primary-container" />
                      <span className="type-label-md text-on-primary-container uppercase font-semibold tracking-wider">Iniciar sesión</span>
                    </button>
                  )}
                  {live && (
                    <Link to="/entrenar" className="flex-1 h-touch bg-volt press rounded-lg flex items-center justify-center gap-sm px-lg shadow-md">
                      <Icon name="play" size={20} className="text-on-primary-container" />
                      <span className="type-label-md text-on-primary-container uppercase font-semibold tracking-wider">Continuar sesión</span>
                    </Link>
                  )}
                  {live && session && doneWork === 0 && (
                    <button className="w-touch h-touch bg-sc-high press rounded-lg flex items-center justify-center text-on-surface-variant" aria-label="Cancelar inicio" onClick={() => void cancelStart(session.id)}>
                      <Icon name="close" size={20} />
                    </button>
                  )}
                  {finished && session && (
                    <>
                      <Link to={`/resumen/${session.id}`} className="flex-1 h-touch bg-sc-high press rounded-lg flex items-center justify-center gap-sm px-lg">
                        <Icon name="history" size={20} className="text-on-surface-variant" />
                        <span className="type-label-md text-on-surface uppercase font-semibold tracking-wider">Ver resumen</span>
                      </Link>
                      <button className="w-touch h-touch bg-sc-high press rounded-lg flex items-center justify-center text-on-surface-variant" aria-label="Reabrir sesión" onClick={() => void reopenSession(session.id)}>
                        <Icon name="edit" size={20} />
                      </button>
                    </>
                  )}
                  {!started && session?.routine_id != null && (
                    <Link to={`/rutinas/${session.routine_id}`} className="w-touch h-touch bg-sc-high press rounded-lg flex items-center justify-center text-on-surface-variant" aria-label="Ajustar sesión">
                      <Icon name="sliders" size={20} />
                    </Link>
                  )}
                  {!started && session?.routine_id != null && (
                    <button
                      className="w-touch h-touch bg-sc-high press rounded-lg flex items-center justify-center text-on-surface-variant"
                      aria-label={doneWork > 0 ? 'Mover o cambiar: ya hay series hechas hoy' : 'Mover o cambiar'}
                      disabled={doneWork > 0}
                      style={doneWork > 0 ? { opacity: 0.45 } : undefined}
                      onClick={() => setMoving(true)}
                    >
                      <Icon name="calendar" size={20} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Día sin entreno porque se movió: decirlo y poder deshacerlo */}
          {!hasTraining &&
            (movedToday ?? []).map((m) => (
              <div key={m.id} className="w-full rounded-xl bg-sc p-lg shadow-xl flex flex-col space-y-md">
                <div className="flex items-center gap-xs bg-sc-high px-sm py-xxs rounded-lg self-start">
                  <span className="w-1p5 h-1p5 rounded-full bg-sc-highest" />
                  <span className="type-label-sm text-on-surface-variant uppercase tracking-wider">Descanso</span>
                </div>
                <div className="flex flex-col gap-xxs">
                  <h1 className="type-display-sm text-on-surface uppercase font-extrabold" style={{ letterSpacing: '-0.03em' }}>
                    Hoy libre
                  </h1>
                  <p className="type-body-sm text-on-surface-variant">
                    {m.name} {m.to === null ? 'anulado hoy' : `movido al ${shortDate(m.to)}`}
                  </p>
                </div>
                <button className="w-full h-touch bg-sc-high press rounded-lg flex items-center justify-center gap-sm text-on-surface" onClick={() => void db.schedule_overrides.delete(m.id)}>
                  <Icon name="swap" size={20} className="text-on-surface-variant" />
                  <span className="type-label-md uppercase font-semibold tracking-wider">Deshacer</span>
                </button>
              </div>
            ))}

          {moving && session?.routine_id != null && <MoveSheet routineId={session.routine_id} routineName={trainingName} fromDate={today} onClose={() => setMoving(false)} />}

          {/* Visual Benchmark Anchor (Context Snapshot) */}
          {hasTraining && (
            <Link to="/ciclo" className="w-full bg-sc-low rounded-xl p-md shadow-sm flex items-center gap-md">
              <div className="w-14 h-14 rounded-lg overflow-hidden flex-none bg-sc-highest w-full-img flex items-center justify-center text-volt">
                {firstImage !== null && EXERCISE_IMAGES[firstImage] !== undefined ? <img src={EXERCISE_IMAGES[firstImage]} alt="" /> : <Icon name="layers" size={24} />}
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="type-label-sm text-volt uppercase tracking-wider">{cycle ? `Mesociclo ${cycle.cycle.name}` : 'Sin ciclo activo'}</span>
                <p className="type-body-md text-on-surface font-medium truncate">
                  {cycle
                    ? cycle.block
                      ? `Bloque ${cycle.blocks.findIndex((b) => b.id === cycle.block?.id) + 1} · Microciclo ${cycle.microcycle}`
                      : `Semana ${cycle.week} · fuera de bloque`
                    : 'Crear un ciclo'}
                </p>
                <span className="type-body-sm text-on-surface-variant">
                  {totalWork} series · {blockGoal !== null ? goalLabel(blockGoal).toLowerCase() : 'sin objetivo'}
                  {cycle && ` · semana ${cycle.week} de ${cycle.totalWeeks}`}
                </span>
              </div>
            </Link>
          )}

          {/* Daily Weight Tracker Card */}
          <div className="w-full rounded-xl bg-sc p-lg shadow-lg flex flex-col space-y-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-xs">
                <Icon name="weight" size={18} className="text-volt" />
                <span className="type-headline-sm text-on-surface">Peso corporal</span>
              </div>
              <span className="type-label-sm bg-sc-high text-on-surface-variant px-sm py-xxs rounded-md">{weighedToday ? 'Pesaje completado' : 'Sin pesar hoy'}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline gap-xs">
                {weighedToday && todayWeight !== null ? (
                  <span className="type-metric-xl text-on-surface tracking-tight font-semibold">{fmtNum(todayWeight)}</span>
                ) : (
                  <input
                    ref={weightInputRef}
                    className="bare-input type-metric-xl text-on-surface tracking-tight font-semibold text-left"
                    style={{ width: 120 }}
                    inputMode="decimal"
                    aria-label="Peso de hoy"
                    placeholder={yesterdayWeight !== null ? fmtNum(yesterdayWeight) : '—'}
                    value={weightText}
                    onChange={(e) => setWeightText(e.target.value)}
                    onBlur={commitWeight}
                    onKeyDown={(e) => e.key === 'Enter' && commitWeight()}
                  />
                )}
                <span className="type-label-md text-on-surface-variant">{unit}</span>
                {!weighedToday && yesterdayWeight !== null && <span className="type-label-sm text-outline">ayer</span>}
              </div>
              {delta !== null ? (
                <div className="flex items-center gap-xxs bg-sc-high px-sm py-xxs rounded-md">
                  <Icon name={delta < 0 ? 'arrow-down' : 'arrow-up'} size={14} className="text-volt" />
                  <span className="type-label-sm text-volt font-medium">
                    {delta > 0 ? '+' : delta < 0 ? '−' : ''}
                    {fmtNum(Math.abs(delta))} {unit} ayer
                  </span>
                </div>
              ) : (
                yesterdayWeight !== null && (
                  <div className="flex items-center gap-xxs bg-sc-high px-sm py-xxs rounded-md">
                    <span className="type-label-sm text-on-surface-variant">toca la cifra para anotar</span>
                  </div>
                )
              )}
            </div>
            <WeekLine ma={ma} dots={dots} today={today} goal={goal} />
            <div className="flex items-center justify-between type-label-sm text-on-surface-variant">
              {Array.from({ length: 7 }, (_, i) => addDays(today, -(6 - i))).map((d, i) => (
                <span key={d} className={i === 6 ? 'text-volt font-medium' : ''}>
                  {i === 6 ? 'Hoy' : DAY_ABBR[(parseISO(d).getDay() + 6) % 7]}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-xs bg-sc-low p-sm rounded-lg">
              <Icon name="trending" size={16} className="text-on-surface-variant flex-none" />
              <p className="type-body-sm text-on-surface-variant">
                {bodyWeightVerdict(dots)}
                {monthDelta !== null && (
                  <span className="text-on-surface font-medium">
                    {' '}
                    ({monthDelta > 0 ? '+' : '−'}
                    {fmtNum(Math.abs(monthDelta))} {unit} este mes)
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Today's Workout Breakdown Card */}
          {hasTraining && session && (
            <div className="w-full rounded-xl bg-sc p-lg shadow-lg flex flex-col space-y-md">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <h2 className="type-headline-sm text-on-surface">Entreno de hoy</h2>
                  <span className="type-body-sm text-on-surface-variant">
                    {cardList.length} ejercicios · {totalWork} series
                  </span>
                </div>
                <div className="relative w-11 h-11 flex items-center justify-center">
                  <svg className="w-full h-full" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx={18} cy={18} r={15} fill="none" strokeWidth={3} style={{ stroke: 'var(--md-sc-high)' }} />
                    <circle cx={18} cy={18} r={15} fill="none" strokeWidth={3} strokeLinecap="round" strokeDasharray={ringC} strokeDashoffset={ringC - (pct / 100) * ringC} style={{ stroke: 'var(--md-primary-fixed)', transition: 'stroke-dashoffset 0.3s' }} />
                  </svg>
                  <span className={`absolute text-on-surface font-medium nowrap ${pct >= 100 ? 'type-label-sm text-9' : 'type-label-sm'}`} style={{ letterSpacing: 0 }}>{pct}%</span>
                </div>
              </div>
              <div className="w-full bg-sc-high rounded-full h-1p5 overflow-hidden">
                <div className="progress__fill" style={{ transform: `scaleX(${pct / 100})` }} />
              </div>
              <div className="flex justify-between items-center">
                <span className="type-label-sm text-on-surface-variant">
                  {doneWork} / {totalWork} series completadas
                </span>
                {rpeObj !== null && <span className="type-label-sm text-volt">RPE obj: {rpeObj}</span>}
              </div>
              <div className="flex flex-col space-y-sm pt-xs">
                {cardList.map((c) => (
                  <TodayRow key={c.se.id} card={c} unit={unit} />
                ))}
              </div>
              <Link to="/entrenar" className="w-full h-touch rounded-lg bg-sc-high press flex items-center justify-center gap-xs text-on-surface">
                <span className="type-label-sm uppercase tracking-wider font-medium">Ver desglose técnico y calentamiento</span>
                <Icon name="chevron-right" size={16} />
              </Link>
            </div>
          )}

          {/* Recovery / Sleep */}
          <div className="w-full rounded-xl bg-sc-low p-md flex items-center justify-between">
            <div className="flex items-center gap-md">
              <div className="w-10 h-10 rounded-lg bg-sc flex items-center justify-center text-volt">
                <Icon name="moon" size={22} />
              </div>
              <div className="flex flex-col">
                <span className="type-body-sm text-on-surface-variant">Descanso nocturno</span>
                <span className="type-body-md text-on-surface font-medium">— · sin fuente de datos</span>
              </div>
            </div>
            <span className="type-label-sm text-volt bg-volt-10 px-sm py-xxs rounded-md">Sin datos</span>
          </div>
        </div>
      </main>
    </div>
  )
}

/** Fila de ejercicio de la maqueta: casilla, nombre, series·reps y objetivo a la derecha. */
function TodayRow({ card, unit }: { card: CardData; unit: string }) {
  const past = useLiveQuery(() => lastPerformance(card.exercise.id), [card.exercise.id]) ?? []
  const top = past[0]
  const work = card.sets.filter((s) => s.kind !== 'warmup')
  const done = work.filter((s) => s.completed).length
  const complete = work.length > 0 && done === work.length
  return (
    <Link to="/entrenar" className="rounded-xl bg-sc-low p-md flex items-center justify-between shadow-sm">
      <div className="flex items-start gap-md min-w-0">
        <span className={`w-7 h-7 rounded-md flex items-center justify-center mt-0p5 flex-none ${complete ? 'bg-volt text-on-primary-container' : 'bg-sc-high'}`} aria-hidden="true">
          {complete && <Icon name="check" size={16} strokeWidth={2.5} />}
        </span>
        <div className="flex flex-col min-w-0">
          <span className="type-body-md text-on-surface font-semibold truncate">{card.exercise.name}</span>
          <span className="type-body-sm text-on-surface-variant">
            {card.se.target_sets} series · {card.se.target_reps_min}-{card.se.target_reps_max} reps
            {done > 0 && !complete && ` · ${done}/${work.length}`}
            {card.se.target_rpe !== null && ` · RPE ${fmtNum(card.se.target_rpe)}`}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-end flex-none">
        <span className="type-label-md text-on-surface font-medium nowrap">{top?.weight != null ? `${fmtNum(top.weight)} ${unit}` : '—'}</span>
        <span className="type-label-sm text-volt">Objetivo</span>
      </div>
    </Link>
  )
}
