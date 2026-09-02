import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { db, getSettings } from '../db/db'
import { deleteSession, repeatSession } from '../db/repo'
import { fmtDateLong } from '../lib/format'
import { MaterialHeader, materialFor } from '../components/MaterialHeader'
import { TopBar } from '../components/TopBar'
import { ExerciseCard } from '../components/ExerciseCard'
import { useSessionCards } from '../components/useSessionCards'

export function SesionPasada() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [openCard, setOpenCard] = useState<string | null>(null)

  const settings = useLiveQuery(getSettings)
  const session = useLiveQuery(async () => (id !== undefined ? ((await db.sessions.get(id)) ?? null) : null), [id])
  const routine = useLiveQuery(
    async () => (session?.routine_id != null ? ((await db.routines.get(session.routine_id)) ?? null) : null),
    [session?.routine_id],
  )
  const cards = useSessionCards(session?.id)

  if (settings === undefined || session === undefined) return null
  if (session === null) {
    return (
      <div className="screen screen--stacked">
        <TopBar />
        <p className="t-body pad">Esta sesión ya no existe.</p>
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

  return (
    <div className="screen screen--stacked">
      <MaterialHeader
        material={materialFor(routine?.routine_type ?? null, session.routine_id ?? '')}
        eyebrow={fmtDateLong(session.date)}
        title={session.routine_name_snapshot}
        minHeight={200}
      >
        <TopBar
          onMaterial
          right={
            <button style={{ color: 'var(--on-material)' }} onClick={() => setEditing((v) => !v)}>
              {editing ? 'Hecho' : 'Editar'}
            </button>
          }
        />
      </MaterialHeader>

      <div className="sheet">
        {(cards ?? []).map((c) => (
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

        {session.notes !== '' && (
          <p className="t-body" style={{ marginTop: 'var(--sp-5)' }}>
            {session.notes}
          </p>
        )}

        <div style={{ marginTop: 'var(--sp-6)' }}>
          <button className="btn-text" onClick={() => void onRepeat()}>
            Repetir esta sesión
          </button>
          {editing && (
            <>
              <div className="row" style={{ marginTop: 'var(--sp-4)' }}>
                <span className="row__main t-body">Fecha</span>
                <input
                  type="date"
                  aria-label="Fecha de la sesión"
                  className="t-data"
                  value={session.date}
                  onChange={(e) => {
                    if (e.target.value !== '') void db.sessions.update(session.id, { date: e.target.value })
                  }}
                  style={{ background: 'var(--panel-deep)', borderRadius: 10, padding: '10px 12px' }}
                />
              </div>
              <button className="btn-text soft" onClick={() => void onDelete()}>
                Borrar sesión
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
