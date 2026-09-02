import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { db, getSettings } from '../db/db'
import { saveSessionAsRoutine, sessionStats } from '../db/repo'
import { fmtDuration, fmtNum, fmtWeight } from '../lib/format'
import { TopBar } from '../components/TopBar'

const COUNT_WORDS = ['', 'Un récord hoy', 'Dos récords hoy', 'Tres récords hoy', 'Cuatro récords hoy', 'Cinco récords hoy']

export function Resumen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [templateName, setTemplateName] = useState('')
  const [saved, setSaved] = useState(false)

  const settings = useLiveQuery(getSettings)
  const session = useLiveQuery(async () => (id !== undefined ? ((await db.sessions.get(id)) ?? null) : null), [id])
  const stats = useLiveQuery(async () => (id !== undefined ? sessionStats(id) : null), [id])

  if (settings === undefined || session === undefined || session === null || stats == null) return null

  const unit = settings.unit
  const prs = stats.prs
  const prTitle = COUNT_WORDS[Math.min(prs.length, 5)] ?? `${prs.length} récords hoy`

  async function onSaveTemplate() {
    if (!session) return
    const name = templateName.trim()
    if (name === '') return
    await saveSessionAsRoutine(session.id, name.slice(0, 24))
    setSaved(true)
  }

  return (
    <div className="screen screen--stacked">
      <TopBar />
      <div className="pad">
        <h1 className="t-title">Sesión registrada</h1>

        {/* Los PRs son la recompensa. Si no hay, el bloque no existe. */}
        {prs.length > 0 && (
          <section style={{ marginTop: 'var(--sp-5)' }}>
            <p className="t-title">{prTitle}</p>
            <div className="xcard" style={{ marginTop: 'var(--sp-3)' }}>
              {prs.map((pr) => (
                <div key={pr.exercise_id} className="pr-row">
                  <span className="row__main">
                    <span className="t-item">{pr.exercise_name}</span>
                    <span className="t-data soft" style={{ display: 'block', marginTop: 4 }}>
                      e1RM {fmtNum(Math.round(pr.e1rm * 10) / 10)} {unit}
                      {pr.prev_e1rm !== null && ` · antes ${fmtNum(Math.round(pr.prev_e1rm * 10) / 10)}`}
                    </span>
                  </span>
                  {pr.prev_e1rm !== null && (
                    <span className="t-datalg">+{fmtNum(Math.round((pr.e1rm - pr.prev_e1rm) * 10) / 10)}</span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <section style={{ marginTop: 'var(--sp-5)' }}>
          {stats.duration_ms !== null && (
            <div className="sum-row">
              <span className="t-body">Duración</span>
              <span className="t-datalg">{fmtDuration(stats.duration_ms)}</span>
            </div>
          )}
          <div className="sum-row">
            <span className="t-body">Volumen</span>
            <span className="t-datalg">{fmtWeight(Math.round(stats.volume), unit)}</span>
          </div>
          <div className="sum-row">
            <span className="t-body">Series de trabajo</span>
            <span className="t-datalg">{stats.done_sets}</span>
          </div>
        </section>

        <section style={{ marginTop: 'var(--sp-6)' }}>
          <p className="t-body">Cómo fue</p>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-3)' }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                className={`rate t-datalg${session.rating === n ? ' active' : ''}`}
                aria-pressed={session.rating === n}
                onClick={() => void db.sessions.update(session.id, { rating: n })}
              >
                {n}
              </button>
            ))}
          </div>
        </section>

        <section style={{ marginTop: 'var(--sp-6)' }}>
          <p className="t-body">Notas</p>
          <textarea
            className="field t-body"
            style={{ marginTop: 'var(--sp-3)' }}
            aria-label="Notas de la sesión"
            placeholder="dormí 5 horas, el press se notó"
            defaultValue={session.notes}
            onBlur={(e) => void db.sessions.update(session.id, { notes: e.target.value })}
          />
        </section>

        {session.routine_id === null && !saved && (
          <section style={{ marginTop: 'var(--sp-6)' }}>
            <p className="t-body">Guardar como plantilla</p>
            <div className="field" style={{ minHeight: 56, marginTop: 'var(--sp-3)' }}>
              <input
                aria-label="Nombre de la plantilla"
                placeholder="Torso superior"
                maxLength={24}
                className="t-item"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </div>
            <button className="btn-text" onClick={() => void onSaveTemplate()}>
              Guardar plantilla
            </button>
          </section>
        )}
        {saved && (
          <p className="t-body" style={{ marginTop: 'var(--sp-5)' }}>
            Plantilla guardada. Está en Rutinas.
          </p>
        )}

        <div style={{ marginTop: 'var(--sp-6)' }}>
          <button className="btn-cta" onClick={() => navigate('/')}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
