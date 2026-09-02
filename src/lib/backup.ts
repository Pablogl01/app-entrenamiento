// Backup unidireccional (especificaciones §6.5): snapshot completo al servidor
// y export manual a JSON. No hay sync bidireccional.
import { db, patchSettings } from '../db/db'
import { apiFetch } from './outbox'

interface Snapshot {
  version: 1
  exported_at: string
  tables: Record<string, unknown[]>
}

export async function makeSnapshot(): Promise<Snapshot> {
  const names = [
    'exercises', 'routines', 'routine_exercises', 'routine_schedules',
    'sessions', 'session_exercises', 'sets', 'body_metrics', 'settings',
  ] as const
  const tables: Record<string, unknown[]> = {}
  for (const n of names) tables[n] = await db.table(n).toArray()
  return { version: 1, exported_at: new Date().toISOString(), tables }
}

/** Export manual: descarga un JSON. El botón cuesta media tarde y salva un año. */
export async function downloadExport(): Promise<void> {
  const snap = await makeSnapshot()
  const blob = new Blob([JSON.stringify(snap)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `entrenamiento-${snap.exported_at.slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}

export async function importSnapshot(file: File): Promise<'ok' | 'error'> {
  try {
    const snap = JSON.parse(await file.text()) as Snapshot
    if (snap.version !== 1) return 'error'
    await db.transaction('rw', db.tables, async () => {
      for (const [name, rows] of Object.entries(snap.tables)) {
        const table = db.table(name)
        await table.clear()
        await table.bulkAdd(rows)
      }
    })
    return 'ok'
  } catch {
    return 'error'
  }
}

/** Sube un snapshot al servidor. Fire-and-forget: falla en silencio. */
export async function uploadBackup(): Promise<boolean> {
  try {
    const snap = await makeSnapshot()
    const res = await apiFetch('/api/backup', { method: 'POST', body: JSON.stringify({ data: snap }) })
    if (res.ok) await patchSettings({ last_backup_at: Date.now() })
    return res.ok
  } catch {
    return false
  }
}

/** Una vez al día como mucho, además del cierre de sesión. */
export async function dailyBackupIfDue(): Promise<void> {
  const s = await db.settings.get('singleton')
  if (!s) return
  if (s.last_backup_at !== null && Date.now() - s.last_backup_at < 20 * 3600_000) return
  void uploadBackup()
}
