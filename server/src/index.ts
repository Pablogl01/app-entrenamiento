// Notificador y backup (especificaciones §6). No es un servidor de datos:
// el registro de series nunca pasa por aquí. Superficie: ~7 endpoints.
import express, { type NextFunction, type Request, type Response } from 'express'
import Database from 'better-sqlite3'
import webpush from 'web-push'
import cron from 'node-cron'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// ---- .env (sin dependencia) ----
const envPath = fileURLToPath(new URL('../.env', import.meta.url))
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = /^([A-Z_]+)=(.*)$/.exec(line.trim())
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2]
  }
}

const PORT = Number(process.env.PORT ?? 8787)
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? 'https://app-entrenamiento.pgl-dev.workers.dev'

if (VAPID_PUBLIC === undefined || VAPID_PRIVATE === undefined) {
  console.error('Faltan las claves VAPID. Genera server/.env con: npm run vapid')
  process.exit(1)
}
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)

// ---- Base de datos ----
const db = new Database(process.env.DB_PATH ?? fileURLToPath(new URL('../data.db', import.meta.url)))
db.pragma('journal_mode = WAL')
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  token_hash TEXT UNIQUE NOT NULL,
  timezone TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  last_seen_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS notification_prefs (
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  enabled INTEGER NOT NULL,
  local_time TEXT NOT NULL,
  only_scheduled_days INTEGER NOT NULL,
  PRIMARY KEY (user_id, type)
);
CREATE TABLE IF NOT EXISTS weekly_schedule (
  user_id TEXT NOT NULL,
  weekday INTEGER NOT NULL,
  routine_name TEXT NOT NULL,
  PRIMARY KEY (user_id, weekday, routine_name)
);
CREATE TABLE IF NOT EXISTS daily_facts (
  user_id TEXT NOT NULL,
  local_date TEXT NOT NULL,
  weighed_in INTEGER NOT NULL DEFAULT 0,
  trained INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, local_date)
);
CREATE TABLE IF NOT EXISTS notification_log (
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  local_date TEXT NOT NULL,
  PRIMARY KEY (user_id, type, local_date)
);
CREATE TABLE IF NOT EXISTS backups (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  blob TEXT NOT NULL
);
`)

interface UserRow {
  id: string
  token_hash: string
  timezone: string
}

interface SubRow {
  endpoint: string
  user_id: string
  p256dh: string
  auth: string
}

interface PrefRow {
  user_id: string
  type: 'weight' | 'train'
  enabled: number
  local_time: string
  only_scheduled_days: number
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

// ---- App ----
const app = express()
app.use(express.json({ limit: '10mb' }))

// Despliegue: sirve el build del frontend (mismo origen que /api).
const distDir = fileURLToPath(new URL('../../dist/', import.meta.url))
if (existsSync(distDir)) {
  app.use(express.static(distDir))
}

// La clave pública no es secreta: sin auth, el cliente la pide antes de suscribirse.
app.get('/api/vapid-public', (_req, res) => {
  res.json({ key: VAPID_PUBLIC })
})

interface AuthedRequest extends Request {
  user?: UserRow
}

function bearer(req: Request): string | null {
  const h = req.headers.authorization
  if (h === undefined || !h.startsWith('Bearer ') || h.length < 24) return null
  return h.slice(7)
}

// Alta idempotente: token largo generado por el cliente (especificaciones §6.6).
app.post('/api/register', (req, res) => {
  const token = bearer(req)
  const timezone = typeof req.body?.timezone === 'string' ? (req.body.timezone as string) : 'Europe/Madrid'
  if (token === null) {
    res.status(401).json({ error: 'sin token' })
    return
  }
  const hash = hashToken(token)
  const existing = db.prepare('SELECT * FROM users WHERE token_hash = ?').get(hash) as UserRow | undefined
  if (existing === undefined) {
    db.prepare('INSERT INTO users (id, token_hash, timezone, created_at) VALUES (?, ?, ?, ?)').run(
      randomUUID(),
      hash,
      timezone,
      Date.now(),
    )
  } else {
    db.prepare('UPDATE users SET timezone = ? WHERE id = ?').run(timezone, existing.id)
  }
  res.json({ ok: true })
})

function auth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const token = bearer(req)
  if (token === null) {
    res.status(401).json({ error: 'sin token' })
    return
  }
  const user = db.prepare('SELECT * FROM users WHERE token_hash = ?').get(hashToken(token)) as UserRow | undefined
  if (user === undefined) {
    res.status(401).json({ error: 'usuario no registrado' })
    return
  }
  req.user = user
  next()
}

app.post('/api/subscription', auth, (req: AuthedRequest, res) => {
  const { endpoint, p256dh, auth: authKey } = req.body as { endpoint?: string; p256dh?: string; auth?: string }
  if (typeof endpoint !== 'string' || typeof p256dh !== 'string' || typeof authKey !== 'string') {
    res.status(400).json({ error: 'suscripción incompleta' })
    return
  }
  db.prepare(
    `INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth, last_seen_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, last_seen_at = excluded.last_seen_at`,
  ).run(endpoint, req.user!.id, p256dh, authKey, Date.now())
  res.json({ ok: true })
})

app.post('/api/prefs', auth, (req: AuthedRequest, res) => {
  const prefs = (req.body as { prefs?: unknown }).prefs
  if (!Array.isArray(prefs)) {
    res.status(400).json({ error: 'prefs debe ser una lista' })
    return
  }
  const stmt = db.prepare(
    `INSERT INTO notification_prefs (user_id, type, enabled, local_time, only_scheduled_days) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, type) DO UPDATE SET enabled = excluded.enabled, local_time = excluded.local_time, only_scheduled_days = excluded.only_scheduled_days`,
  )
  for (const p of prefs as { type?: string; enabled?: boolean; local_time?: string; only_scheduled_days?: boolean }[]) {
    if ((p.type === 'weight' || p.type === 'train') && typeof p.local_time === 'string' && /^\d{2}:\d{2}$/.test(p.local_time)) {
      stmt.run(req.user!.id, p.type, p.enabled === true ? 1 : 0, p.local_time, p.only_scheduled_days === true ? 1 : 0)
    }
  }
  res.json({ ok: true })
})

app.put('/api/schedule', auth, (req: AuthedRequest, res) => {
  const days = (req.body as { days?: unknown }).days
  if (!Array.isArray(days)) {
    res.status(400).json({ error: 'days debe ser una lista' })
    return
  }
  const userId = req.user!.id
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM weekly_schedule WHERE user_id = ?').run(userId)
    const stmt = db.prepare('INSERT OR IGNORE INTO weekly_schedule (user_id, weekday, routine_name) VALUES (?, ?, ?)')
    for (const d of days as { weekday?: number; routine_name?: string }[]) {
      if (typeof d.weekday === 'number' && d.weekday >= 0 && d.weekday <= 6 && typeof d.routine_name === 'string') {
        stmt.run(userId, d.weekday, d.routine_name)
      }
    }
  })
  tx()
  res.json({ ok: true })
})

app.post('/api/facts', auth, (req: AuthedRequest, res) => {
  const { local_date, weighed_in, trained } = req.body as {
    local_date?: string
    weighed_in?: boolean
    trained?: boolean
  }
  if (typeof local_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(local_date)) {
    res.status(400).json({ error: 'local_date inválida' })
    return
  }
  db.prepare(
    `INSERT INTO daily_facts (user_id, local_date, weighed_in, trained) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, local_date) DO UPDATE SET
       weighed_in = MAX(weighed_in, excluded.weighed_in),
       trained = MAX(trained, excluded.trained)`,
  ).run(req.user!.id, local_date, weighed_in === true ? 1 : 0, trained === true ? 1 : 0)
  res.json({ ok: true })
})

app.post('/api/backup', auth, (req: AuthedRequest, res) => {
  const data = (req.body as { data?: unknown }).data
  if (data === undefined) {
    res.status(400).json({ error: 'sin data' })
    return
  }
  const userId = req.user!.id
  db.prepare('INSERT INTO backups (id, user_id, created_at, blob) VALUES (?, ?, ?, ?)').run(
    randomUUID(),
    userId,
    Date.now(),
    JSON.stringify(data),
  )
  // se guardan los últimos 7
  db.prepare(
    `DELETE FROM backups WHERE user_id = ? AND id NOT IN
     (SELECT id FROM backups WHERE user_id = ? ORDER BY created_at DESC LIMIT 7)`,
  ).run(userId, userId)
  res.json({ ok: true })
})

app.get('/api/backup', auth, (req: AuthedRequest, res) => {
  const row = db
    .prepare('SELECT blob, created_at FROM backups WHERE user_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(req.user!.id) as { blob: string; created_at: number } | undefined
  if (row === undefined) {
    res.status(404).json({ error: 'sin copias' })
    return
  }
  res.json({ created_at: row.created_at, data: JSON.parse(row.blob) as unknown })
})

app.post('/api/test', auth, (req: AuthedRequest, res) => {
  void sendToUser(req.user!.id, {
    title: 'Aviso de prueba',
    body: 'Las notificaciones funcionan en este dispositivo.',
    url: '/',
  }).then((sent) => res.json({ ok: sent > 0, sent }))
})

// ---- Envío ----

interface Payload {
  title: string
  body: string
  url: string
}

async function sendToUser(userId: string, payload: Payload): Promise<number> {
  const subs = db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').all(userId) as SubRow[]
  let sent = 0
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      )
      sent++
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode
      // Suscripción muerta: borrar, o se acumulan endpoints zombis (§6.3).
      if (status === 404 || status === 410) {
        db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(sub.endpoint)
      }
    }
  }
  return sent
}

// ---- Cron: cada 15 minutos en UTC, hora local por IANA (§6.3) ----

const WEEKDAY_MON0: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }

function localNow(timezone: string): { date: string; minutes: number; weekday: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      weekday: 'short',
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  )
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: (Number(parts.hour) % 24) * 60 + Number(parts.minute),
    weekday: WEEKDAY_MON0[parts.weekday] ?? 0,
  }
}

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

async function tick(): Promise<void> {
  const users = db.prepare('SELECT * FROM users').all() as UserRow[]
  for (const user of users) {
    const now = localNow(user.timezone)
    const prefs = db.prepare('SELECT * FROM notification_prefs WHERE user_id = ? AND enabled = 1').all(user.id) as PrefRow[]
    const facts = db
      .prepare('SELECT weighed_in, trained FROM daily_facts WHERE user_id = ? AND local_date = ?')
      .get(user.id, now.date) as { weighed_in: number; trained: number } | undefined

    for (const pref of prefs) {
      const diff = now.minutes - minutesOf(pref.local_time)
      if (diff < 0 || diff >= 15) continue

      // Lógica de supresión: es lo que decide si el aviso es útil o molesto.
      if (pref.type === 'weight' && facts !== undefined && facts.weighed_in === 1) continue
      if (pref.type === 'train' && facts !== undefined && facts.trained === 1) continue

      let routineName: string | null = null
      if (pref.type === 'train') {
        const rows = db
          .prepare('SELECT routine_name FROM weekly_schedule WHERE user_id = ? AND weekday = ?')
          .all(user.id, now.weekday) as { routine_name: string }[]
        routineName = rows[0]?.routine_name ?? null
        if (pref.only_scheduled_days === 1 && routineName === null) continue
      }

      // Idempotencia: el cron se ejecutará dos veces alguna vez. Máximo un
      // aviso por tipo y día; sin esto, un día llegan cuatro y se desinstala.
      const logged = db
        .prepare('INSERT OR IGNORE INTO notification_log (user_id, type, local_date) VALUES (?, ?, ?)')
        .run(user.id, pref.type, now.date)
      if (logged.changes === 0) continue

      const payload: Payload =
        pref.type === 'weight'
          ? { title: 'Peso', body: '¿Cuánto pesas hoy?', url: '/?focus=peso' }
          : { title: 'Entreno', body: routineName !== null ? `Hoy toca ${routineName}` : 'Hoy toca entrenar', url: '/' }
      await sendToUser(user.id, payload)
    }
  }
}

cron.schedule('*/15 * * * *', () => {
  void tick().catch((err: unknown) => console.error('tick falló:', err))
})

// SPA fallback: cualquier GET que no sea /api devuelve la app.
app.get(/^\/(?!api\/).*/, (_req, res, next) => {
  if (!existsSync(distDir)) {
    next()
    return
  }
  res.sendFile('index.html', { root: distDir })
})

app.listen(PORT, () => {
  console.log(`Escuchando en http://localhost:${PORT} (app + API). Cron cada 15 min.`)
})
