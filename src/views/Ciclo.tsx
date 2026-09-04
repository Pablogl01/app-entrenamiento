import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db, USER_ID } from '../db/db'
import { addCycleBlock, cycleBlocks, cycleState, createCycle, reorderBlocks } from '../db/repo'
import { todayISO } from '../lib/dates'
import { fmtDateShort } from '../lib/format'
import { TopBar } from '../components/TopBar'
import { Icon } from '../components/Icon'
import { Stepper } from '../components/Stepper'
import { useReorder } from '../components/useReorder'
import type { BlockGoal } from '../db/types'

export const GOALS: { key: BlockGoal; label: string }[] = [
  { key: 'fuerza', label: 'Fuerza' },
  { key: 'volumen', label: 'Volumen' },
  { key: 'hipertrofia', label: 'Hipertrofia' },
  { key: 'descarga', label: 'Descarga' },
]

export function goalLabel(g: BlockGoal): string {
  return GOALS.find((x) => x.key === g)?.label ?? g
}

/** Ciclo de entrenamiento con bloques configurables (especificaciones §4.11). */
export function Ciclo() {
  const navigate = useNavigate()
  const state = useLiveQuery(() => cycleState(), [])
  const blocks = useLiveQuery(async () => (state?.cycle ? cycleBlocks(state.cycle.id) : []), [state?.cycle.id]) ?? []
  const [name, setName] = useState('')
  const [goal, setGoal] = useState<BlockGoal>('hipertrofia')
  const [start, setStart] = useState(todayISO())
  const [editingName, setEditingName] = useState(false)
  const [nameText, setNameText] = useState('')

  const { handlers, dragIndex } = useReorder(blocks.length, (from, to) => {
    const ids = blocks.map((b) => b.id)
    const [moved] = ids.splice(from, 1)
    ids.splice(to, 0, moved)
    void reorderBlocks(ids)
  })

  if (state === undefined) return null

  if (state === null) {
    return (
      <div className="screen screen--stacked pad">
        <TopBar title="Ciclo" />
        <div className="stack">
          <header>
            <span className="t-label mute">Mesociclo</span>
            <h1 className="t-h1">Nuevo ciclo</h1>
            <p className="t-body-sm soft" style={{ marginTop: 'var(--sp-2)' }}>
              El ciclo da nombre a las semanas: en Hoy y Rutinas verás «Semana 4 · Bloque 2». Se crea con tres bloques que puedes cambiar.
            </p>
          </header>
          <section className="card stack stack--tight">
            <span className="t-label-sm mute">Nombre</span>
            <div className="field">
              <input aria-label="Nombre del ciclo" className="t-h3" placeholder="Fuerza-Volumen" value={name} maxLength={28} onChange={(e) => setName(e.target.value)} />
            </div>
            <span className="t-label-sm mute" style={{ marginTop: 'var(--sp-2)' }}>
              Objetivo
            </span>
            <div className="seg t-label" role="radiogroup" aria-label="Objetivo">
              {GOALS.map((g) => (
                <button key={g.key} role="radio" aria-checked={goal === g.key} className={goal === g.key ? 'active' : ''} onClick={() => setGoal(g.key)}>
                  {g.label}
                </button>
              ))}
            </div>
            <span className="t-label-sm mute" style={{ marginTop: 'var(--sp-2)' }}>
              Empieza
            </span>
            <div className="between">
              <span className="t-body">{fmtDateShort(start)}</span>
              <input type="date" aria-label="Fecha de inicio" className="t-metric-sm time-input" value={start} onChange={(e) => e.target.value !== '' && setStart(e.target.value)} />
            </div>
          </section>
          <button
            className="btn btn--primary"
            disabled={name.trim() === ''}
            onClick={() => void createCycle(name.trim(), goal, start)}
          >
            <Icon name="plus" size={18} />
            Crear ciclo
          </button>
        </div>
      </div>
    )
  }

  const { cycle, week, totalWeeks, block, microcycle, overrun } = state
  const pct = totalWeeks === 0 ? 0 : Math.min(100, Math.round((week / totalWeeks) * 100))

  function commitName() {
    setEditingName(false)
    const clean = nameText.trim()
    if (clean !== '') void db.cycles.update(cycle.id, { name: clean })
  }

  async function onArchive() {
    if (!window.confirm('¿Cerrar este ciclo? Las sesiones hechas no cambian.')) return
    await db.cycles.update(cycle.id, { archived: true })
    navigate(-1)
  }

  return (
    <div className="screen screen--stacked pad">
      <TopBar title="Ciclo" />
      <div className="stack">
        <section className="card card--active">
          <div className="between">
            <span className="chip chip--volt t-label-sm">
              <span className="chip__dot" />
              Ciclo activo
            </span>
            <span className="t-label-sm mute">desde {fmtDateShort(cycle.start_date)}</span>
          </div>
          <span className="t-label-sm mute" style={{ display: 'block', marginTop: 'var(--sp-3)' }}>
            Mesociclo · toca el nombre para editar
          </span>
          {editingName ? (
            <input
              className="t-display ed-name-input"
              aria-label="Nombre del ciclo"
              value={nameText}
              maxLength={28}
              autoFocus
              onChange={(e) => setNameText(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => e.key === 'Enter' && commitName()}
            />
          ) : (
            <button
              className="t-display"
              style={{ display: 'block', width: '100%' }}
              onClick={() => {
                setNameText(cycle.name)
                setEditingName(true)
              }}
            >
              {cycle.name}
            </button>
          )}
          <p className="t-body-sm soft" style={{ marginTop: 'var(--sp-2)' }}>
            {overrun > 0
              ? `Ciclo terminado hace ${overrun} ${overrun === 1 ? 'semana' : 'semanas'}. Ciérralo o añade bloques.`
              : `Semana ${week} de ${totalWeeks} · ${block ? `Bloque ${blocks.findIndex((b) => b.id === block.id) + 1} «${block.name}» · Microciclo ${microcycle}` : 'Sin bloques'}`}
          </p>
          <div className="progress" style={{ marginTop: 'var(--sp-3)' }} role="progressbar" aria-valuenow={week} aria-valuemax={totalWeeks}>
            <div className="progress__fill" style={{ transform: `scaleX(${pct / 100})` }} />
          </div>
          <div className="seg t-label" role="radiogroup" aria-label="Objetivo del ciclo" style={{ marginTop: 'var(--sp-4)' }}>
            {GOALS.map((g) => (
              <button key={g.key} role="radio" aria-checked={cycle.goal === g.key} className={cycle.goal === g.key ? 'active' : ''} onClick={() => void db.cycles.update(cycle.id, { goal: g.key })}>
                {g.label}
              </button>
            ))}
          </div>
          <div className="between" style={{ marginTop: 'var(--sp-3)' }}>
            <span className="t-body-sm soft">Fecha de inicio</span>
            <input
              type="date"
              aria-label="Fecha de inicio"
              className="t-metric-sm time-input"
              value={cycle.start_date}
              onChange={(e) => e.target.value !== '' && void db.cycles.update(cycle.id, { start_date: e.target.value })}
            />
          </div>
        </section>

        <section className="stack stack--tight" aria-label="Bloques">
          <div className="sect t-label">
            <span className="sect__label">Bloques</span>
            <span className="t-label-sm">{totalWeeks} semanas</span>
          </div>
          {blocks.map((b, i) => (
            <article key={b.id} className={`card${block?.id === b.id ? ' card--active' : ''}${dragIndex === i ? ' dragging' : ''}`} {...handlers(i)}>
              <div className="between">
                <span className="inline">
                  <span className="queue-row__idx t-label">{String(i + 1).padStart(2, '0')}</span>
                  <input
                    aria-label="Nombre del bloque"
                    className="t-h3"
                    defaultValue={b.name}
                    style={{ minWidth: 0, flex: 1 }}
                    onBlur={(e) => e.target.value.trim() !== '' && void db.cycle_blocks.update(b.id, { name: e.target.value.trim() })}
                  />
                </span>
                <span className="queue-row__grip" aria-hidden="true">
                  <Icon name="grip" size={20} />
                </span>
              </div>
              <div className="between" style={{ marginTop: 'var(--sp-3)' }}>
                <span className="t-body-sm soft">Semanas</span>
                <Stepper
                  small
                  value={b.weeks}
                  step={1}
                  min={1}
                  integer
                  className="t-metric"
                  ariaLabel="semanas"
                  onCommit={(n) => void db.cycle_blocks.update(b.id, { weeks: Math.max(1, n) })}
                />
              </div>
              <div className="chips t-label-sm" style={{ marginTop: 'var(--sp-3)' }} role="radiogroup" aria-label="Objetivo del bloque">
                {GOALS.map((g) => (
                  <button key={g.key} className={`chip${b.goal === g.key ? ' active' : ''}`} onClick={() => void db.cycle_blocks.update(b.id, { goal: g.key })}>
                    {g.label}
                  </button>
                ))}
              </div>
              <button
                className="textbtn textbtn--soft textbtn--alert t-label-sm"
                style={{ marginTop: 'var(--sp-2)' }}
                onClick={() => void db.cycle_blocks.delete(b.id)}
              >
                <Icon name="close" size={14} />
                Quitar bloque
              </button>
            </article>
          ))}
          <button className="btn btn--secondary" onClick={() => void addCycleBlock(cycle.id, `Bloque ${blocks.length + 1}`, 3, cycle.goal)}>
            <Icon name="plus" size={18} />
            Añadir bloque
          </button>
        </section>

        <button className="btn btn--ghost t-label" onClick={() => void onArchive()}>
          <Icon name="archive" size={16} />
          Cerrar ciclo
        </button>
        <p className="t-caption mute" style={{ textAlign: 'center' }}>
          Usuario {USER_ID} · un ciclo activo como máximo
        </p>
      </div>
    </div>
  )
}
