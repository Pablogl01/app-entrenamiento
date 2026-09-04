import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate } from 'react-router-dom'
import { db, getSettings } from '../db/db'
import {
  addSet,
  cancelStart,
  cycleState,
  deleteSession,
  elapsedMs,
  finishSession,
  lastPerformance,
  moveAfter,
  pauseSession,
  reorderPositions,
  resumeSession,
  startSession,
  todaySession,
} from '../db/repo'
import { todayISO } from '../lib/dates'
import { fmtNum } from '../lib/format'
import { platesPerSide } from '../lib/plates'
import { addRest, skipRest, startRest, useRest } from '../lib/rest'
import { fmtClock, useNow } from '../lib/useNow'
import { TopBar } from '../components/TopBar'
import { MoveSheet } from '../components/MoveSheet'
import { Icon } from '../components/Icon'
import { SetTable } from '../components/SetTable'
import { useReorder } from '../components/useReorder'
import { useSessionCards } from '../components/useSessionCards'
import type { CardData } from '../components/ExerciseCard'
import type { LoadType, MuscleGroup } from '../db/types'

const LOAD_LABEL: Record<LoadType, string> = {
  barbell: 'Barra olímpica',
  dumbbell: 'Mancuernas',
  machine: 'Máquina',
  cable: 'Polea',
  bodyweight: 'Corporal',
}

const GROUP_LABEL: Record<MuscleGroup, string> = {
  pecho: 'Pectoral', espalda: 'Espalda', hombro: 'Hombro', biceps: 'Bíceps', triceps: 'Tríceps',
  cuadriceps: 'Cuádriceps', femoral: 'Femoral', gluteo: 'Glúteo', gemelo: 'Gemelo', core: 'Core',
}

const RPE_SCALE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

function isDone(c: CardData): boolean {
  return c.sets.length > 0 && c.sets.every((s) => s.completed)
}

function restLabel(seconds: number): string {
  return seconds % 60 === 0 ? `${seconds / 60} min` : `${fmtNum(Math.round((seconds / 60) * 10) / 10)} min`
}

/** Temporizador de descanso, calcado del widget de la maqueta. */
function RestTimer() {
  const rest = useRest()
  if (!rest.active) return null
  const pct = rest.totalSeconds === 0 ? 100 : Math.round(((rest.totalSeconds - rest.remainingSeconds) / rest.totalSeconds) * 100)
  const mm = String(Math.floor(rest.remainingSeconds / 60)).padStart(2, '0')
  const ss = String(rest.remainingSeconds % 60).padStart(2, '0')
  return (
    <div className="px-gutter mb-md enter-soft">
      <div className="bg-sc rounded-xl p-md shadow-md flex items-center justify-between gap-sm" aria-label="Descanso" aria-live="polite">
        <div className="flex items-center gap-md min-w-0">
          <div className="relative flex items-center justify-center w-11 h-11 rounded-lg bg-sc-highest">
            <svg className="w-10 h-10" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" strokeWidth={3} style={{ stroke: 'var(--md-bright)' }} />
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                strokeWidth={3}
                strokeLinecap="round"
                strokeDasharray={`${pct}, 100`}
                style={{ stroke: 'var(--md-primary-fixed)' }}
              />
            </svg>
            <Icon name="clock" size={18} className="absolute text-volt" />
          </div>
          <div>
            <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
              <span className="type-label-sm uppercase tracking-wider text-outline nowrap">Descanso sugerido</span>
              {rest.rpeTarget !== null && <span className="type-label-sm px-1p5 py-0p5 rounded bg-volt-10 text-volt font-semibold nowrap">RPE {fmtNum(rest.rpeTarget)}</span>}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="type-metric-md text-on-surface font-semibold">
                {mm}:{ss}
              </span>
              <span className="type-label-sm text-secondary">restantes</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-xs">
          <button className="h-9 px-3 rounded-lg bg-sc-high text-on-surface type-label-sm press press-95" onClick={() => addRest(30)}>
            +30s
          </button>
          <button className="h-9 px-3 rounded-lg bg-sc-highest text-secondary-fixed-dim type-label-sm press press-95" onClick={skipRest}>
            Saltar
          </button>
        </div>
      </div>
    </div>
  )
}

export function Entrenar() {
  const navigate = useNavigate()
  const today = todayISO()
  const settings = useLiveQuery(getSettings)
  const session = useLiveQuery(todaySession, [today])
  const cards = useSessionCards(session?.id)
  const cycle = useLiveQuery(() => cycleState(), [])
  const [menuOpen, setMenuOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [platesOpen, setPlatesOpen] = useState(false)
  const [chosenId, setChosenId] = useState<string | null>(null)
  const [moving, setMoving] = useState(false)

  const started = session?.started_at != null
  const finished = session?.finished_at != null
  const live = started && !finished
  const paused = live && session.paused_at !== null
  const now = useNow(live && !paused)

  const list = cards ?? []
  const pending = list.filter((c) => !isDone(c))
  const current = pending.find((c) => c.se.id === chosenId) ?? pending[0] ?? null
  const queue = pending.filter((c) => c !== current)
  const next = queue[0] ?? null
  const done = list.filter(isDone)

  const past = useLiveQuery(() => (current ? lastPerformance(current.exercise.id) : Promise.resolve([])), [current?.exercise.id]) ?? []

  const { handlers, dragIndex } = useReorder(queue.length, (from, to) => {
    if (!session) return
    const q = queue.map((c) => c.se.id)
    const [moved] = q.splice(from, 1)
    q.splice(to, 0, moved)
    let qi = 0
    const full = list.map((c) => (queue.includes(c) ? q[qi++] : c.se.id))
    void reorderPositions('session_exercises', full)
  })

  if (settings === undefined || session === undefined || cards === undefined) return null

  if (session === null) {
    return (
      <div className="screen screen--stacked">
        <TopBar title="Active Session" />
        <div className="px-gutter flex flex-col gap-md">
          <p className="type-body-md text-secondary">No hay ninguna sesión hoy. Se empieza desde Rutinas.</p>
          <Link to="/rutinas" className="h-touch rounded-lg bg-sc-high text-on-surface type-label-md font-semibold uppercase tracking-wider flex items-center justify-center">
            Ir a Rutinas
          </Link>
        </div>
      </div>
    )
  }

  const unit = settings.unit
  const totalWork = list.flatMap((c) => c.sets.filter((s) => s.kind !== 'warmup')).length
  const doneWork = list.flatMap((c) => c.sets.filter((s) => s.kind !== 'warmup' && s.completed)).length
  const pct = totalWork === 0 ? 0 : Math.round((doneWork / totalWork) * 100)
  const allDone = totalWork > 0 && doneWork === totalWork
  const currentIdx = current ? list.indexOf(current) : -1
  const prevId = currentIdx > 0 ? list[currentIdx - 1].se.id : null

  const top = past[0]
  const activeSet = current?.sets.filter((s) => !s.completed).sort((a, b) => a.set_index - b.set_index)[0] ?? null
  const plateWeight = activeSet?.weight ?? top?.weight ?? null
  const stack = current?.exercise.load_type === 'barbell' && plateWeight !== null ? platesPerSide(plateWeight, settings.bar_weight, settings.plates) : null

  async function onStart() {
    await startSession(session!.id)
  }

  async function onFinish() {
    skipRest()
    await finishSession(session!.id)
    navigate(`/resumen/${session!.id}`)
  }

  /** Iniciada sin querer y sin ninguna serie hecha: vuelve a borrador y a Hoy. Sin confirmar: no se pierde nada. */
  async function onCancelStart() {
    skipRest()
    await cancelStart(session!.id)
    navigate('/')
  }

  async function onDiscard() {
    if (!window.confirm('¿Descartar la sesión de hoy? Se borran las series registradas.')) return
    skipRest()
    await deleteSession(session!.id)
    navigate('/')
  }

  function onSetConfirmed(rest: number, rpe: number | null) {
    if (live) startRest(rest, rpe)
  }

  return (
    <div className="screen screen--stacked">
      <TopBar title="Active Session" />
      <div className="flex flex-col w-full pb-10">
        {/* Top Session Telemetry Banner */}
        <div className="px-gutter pt-xs pb-sm">
          <div className={`bg-sc-low rounded-xl p-md shadow-sm${live ? ' border-volt-30' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-sm">
                <div className={`w-2 h-2 rounded-full bg-volt${live && !paused ? ' pulse' : ''}`} />
                <span className="type-label-md uppercase tracking-wider text-secondary">
                  {finished ? 'Sesión hecha' : paused ? 'En pausa' : live ? 'Sesión en curso' : 'Previa'}
                </span>
              </div>
              <div className="flex items-center gap-xs">
                {live && (
                  <button className="w-touch h-8 ibtn rounded-lg bg-sc-high" aria-label={paused ? 'Reanudar' : 'Pausar'} onClick={() => void (paused ? resumeSession(session.id) : pauseSession(session.id))}>
                    <Icon name={paused ? 'play' : 'pause'} size={18} />
                  </button>
                )}
                <button className="w-touch h-8 ibtn rounded-lg bg-sc-high" aria-label="Más opciones" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
                  <Icon name="more" size={18} />
                </button>
              </div>
            </div>
            <div className="flex items-baseline justify-between mt-xs gap-sm">
              <div className="min-w-0">
                <h1 className="type-display-sm text-primary uppercase font-extrabold" style={{ letterSpacing: '-0.03em' }}>
                  {session.routine_name_snapshot}
                </h1>
                <p className="type-label-sm text-secondary-fixed-dim uppercase tracking-widest mt-0p5">
                  {cycle ? `Semana ${cycle.week} · ${cycle.block?.name ?? 'Fuera de bloque'}` : session.routine_id !== null ? 'Sesión de plantilla' : 'Sesión libre'}
                </p>
              </div>
              <div className="text-right flex-none">
                <span className="type-metric-xl text-primary tracking-tight">{fmtClock(elapsedMs(session, now))}</span>
                <span className="block type-label-sm text-outline uppercase tracking-wider">Duración</span>
              </div>
            </div>
            <div className="mt-md">
              <div className="flex justify-between items-center mb-xxs">
                <span className="type-label-sm text-secondary uppercase">Progreso total</span>
                <span className="type-label-md text-volt font-semibold uppercase">
                  {doneWork} / {totalWork} series ({pct}%)
                </span>
              </div>
              <div className="w-full h-1p5 bg-sc-highest rounded-full overflow-hidden" role="progressbar" aria-valuenow={doneWork} aria-valuemax={totalWork}>
                <div className="progress__fill" style={{ transform: `scaleX(${pct / 100})` }} />
              </div>
            </div>
            {!started && (
              <button className="w-full h-touch rounded-lg bg-volt text-on-volt type-label-md font-bold uppercase tracking-wider flex items-center justify-center gap-sm press mt-md shadow-md" onClick={() => void onStart()}>
                <Icon name="play" size={20} />
                <span>Iniciar sesión</span>
              </button>
            )}
            {menuOpen && (
              <div className="mt-md rounded-lg bg-sc-high flex flex-col enter-menu">
                {live && doneWork === 0 && (
                  <button className="h-touch px-md flex items-center gap-sm type-label-md uppercase tracking-wider text-on-surface" onClick={() => void onCancelStart()}>
                    <Icon name="close" size={18} />
                    Cancelar inicio
                  </button>
                )}
                {!started && session.routine_id !== null && doneWork === 0 && (
                  <button
                    className="h-touch px-md flex items-center gap-sm type-label-md uppercase tracking-wider text-on-surface"
                    onClick={() => {
                      setMoving(true)
                      setMenuOpen(false)
                    }}
                  >
                    <Icon name="calendar" size={18} />
                    Mover a otro día
                  </button>
                )}
                <Link to={`/catalogo?session=${session.id}`} className="h-touch px-md flex items-center gap-sm type-label-md uppercase tracking-wider text-on-surface">
                  <Icon name="add-circle" size={18} />
                  Añadir ejercicio
                </Link>
                <button
                  className="h-touch px-md flex items-center gap-sm type-label-md uppercase tracking-wider text-on-surface"
                  onClick={() => {
                    setNotesOpen(true)
                    setMenuOpen(false)
                  }}
                >
                  <Icon name="note" size={18} />
                  Notas / RPE
                </button>
                <button className="h-touch px-md flex items-center gap-sm type-label-md uppercase tracking-wider text-error" onClick={() => void onDiscard()}>
                  <Icon name="trash" size={18} />
                  Descartar sesión
                </button>
              </div>
            )}
          </div>
        </div>

        <RestTimer />

        {moving && session.routine_id !== null && (
          <MoveSheet routineId={session.routine_id} routineName={session.routine_name_snapshot} fromDate={today} onClose={() => setMoving(false)} onDone={() => navigate('/')} />
        )}

        <div className="px-gutter flex flex-col gap-md">
          {/* Primary Active Exercise Card */}
          {current !== null && (
            <div className="bg-sc rounded-xl overflow-hidden shadow-md" aria-label="Ejercicio en curso">
              <div className="p-base bg-sc-high">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-xs mb-1">
                      <span className="type-label-sm uppercase tracking-widest text-volt bg-sc-lowest px-2 py-0p5 rounded">Serie principal</span>
                      <span className="type-label-sm text-secondary">
                        {currentIdx + 1} de {list.length} ejercicios
                      </span>
                    </div>
                    <h2 className="type-headline-md text-primary font-bold tracking-tight">
                      <Link to={`/ejercicio/${current.exercise.id}`}>{current.exercise.name}</Link>
                    </h2>
                    <p className="type-body-sm text-secondary-fixed-dim mt-0p5">
                      {LOAD_LABEL[current.exercise.load_type]} · {current.sets.filter((s) => s.kind !== 'warmup').length} series de trabajo · Descanso {restLabel(current.se.rest_seconds)}
                    </p>
                  </div>
                  {current.exercise.load_type === 'barbell' && (
                    <button className="w-touch h-touch -mr-2 -mt-2 ibtn text-secondary flex-none" aria-label="Calculadora de discos" aria-expanded={platesOpen} onClick={() => setPlatesOpen((v) => !v)}>
                      <Icon name="ruler" size={24} />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-sm mt-sm overflow-x-auto py-1 hscroll">
                  <div className="bg-sc-lowest px-2p5 py-1 rounded flex items-center gap-1p5 flex-none">
                    <Icon name="sliders" size={14} className="text-outline" />
                    <span className="type-label-sm text-secondary uppercase">Target:</span>
                    <span className="type-label-sm text-on-surface font-semibold nowrap">
                      {top?.weight != null ? `${fmtNum(top.weight)} ${unit}` : '—'} × {current.se.target_reps_min}-{current.se.target_reps_max}
                    </span>
                  </div>
                  <div className="bg-sc-lowest px-2p5 py-1 rounded flex items-center gap-1p5 flex-none">
                    <Icon name="gauge" size={14} className="text-volt" />
                    <span className="type-label-sm text-secondary uppercase">RPE meta:</span>
                    <span className="type-label-sm text-volt font-semibold">{current.se.target_rpe === null ? '—' : fmtNum(current.se.target_rpe)}</span>
                  </div>
                  <div className="bg-sc-lowest px-2p5 py-1 rounded flex items-center gap-1p5 flex-none">
                    <Icon name="history" size={14} className="text-outline" />
                    <span className="type-label-sm text-secondary uppercase">Ant:</span>
                    <span className="type-label-sm text-on-surface font-semibold nowrap">{top ? `${top.weight === null ? '—' : fmtNum(top.weight)} ${unit} × ${top.reps}` : '—'}</span>
                  </div>
                </div>
              </div>

              <div className="p-base flex flex-col gap-xs">
                <SetTable
                  se={current.se}
                  exercise={current.exercise}
                  sets={current.sets}
                  past={past}
                  active={!finished}
                  unit={unit}
                  hideFoot
                  onSetConfirmed={() => onSetConfirmed(current.se.rest_seconds, current.se.target_rpe)}
                />

                {platesOpen && current.exercise.load_type === 'barbell' && (
                  <div className="bg-sc-lowest rounded-lg p-2p5 enter-panel">
                    <div className="flex justify-between items-center type-label-sm text-outline uppercase tracking-wider">
                      <span>Discos por lado</span>
                      <span>
                        Barra {fmtNum(settings.bar_weight)} {unit}
                      </span>
                    </div>
                    {stack === null ? (
                      <p className="type-body-sm text-secondary mt-1">Con {plateWeight === null ? 'esa carga' : `${fmtNum(plateWeight)} ${unit}`} no hace falta cargar la barra.</p>
                    ) : (
                      <div className="flex items-center gap-sm mt-sm overflow-x-auto hscroll">
                        {stack.plates.map((p) => (
                          <span key={p.plate} className="bg-sc-high rounded px-2p5 py-1 text-center flex-none">
                            <span className="block type-metric-md text-on-surface">{fmtNum(p.plate)}</span>
                            <span className="block type-label-sm text-outline">× {p.count}</span>
                          </span>
                        ))}
                        {stack.remainder > 0 && (
                          <span className="type-label-sm text-outline">
                            faltan {fmtNum(stack.remainder)} {unit}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-xs px-1">
                  {current.exercise.load_type === 'barbell' && stack !== null ? (
                    <button className="flex items-center gap-1p5 text-secondary type-label-sm press" onClick={() => setPlatesOpen((v) => !v)}>
                      <Icon name="calculator" size={16} />
                      <span>
                        Calculadora de discos ({fmtNum(stack.perSide)} {unit} / lado)
                      </span>
                    </button>
                  ) : (
                    <button className="flex items-center gap-1p5 text-secondary type-label-sm press" onClick={() => void addSet(current.se.id, 'warmup')}>
                      <Icon name="flame" size={16} />
                      <span>Calentamiento</span>
                    </button>
                  )}
                  <button className="flex items-center gap-1 text-secondary type-label-sm press" onClick={() => void addSet(current.se.id, 'work')}>
                    <Icon name="plus" size={16} />
                    <span>Añadir serie</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {current === null && list.length > 0 && (
            <div className="bg-sc rounded-xl p-md shadow-sm flex items-center gap-md border-volt-30">
              <div className="w-10 h-10 rounded-lg bg-volt text-on-volt flex items-center justify-center flex-none">
                <Icon name="check-all" size={20} />
              </div>
              <div>
                <h3 className="type-headline-sm text-on-surface font-semibold tracking-tight">Todas las series hechas</h3>
                <p className="type-body-sm text-secondary-fixed-dim">Finaliza para ver el resumen, o añade otro ejercicio.</p>
              </div>
            </div>
          )}

          {/* Next Up in Session Queue */}
          {next !== null && (
            <div className="bg-sc rounded-xl p-md shadow-sm">
              <div className="flex items-center justify-between mb-xs">
                <div className="flex items-center gap-xs">
                  <Icon name="next-plan" size={18} className="text-secondary" />
                  <span className="type-label-sm uppercase tracking-wider text-secondary">Siguiente en cola</span>
                </div>
                <span className="type-label-sm text-volt bg-sc-highest px-2 py-0p5 rounded font-semibold uppercase">{next.se.target_sets} series</span>
              </div>
              <div className="flex items-center justify-between pt-1 gap-sm">
                <div className="min-w-0">
                  <h3 className="type-headline-sm text-on-surface font-semibold tracking-tight">{next.exercise.name}</h3>
                  <NextLine card={next} unit={unit} />
                </div>
                <button className="w-10 h-10 rounded-lg bg-sc-high ibtn flex-none" aria-label="Hacer este ahora" onClick={() => void moveAfter(session.id, next.se.id, prevId).then(() => setChosenId(null))}>
                  <Icon name="swap" size={20} />
                </button>
              </div>
            </div>
          )}

          {queue.slice(1).map((c, i) => (
            <div key={c.se.id} className={`bg-sc-low rounded-xl p-md opacity-85 flex items-center justify-between${dragIndex === i + 1 ? ' dragging' : ''}`} {...handlers(i + 1)}>
              <button className="flex items-center gap-md text-left min-w-0" onClick={() => setChosenId(c.se.id)}>
                <div className="w-8 h-8 rounded bg-sc-highest flex items-center justify-center type-label-sm text-outline font-bold flex-none">{currentIdx + 3 + i}</div>
                <div className="min-w-0">
                  <h4 className="type-body-lg text-on-surface font-semibold truncate">{c.exercise.name}</h4>
                  <span className="type-label-sm text-outline">
                    {GROUP_LABEL[c.exercise.muscle_group]} · {c.se.target_sets} series de {c.se.target_reps_min}-{c.se.target_reps_max}
                  </span>
                </div>
              </button>
              <Icon name="grip" size={20} className="text-outline flex-none" style={{ touchAction: 'none' }} />
            </div>
          ))}

          {done.map((c) => (
            <div key={c.se.id} className="bg-sc-low rounded-xl p-md opacity-70 flex items-center justify-between">
              <div className="flex items-center gap-md min-w-0">
                <div className="w-8 h-8 rounded bg-volt text-on-volt flex items-center justify-center flex-none">
                  <Icon name="check" size={18} strokeWidth={2.5} />
                </div>
                <div className="min-w-0">
                  <h4 className="type-body-lg text-on-surface font-semibold truncate">{c.exercise.name}</h4>
                  <span className="type-label-sm text-outline">{c.sets.filter((s) => s.kind !== 'warmup').length} series hechas</span>
                </div>
              </div>
              <button className="type-label-sm text-secondary uppercase press flex-none" onClick={() => void addSet(c.se.id, 'work')}>
                + serie
              </button>
            </div>
          ))}

          {notesOpen && (
            <div className="bg-sc rounded-xl p-md shadow-sm flex flex-col gap-sm enter-panel" aria-label="Notas y RPE">
              <div className="flex items-center justify-between">
                <span className="type-label-sm uppercase tracking-wider text-secondary">Esfuerzo percibido (RPE global)</span>
                <span className="type-metric-md text-volt">{session.rating === null ? '—' : `${session.rating} / 10`}</span>
              </div>
              <div className="grid grid-cols-5 gap-sm">
                {RPE_SCALE.map((n) => (
                  <button
                    key={n}
                    className={`h-9 rounded type-label-sm font-bold text-center flex items-center justify-center press${session.rating === n ? ' bg-volt text-on-volt' : ' bg-sc-high text-secondary'}`}
                    aria-pressed={session.rating === n}
                    onClick={() => void db.sessions.update(session.id, { rating: n })}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <span className="type-label-sm uppercase tracking-wider text-secondary mt-xs">Notas de biomecánica y estado físico</span>
              <textarea
                className="w-full bg-sc-lowest rounded-lg p-md type-body-md text-on-surface"
                style={{ minHeight: 88, border: 'none', outline: 'none', resize: 'vertical' }}
                aria-label="Notas de la sesión"
                placeholder="hombro derecho estable en los fondos con lastre"
                defaultValue={session.notes}
                onBlur={(e) => void db.sessions.update(session.id, { notes: e.target.value })}
              />
              <button className="type-label-sm text-secondary uppercase tracking-wider press" onClick={() => setNotesOpen(false)}>
                Cerrar notas
              </button>
            </div>
          )}
        </div>

        {/* Bottom actions */}
        <div className="mt-lg px-gutter flex flex-col gap-sm">
          {!finished ? (
            <>
              <div className="grid grid-cols-2 gap-sm">
                <Link to={`/catalogo?session=${session.id}`} className="h-touch rounded-lg bg-sc-high text-on-surface type-label-md font-semibold uppercase tracking-wider flex items-center justify-center gap-xs press">
                  <Icon name="add-circle" size={18} />
                  <span>Añadir ejercicio</span>
                </Link>
                <button className="h-touch rounded-lg bg-sc-high text-on-surface type-label-md font-semibold uppercase tracking-wider flex items-center justify-center gap-xs press" onClick={() => setNotesOpen((v) => !v)}>
                  <Icon name="note" size={18} />
                  <span>Notas / RPE</span>
                </button>
              </div>
              {started && (
                <button
                  className={`w-full h-touch rounded-lg type-label-md font-bold uppercase tracking-widest flex items-center justify-center gap-xs press shadow-sm finish-cta${allDone ? ' bg-volt text-on-volt' : ' bg-sc-highest text-secondary-fixed'}`}
                  onClick={() => void onFinish()}
                >
                  <Icon name="flag" size={20} />
                  <span>Finalizar entrenamiento</span>
                </button>
              )}
            </>
          ) : (
            <Link to={`/resumen/${session.id}`} className="w-full h-touch rounded-lg bg-volt text-on-volt type-label-md font-bold uppercase tracking-widest flex items-center justify-center gap-xs press">
              Ver resumen
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

function NextLine({ card, unit }: { card: CardData; unit: string }) {
  const past = useLiveQuery(() => lastPerformance(card.exercise.id), [card.exercise.id]) ?? []
  const top = past[0]
  return (
    <p className="type-body-sm text-secondary-fixed-dim">
      Carga proyectada: {top?.weight != null ? `${fmtNum(top.weight)} ${unit}` : '—'}
      {card.se.target_rpe !== null && ` · RPE ${fmtNum(card.se.target_rpe)}`}
    </p>
  )
}
