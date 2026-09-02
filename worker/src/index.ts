// Notificador y backup en Cloudflare Workers + D1 (gratis, siempre encendido).
// Misma superficie y lógica que server/ (Node), con web-push vía WebCrypto —
// la alternativa que las especificaciones §6.3 anticipaban para runtimes edge.
// El registro de series nunca pasa por aquí.
import { buildPushPayload, type PushSubscription } from '@block65/webcrypto-web-push'

export interface Env {
  DB: D1Database
  ASSETS: Fetcher
  VAPID_SUBJECT: string
  VAPID_PUBLIC_KEY: string
  VAPID_PRIVATE_KEY: string
}

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

interface Payload {
  title: string
  body: string
  url: string
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function bearer(req: Request): string | null {
  const h = req.headers.get('Authorization')
  if (h === null || !h.startsWith('Bearer ') || h.length < 24) return null
  return h.slice(7)
}

async function authUser(req: Request, env: Env): Promise<UserRow | null> {
  const token = bearer(req)
  if (token === null) return null
  const hash = await hashToken(token)
  return env.DB.prepare('SELECT * FROM users WHERE token_hash = ?').bind(hash).first<UserRow>()
}

async function readBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = await req.json()
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

// ---- Envío ----

async function sendToUser(env: Env, userId: string, payload: Payload): Promise<number> {
  const vapid = {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  }
  const subs = (await env.DB.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').bind(userId).all<SubRow>()).results
  let sent = 0
  for (const sub of subs) {
    const subscription: PushSubscription = {
      endpoint: sub.endpoint,
      expirationTime: null,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    }
    try {
      const init = await buildPushPayload({ data: JSON.stringify(payload), options: { ttl: 3600 } }, subscription, vapid)
      const res = await fetch(sub.endpoint, init)
      if (res.status === 404 || res.status === 410) {
        // Suscripción muerta: borrar, o se acumulan endpoints zombis (§6.3).
        await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(sub.endpoint).run()
      } else if (res.ok || res.status === 201) {
        sent++
      }
    } catch {
      // endpoint inalcanzable: se reintentará en el siguiente cron
    }
  }
  return sent
}

// ---- API ----

async function handleApi(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url)
  const route = `${req.method} ${url.pathname}`

  // La clave pública no es secreta: el cliente la pide antes de suscribirse.
  if (route === 'GET /api/vapid-public') return json({ key: env.VAPID_PUBLIC_KEY })

  if (route === 'POST /api/register') {
    const token = bearer(req)
    if (token === null) return json({ error: 'sin token' }, 401)
    const body = await readBody(req)
    const timezone = typeof body.timezone === 'string' ? body.timezone : 'Europe/Madrid'
    const hash = await hashToken(token)
    const existing = await env.DB.prepare('SELECT id FROM users WHERE token_hash = ?').bind(hash).first<{ id: string }>()
    if (existing === null) {
      await env.DB.prepare('INSERT INTO users (id, token_hash, timezone, created_at) VALUES (?, ?, ?, ?)')
        .bind(crypto.randomUUID(), hash, timezone, Date.now())
        .run()
    } else {
      await env.DB.prepare('UPDATE users SET timezone = ? WHERE id = ?').bind(timezone, existing.id).run()
    }
    return json({ ok: true })
  }

  const user = await authUser(req, env)
  if (user === null) return json({ error: 'sin token o usuario no registrado' }, 401)

  switch (route) {
    case 'POST /api/subscription': {
      const body = await readBody(req)
      const { endpoint, p256dh, auth } = body
      if (typeof endpoint !== 'string' || typeof p256dh !== 'string' || typeof auth !== 'string') {
        return json({ error: 'suscripción incompleta' }, 400)
      }
      await env.DB.prepare(
        `INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth, last_seen_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, last_seen_at = excluded.last_seen_at`,
      )
        .bind(endpoint, user.id, p256dh, auth, Date.now())
        .run()
      return json({ ok: true })
    }

    case 'POST /api/prefs': {
      const body = await readBody(req)
      if (!Array.isArray(body.prefs)) return json({ error: 'prefs debe ser una lista' }, 400)
      for (const p of body.prefs as { type?: string; enabled?: boolean; local_time?: string; only_scheduled_days?: boolean }[]) {
        if ((p.type === 'weight' || p.type === 'train') && typeof p.local_time === 'string' && /^\d{2}:\d{2}$/.test(p.local_time)) {
          await env.DB.prepare(
            `INSERT INTO notification_prefs (user_id, type, enabled, local_time, only_scheduled_days) VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(user_id, type) DO UPDATE SET enabled = excluded.enabled, local_time = excluded.local_time, only_scheduled_days = excluded.only_scheduled_days`,
          )
            .bind(user.id, p.type, p.enabled === true ? 1 : 0, p.local_time, p.only_scheduled_days === true ? 1 : 0)
            .run()
        }
      }
      return json({ ok: true })
    }

    case 'PUT /api/schedule': {
      const body = await readBody(req)
      if (!Array.isArray(body.days)) return json({ error: 'days debe ser una lista' }, 400)
      const statements = [env.DB.prepare('DELETE FROM weekly_schedule WHERE user_id = ?').bind(user.id)]
      for (const d of body.days as { weekday?: number; routine_name?: string }[]) {
        if (typeof d.weekday === 'number' && d.weekday >= 0 && d.weekday <= 6 && typeof d.routine_name === 'string') {
          statements.push(
            env.DB.prepare('INSERT OR IGNORE INTO weekly_schedule (user_id, weekday, routine_name) VALUES (?, ?, ?)').bind(
              user.id,
              d.weekday,
              d.routine_name,
            ),
          )
        }
      }
      await env.DB.batch(statements)
      return json({ ok: true })
    }

    case 'POST /api/facts': {
      const body = await readBody(req)
      const localDate = body.local_date
      if (typeof localDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
        return json({ error: 'local_date inválida' }, 400)
      }
      await env.DB.prepare(
        `INSERT INTO daily_facts (user_id, local_date, weighed_in, trained) VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id, local_date) DO UPDATE SET
           weighed_in = MAX(weighed_in, excluded.weighed_in),
           trained = MAX(trained, excluded.trained)`,
      )
        .bind(user.id, localDate, body.weighed_in === true ? 1 : 0, body.trained === true ? 1 : 0)
        .run()
      return json({ ok: true })
    }

    case 'POST /api/backup': {
      const body = await readBody(req)
      if (body.data === undefined) return json({ error: 'sin data' }, 400)
      await env.DB.prepare('INSERT INTO backups (id, user_id, created_at, blob) VALUES (?, ?, ?, ?)')
        .bind(crypto.randomUUID(), user.id, Date.now(), JSON.stringify(body.data))
        .run()
      // se guardan los últimos 7
      await env.DB.prepare(
        `DELETE FROM backups WHERE user_id = ? AND id NOT IN
         (SELECT id FROM backups WHERE user_id = ? ORDER BY created_at DESC LIMIT 7)`,
      )
        .bind(user.id, user.id)
        .run()
      return json({ ok: true })
    }

    case 'GET /api/backup': {
      const row = await env.DB.prepare('SELECT blob, created_at FROM backups WHERE user_id = ? ORDER BY created_at DESC LIMIT 1')
        .bind(user.id)
        .first<{ blob: string; created_at: number }>()
      if (row === null) return json({ error: 'sin copias' }, 404)
      return json({ created_at: row.created_at, data: JSON.parse(row.blob) as unknown })
    }

    case 'POST /api/test': {
      const sent = await sendToUser(env, user.id, {
        title: 'Aviso de prueba',
        body: 'Las notificaciones funcionan en este dispositivo.',
        url: '/',
      })
      return json({ ok: sent > 0, sent })
    }

    default:
      return json({ error: 'no existe' }, 404)
  }
}

// ---- Cron: cada 15 minutos en UTC, hora local por zona IANA (§6.3) ----

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

async function tick(env: Env): Promise<void> {
  const users = (await env.DB.prepare('SELECT * FROM users').all<UserRow>()).results
  for (const user of users) {
    const now = localNow(user.timezone)
    const prefs = (
      await env.DB.prepare('SELECT * FROM notification_prefs WHERE user_id = ? AND enabled = 1').bind(user.id).all<PrefRow>()
    ).results
    const facts = await env.DB.prepare('SELECT weighed_in, trained FROM daily_facts WHERE user_id = ? AND local_date = ?')
      .bind(user.id, now.date)
      .first<{ weighed_in: number; trained: number }>()

    for (const pref of prefs) {
      const diff = now.minutes - minutesOf(pref.local_time)
      if (diff < 0 || diff >= 15) continue

      // Lógica de supresión: decide si el aviso es útil o molesto (§6.3).
      if (pref.type === 'weight' && facts !== null && facts.weighed_in === 1) continue
      if (pref.type === 'train' && facts !== null && facts.trained === 1) continue

      let routineName: string | null = null
      if (pref.type === 'train') {
        const row = await env.DB.prepare('SELECT routine_name FROM weekly_schedule WHERE user_id = ? AND weekday = ? LIMIT 1')
          .bind(user.id, now.weekday)
          .first<{ routine_name: string }>()
        routineName = row?.routine_name ?? null
        if (pref.only_scheduled_days === 1 && routineName === null) continue
      }

      // Idempotencia: máximo un aviso por tipo y día aunque el cron repita.
      const logged = await env.DB.prepare('INSERT OR IGNORE INTO notification_log (user_id, type, local_date) VALUES (?, ?, ?)')
        .bind(user.id, pref.type, now.date)
        .run()
      if (logged.meta.changes === 0) continue

      const payload: Payload =
        pref.type === 'weight'
          ? { title: 'Peso', body: '¿Cuánto pesas hoy?', url: '/?focus=peso' }
          : { title: 'Entreno', body: routineName !== null ? `Hoy toca ${routineName}` : 'Hoy toca entrenar', url: '/' }
      await sendToUser(env, user.id, payload)
    }
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    if (url.pathname.startsWith('/api/')) return handleApi(req, env)
    return env.ASSETS.fetch(req)
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(tick(env))
  },
} satisfies ExportedHandler<Env>
