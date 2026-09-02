import { MONTHS, WEEKDAY_SHORT, daysBetween, parseISO, todayISO, weekdayMon0 } from './dates'
import type { WeightUnit } from '../db/types'

/** Cifra con coma decimal, sin ceros de relleno innecesarios. */
export function fmtNum(n: number, decimals = 1): string {
  const fixed = Number.isInteger(n) ? String(n) : n.toFixed(decimals)
  return fixed.replace('.', ',')
}

export function fmtWeight(n: number | null, unit: WeightUnit): string {
  if (n === null) return '—'
  return `${fmtNum(n)} ${unit}`
}

/** "mar 2 sep" para listas. */
export function fmtDateShort(iso: string): string {
  const d = parseISO(iso)
  return `${WEEKDAY_SHORT[weekdayMon0(iso)]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`
}

/** "2 de septiembre de 2026" para cabeceras. */
export function fmtDateLong(iso: string): string {
  const d = parseISO(iso)
  return `${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`
}

/** "hoy" / "ayer" / "hace 3 días" / "hace 5 semanas" / "hace 8 meses". */
export function fmtRelative(iso: string): string {
  const days = daysBetween(iso, todayISO())
  if (days <= 0) return 'hoy'
  if (days === 1) return 'ayer'
  if (days < 14) return `hace ${days} días`
  if (days < 60) return `hace ${Math.round(days / 7)} semanas`
  if (days < 365) return `hace ${Math.round(days / 30)} meses`
  return `hace ${fmtNum(days / 365)} años`
}

/** Versión abreviada para la columna de Rutinas por debajo de 360px. */
export function fmtRelativeAbbr(iso: string): string {
  const days = daysBetween(iso, todayISO())
  if (days <= 0) return 'hoy'
  if (days < 14) return `${days} d`
  if (days < 60) return `${Math.round(days / 7)} sem`
  return `${Math.round(days / 30)} mes`
}

export function fmtDuration(ms: number): string {
  const min = Math.round(ms / 60_000)
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${min % 60} min`
}

/** "lun y jue" / "lun, mié y vie" a partir de weekdays Mon0 ordenados. */
export function fmtWeekdays(days: number[]): string {
  const names = [...days].sort((a, b) => a - b).map((d) => WEEKDAY_SHORT[d])
  if (names.length === 0) return 'sin días'
  if (names.length === 1) return names[0]
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`
}
