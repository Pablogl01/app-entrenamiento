// Temporizador de descanso (especificaciones §4.2 v2.1). Estado fuera de React
// para que sobreviva a cambios de vista; solo la sesión en vivo lo pinta.
import { useEffect, useSyncExternalStore } from 'react'

interface RestState {
  endsAt: number | null
  totalSeconds: number
  rpeTarget: number | null
  /** Último tic: la vista deriva el tiempo restante de aquí, no de Date.now(). */
  now: number
}

let state: RestState = { endsAt: null, totalSeconds: 0, rpeTarget: null, now: 0 }
const listeners = new Set<() => void>()

function emit(): void {
  for (const l of listeners) l()
}

export function startRest(seconds: number, rpeTarget: number | null): void {
  if (seconds <= 0) return
  const now = Date.now()
  state = { endsAt: now + seconds * 1000, totalSeconds: seconds, rpeTarget, now }
  emit()
}

export function addRest(seconds: number): void {
  if (state.endsAt === null) return
  const base = Math.max(state.endsAt, Date.now())
  state = { ...state, endsAt: base + seconds * 1000, totalSeconds: state.totalSeconds + seconds, now: Date.now() }
  emit()
}

export function skipRest(): void {
  state = { endsAt: null, totalSeconds: 0, rpeTarget: null, now: 0 }
  emit()
}

function subscribe(l: () => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

export interface RestView {
  active: boolean
  remainingSeconds: number
  totalSeconds: number
  rpeTarget: number | null
}

export function useRest(): RestView {
  const s = useSyncExternalStore(subscribe, () => state)
  // tick por segundo mientras corre; al llegar a cero vibra y se apaga
  useEffect(() => {
    if (s.endsAt === null) return
    const id = window.setInterval(() => {
      if (state.endsAt !== null && state.endsAt <= Date.now()) {
        navigator.vibrate?.([120, 60, 120])
        window.setTimeout(skipRest, 1500)
        state = { ...state, endsAt: Date.now(), now: Date.now() }
        window.clearInterval(id)
        emit()
        return
      }
      state = { ...state, now: Date.now() }
      emit()
    }, 500)
    return () => window.clearInterval(id)
  }, [s.endsAt])
  const remaining = s.endsAt === null ? 0 : Math.max(0, Math.ceil((s.endsAt - s.now) / 1000))
  return { active: s.endsAt !== null, remainingSeconds: remaining, totalSeconds: s.totalSeconds, rpeTarget: s.rpeTarget }
}
