// Cola de hechos pendientes de enviar al servidor (especificaciones §6.2).
// Fire-and-forget con reintento. No es sincronización: son los hechos que el
// notificador necesita para no dar la lata. Si no hay backend accesible, los
// intentos se agotan en silencio y la app no se entera.
import { db, USER_ID, getSettings } from '../db/db'

const MAX_RETRIES = 10

export const API_BASE: string = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const settings = await getSettings()
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.api_token}`,
      ...init?.headers,
    },
  })
}

export async function enqueue(path: string, body: unknown): Promise<void> {
  await db.outbox.add({
    id: crypto.randomUUID(),
    user_id: USER_ID,
    path,
    body: JSON.stringify(body),
    created_at: Date.now(),
    retries: 0,
  })
  void flushOutbox()
}

let flushing = false

export async function flushOutbox(): Promise<void> {
  if (flushing) return
  flushing = true
  try {
    const items = await db.outbox.orderBy('created_at').toArray()
    for (const item of items) {
      try {
        const res = await apiFetch(item.path, { method: 'POST', body: item.body })
        if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429)) {
          await db.outbox.delete(item.id)
        } else {
          await bumpRetry(item.id, item.retries)
        }
      } catch {
        await bumpRetry(item.id, item.retries)
        break // sin red: no insistir con el resto ahora
      }
    }
  } finally {
    flushing = false
  }
}

async function bumpRetry(id: string, retries: number): Promise<void> {
  if (retries + 1 >= MAX_RETRIES) await db.outbox.delete(id)
  else await db.outbox.update(id, { retries: retries + 1 })
}

/** Hecho del día: {fecha, tipo}. POST diminuto al notificador. */
export async function reportFact(fact: 'weighed_in' | 'trained', localDate: string): Promise<void> {
  await enqueue('/api/facts', { local_date: localDate, [fact]: true })
}

export function initOutbox(): void {
  window.addEventListener('online', () => void flushOutbox())
  // Alta idempotente al arrancar: el token largo del primer arranque + tz IANA.
  void apiFetch('/api/register', {
    method: 'POST',
    body: JSON.stringify({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
  })
    .catch(() => undefined)
    .then(() => flushOutbox())
}
