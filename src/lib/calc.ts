import type { SetEntry } from '../db/types'
import { daysBetween } from './dates'

/** e1RM por Epley (especificaciones §5.2). Solo fiable hasta 12 reps. */
export function epley(weight: number, reps: number): number {
  return weight * (1 + reps / 30)
}

/** e1RM de una serie, o null si no aplica (calentamiento, >12 reps, sin peso). */
export function setE1rm(set: SetEntry): number | null {
  if (!set.completed || set.kind === 'warmup') return null
  if (set.weight === null || set.weight <= 0 || set.reps <= 0) return null
  if (set.reps > 12) return null // Epley degradado: excluido (§8.3, cerrada v1.2)
  return epley(set.weight, set.reps)
}

/** Volumen de una serie: peso × reps sobre series de trabajo. */
export function setVolume(set: SetEntry): number {
  if (!set.completed || set.kind === 'warmup') return 0
  if (set.weight === null) return 0
  return set.weight * set.reps
}

export interface Point {
  /** Fecha ISO. */
  date: string
  value: number
}

/** Media móvil trailing de 7 días por fecha; tolera huecos. */
export function movingAvg7(points: Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  return sorted.map((p) => {
    const window = sorted.filter(
      (q) => daysBetween(q.date, p.date) >= 0 && daysBetween(q.date, p.date) < 7,
    )
    const avg = window.reduce((s, q) => s + q.value, 0) / window.length
    return { date: p.date, value: avg }
  })
}

export interface Regression {
  slope: number
  intercept: number
}

/** Regresión lineal simple sobre (x, y). Devuelve null con menos de 2 puntos. */
export function linReg(xs: number[], ys: number[]): Regression | null {
  const n = xs.length
  if (n < 2) return null
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my)
    den += (xs[i] - mx) ** 2
  }
  if (den === 0) return null
  return { slope: num / den, intercept: my - (num / den) * mx }
}

/**
 * Tendencia de peso corporal en kg/semana: regresión sobre la media móvil
 * de las últimas 4 semanas (especificaciones §5.1). Null con pocos datos.
 */
export function weightTrendPerWeek(metrics: Point[]): number | null {
  if (metrics.length < 4) return null
  const last = metrics.map((m) => m.date).sort().at(-1)
  if (last === undefined) return null
  const windowed = metrics.filter((m) => daysBetween(m.date, last) < 28)
  if (windowed.length < 4) return null
  const ma = movingAvg7(windowed)
  const x0 = ma[0].date
  const reg = linReg(
    ma.map((p) => daysBetween(x0, p.date)),
    ma.map((p) => p.value),
  )
  return reg === null ? null : reg.slope * 7
}

export const STAGNATION_WINDOW = 5
export const STAGNATION_THRESHOLD = 0.01

export type ExerciseTrend =
  | { kind: 'insufficient' }
  | { kind: 'plateau'; sinceWeeks: number; projection: Regression; window: Point[] }
  | { kind: 'trending'; pctChange: number; projection: Regression; window: Point[] }

/**
 * Detección de estancamiento (especificaciones §5.3): regresión sobre el
 * mejor e1RM por sesión, ventana de las últimas 5 sesiones, mínimo 4 puntos.
 * Cambio proyectado sobre la ventana por debajo del 1 % ⇒ estancamiento.
 */
export function exerciseTrend(bestPerSession: Point[]): ExerciseTrend {
  const sorted = [...bestPerSession].sort((a, b) => a.date.localeCompare(b.date))
  const window = sorted.slice(-STAGNATION_WINDOW)
  if (window.length < 4) return { kind: 'insufficient' }
  const x0 = window[0].date
  const xs = window.map((p) => daysBetween(x0, p.date))
  const ys = window.map((p) => p.value)
  const reg = linReg(xs, ys)
  if (reg === null) return { kind: 'insufficient' }
  const mean = ys.reduce((a, b) => a + b, 0) / ys.length
  const projected = (reg.slope * (xs[xs.length - 1] - xs[0])) / mean
  if (Math.abs(projected) < STAGNATION_THRESHOLD) {
    const sinceWeeks = Math.max(1, Math.round(daysBetween(x0, window[window.length - 1].date) / 7))
    return { kind: 'plateau', sinceWeeks, projection: reg, window }
  }
  return { kind: 'trending', pctChange: projected, projection: reg, window }
}
