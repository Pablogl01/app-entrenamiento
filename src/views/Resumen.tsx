import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { db, getSettings } from '../db/db'
import { recoveryWindowHours, reopenSession, saveSessionAsRoutine, scheduledOn, sessionStats } from '../db/repo'
import { setE1rm, setVolume } from '../lib/calc'
import { addDays, todayISO, weekdayMon0 } from '../lib/dates'
import { fmtDateShort, fmtNum } from '../lib/format'
import { useNow } from '../lib/useNow'
import { TopBar } from '../components/TopBar'
import { Icon } from '../components/Icon'
import { useSessionCards } from '../components/useSessionCards'

const HITOS = ['', 'Un hito alcanzado', 'Dos hitos alcanzados', 'Tres hitos alcanzados', 'Cuatro hitos alcanzados', 'Cinco hitos alcanzados']
const RPE_SCALE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const WEEKDAY_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

const GROUP_LABEL: Record<string, string> = {
  pecho: 'Pectoral', espalda: 'Espalda', hombro: 'Hombro', biceps: 'Bíceps', triceps: 'Tríceps',
  cuadriceps: 'Cuádriceps', femoral: 'Femoral', gluteo: 'Glúteo', gemelo: 'Gemelo', core: 'Core',
}

function rpeBand(rpe: number): string {
  if (rpe < 7.5) return 'Sesión suave'
  if (rpe <= 9) return 'Intensidad óptima'
  return 'Al límite'
}

export function Resumen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [templateName, setTemplateName] = useState('')
  const [saved, setSaved] = useState(false)
  const now = useNow(true)

  const settings = useLiveQuery(getSettings)
  const session = useLiveQuery(async () => (id !== undefined ? ((await db.sessions.get(id)) ?? null) : null), [id])
  const stats = useLiveQuery(async () => (id !== undefined ? sessionStats(id) : null), [id])
  const cards = useSessionCards(session?.id)
  const context = useLiveQuery(async () => {
    if (!session) return null
    const finished = (await db.sessions.toArray()).filter((s) => s.finished_at !== null)
    const ordinal = finished.filter((s) => s.date < session.date || (s.date === session.date && (s.finished_at ?? 0) <= (session.finished_at ?? 0))).length
    let prevVolume: number | null = null
    let nextDate: string | null = null
    if (session.routine_id !== null) {
      const prev = finished
        .filter((s) => s.routine_id === session.routine_id && s.id !== session.id && s.date <= session.date)
        .sort((a, b) => b.date.localeCompare(a.date))[0]
      if (prev) prevVolume = (await sessionStats(prev.id)).volume
      for (let i = 1; i <= 14; i++) {
        const iso = addDays(session.date, i)
        if ((await scheduledOn(iso)).some((r) => r.id === session.routine_id)) {
          nextDate = iso
          break
        }
      }
    }
    return { ordinal, prevVolume, nextDate }
  }, [session?.id, session?.finished_at])

  if (settings === undefined || session === undefined || session === null || stats == null) return null

  const unit = settings.unit
  const prs = stats.prs
  const list = (cards ?? []).filter((c) => c.sets.some((s) => s.completed && s.kind !== 'warmup'))
  const finishedAt = session.finished_at !== null ? new Date(session.finished_at) : null
  const time = finishedAt === null ? '' : `${String(finishedAt.getHours()).padStart(2, '0')}:${String(finishedAt.getMinutes()).padStart(2, '0')}`
  const volDelta = context?.prevVolume != null ? stats.volume - context.prevVolume : null
  const planned = session.planned_sets ?? stats.done_sets
  const adherence = planned === 0 ? 100 : Math.round((stats.done_sets / planned) * 100)
  const windowH = recoveryWindowHours(session.rating ?? stats.rpe_avg)
  const recoveryPct = session.finished_at === null ? 0 : Math.min(100, Math.round(((now - session.finished_at) / (windowH * 3_600_000)) * 100))
  const synced = settings.last_backup_at !== null && session.finished_at !== null && settings.last_backup_at >= session.finished_at - 60_000

  async function onSaveTemplate() {
    if (!session) return
    const name = templateName.trim()
    if (name === '') return
    await saveSessionAsRoutine(session.id, name.slice(0, 24))
    setSaved(true)
  }

  return (
    <div className="screen screen--stacked" style={{ paddingBottom: 0 }}>
      <TopBar title="Session Summary" />
      <div className="flex flex-col w-full pb-10">
        {/* Celebration Hero Status */}
        <section className="px-gutter pt-md pb-lg flex flex-col gap-xs">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-xs px-sm py-0p5 rounded-full bg-sc-high text-volt">
              <span className="w-1p5 h-1p5 rounded-full bg-volt ping" />
              <span className="type-label-sm uppercase tracking-wider font-semibold">{adherence}% adherencia</span>
            </div>
            <span className="type-label-sm text-secondary tracking-widest uppercase">Registro #{String(context?.ordinal ?? 0).padStart(3, '0')}</span>
          </div>
          <div className="mt-xs flex flex-col">
            <span className="type-display-sm text-on-surface uppercase font-extrabold" style={{ letterSpacing: '-0.03em' }}>
              Sesión completada
            </span>
            <p className="type-body-md text-secondary">
              {session.routine_name_snapshot}
              {time !== '' && ` · ${session.date === todayISO() ? 'Hoy' : fmtDateShort(session.date)}, ${time}`}
            </p>
          </div>
        </section>

        {/* Key Metric Bento Grid */}
        <section className="px-gutter mb-lg">
          <div className="grid grid-cols-2 gap-sm">
            <div className="bg-sc-low p-md rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-secondary">
                <span className="type-label-sm uppercase tracking-wider">Duración</span>
                <Icon name="clock" size={18} />
              </div>
              <div className="mt-md flex items-baseline gap-xxs">
                <span className="type-metric-xl text-on-surface font-bold">{stats.duration_ms === null ? '—' : Math.round(stats.duration_ms / 60_000)}</span>
                <span className="type-label-md text-secondary uppercase font-bold">min</span>
              </div>
              <span className="type-body-sm text-on-surface-variant mt-xs">{stats.avg_rest_ms === null ? 'Descansos: sin datos' : `Descansos: ~${Math.round(stats.avg_rest_ms / 1000)}s`}</span>
            </div>
            <div className="bg-sc-low p-md rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-secondary">
                <span className="type-label-sm uppercase tracking-wider">Volumen carga</span>
                <Icon name="dumbbell" size={18} />
              </div>
              <div className="mt-md flex items-baseline gap-xxs">
                <span className="type-metric-xl text-on-surface font-bold">{fmtNum(Math.round(stats.volume))}</span>
                <span className="type-label-md text-secondary uppercase font-bold">{unit}</span>
              </div>
              {volDelta !== null ? (
                <div className={`flex items-center gap-xxs mt-xs ${volDelta >= 0 ? 'text-volt' : 'text-secondary'}`}>
                  <Icon name={volDelta >= 0 ? 'trending' : 'trending-down'} size={14} />
                  <span className="type-label-sm font-semibold">
                    {volDelta >= 0 ? '+' : '−'}
                    {fmtNum(Math.round(Math.abs(volDelta)))} {unit} vs ses. ant.
                  </span>
                </div>
              ) : (
                <span className="type-body-sm text-secondary mt-xs">Primera sesión de esta rutina</span>
              )}
            </div>
            <div className="bg-sc-low p-md rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-secondary">
                <span className="type-label-sm uppercase tracking-wider">Series válidas</span>
                <Icon name="check-all" size={18} />
              </div>
              <div className="mt-md flex items-baseline gap-xxs">
                <span className="type-metric-xl text-on-surface font-bold">{stats.done_sets}</span>
                <span className="type-label-md text-secondary">/ {planned}</span>
              </div>
              <span className="type-body-sm text-secondary mt-xs">
                {list.length} {list.length === 1 ? 'ejercicio ejecutado' : 'ejercicios ejecutados'}
              </span>
            </div>
            <div className="bg-sc-low p-md rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-secondary">
                <span className="type-label-sm uppercase tracking-wider">RPE medio</span>
                <Icon name="gauge" size={18} />
              </div>
              <div className="mt-md flex items-baseline gap-xxs">
                <span className="type-metric-xl text-on-surface font-bold">{stats.rpe_avg === null ? '—' : fmtNum(Math.round(stats.rpe_avg * 10) / 10)}</span>
                <span className="type-label-md text-secondary">/ 10</span>
              </div>
              <span className={`type-body-sm mt-xs ${stats.rpe_avg === null ? 'text-secondary' : 'text-primary-fixed-dim'}`}>{stats.rpe_avg === null ? 'Sin RPE en las series' : rpeBand(stats.rpe_avg)}</span>
            </div>
          </div>
        </section>

        {/* Kinetic Personal Records */}
        {prs.length > 0 && (
          <section className="px-gutter mb-lg">
            <div className="bg-sc-low rounded-xl p-md overflow-hidden relative">
              <div className="flex items-center justify-between mb-md">
                <div className="flex items-center gap-sm">
                  <div className="w-7 h-7 rounded-lg bg-volt flex items-center justify-center text-on-volt">
                    <Icon name="trophy" size={18} />
                  </div>
                  <div className="flex flex-col">
                    <span className="type-label-sm text-volt uppercase tracking-wider font-semibold">{HITOS[Math.min(prs.length, 5)] ?? `${prs.length} hitos alcanzados`}</span>
                    <span className="type-headline-sm text-on-surface font-bold">Nuevos récords (PR)</span>
                  </div>
                </div>
                <span className="type-label-sm px-xs py-0p5 rounded bg-sc-highest text-secondary-fixed uppercase">Kinetic PR</span>
              </div>
              <div className="flex flex-col gap-sm">
                {prs.map((pr) => (
                  <div key={pr.exercise_id} className="p-sm rounded-lg bg-sc flex items-center justify-between gap-sm">
                    <div className="flex flex-col min-w-0">
                      <span className="type-body-lg text-on-surface font-bold" style={{ fontFamily: 'var(--font-display)' }}>
                        {pr.exercise_name}
                      </span>
                      <span className="type-label-md text-volt font-semibold mt-0p5">
                        {fmtNum(pr.weight)} {unit} × {pr.reps} reps
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="inline-flex px-xs py-0p5 rounded bg-sc-high text-volt type-label-sm font-semibold">
                        {pr.prev_e1rm === null ? 'Primer registro' : `+${fmtNum(Math.round((pr.e1rm - pr.prev_e1rm) * 10) / 10)} ${unit} e1RM`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Exercise Breakdown */}
        {list.length > 0 && (
          <section className="px-gutter mb-lg flex flex-col gap-md">
            <div className="flex items-center justify-between">
              <h2 className="type-headline-md text-on-surface uppercase tracking-tight font-extrabold">Desglose de bloques</h2>
              <span className="type-label-sm text-secondary uppercase">Orden táctico</span>
            </div>
            {list.map((c, i) => {
              const work = c.sets.filter((s) => s.kind !== 'warmup' && s.completed).sort((a, b) => a.set_index - b.set_index)
              const isPrExercise = prs.some((p) => p.exercise_id === c.exercise.id)
              const best = work.reduce<{ id: string; v: number } | null>((acc, s) => {
                const v = setE1rm(s) ?? 0
                return acc === null || v > acc.v ? { id: s.id, v } : acc
              }, null)
              const vol = work.reduce((acc, s) => acc + setVolume(s), 0)
              return (
                <div key={c.se.id} className="bg-sc-low p-md rounded-xl flex flex-col gap-sm">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <span className="type-label-sm text-secondary uppercase">
                        Bloque {String(i + 1).padStart(2, '0')} · {GROUP_LABEL[c.exercise.muscle_group]}
                      </span>
                      <h3 className="type-body-lg font-bold text-on-surface" style={{ fontFamily: 'var(--font-display)' }}>
                        {c.exercise.name}
                      </h3>
                    </div>
                    <span className="type-label-md text-on-surface bg-sc-high px-sm py-0p5 rounded uppercase flex-none">
                      {work.length} {work.length === 1 ? 'serie' : 'series'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-xs mt-xs">
                    {work.map((s, j) => {
                      const pr = isPrExercise && best !== null && best.id === s.id
                      return (
                        <div key={s.id} className={`p-xs rounded flex flex-col text-center ${pr ? 'bg-sc-high' : 'bg-sc'}`}>
                          <span className={`type-label-sm uppercase ${pr ? 'text-volt' : 'text-secondary'}`}>
                            Set {j + 1}
                            {pr && ' (PR)'}
                          </span>
                          <span className={`type-label-md text-14 font-bold nowrap ${pr ? 'text-volt' : 'text-on-surface'}`}>
                            {c.exercise.unit_mode === 'weight_reps' && s.weight !== null
                              ? `${fmtNum(s.weight)} ${unit} × ${s.reps}`
                              : `${s.reps} ${c.exercise.unit_mode === 'time' ? 's' : 'reps'}`}
                          </span>
                          <span className={`type-label-sm ${pr ? 'text-primary-fixed-dim' : 'text-secondary'}`}>{s.rpe === null ? 'sin RPE' : `RPE ${fmtNum(s.rpe)}`}</span>
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex items-center justify-between pt-xs text-secondary type-label-sm">
                    <span>
                      Volumen acumulado: {fmtNum(Math.round(vol))} {unit}
                    </span>
                    <span className="text-on-surface-variant">Velocidad pico: —</span>
                  </div>
                </div>
              )
            })}
          </section>
        )}

        {/* Recovery */}
        <section className="px-gutter mb-lg">
          <div className="bg-sc-low rounded-xl p-md flex items-center justify-between">
            <div className="flex flex-col gap-xxs max-w-70">
              <span className="type-label-sm text-secondary uppercase tracking-wider">Recuperación estimada</span>
              <span className="type-headline-sm text-on-surface font-bold">Ventana de {windowH} horas</span>
              <p className="type-body-sm text-secondary">
                {stats.rpe_avg !== null && stats.rpe_avg <= 9 ? 'Sobrecarga progresiva controlada.' : stats.rpe_avg === null ? 'Sin RPE: ventana estándar.' : 'Sesión al límite: ventana larga.'}
                {context?.nextDate != null &&
                  ` Próxima sesión de esta rutina sugerida: ${WEEKDAY_FULL[weekdayMon0(context.nextDate)]}${settings.notif_train_enabled ? ` ${settings.notif_train_time}` : ''}.`}
              </p>
            </div>
            <div className="w-16 h-16 rounded-full bg-sc-high flex items-center justify-center relative flex-none">
              <svg className="w-16 h-16" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" strokeWidth={3} style={{ stroke: 'var(--md-sc-highest)' }} />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" strokeWidth={3} strokeLinecap="round" strokeDasharray={`${recoveryPct}, 100`} style={{ stroke: 'var(--md-primary-fixed)' }} />
              </svg>
              <span className="absolute type-label-md text-volt font-bold">{recoveryPct}%</span>
            </div>
          </div>
        </section>

        {/* Athlete feedback */}
        <section className="px-gutter mb-xl flex flex-col gap-md">
          <div className="flex items-center justify-between">
            <span className="type-headline-sm text-on-surface uppercase tracking-tight font-bold">Sensaciones del atleta</span>
            <span className="type-label-sm text-secondary uppercase">Feedback post-entreno</span>
          </div>
          <div className="bg-sc-low p-md rounded-xl flex flex-col gap-md">
            <div className="flex flex-col gap-xs">
              <div className="flex items-center justify-between">
                <label className="type-label-md text-secondary uppercase tracking-wider">Esfuerzo percibido (RPE global)</label>
                <span className="type-metric-md text-volt font-semibold">{session.rating === null ? '— / 10' : `${session.rating} / 10`}</span>
              </div>
              <div className="grid grid-cols-10 gap-1 mt-xs">
                {RPE_SCALE.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`h-9 rounded type-label-sm text-center flex items-center justify-center press ${session.rating === n ? 'bg-volt text-on-volt font-bold' : 'bg-sc text-secondary'}`}
                    aria-pressed={session.rating === n}
                    onClick={() => void db.sessions.update(session.id, { rating: n })}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-xs">
              <label className="type-label-sm text-secondary uppercase tracking-wider" htmlFor="workout-notes">
                Notas de biomecánica y estado físico
              </label>
              <div className="relative bg-sc rounded-lg p-sm">
                <textarea
                  id="workout-notes"
                  className="w-full type-body-md text-on-surface"
                  style={{ background: 'transparent', border: 'none', outline: 'none', resize: 'none' }}
                  rows={2}
                  placeholder="Añade sensaciones articulares o notas técnicas..."
                  defaultValue={session.notes}
                  onBlur={(e) => void db.sessions.update(session.id, { notes: e.target.value })}
                />
              </div>
            </div>
          </div>
        </section>

        {session.routine_id === null && !saved && (
          <section className="px-gutter mb-lg">
            <div className="bg-sc-low p-md rounded-xl flex flex-col gap-sm">
              <span className="type-label-sm text-secondary uppercase tracking-wider">Guardar como plantilla</span>
              <div className="bg-sc rounded-lg p-sm">
                <input className="w-full bare-input text-left type-body-lg text-on-surface" aria-label="Nombre de la plantilla" placeholder="Torso superior" maxLength={24} value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
              </div>
              <button className="h-touch rounded-lg bg-sc-high text-on-surface type-label-md uppercase font-semibold tracking-wider press" onClick={() => void onSaveTemplate()} disabled={templateName.trim() === ''}>
                Guardar plantilla
              </button>
            </div>
          </section>
        )}
        {saved && <p className="px-gutter mb-lg type-body-sm text-secondary">Plantilla guardada. Está en Rutinas.</p>}

        <section className="sticky bottom-0 w-full px-gutter pt-sm pb-lg bg-surface-90 flex flex-col gap-xs z-30" style={{ backdropFilter: 'blur(8px)' }}>
          <button className="w-full h-touch rounded-xl bg-volt text-on-volt type-label-md font-bold uppercase tracking-wider flex items-center justify-center gap-xs press glow-volt" onClick={() => navigate('/')}>
            <Icon name="check-circle" size={20} />
            <span>Guardar en calendario y cerrar</span>
          </button>
          <div className="flex items-center justify-center py-xxs">
            <span className="type-label-sm text-secondary uppercase tracking-widest text-center">{synced ? 'Sincronización completada' : 'Sincronización automática en curso'}</span>
          </div>
          <button className="type-label-sm text-secondary uppercase tracking-wider text-center press" onClick={() => void reopenSession(session.id).then(() => navigate('/entrenar'))}>
            Terminé sin querer: reabrir la sesión
          </button>
        </section>
      </div>
    </div>
  )
}
