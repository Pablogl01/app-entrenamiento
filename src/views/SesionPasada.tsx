import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { db, getSettings } from '../db/db'
import { deleteSession, reopenSession, repeatSession, sessionStats } from '../db/repo'
import { fmtDateLong, fmtDateShort, fmtDuration, fmtNum } from '../lib/format'
import { todayISO } from '../lib/dates'
import { TopBar } from '../components/TopBar'
import { ExerciseCard } from '../components/ExerciseCard'
import { Icon } from '../components/Icon'
import { useSessionCards } from '../components/useSessionCards'

export function SesionPasada() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [openCard, setOpenCard] = useState<string | null>(null)

  const settings = useLiveQuery(getSettings)
  const session = useLiveQuery(async () => (id !== undefined ? ((await db.sessions.get(id)) ?? null) : null), [id])
  const stats = useLiveQuery(async () => (id !== undefined ? sessionStats(id) : null), [id])
  const cards = useSessionCards(session?.id)

  if (settings === undefined || session === undefined) return null
  if (session === null) {
    return (
      <div className="screen screen--stacked pad">
        <TopBar title="Sesión" />
        <p className="t-body">Esta sesión ya no existe.</p>
      </div>
    )
  }

  async function onRepeat() {
    if (!session) return
    const created = await repeatSession(session.id)
    if (created) navigate('/')
  }

  async function onDelete() {
    if (!session) return
    if (window.confirm('¿Borrar esta sesión y sus series? No se puede deshacer.')) {
      await deleteSession(session.id)
      navigate(-1)
    }
  }

  const list = cards ?? []
  const totalWork = list.flatMap((c) => c.sets.filter((s) => s.kind !== 'warmup')).length
  const doneWork = list.flatMap((c) => c.sets.filter((s) => s.kind !== 'warmup' && s.completed)).length

  return (
    <div className="screen screen--stacked pad">
      <TopBar
        title={fmtDateShort(session.date)}
        right={
          <button className="t-label" onClick={() => setEditing((v) => !v)}>
            {editing ? 'Hecho' : 'Editar'}
          </button>
        }
      />
      <div className="stack">
        <section className="card" aria-label="Sesión">
          <div className="between">
            <span className={`chip t-label-sm${session.finished_at !== null ? ' chip--volt' : ''}`}>
              <span className="chip__dot" />
              {session.finished_at === null ? 'En curso' : 'Hecha'} · {doneWork}/{totalWork} series
            </span>
            <span className="t-label-sm mute">{fmtDateLong(session.date)}</span>
          </div>
          <h1 className="t-display hero__title">{session.routine_name_snapshot}</h1>
          {stats != null && (
            <div className="tiles" style={{ marginTop: 'var(--sp-4)' }}>
              <div className="tile">
                <span className="tile__label t-label-sm">Duración</span>
                <span className="t-metric">{stats.duration_ms === null ? '—' : fmtDuration(stats.duration_ms)}</span>
              </div>
              <div className="tile">
                <span className="tile__label t-label-sm">Ejercicios</span>
                <span className="t-metric">{list.length}</span>
              </div>
              <div className="tile">
                <span className="tile__label t-label-sm">Volumen</span>
                <span className="t-metric" style={{ color: 'var(--volt-ink)' }}>
                  {fmtNum(Math.round(stats.volume))} <span className="t-label-sm soft">{settings.unit}</span>
                </span>
              </div>
            </div>
          )}
        </section>

        <section className="stack stack--tight" aria-label="Ejercicios">
          {list.map((c) => (
            <ExerciseCard
              key={c.se.id}
              data={c}
              open={openCard === c.se.id}
              onToggle={() => setOpenCard(openCard === c.se.id ? null : c.se.id)}
              active={editing}
              removable={editing}
              unit={settings.unit}
            />
          ))}
        </section>

        {session.notes !== '' && (
          <section className="card">
            <span className="t-label-sm mute">Notas</span>
            <p className="t-body" style={{ marginTop: 'var(--sp-1)' }}>
              {session.notes}
            </p>
          </section>
        )}

        <button className="btn btn--secondary" onClick={() => void onRepeat()}>
          <Icon name="history" size={18} />
          Repetir esta sesión
        </button>
        {session.date === todayISO() && session.finished_at !== null && (
          <button className="btn btn--ghost t-label" onClick={() => void reopenSession(session.id).then(() => navigate('/'))}>
            Reabrir sesión (vuelve a Hoy en curso)
          </button>
        )}

        {editing && (
          <section className="card stack stack--tight" aria-label="Edición">
            <div className="between">
              <span className="t-body">Fecha</span>
              <input
                type="date"
                aria-label="Fecha de la sesión"
                className="t-metric-sm time-input"
                value={session.date}
                onChange={(e) => {
                  if (e.target.value !== '') void db.sessions.update(session.id, { date: e.target.value })
                }}
              />
            </div>
            <button className="btn btn--ghost t-label" onClick={() => void onDelete()}>
              <Icon name="close" size={16} />
              Borrar sesión
            </button>
          </section>
        )}
      </div>
    </div>
  )
}
