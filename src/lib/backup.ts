// Backup unidireccional (especificaciones §6.5): snapshot completo al servidor
// y export manual a JSON. No hay sync bidireccional.
import { db, patchSettings } from '../db/db'
import { apiFetch } from './outbox'

const TABLES = [
  'exercises', 'routines', 'routine_exercises', 'routine_schedules', 'schedule_overrides',
  'sessions', 'session_exercises', 'sets', 'body_metrics', 'settings', 'cycles', 'cycle_blocks',
] as const

interface Snapshot {
  version: 1 | 2
  exported_at: string
  tables: Record<string, unknown[]>
}

export async function makeSnapshot(): Promise<Snapshot> {
  const tables: Record<string, unknown[]> = {}
  for (const n of TABLES) tables[n] = await db.table(n).toArray()
  return { version: 2, exported_at: new Date().toISOString(), tables }
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

type Row = Record<string, unknown>

/** Un snapshot v1 recibe la misma migración que aplica Dexie al abrir una base vieja. */
function migrateV1(tables: Record<string, unknown[]>): Record<string, unknown[]> {
  const out: Record<string, unknown[]> = { ...tables }
  out.sets = ((tables.sets ?? []) as Row[]).map((s) => {
    const rir = s.rir
    const { rir: _drop, ...rest } = s
    void _drop
    return { ...rest, rpe: typeof rir === 'number' ? Math.max(6, Math.min(10, 10 - rir)) : null, velocity: null }
  })
  out.sessions = ((tables.sessions ?? []) as Row[]).map((s) => ({
    ...s,
    rating: typeof s.rating === 'number' && s.rating <= 5 ? s.rating * 2 : s.rating,
    paused_at: null,
    paused_ms: 0,
    planned_sets: null,
  }))
  for (const t of ['routine_exercises', 'session_exercises']) {
    out[t] = ((tables[t] ?? []) as Row[]).map((r) => ({ ...r, target_rpe: null, rest_seconds: 90 }))
  }
  out.exercises = ((tables.exercises ?? []) as Row[]).map((e) => ({ ...e, image: null }))
  out.body_metrics = ((tables.body_metrics ?? []) as Row[]).map((m) => ({ ...m, sleep_hours: null, recovery: null }))
  out.cycles = []
  out.cycle_blocks = []
  out.schedule_overrides = []
  return out
}

/** La sesión y la clave de este móvil son de ahora, no de la copia. */
const KEEP_FROM_CURRENT = ['api_token', 'account_email', 'last_backup_at'] as const

async function applySnapshot(snap: Snapshot): Promise<void> {
  const tables = snap.version === 1 ? migrateV1(snap.tables) : snap.tables
  const current = await db.settings.get('singleton')
  await db.transaction('rw', db.tables, async () => {
    for (const name of TABLES) {
      const rows = tables[name]
      if (!Array.isArray(rows)) continue
      const table = db.table(name)
      await table.clear()
      if (name === 'settings' && current !== undefined) {
        const keep: Record<string, unknown> = {}
        for (const k of KEEP_FROM_CURRENT) keep[k] = current[k]
        await table.bulkAdd(rows.map((r) => ({ ...(r as Record<string, unknown>), ...keep })))
      } else {
        await table.bulkAdd(rows)
      }
    }
  })
}

export async function importSnapshot(file: File): Promise<'ok' | 'error'> {
  try {
    const snap = JSON.parse(await file.text()) as Snapshot
    if (snap.version !== 1 && snap.version !== 2) return 'error'
    await applySnapshot(snap)
    return 'ok'
  } catch {
    return 'error'
  }
}

export interface BackupCounts {
  routines: number
  sessions: number
  sets: number
  weights: number
}

function countRows(snap: Snapshot): BackupCounts {
  const n = (k: string) => (Array.isArray(snap.tables[k]) ? snap.tables[k].length : 0)
  return { routines: n('routines'), sessions: n('sessions'), sets: n('sets'), weights: n('body_metrics') }
}

export type ServerBackup =
  | { ok: true; created_at: number; snapshot: Snapshot; counts: BackupCounts }
  | { ok: false; reason: 'auth' | 'none' | 'offline' | 'error' }

/**
 * Baja la copia más reciente del servidor sin aplicarla. Ajustes enseña primero
 * su fecha y su contenido: restaurar reemplaza los datos del móvil y una copia
 * vacía se ve venir antes de perder nada.
 */
export async function fetchServerBackup(): Promise<ServerBackup> {
  let res: Response
  try {
    res = await apiFetch('/api/backup')
  } catch {
    return { ok: false, reason: 'offline' }
  }
  if (res.status === 401) return { ok: false, reason: 'auth' }
  if (res.status === 404) return { ok: false, reason: 'none' }
  if (!res.ok) return { ok: false, reason: 'error' }
  try {
    const body = (await res.json()) as { created_at: number; data: Snapshot }
    const snap = body.data
    if (snap.version !== 1 && snap.version !== 2) return { ok: false, reason: 'error' }
    return { ok: true, created_at: body.created_at, snapshot: snap, counts: countRows(snap) }
  } catch {
    return { ok: false, reason: 'error' }
  }
}

/** Aplica una copia que el usuario ya ha visto y confirmado. */
export async function restoreSnapshot(snap: Snapshot): Promise<'ok' | 'error'> {
  try {
    await applySnapshot(snap)
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
