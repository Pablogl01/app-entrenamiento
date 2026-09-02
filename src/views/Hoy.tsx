import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { db, getSettings } from '../db/db'
import {
  finishSession,
  reorderPositions,
  saveBodyWeight,
  scheduledRoutineFor,
  startSession,
  syncTodayDraft,
  todaySession,
} from '../db/repo'
import { addDays, todayISO } from '../lib/dates'
import { fmtNum, fmtWeight } from '../lib/format'
import { movingAvg7, type Point } from '../lib/calc'
import { bodyWeightVerdict } from '../lib/verdicts'
import { MaterialHeader, materialFor } from '../components/MaterialHeader'
import { ExerciseCard } from '../components/ExerciseCard'
import { Sparkline } from '../components/charts'
import { useSessionCards } from '../components/useSessionCards'
import { useReorder } from '../components/useReorder'

let draftCreationInFlight = false
let animatedThisAppSession = false

export function Hoy() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const today = todayISO()

  const settings = useLiveQuery(getSettings)
  const routine = useLiveQuery(() => scheduledRoutineFor(today), [today])
  const session = useLiveQuery(todaySession, [today])
  const sessionRoutine = useLiveQuery(
    async () => (session?.routine_id != null ? ((await db.routines.get(session.routine_id)) ?? null) : null),
    [session?.routine_id],
  )
  const metrics = useLiveQuery(async () => {
    const from = addDays(today, -42)
    const rows = await db.body_metrics.filter((m) => m.date >= from).toArray()
    return rows.sort((a, b) => a.date.localeCompare(b.date))
  }, [today])
  const cards = useSessionCards(session?.id)

  // El borrador de hoy sigue a la plantilla mientras no empiece la sesión
  // (proyección, §3.4). Crea, regenera o retira el borrador según toque.
  useEffect(() => {
    if (routine === undefined || session === undefined || draftCreationInFlight) return
    draftCreationInFlight = true
    void syncTodayDraft(routine).finally(() => {
      draftCreationInFlight = false
    })
  }, [routine, session])

  const hasTraining = session != null || routine != null
  const weighedToday = metrics?.some((m) => m.date === today) ?? false
  const hour = new Date().getHours()
  const [openBlock, setOpenBlock] = useState<'weight' | 'train' | null>(null)
  const open =
    openBlock ??
    (params.get('focus') === 'peso' ? 'weight' : !hasTraining ? 'weight' : hour >= 15 || weighedToday ? 'train' : 'weight')

  // Peso
  const yesterdayWeight = metrics?.filter((m) => m.date < today).at(-1)?.weight ?? null
  const todayWeight = metrics?.find((m) => m.date === today)?.weight ?? null
  const [weightText, setWeightText] = useState('')
  const weightInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (open === 'weight' && !weighedToday) weightInputRef.current?.focus()
  }, [open, weighedToday])

  function commitWeight() {
    const n = Number(weightText.replace(',', '.'))
    if (Number.isFinite(n) && n > 20 && n < 400) {
      void saveBodyWeight(today, n)
      setWeightText('')
    }
  }

  // Entreno
  const [openCard, setOpenCard] = useState<string | null>(null)
  const started = session?.started_at != null
  const finished = session?.finished_at != null
  const cardList = cards ?? []
  const firstIncomplete = cardList.find((c) => c.sets.some((s) => !s.completed))?.se.id ?? null
  const activeCardId = openCard ?? firstIncomplete
  const { handlers, dragIndex } = useReorder(cardList.length, (from, to) => {
    const ids = cardList.map((c) => c.se.id)
    const [moved] = ids.splice(from, 1)
    ids.splice(to, 0, moved)
    void reorderPositions('session_exercises', ids)
  })

  const totalWork = cardList.flatMap((c) => c.sets.filter((s) => s.kind !== 'warmup')).length
  const doneWork = cardList.flatMap((c) => c.sets.filter((s) => s.kind !== 'warmup' && s.completed)).length

  async function onCta() {
    if (!session) return
    if (!started) {
      await startSession(session.id)
    } else if (!finished) {
      await finishSession(session.id)
      navigate(`/resumen/${session.id}`)
    }
  }

  if (settings === undefined || session === undefined || routine === undefined) return null

  const unit = settings.unit
  const dots: Point[] = (metrics ?? []).map((m) => ({ date: m.date, value: m.weight }))
  const ma = movingAvg7(dots)
  const routineType = sessionRoutine?.routine_type ?? routine?.routine_type ?? null
  const trainingName = session?.routine_name_snapshot ?? routine?.name ?? ''
  const anim = !animatedThisAppSession
  if (anim) animatedThisAppSession = true

  return (
    <div className="screen">
      {hasTraining ? (
        <MaterialHeader
          material={materialFor(routineType, session?.routine_id ?? routine?.id ?? '')}
          eyebrow="Día de entreno"
          title={trainingName}
          minHeight={Math.max(240, Math.round(window.innerHeight * 0.34))}
          animate={anim}
        />
      ) : (
        <MaterialHeader material="neutral" quietTitle="Día de descanso" minHeight={160} animate={anim} />
      )}

      <div className={`sheet${anim ? ' anim-enter' : ''}`}>
        {/* ---- Bloque de peso ---- */}
        {open === 'weight' || !hasTraining ? (
          <section>
            <h2 className="t-title">Peso de hoy</h2>
            <div className="field" style={{ marginTop: 'var(--sp-3)' }}>
              <input
                ref={weightInputRef}
                inputMode="decimal"
                aria-label="Peso de hoy"
                placeholder={
                  todayWeight !== null
                    ? fmtNum(todayWeight)
                    : yesterdayWeight !== null
                      ? `${fmtNum(yesterdayWeight)} ayer`
                      : 'primer pesaje'
                }
                value={weightText}
                onChange={(e) => setWeightText(e.target.value)}
                onBlur={commitWeight}
                onKeyDown={(e) => e.key === 'Enter' && commitWeight()}
                className="t-datalg"
              />
              <span className="t-data soft">{unit}</span>
            </div>
            {dots.length > 0 && (
              <div style={{ marginTop: 'var(--sp-4)' }}>
                <Sparkline dots={dots} ma={ma} ariaLabel="Peso de las últimas semanas" />
              </div>
            )}
            <p className="t-body" style={{ marginTop: 'var(--sp-3)' }}>
              {bodyWeightVerdict(dots)}
            </p>
          </section>
        ) : (
          <button className="row row--closed" onClick={() => setOpenBlock('weight')}>
            <span className="row__main">
              <span className="t-item">Peso de hoy</span>
              <span className="t-data soft" style={{ display: 'block', marginTop: 4 }}>
                {todayWeight !== null
                  ? fmtWeight(todayWeight, unit)
                  : `sin registrar${yesterdayWeight !== null ? ` · ${fmtWeight(yesterdayWeight, unit)} ayer` : ''}`}
              </span>
            </span>
            <span className="row__chev">⌄</span>
          </button>
        )}

        {/* ---- Bloque de entreno ---- */}
        {hasTraining &&
          (open === 'train' ? (
            <section className={anim ? 'hoy-stagger' : undefined} style={{ marginTop: 'var(--sp-6)' }}>
              {cardList.map((c, i) => (
                <ExerciseCard
                  key={c.se.id}
                  data={c}
                  open={activeCardId === c.se.id}
                  onToggle={() => setOpenCard(activeCardId === c.se.id ? '' : c.se.id)}
                  active={!finished}
                  unit={unit}
                  dragging={dragIndex === i}
                  dragHandlers={!finished ? handlers(i) : undefined}
                />
              ))}
              {!finished && session && (
                <Link to={`/catalogo?session=${session.id}`} className="btn-text" style={{ textDecoration: 'none', color: 'var(--ink)' }}>
                  Añadir ejercicio
                </Link>
              )}
              <div style={{ marginTop: 'var(--sp-5)' }}>
                {session && !finished && (
                  <button className={started ? 'btn-cta btn-cta--go' : 'btn-cta'} onClick={() => void onCta()}>
                    {started ? 'Finalizar sesión' : 'Empezar sesión'}
                  </button>
                )}
                {session && finished && (
                  <Link to={`/resumen/${session.id}`} className="btn-text" style={{ textDecoration: 'none', color: 'var(--ink)' }}>
                    Ver el resumen de la sesión
                  </Link>
                )}
              </div>
            </section>
          ) : (
            <button className="row row--closed" style={{ marginTop: 'var(--sp-6)' }} onClick={() => setOpenBlock('train')}>
              <span className="row__main">
                <span className="t-item">Entreno de hoy</span>
                <span className="t-data soft" style={{ display: 'block', marginTop: 4 }}>
                  {finished
                    ? `hecho · ${doneWork} series`
                    : `${cardList.length} ejercicios · ${doneWork}/${totalWork} series`}
                </span>
              </span>
              <span className="row__chev">⌄</span>
            </button>
          ))}
      </div>
    </div>
  )
}
