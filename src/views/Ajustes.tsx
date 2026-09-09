import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useLocation } from 'react-router-dom'
import { getSettings, patchSettings } from '../db/db'
import { cycleState } from '../db/repo'
import { downloadExport, fetchServerBackup, importSnapshot, restoreSnapshot, uploadBackup } from '../lib/backup'
import { enablePush, pushStatus, sendTestNotification, syncPrefs, type PushStatus } from '../lib/push'
import { applyTheme } from '../lib/theme'
import { logout, useAuthState } from '../lib/auth'
import { fmtNum } from '../lib/format'
import { TopBar } from '../components/TopBar'
import { Icon, type IconName } from '../components/Icon'
import type { LoadType, Theme } from '../db/types'
import { goalLabel } from './Ciclo'
import { radioGroupKeyDown } from '../lib/a11y'

const LOAD_LABELS: { key: LoadType; label: string; hint: string; icon: IconName }[] = [
  { key: 'barbell', label: 'Barra olímpica', hint: 'Discos estándar', icon: 'dumbbell' },
  { key: 'dumbbell', label: 'Mancuernas', hint: 'Incremento en par', icon: 'dumbbell' },
  { key: 'machine', label: 'Máquina', hint: 'Selector de placas', icon: 'layers' },
  { key: 'cable', label: 'Polea', hint: 'Ladrillos guía', icon: 'grid' },
  { key: 'bodyweight', label: 'Corporal (lastre)', hint: 'Cinturón de dominadas/fondos', icon: 'user' },
]

const THEMES: { key: Theme; label: string }[] = [
  { key: 'system', label: 'Sistema' },
  { key: 'dark', label: 'Oscuro' },
  { key: 'light', label: 'Claro' },
]

/** Cabecera de sección de la maqueta: punto volt + título en label-md + pista a la derecha. */
function SectionHead({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex items-center justify-between px-xxs">
      <h2 className="type-label-md uppercase tracking-wider text-on-surface-variant flex items-center gap-xs">
        <span className="w-1p5 h-1p5 rounded-full bg-volt" />
        {title}
      </h2>
      <span className="type-label-sm text-on-surface-variant">{hint}</span>
    </div>
  )
}

/** Interruptor de la maqueta: w-12 h-7, pomo de 20 en on-primary-container. */
function MockToggle({ checked, onChange, label, small = false }: { checked: boolean; onChange: (v: boolean) => void; label: string; small?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`${small ? 'w-10 h-6 p-0p5' : 'w-12 h-7 p-1'} hit-lg rounded-full flex items-center flex-none ${checked ? 'bg-volt' : 'bg-sc-highest'}`}
      onClick={() => onChange(!checked)}
    >
      <div
        className="w-5 h-5 rounded-full shadow-sm"
        style={{
          background: checked ? 'var(--md-on-primary-container)' : 'var(--md-on-surface-variant)',
          transform: checked ? `translateX(${small ? 16 : 20}px)` : 'translateX(0)',
          transition: 'transform 150ms var(--ease-out), background-color 150ms ease',
        }}
      />
    </button>
  )
}

/** Stepper de la maqueta: fondo sc-high, botones de 32 y cifra metric-md centrada. */
function MockStepper({ value, unit, step, min, onCommit, label, integer = false }: { value: number | null; unit: string; step: number; min: number; onCommit: (n: number) => void; label: string; integer?: boolean }) {
  return (
    <div className="flex items-center bg-sc-high rounded-lg p-xxs flex-none">
      <button type="button" className="w-8 h-8 hit flex items-center justify-center rounded text-on-surface press press-95" aria-label={`Bajar ${label}`} onClick={() => onCommit(Math.max(min, Math.round(((value ?? min) - step) * 100) / 100))}>
        <Icon name="minus" size={16} />
      </button>
      <span className="type-metric-md px-sm text-center text-on-surface font-semibold nowrap" style={{ minWidth: 68 }}>
        {value === null ? '—' : integer ? value : fmtNum(value)} {unit}
      </span>
      <button type="button" className="w-8 h-8 hit flex items-center justify-center rounded text-on-surface press press-95" aria-label={`Subir ${label}`} onClick={() => onCommit(Math.round(((value ?? min) + step) * 100) / 100)}>
        <Icon name="plus" size={16} />
      </button>
    </div>
  )
}

function Row({ icon, iconVolt = false, title, hint, hintVolt = false, children }: { icon: IconName; iconVolt?: boolean; title: string; hint: string; hintVolt?: boolean; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between p-md gap-sm">
      <div className="flex items-center gap-md min-w-0">
        <div className={`w-8 h-8 rounded bg-sc-high flex items-center justify-center flex-none ${iconVolt ? 'text-volt' : 'text-on-surface'}`}>
          <Icon name={icon} size={18} />
        </div>
        <div className="flex flex-col min-w-0">
          {/* Un correo no tiene espacios: que parta antes de desbordar la fila. */}
          <span className="type-body-md font-medium text-on-surface" style={{ overflowWrap: 'anywhere' }}>{title}</span>
          <span className={`type-label-sm ${hintVolt ? 'text-primary-dim' : 'text-on-surface-variant'}`}>{hint}</span>
        </div>
      </div>
      {children}
    </div>
  )
}

export function Ajustes() {
  const settings = useLiveQuery(getSettings)
  const cycle = useLiveQuery(() => cycleState(), [])
  const auth = useAuthState()
  const location = useLocation()
  const [push, setPush] = useState<PushStatus | null>(null)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const avisosRef = useRef<HTMLElement>(null)

  useEffect(() => {
    void pushStatus().then(setPush)
  }, [])

  useEffect(() => {
    if (location.hash === '#avisos' && settings !== undefined) avisosRef.current?.scrollIntoView({ block: 'start' })
  }, [location.hash, settings])

  if (settings === undefined) return null

  async function onEnablePush() {
    const result = await enablePush()
    setPush(await pushStatus())
    if (result === 'denied') setTestResult('Permiso denegado. Se reactiva desde los ajustes del sistema.')
    if (result === 'error') setTestResult('No se pudo suscribir. ¿Está el servidor accesible?')
  }

  async function onTest() {
    setTestResult(null)
    const ok = await sendTestNotification()
    setTestResult(ok ? 'Aviso enviado. Si no llega en un minuto, revisa el bloque de estado.' : 'El servidor no respondió. El aviso no salió.')
  }

  async function onImport(file: File | undefined) {
    if (!file) return
    if (!window.confirm('Importar reemplaza todos los datos actuales. ¿Seguir?')) return
    const res = await importSnapshot(file)
    setImportResult(res === 'ok' ? 'Datos importados.' : 'Ese archivo no es un export válido.')
  }

  /** Trae la copia del servidor, la enseña, y solo reemplaza si se confirma. */
  async function onRestore() {
    setImportResult('Buscando la copia del servidor…')
    const found = await fetchServerBackup()
    if (!found.ok) {
      setImportResult(
        found.reason === 'auth'
          ? 'Entra con tu cuenta para restaurar la copia del servidor.'
          : found.reason === 'none'
            ? 'No hay ninguna copia guardada en el servidor.'
            : found.reason === 'offline'
              ? 'Sin conexión: la copia vive en el servidor.'
              : 'El servidor no devolvió una copia válida.',
      )
      return
    }
    const when = new Date(found.created_at).toLocaleString('es-ES', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    const { routines, sessions, weights, sets } = found.counts
    const what = `${routines} rutinas · ${sessions} sesiones · ${weights} pesajes · ${sets} series`
    if (!window.confirm(`Copia del ${when}\n${what}\n\nRestaurar reemplaza todos los datos de este móvil. ¿Seguir?`)) {
      setImportResult(null)
      return
    }
    const res = await restoreSnapshot(found.snapshot)
    setImportResult(res === 'ok' ? `Restaurada la copia del ${when}.` : 'No se pudo restaurar la copia.')
  }

  const inc = settings.increments
  const unit = settings.unit
  const lastSync = settings.last_backup_at === null ? 'nunca' : new Date(settings.last_backup_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="screen screen--stacked">
      <TopBar as="p" title="Ajustes" />
      <main className="flex-1 w-full pb-24 px-gutter flex flex-col relative">
        <div className="flex flex-col w-full gap-lg pb-2xl">
          {/* Header */}
          <div className="flex items-center justify-between pt-xs">
            <div className="flex flex-col">
              <span className="type-label-sm uppercase tracking-wider text-primary-dim">Parámetros del sistema</span>
              <h1 className="type-headline-sm uppercase tracking-tight text-on-surface">Ajustes</h1>
            </div>
            <span className="type-label-sm px-sm py-xxs rounded bg-sc-high text-on-surface-variant uppercase">v2.2-nordic</span>
          </div>

          {/* Apariencia */}
          <section className="flex flex-col gap-sm">
            <SectionHead title="Apariencia" hint="Modo de color" />
            <div className="p-xxs rounded-xl bg-sc-low flex items-center gap-xxs" role="radiogroup" onKeyDown={radioGroupKeyDown} aria-label="Modo de color">
              {THEMES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="radio"
                  aria-checked={settings.theme === t.key} tabIndex={settings.theme === t.key ? 0 : -1}
                  className={`flex-1 h-touch rounded-lg flex items-center justify-center gap-xs type-label-md uppercase ${settings.theme === t.key ? 'bg-volt text-on-primary-container shadow-sm' : 'text-on-surface-variant'}`}
                  onClick={() => {
                    applyTheme(t.key)
                    void patchSettings({ theme: t.key })
                  }}
                >
                  <span className={settings.theme === t.key ? 'font-bold' : ''}>{t.label}</span>
                  {settings.theme === t.key && <Icon name="check" size={16} />}
                </button>
              ))}
            </div>
          </section>

          {/* Unidad */}
          <section className="flex flex-col gap-sm">
            <SectionHead title="Unidad de peso" hint="Global" />
            <div className="p-xxs rounded-xl bg-sc-low flex items-center gap-xxs" role="radiogroup" onKeyDown={radioGroupKeyDown} aria-label="Unidad">
              {(['kg', 'lb'] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  role="radio"
                  aria-checked={unit === u} tabIndex={unit === u ? 0 : -1}
                  className={`flex-1 h-touch rounded-lg flex items-center justify-center gap-xs type-label-md uppercase ${unit === u ? 'bg-volt text-on-primary-container shadow-sm' : 'text-on-surface-variant'}`}
                  onClick={() => void patchSettings({ unit: u })}
                >
                  <span className={unit === u ? 'font-bold' : ''}>{u === 'kg' ? 'Kilogramos (kg)' : 'Libras (lb)'}</span>
                  {unit === u && <Icon name="check" size={16} />}
                </button>
              ))}
            </div>
          </section>

          {/* Ciclo */}
          <section className="flex flex-col gap-sm">
            <SectionHead title="Ciclo de entrenamiento" hint={cycle ? `Semana ${cycle.week}` : 'Ninguno'} />
            <Link to="/ciclo" className="flex flex-col rounded-xl bg-sc-low overflow-hidden shadow-sm">
              <Row icon="layers" iconVolt title={cycle ? cycle.cycle.name : 'Crear un ciclo'} hint={cycle ? `${goalLabel(cycle.cycle.goal)} · ${cycle.blocks.length} bloques · semana ${cycle.week} de ${cycle.totalWeeks}` : 'Da nombre a las semanas: bloques y microciclos'}>
                <Icon name="chevron-right" size={20} className="text-on-surface-variant" />
              </Row>
            </Link>
          </section>

          {/* Incrementos */}
          <section className="flex flex-col gap-sm">
            <div className="flex flex-col px-xxs gap-xxs">
              <SectionHead title="Incrementos por defecto" hint="Paso de carga" />
              <p className="type-body-sm text-on-surface-variant">Para ejercicios nuevos. Cada ejercicio guarda el suyo propio en su ficha táctica.</p>
            </div>
            <div className="flex flex-col rounded-xl bg-sc-low overflow-hidden shadow-sm">
              {LOAD_LABELS.map(({ key, label, hint, icon }, i) => (
                <div key={key}>
                  {i > 0 && <div className="h-1px bg-sc mx-md" />}
                  <Row icon={icon} iconVolt title={label} hint={hint}>
                    <MockStepper value={inc[key]} unit={unit} step={0.5} min={0.25} label={`incremento ${label}`} onCommit={(n) => void patchSettings({ increments: { ...inc, [key]: n } })} />
                  </Row>
                </div>
              ))}
            </div>
          </section>

          {/* Meta de peso y equipo */}
          <section className="flex flex-col gap-sm">
            <SectionHead title="Meta de peso y equipo" hint="Sesión en vivo" />
            <div className="flex flex-col rounded-xl bg-sc-low overflow-hidden shadow-sm">
              <Row icon="weight" iconVolt title="Meta de peso corporal" hint={settings.body_weight_goal === null ? 'Sin meta: dibuja la línea objetivo' : 'Línea objetivo en las gráficas'}>
                <div className="flex items-center gap-xs">
                  <MockStepper value={settings.body_weight_goal} unit={unit} step={0.5} min={30} label="meta de peso" onCommit={(n) => void patchSettings({ body_weight_goal: n })} />
                  {settings.body_weight_goal !== null && (
                    <button type="button" className="w-8 h-8 hit rounded bg-sc-high flex items-center justify-center text-on-surface-variant" aria-label="Quitar meta" onClick={() => void patchSettings({ body_weight_goal: null })}>
                      <Icon name="close" size={16} />
                    </button>
                  )}
                </div>
              </Row>
              <div className="h-1px bg-sc mx-md" />
              <Row icon="clock" title="Descanso por defecto" hint="Arranca al completar una serie">
                <MockStepper value={settings.default_rest_seconds} unit="s" step={15} min={15} integer label="descanso por defecto" onCommit={(n) => void patchSettings({ default_rest_seconds: Math.max(15, n) })} />
              </Row>
              <div className="h-1px bg-sc mx-md" />
              <Row icon="ruler" title="Peso de la barra" hint="Para la calculadora de discos">
                <MockStepper value={settings.bar_weight} unit={unit} step={2.5} min={0} label="peso de la barra" onCommit={(n) => void patchSettings({ bar_weight: n })} />
              </Row>
              <div className="h-1px bg-sc mx-md" />
              <div className="flex flex-col gap-sm p-md">
                <div className="flex items-center gap-md">
                  <div className="w-8 h-8 rounded bg-sc-high flex items-center justify-center text-on-surface flex-none">
                    <Icon name="calculator" size={18} />
                  </div>
                  <div className="flex flex-col">
                    <span className="type-body-md font-medium text-on-surface">Discos disponibles</span>
                    <span className="type-label-sm text-on-surface-variant">Por lado. Toca para quitar o añadir.</span>
                  </div>
                </div>
                <div className="flex items-center gap-xs overflow-x-auto hscroll">
                  {[25, 20, 15, 10, 5, 2.5, 1.25, 0.5].map((plate) => {
                    const on = settings.plates.includes(plate)
                    return (
                      <button
                        key={plate}
                        type="button"
                        className={`shrink-0 px-md py-xs rounded-full type-label-md ${on ? 'bg-volt text-on-volt font-semibold' : 'bg-sc-high text-secondary'}`}
                        aria-pressed={on}
                        onClick={() => void patchSettings({ plates: on ? settings.plates.filter((x) => x !== plate) : [...settings.plates, plate].sort((a, b) => b - a) })}
                      >
                        {fmtNum(plate)}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* Cuenta: justo antes de las dos secciones que la necesitan (plans/007 §4.1) */}
          <section id="cuenta" className="flex flex-col gap-sm" style={{ scrollMarginTop: 72 }}>
            <SectionHead title="Cuenta" hint="Avisos y copia" />
            <div className="flex flex-col rounded-xl bg-sc-low overflow-hidden shadow-sm">
              {auth.status === 'in' ? (
                <Row icon="user" title={auth.email} hint="Sesión abierta en este dispositivo">
                  <button type="button" className="h-touch px-sm rounded-lg type-label-md uppercase tracking-wider text-on-surface-variant press flex-none" onClick={() => void logout()}>
                    Salir
                  </button>
                </Row>
              ) : (
                <Link to="/cuenta" className="flex flex-col">
                  <Row
                    icon="user"
                    title={auth.status === 'anon' ? 'Sin cuenta' : auth.email}
                    hint={auth.status === 'anon' ? 'Avisos y copia se quedan en este móvil' : auth.status === 'expired' ? 'Sesión caducada · toca para entrar' : 'Sin conexión · se comprueba al volver la red'}
                  >
                    <Icon name="chevron-right" size={20} className="text-on-surface-variant" />
                  </Row>
                </Link>
              )}
            </div>
          </section>

          {/* Peso corporal y recordatorios */}
          <section ref={avisosRef} id="avisos" className="flex flex-col gap-sm" style={{ scrollMarginTop: 72 }}>
            <SectionHead title="Peso corporal y recordatorios" hint={settings.notif_weight_enabled || settings.notif_train_enabled ? 'Alertas activas' : 'Sin alertas'} />
            <div className="flex flex-col gap-sm">
              {auth.status === 'anon' && <p className="type-body-sm text-on-surface-variant px-xxs">Sin cuenta, los avisos se quedan en este móvil: si reinstalas la app, se pierden.</p>}
              <div className="p-md rounded-xl bg-sc-low flex flex-col gap-sm">
                <div className="flex items-center justify-between gap-sm">
                  <div className="flex items-center gap-md min-w-0">
                    <div className="w-8 h-8 rounded bg-sc-high flex items-center justify-center text-on-surface flex-none">
                      <Icon name="weight" size={18} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="type-body-md font-medium text-on-surface">Pedir el peso por la mañana</span>
                      <span className="type-label-sm text-primary-dim">Registro diario en ayunas</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-sm">
                    <input
                      type="time"
                      aria-label="Hora del aviso de peso"
                      className="type-label-md px-sm py-xxs rounded bg-sc-high text-on-surface font-semibold"
                      style={{ border: 'none', outline: 'none', width: 78 }}
                      value={settings.notif_weight_time}
                      onChange={(e) => {
                        void patchSettings({ notif_weight_time: e.target.value })
                        void syncPrefs()
                      }}
                    />
                    <MockToggle
                      checked={settings.notif_weight_enabled}
                      label="Aviso de peso"
                      onChange={(v) => {
                        void patchSettings({ notif_weight_enabled: v, weigh_prompt: v || settings.weigh_prompt })
                        void syncPrefs()
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="p-md rounded-xl bg-sc-low flex flex-col gap-md">
                <div className="flex items-center justify-between gap-sm">
                  <div className="flex items-center gap-md min-w-0">
                    <div className="w-8 h-8 rounded bg-sc-high flex items-center justify-center text-on-surface flex-none">
                      <Icon name="bell" size={18} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="type-body-md font-medium text-on-surface">Aviso de entreno</span>
                      <span className="type-label-sm text-on-surface-variant">Alerta previa de sesión</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-sm">
                    <input
                      type="time"
                      aria-label="Hora del aviso de entreno"
                      className="type-label-md px-sm py-xxs rounded bg-sc-high text-on-surface font-semibold"
                      style={{ border: 'none', outline: 'none', width: 78 }}
                      value={settings.notif_train_time}
                      onChange={(e) => {
                        void patchSettings({ notif_train_time: e.target.value })
                        void syncPrefs()
                      }}
                    />
                    <MockToggle
                      checked={settings.notif_train_enabled}
                      label="Aviso de entreno"
                      onChange={(v) => {
                        void patchSettings({ notif_train_enabled: v })
                        void syncPrefs()
                      }}
                    />
                  </div>
                </div>
                <div className="pt-xs pl-xl flex items-center justify-between">
                  <div className="flex items-center gap-sm">
                    <Icon name="calendar" size={18} className="text-primary-dim" />
                    <span className="type-body-sm text-on-surface">Solo los días con sesión programada</span>
                  </div>
                  <MockToggle
                    small
                    checked={settings.notif_only_scheduled}
                    label="Solo días programados"
                    onChange={(v) => {
                      void patchSettings({ notif_only_scheduled: v })
                      void syncPrefs()
                    }}
                  />
                </div>
              </div>
              {push !== null && (
                <div className="p-md rounded-xl bg-sc-low flex flex-col gap-sm">
                  {!push.supported && <p className="type-body-sm text-on-surface-variant">Este navegador no soporta avisos push.</p>}
                  {push.supported && !push.standalone && <p className="type-body-sm text-on-surface-variant">La app no está instalada en la pantalla de inicio. Sin eso, en iOS los avisos no llegan: Compartir → Añadir a pantalla de inicio.</p>}
                  {push.supported && push.permission === 'denied' && <p className="type-body-sm text-on-surface-variant">El permiso está denegado a nivel de sistema. Se reactiva en los ajustes del navegador o de iOS.</p>}
                  {push.supported && push.permission === 'granted' && push.subscribed && <p className="type-body-sm text-volt">Suscripción activa en este dispositivo.</p>}
                  {push.supported && (push.permission === 'default' || (push.permission === 'granted' && !push.subscribed)) && (
                    <button type="button" className="w-full h-touch rounded-lg bg-sc-high text-on-surface type-label-md uppercase tracking-wider flex items-center justify-center gap-sm press" onClick={() => void onEnablePush()}>
                      <Icon name="bell" size={18} />
                      <span>{push.permission === 'default' ? 'Activar avisos en este dispositivo' : 'Reactivar la suscripción'}</span>
                    </button>
                  )}
                  {push.supported && push.permission === 'granted' && push.subscribed && (
                    <button type="button" className="w-full h-touch rounded-lg bg-sc-high text-on-surface type-label-md uppercase tracking-wider flex items-center justify-center gap-sm press" onClick={() => void onTest()}>
                      Enviar aviso de prueba
                    </button>
                  )}
                  {testResult !== null && <p className="type-body-sm text-on-surface-variant">{testResult}</p>}
                </div>
              )}
            </div>
          </section>

          {/* Datos */}
          <section className="flex flex-col gap-sm">
            <SectionHead title="Gestión de datos y copia" hint="Local primero" />
            <div className="rounded-xl bg-sc-low p-md flex flex-col gap-md shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-md">
                  <div className="w-9 h-9 rounded bg-sc-high flex items-center justify-center text-volt flex-none">
                    <Icon name="sync" size={20} />
                  </div>
                  <div className="flex flex-col">
                    <span className="type-body-md font-medium text-on-surface">Copia en el servidor</span>
                    <span className="type-label-sm text-on-surface-variant">
                      Última sincronización: <strong className="text-on-surface font-semibold">{lastSync}</strong>
                    </span>
                  </div>
                </div>
              </div>
              {auth.status === 'anon' && <p className="type-body-sm text-on-surface-variant">Sin cuenta, la copia se guarda con la clave de este móvil.</p>}
              {/* Las dos direcciones del servidor, emparejadas: subir y recuperar. */}
              <div className="grid grid-cols-2 gap-sm">
                <button type="button" className="h-touch rounded-lg bg-sc-high text-on-surface p-sm flex items-center justify-center gap-xs type-label-sm uppercase tracking-wider press" onClick={() => void uploadBackup().then((ok) => setImportResult(ok ? 'Copia subida.' : 'El servidor no respondió.'))}>
                  <Icon name="sync" size={18} />
                  <span>Subir copia</span>
                </button>
                <button type="button" className="h-touch rounded-lg bg-sc-high text-on-surface p-sm flex items-center justify-center gap-xs type-label-sm uppercase tracking-wider press" onClick={() => void onRestore()}>
                  <Icon name="history" size={18} className="text-primary-dim" />
                  <span>Restaurar copia</span>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-sm pt-xs">
                <button type="button" className="h-touch rounded-lg bg-sc-high text-on-surface p-sm flex items-center justify-center gap-xs type-label-sm uppercase tracking-wider press" onClick={() => void downloadExport()}>
                  <Icon name="download" size={18} className="text-primary-dim" />
                  <span>Exportar a JSON</span>
                </button>
                <button type="button" className="h-touch rounded-lg bg-sc-high text-on-surface p-sm flex items-center justify-center gap-xs type-label-sm uppercase tracking-wider press" onClick={() => fileRef.current?.click()}>
                  <Icon name="upload" size={18} className="text-on-surface-variant" />
                  <span>Importar desde JSON</span>
                </button>
              </div>
              <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={(e) => void onImport(e.target.files?.[0])} />
              <p className="type-body-sm text-on-surface-variant" role="status">
                {importResult}
              </p>
            </div>
          </section>

          {/* Legal y ayuda */}
          <section className="flex flex-col gap-sm">
            <SectionHead title="Legal y ayuda" hint="Léelo una vez" />
            <div className="flex flex-col rounded-xl bg-sc-low overflow-hidden shadow-sm">
              {(
                [
                  ['/ayuda', 'Ayuda', 'Sin conexión, copias, avisos en iPhone, cuenta'],
                  ['/privacidad', 'Política de privacidad', 'Qué datos se guardan y dónde'],
                  ['/terminos', 'Términos de uso', 'Condiciones de la cuenta'],
                ] as const
              ).map(([to, title, hint], i) => (
                <div key={to}>
                  {i > 0 && <div className="h-1px bg-sc mx-md" />}
                  <Link to={to} className="flex flex-col">
                    <Row icon={to === '/ayuda' ? 'note' : 'archive'} title={title} hint={hint}>
                      <Icon name="chevron-right" size={20} className="text-on-surface-variant" />
                    </Row>
                  </Link>
                </div>
              ))}
            </div>
          </section>

          <div className="flex items-center justify-center py-xs text-center">
            <span className="type-label-sm text-on-surface-variant uppercase tracking-widest flex items-center gap-xs">
              <Icon name="bolt" size={14} />
              Entrenamiento · v2.2 · local-first
            </span>
          </div>
        </div>
      </main>
    </div>
  )
}
