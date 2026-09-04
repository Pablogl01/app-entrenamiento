import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import {
  activeRoutines,
  createDraftFromRoutine,
  createEmptySession,
  createRoutine,
  cycleState,
  estimatedDurationMin,
  lastHighlight,
  lastPerformedAt,
  projectedVolume,
  routineWeekdays,
  scheduledOn,
  todaySession,
  type LastHighlight,
} from '../db/repo'
import { WEEKDAY_SHORT, addDays, todayISO, weekdayMon0 } from '../lib/dates'
import { fmtNum, fmtRelative, fmtWeekdays } from '../lib/format'
import { weeklySessions } from '../lib/verdicts'
import type { Routine } from '../db/types'
import { RootTopBar } from '../components/TopBar'
import { Icon, type IconName } from '../components/Icon'
import { goalLabel } from './Ciclo'

type State = 'today' | 'done_today' | 'done_yesterday' | 'upcoming' | 'in_cycle'

interface RoutineRow {
  routine: Routine
  exercises: number
  sets: number
  names: string[]
  weekdays: number[]
  last: string | null
  state: State
  nextDate: string | null
  volume: number
  minutes: number
  highlight: LastHighlight | null
}

const WEEKDAY_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

function routineIcon(r: Routine): IconName {
  return r.routine_type === 'mobility' ? 'wave' : r.routine_type === 'strength' ? 'dumbbell' : 'grid'
}

export function Rutinas() {
  const navigate = useNavigate()
  const today = todayISO()

  const weekly = useLiveQuery(() => weeklySessions(1), [])
  const session = useLiveQuery(todaySession, [today])
  const cycle = useLiveQuery(() => cycleState(today), [today])

  const rows = useLiveQuery(async () => {
    const routines = await activeRoutines()
    const current = await todaySession()
    const todayIds = new Set((await scheduledOn(today)).map((r) => r.id))
    const out: RoutineRow[] = []
    for (const r of routines) {
      const res = (await db.routine_exercises.where('routine_id').equals(r.id).toArray()).sort((a, b) => a.position - b.position)
      const names: string[] = []
      for (const re of res.slice(0, 3)) {
        const e = await db.exercises.get(re.exercise_id)
        if (e) names.push(e.name)
      }
      const weekdays = await routineWeekdays(r.id)
      const last = await lastPerformedAt(r.id)
      const sets = res.reduce((acc, re) => acc + re.target_sets, 0)
      const doneToday = current !== null && current.routine_id === r.id && current.started_at !== null
      let nextDate: string | null = null
      for (let i = 1; i <= 7; i++) {
        const iso = addDays(today, i)
        if ((await scheduledOn(iso)).some((x) => x.id === r.id)) {
          nextDate = iso
          break
        }
      }
      const state: State = doneToday ? 'done_today' : todayIds.has(r.id) ? 'today' : last === addDays(today, -1) ? 'done_yesterday' : nextDate !== null ? 'upcoming' : 'in_cycle'
      out.push({
        routine: r,
        exercises: res.length,
        sets,
        names,
        weekdays,
        last,
        state,
        nextDate,
        volume: state === 'today' ? await projectedVolume(r.id) : 0,
        minutes: state === 'today' ? await estimatedDurationMin(r.id, sets) : 0,
        highlight: state === 'done_today' || state === 'done_yesterday' ? await lastHighlight(r.id) : null,
      })
    }
    const order: Record<State, number> = { today: 0, done_today: 1, done_yesterday: 2, upcoming: 3, in_cycle: 4 }
    return out.sort((a, b) => order[a.state] - order[b.state] || (a.nextDate ?? '9').localeCompare(b.nextDate ?? '9'))
  }, [today])

  async function onCreate() {
    const r = await createRoutine()
    navigate(`/rutinas/${r.id}`)
  }

  async function onEmptySession() {
    const existing = await todaySession()
    if (existing === null) await createEmptySession()
    navigate('/entrenar')
  }

  async function onTrain(r: Routine) {
    const existing = await todaySession()
    if (existing === null) await createDraftFromRoutine(r)
    navigate(existing !== null && existing.started_at !== null ? '/entrenar' : '/')
  }

  if (rows === undefined || cycle === undefined) return null

  const live = session != null && session.started_at !== null && session.finished_at === null
  const weekDone = weekly?.bars.at(-1)?.done ?? 0
  const weekTarget = weekly?.target ?? 0

  function tag(r: RoutineRow) {
    switch (r.state) {
      case 'today':
        return <span className="bg-volt text-on-primary-container type-label-sm uppercase px-xs py-2px rounded font-bold tracking-wider">Toca hoy</span>
      case 'done_today':
        return <span className="bg-sc-high text-secondary-fixed type-label-sm uppercase px-xs py-2px rounded font-medium">Hecha hoy</span>
      case 'done_yesterday':
        return <span className="bg-sc-high text-secondary-fixed type-label-sm uppercase px-xs py-2px rounded font-medium">Completado ayer</span>
      case 'upcoming':
        return <span className="bg-sc-low text-on-surface-variant type-label-sm uppercase px-xs py-2px rounded">Próximo {r.nextDate !== null ? WEEKDAY_FULL[weekdayMon0(r.nextDate)] : ''}</span>
      default:
        return <span className="bg-sc-low text-on-surface-variant type-label-sm uppercase px-xs py-2px rounded">{cycle ? 'En ciclo actual' : r.last === null ? 'Nunca' : fmtRelative(r.last)}</span>
    }
  }

  function dayLabel(r: RoutineRow): string {
    if (r.state === 'today') return WEEKDAY_FULL[weekdayMon0(today)]
    if (r.state === 'upcoming' && r.nextDate !== null) return r.nextDate === addDays(today, 1) ? 'Mañana' : WEEKDAY_SHORT[weekdayMon0(r.nextDate)]
    return fmtWeekdays(r.weekdays)
  }

  return (
    <div className="screen">
      <RootTopBar tab="Rutinas" live={live} />
      <main className="flex-1 w-full pb-24 px-gutter flex flex-col relative">
        <div className="flex flex-col w-full space-y-md">
          <Link to="/ciclo" className="flex items-center justify-between px-xs py-xxs bg-sc-low rounded-lg text-on-surface-variant">
            <div className="flex items-center gap-xs">
              <span className={`w-1p5 h-1p5 rounded-full ${cycle ? 'bg-volt' : 'bg-sc-highest'}`} />
              <span className="type-label-sm uppercase tracking-wider text-on-surface">{cycle ? `Ciclo activo · semana ${cycle.week}` : 'Sin ciclo · crear uno'}</span>
            </div>
            <span className="type-label-sm text-on-surface-variant uppercase">
              {weekDone}/{weekTarget} completadas
            </span>
          </Link>

          <div className="flex items-center justify-between pt-xs">
            <div>
              <h2 className="type-headline-lg uppercase tracking-tight text-on-surface font-black">Mis rutinas</h2>
              <p className="type-body-sm text-on-surface-variant">
                {rows.length === 0
                  ? 'Ninguna plantilla todavía'
                  : `${rows.length} ${rows.length === 1 ? 'bloque calibrado' : 'bloques calibrados'} para ${goalLabel(cycle?.block?.goal ?? cycle?.cycle.goal ?? 'hipertrofia').toLowerCase()}`}
              </p>
            </div>
            <button className="flex items-center gap-xxs bg-volt text-on-primary-container px-md py-xs rounded-lg type-label-md font-bold tracking-wide press press-95 glow-volt-20" onClick={() => void onCreate()}>
              <Icon name="plus" size={18} />
              <span className="uppercase">Crear</span>
            </button>
          </div>

          <div className="flex flex-col gap-md pt-xs">
            {rows.length === 0 && <p className="type-body-sm text-on-surface-variant">Sin rutinas todavía. Crea la primera o empieza una sesión vacía y guárdala al acabar.</p>}
            {rows.map((r) => (
              <div key={r.routine.id} className={`relative bg-sc rounded-xl p-base flex flex-col gap-md overflow-hidden ${r.state === 'today' ? 'shadow-black-40' : 'shadow-black-30'}`}>
                {r.state === 'today' && <div className="absolute top-0 left-0 right-0 h-3px bg-volt glow-line" />}
                <div className="flex items-start justify-between">
                  <div className="flex flex-col gap-xxs min-w-0">
                    <div className="flex items-center gap-xs">
                      {tag(r)}
                      <span className="type-label-sm text-on-surface-variant uppercase">{dayLabel(r)}</span>
                    </div>
                    <h3 className="type-headline-md font-bold uppercase tracking-tight text-on-surface mt-xxs">{r.routine.name}</h3>
                    <p className="type-body-sm text-on-surface-variant truncate">
                      {r.exercises} {r.exercises === 1 ? 'ejercicio' : 'ejercicios'}
                      {r.names.length > 0 && ` · ${r.names.join(', ')}`}
                    </p>
                  </div>
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-none ${r.state === 'today' ? 'bg-sc-high text-volt' : 'bg-sc-low text-on-surface-variant'}`}>
                    <Icon name={routineIcon(r.routine)} size={26} />
                  </div>
                </div>

                {r.state === 'today' && (
                  <div className="grid grid-cols-3 gap-xs py-xs px-sm bg-sc-low rounded-lg text-center">
                    <div>
                      <span className="block type-label-sm text-on-surface-variant uppercase">Volumen</span>
                      <span className="type-metric-md text-on-surface">
                        {r.volume >= 1000 ? `${fmtNum(Math.round(r.volume / 100) / 10)}k` : fmtNum(Math.round(r.volume))} <span className="type-label-sm text-on-surface-variant">kg</span>
                      </span>
                    </div>
                    <div>
                      <span className="block type-label-sm text-on-surface-variant uppercase">Series</span>
                      <span className="type-metric-md text-on-surface">{r.sets}</span>
                    </div>
                    <div>
                      <span className="block type-label-sm text-on-surface-variant uppercase">Est.</span>
                      <span className="type-metric-md text-volt">
                        {r.minutes} <span className="type-label-sm text-on-surface-variant">min</span>
                      </span>
                    </div>
                  </div>
                )}

                {r.highlight !== null && (
                  <div className="flex items-center justify-between pt-xs bg-sc-low p-sm rounded-lg">
                    <div className="flex items-center gap-xs">
                      <Icon name={r.highlight.isPr ? 'trophy' : 'check-circle'} size={18} className="text-volt" />
                      <span className="type-body-sm text-on-surface">
                        {r.highlight.isPr ? 'PR' : 'Mejor serie'} {r.highlight.exercise_name}:{' '}
                        <strong className="type-metric-md text-volt">
                          {fmtNum(r.highlight.weight)} kg
                        </strong>
                      </span>
                    </div>
                    <span className="type-label-sm text-on-surface-variant uppercase">RPE {r.highlight.rpe === null ? '—' : fmtNum(r.highlight.rpe)}</span>
                  </div>
                )}

                <div className="flex items-center gap-xs">
                  {r.state === 'today' ? (
                    <>
                      <button className="flex-1 bg-volt text-on-primary-container h-touch rounded-lg flex items-center justify-center gap-xs type-label-md uppercase font-bold tracking-wider press" onClick={() => void onTrain(r.routine)}>
                        <Icon name="play" size={20} />
                        <span>{session != null && session.started_at !== null ? 'Continuar sesión' : 'Iniciar sesión'}</span>
                      </button>
                      <Link to={`/rutinas/${r.routine.id}`} className="w-touch h-touch rounded-lg bg-sc-high text-on-surface flex items-center justify-center" aria-label="Opciones de la rutina">
                        <Icon name="more" size={20} />
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link
                        to={r.state === 'done_today' || r.state === 'done_yesterday' ? (r.highlight !== null ? `/resumen/${r.highlight.session.id}` : `/rutinas/${r.routine.id}`) : `/rutinas/${r.routine.id}`}
                        className="flex-1 bg-sc-high text-on-surface h-touch rounded-lg flex items-center justify-center gap-xs type-label-md uppercase font-semibold tracking-wider press"
                      >
                        <Icon name={r.state === 'done_today' || r.state === 'done_yesterday' ? 'history' : r.state === 'upcoming' ? 'layers' : 'edit'} size={18} />
                        <span>{r.state === 'done_today' || r.state === 'done_yesterday' ? 'Ver resumen' : r.state === 'upcoming' ? 'Detalles' : 'Editar bloque'}</span>
                      </Link>
                      {r.state !== 'done_today' && (
                        <button className="w-touch h-touch rounded-lg bg-sc-high text-volt flex items-center justify-center" aria-label="Entrenar hoy" onClick={() => void onTrain(r.routine)}>
                          <Icon name="play" size={20} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-md pb-lg flex flex-col gap-xs">
            <button className="w-full bg-sc-high text-on-surface h-touch rounded-xl flex items-center justify-center gap-sm px-base type-label-md uppercase font-bold tracking-wider press shadow-sm" onClick={() => void onEmptySession()}>
              <Icon name="bolt" size={20} className="text-volt" />
              <span>Sesión vacía / Freestyle</span>
            </button>
            <Link to="/ajustes" className="w-full text-on-surface-variant h-touch rounded-xl flex items-center justify-center gap-xs px-base type-body-sm">
              <Icon name="sliders" size={18} />
              <span>Ajustes de entrenamiento y equipo</span>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
