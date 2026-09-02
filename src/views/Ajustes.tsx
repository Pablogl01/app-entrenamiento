import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getSettings, patchSettings } from '../db/db'
import { downloadExport, importSnapshot, uploadBackup } from '../lib/backup'
import { enablePush, pushStatus, sendTestNotification, syncPrefs, type PushStatus } from '../lib/push'
import { fmtRelative } from '../lib/format'
import { isoOf } from '../lib/dates'
import { TopBar } from '../components/TopBar'
import { Toggle } from '../components/Toggle'
import { NumberField } from '../components/NumberField'
import type { LoadType } from '../db/types'

const LOAD_LABELS: { key: LoadType; label: string }[] = [
  { key: 'barbell', label: 'Barra' },
  { key: 'dumbbell', label: 'Mancuernas' },
  { key: 'machine', label: 'Máquina' },
  { key: 'cable', label: 'Polea' },
  { key: 'bodyweight', label: 'Corporal (lastre)' },
]

export function Ajustes() {
  const settings = useLiveQuery(getSettings)
  const [push, setPush] = useState<PushStatus | null>(null)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void pushStatus().then(setPush)
  }, [])

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

  const inc = settings.increments

  return (
    <div className="screen screen--stacked">
      <TopBar />
      <div className="pad">
        <h1 className="t-title">Ajustes</h1>

        <section style={{ marginTop: 'var(--sp-5)' }}>
          <p className="t-body">Unidad de peso</p>
          <div className="seltext" style={{ marginTop: 'var(--sp-3)' }}>
            {(['kg', 'lb'] as const).map((u) => (
              <button key={u} className={`t-info${settings.unit === u ? ' active' : ''}`} onClick={() => void patchSettings({ unit: u })}>
                {u}
              </button>
            ))}
          </div>
        </section>

        <section style={{ marginTop: 'var(--sp-6)' }}>
          <p className="t-body">Incrementos por defecto</p>
          <p className="t-info soft" style={{ marginTop: 4 }}>
            Para ejercicios nuevos. Cada ejercicio guarda el suyo.
          </p>
          {LOAD_LABELS.map(({ key, label }) => (
            <div key={key} className="row">
              <span className="row__main t-body">{label}</span>
              <NumberField
                value={inc[key]}
                suffix={settings.unit}
                ariaLabel={`Incremento ${label}`}
                onCommit={(n) => void patchSettings({ increments: { ...inc, [key]: n } })}
              />
            </div>
          ))}
        </section>

        <section style={{ marginTop: 'var(--sp-6)' }}>
          <p className="t-body">Peso corporal</p>
          <div className="row">
            <span className="row__main t-body">Hoy pide el peso por la mañana</span>
            <Toggle checked={settings.weigh_prompt} onChange={(v) => void patchSettings({ weigh_prompt: v })} ariaLabel="Pedir peso" />
          </div>
        </section>

        <section style={{ marginTop: 'var(--sp-6)' }}>
          <p className="t-body">Avisos</p>

          {/* Bloque de estado sincero (especificaciones §6.4). */}
          {push !== null && (
            <div style={{ marginTop: 'var(--sp-3)' }}>
              {!push.supported && <p className="t-info soft">Este navegador no soporta avisos push.</p>}
              {push.supported && !push.standalone && (
                <p className="t-info soft">
                  La app no está instalada en la pantalla de inicio. Sin eso, en iOS los avisos no llegan: Compartir →
                  Añadir a pantalla de inicio.
                </p>
              )}
              {push.supported && push.permission === 'denied' && (
                <p className="t-info soft">
                  El permiso está denegado a nivel de sistema. La app no puede volver a pedirlo: se reactiva en los
                  ajustes del navegador o de iOS.
                </p>
              )}
              {push.supported && push.permission === 'granted' && push.subscribed && (
                <p className="t-info soft">Suscripción activa en este dispositivo.</p>
              )}
              {push.supported && push.permission === 'default' && (
                <button className="btn-text" onClick={() => void onEnablePush()}>
                  Activar avisos en este dispositivo
                </button>
              )}
              {push.supported && push.permission === 'granted' && !push.subscribed && (
                <button className="btn-text" onClick={() => void onEnablePush()}>
                  Reactivar la suscripción
                </button>
              )}
            </div>
          )}

          <div className="row" style={{ marginTop: 'var(--sp-3)' }}>
            <span className="row__main t-body">Peso: ¿cuánto pesas hoy?</span>
            <input
              type="time"
              aria-label="Hora del aviso de peso"
              className="t-data time-input"
              value={settings.notif_weight_time}
              onChange={(e) => {
                void patchSettings({ notif_weight_time: e.target.value })
                void syncPrefs()
              }}
            />
            <Toggle
              checked={settings.notif_weight_enabled}
              onChange={(v) => {
                void patchSettings({ notif_weight_enabled: v })
                void syncPrefs()
              }}
              ariaLabel="Aviso de peso"
            />
          </div>
          <div className="row">
            <span className="row__main t-body">Entreno: hoy toca</span>
            <input
              type="time"
              aria-label="Hora del aviso de entreno"
              className="t-data time-input"
              value={settings.notif_train_time}
              onChange={(e) => {
                void patchSettings({ notif_train_time: e.target.value })
                void syncPrefs()
              }}
            />
            <Toggle
              checked={settings.notif_train_enabled}
              onChange={(v) => {
                void patchSettings({ notif_train_enabled: v })
                void syncPrefs()
              }}
              ariaLabel="Aviso de entreno"
            />
          </div>
          <div className="row">
            <span className="row__main t-body">Solo los días con sesión programada</span>
            <Toggle
              checked={settings.notif_only_scheduled}
              onChange={(v) => {
                void patchSettings({ notif_only_scheduled: v })
                void syncPrefs()
              }}
              ariaLabel="Solo días programados"
            />
          </div>

          <button className="btn-text" style={{ marginTop: 'var(--sp-3)' }} onClick={() => void onTest()}>
            Enviar aviso de prueba
          </button>
          {testResult !== null && <p className="t-info soft">{testResult}</p>}
        </section>

        <section style={{ marginTop: 'var(--sp-6)' }}>
          <p className="t-body">Datos</p>
          <div className="row">
            <span className="row__main t-body">Copia en el servidor</span>
            <span className="t-data soft">
              {settings.last_backup_at === null ? 'nunca' : fmtRelative(isoOf(new Date(settings.last_backup_at)))}
            </span>
          </div>
          <button className="btn-text" onClick={() => void uploadBackup().then((ok) => setImportResult(ok ? 'Copia subida.' : 'El servidor no respondió.'))}>
            Subir copia ahora
          </button>
          <button className="btn-text" onClick={() => void downloadExport()}>
            Exportar a JSON
          </button>
          <button className="btn-text" onClick={() => fileRef.current?.click()}>
            Importar desde JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={(e) => void onImport(e.target.files?.[0])}
          />
          {importResult !== null && <p className="t-info soft">{importResult}</p>}
        </section>
      </div>
    </div>
  )
}
