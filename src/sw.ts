/// <reference lib="webworker" />
// Service worker: precache completo (la app funciona sin red) + push.
// Todo push termina en una notificación visible: en iOS, un push silencioso
// puede costar la revocación del permiso (especificaciones §6.3).
import { precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)

interface PushPayload {
  title?: string
  body?: string
  url?: string
}

self.addEventListener('push', (event) => {
  const data: PushPayload = (() => {
    try {
      return (event.data?.json() as PushPayload) ?? {}
    } catch {
      return {}
    }
  })()
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Entrenamiento', {
      body: data.body ?? '',
      data: { url: data.url ?? '/' },
    }),
  )
})

// Deep link vía notificationclick; sin botones de acción (soporte irregular iOS).
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      for (const client of clients) {
        await client.navigate(url)
        return client.focus()
      }
      return self.clients.openWindow(url)
    }),
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') void self.skipWaiting()
})
