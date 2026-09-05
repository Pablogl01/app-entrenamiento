// Cuenta de usuario con sesión persistente (plans/007). Dos credenciales:
//  - access token (JWT, 15 min): SOLO en esta variable de módulo. Nunca en IndexedDB
//    ni en localStorage: un XSS no debe poder llevárselo.
//  - refresh token: cookie HttpOnly que pone el servidor y que el navegador manda
//    solo a /api/auth/*. Este módulo nunca la ve; solo la hace viajar.
// La cuenta es opcional: sin sesión, entrenar funciona igual. Solo avisos y copia
// en el servidor la necesitan.
import { useSyncExternalStore } from 'react'
import { getSettings, patchSettings } from '../db/db'

export const API_BASE: string = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

export type AuthState =
  | { status: 'anon' }
  | { status: 'in'; email: string }
  /** Hay cuenta guardada pero el servidor no renovó la sesión: hay que volver a entrar. */
  | { status: 'expired'; email: string }
  /** Hay cuenta guardada y no hubo red para comprobar la sesión. */
  | { status: 'offline'; email: string }

export type AuthResult = 'ok' | 'bad-credentials' | 'locked' | 'exists' | 'weak' | 'offline' | 'server'

interface SessionResponse {
  access_token: string
  user: { id: string; email: string | null }
}

let accessToken: string | null = null
let state: AuthState = { status: 'anon' }
const listeners = new Set<() => void>()

function setState(next: AuthState): void {
  state = next
  for (const fn of listeners) fn()
}

export function authState(): AuthState {
  return state
}

export function getAccessToken(): string | null {
  return accessToken
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Estado de la sesión para la UI; se repinta al entrar, salir o caducar. */
export function useAuthState(): AuthState {
  return useSyncExternalStore(subscribe, authState, authState)
}

async function acceptSession(data: SessionResponse): Promise<void> {
  accessToken = data.access_token
  const email = data.user.email ?? ''
  const settings = await getSettings()
  if (settings.account_email !== email) await patchSettings({ account_email: email })
  setState({ status: 'in', email })
}

let refreshing: Promise<boolean> | null = null

/** Renueva la sesión con la cookie. Una sola llamada en vuelo aunque la pidan varios. */
export function refreshSession(): Promise<boolean> {
  if (refreshing !== null) return refreshing
  refreshing = (async () => {
    const settings = await getSettings()
    const saved = settings.account_email
    try {
      // Con tope: el arranque espera a esto y una red lenta no debe retener la app.
      const res = await fetch(`${API_BASE}/api/auth/refresh`, { method: 'POST', credentials: 'same-origin', signal: AbortSignal.timeout(8000) })
      if (res.ok) {
        await acceptSession((await res.json()) as SessionResponse)
        return true
      }
      accessToken = null
      setState(saved !== null ? { status: 'expired', email: saved } : { status: 'anon' })
      return false
    } catch {
      accessToken = null
      setState(saved !== null ? { status: 'offline', email: saved } : { status: 'anon' })
      return false
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

async function authRequest(path: '/api/auth/login' | '/api/auth/register', email: string, password: string): Promise<AuthResult> {
  const settings = await getSettings()
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        // Lo que este móvil guardó sin cuenta (prefs, suscripción, copias) pasa a la cuenta.
        legacy_token: settings.api_token,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    })
  } catch {
    return 'offline'
  }
  if (res.ok) {
    await acceptSession((await res.json()) as SessionResponse)
    return 'ok'
  }
  switch (res.status) {
    case 400:
      return 'weak'
    case 401:
      return 'bad-credentials'
    case 409:
      return 'exists'
    case 429:
      return 'locked'
    default:
      return 'server'
  }
}

export function login(email: string, password: string): Promise<AuthResult> {
  return authRequest('/api/auth/login', email, password)
}

export function register(email: string, password: string): Promise<AuthResult> {
  return authRequest('/api/auth/register', email, password)
}

/** Cierra la sesión de este dispositivo. Los datos locales no se tocan. */
export async function logout(): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST', credentials: 'same-origin' })
  } catch {
    // sin red: la cookie caduca sola; el estado local sí se limpia
  }
  accessToken = null
  await patchSettings({ account_email: null })
  setState({ status: 'anon' })
}

/** Restaura el estado desde Settings sin red (para pintar Ajustes antes del refresh). */
export async function hydrateAuthState(): Promise<void> {
  const settings = await getSettings()
  if (settings.account_email !== null && state.status === 'anon') setState({ status: 'offline', email: settings.account_email })
}
