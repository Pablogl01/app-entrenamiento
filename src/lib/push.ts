// Notificaciones push (especificaciones §6). El cliente solo: pide permiso
// desde una interacción, se suscribe con userVisibleOnly, y reenvía la
// suscripción al arrancar si el endpoint cambió.
import { getSettings, patchSettings } from '../db/db'
import { apiFetch } from './outbox'
import { todayISO } from './dates'

export type PushStatus = {
  standalone: boolean
  supported: boolean
  permission: NotificationPermission | 'unsupported'
  subscribed: boolean
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true)
  )
}

export async function pushStatus(): Promise<PushStatus> {
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  if (!supported) {
    return { standalone: isStandalone(), supported, permission: 'unsupported', subscribed: false }
  }
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return {
    standalone: isStandalone(),
    supported,
    permission: Notification.permission,
    subscribed: sub != null,
  }
}

function urlB64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

async function sendSubscription(sub: PushSubscription): Promise<void> {
  const json = sub.toJSON()
  await apiFetch('/api/subscription', {
    method: 'POST',
    body: JSON.stringify({ endpoint: sub.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth }),
  })
  await patchSettings({ push_endpoint: sub.endpoint })
}

/** Alta completa: registro de usuario + permiso + suscripción. Desde un botón. */
export async function enablePush(): Promise<'ok' | 'denied' | 'error'> {
  try {
    await apiFetch('/api/register', {
      method: 'POST',
      body: JSON.stringify({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
    })
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return 'denied'
    const reg = await navigator.serviceWorker.ready
    const keyRes = await apiFetch('/api/vapid-public')
    if (!keyRes.ok) return 'error'
    const { key } = (await keyRes.json()) as { key: string }
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true, // obligatorio en iOS (especificaciones §6.3)
      applicationServerKey: urlB64ToUint8Array(key) as BufferSource,
    })
    await sendSubscription(sub)
    await syncPrefs()
    return 'ok'
  } catch {
    return 'error'
  }
}

/** Al arrancar: si el endpoint cambió (reinstalación, limpieza), reenviarlo. */
export async function ensureSubscription(): Promise<void> {
  try {
    if (!('serviceWorker' in navigator) || Notification.permission !== 'granted') return
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    if (!sub) return
    const settings = await getSettings()
    if (settings.push_endpoint !== sub.endpoint) await sendSubscription(sub)
  } catch {
    // sin red o sin backend: nada que hacer
  }
}

/** Sube las preferencias de aviso y la programación semanal al notificador. */
export async function syncPrefs(): Promise<void> {
  try {
    const s = await getSettings()
    await apiFetch('/api/prefs', {
      method: 'POST',
      body: JSON.stringify({
        prefs: [
          { type: 'weight', enabled: s.notif_weight_enabled, local_time: s.notif_weight_time, only_scheduled_days: false },
          { type: 'train', enabled: s.notif_train_enabled, local_time: s.notif_train_time, only_scheduled_days: s.notif_only_scheduled },
        ],
      }),
    })
  } catch {
    // reintento implícito la próxima vez que se toquen los ajustes
  }
}

export async function syncSchedule(days: { weekday: number; routine_name: string }[]): Promise<void> {
  try {
    await apiFetch('/api/schedule', { method: 'PUT', body: JSON.stringify({ days }) })
  } catch {
    // idem
  }
}

export async function sendTestNotification(): Promise<boolean> {
  try {
    const res = await apiFetch('/api/test', { method: 'POST', body: JSON.stringify({ local_date: todayISO() }) })
    return res.ok
  } catch {
    return false
  }
}
