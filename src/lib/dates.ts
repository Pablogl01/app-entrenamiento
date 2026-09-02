/** Fechas locales en formato YYYY-MM-DD. Nunca UTC: el gimnasio es local. */

export function isoOf(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayISO(): string {
  return isoOf(new Date())
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(iso: string, days: number): string {
  const d = parseISO(iso)
  d.setDate(d.getDate() + days)
  return isoOf(d)
}

/** 0 = lunes … 6 = domingo. */
export function weekdayMon0(iso: string): number {
  return (parseISO(iso).getDay() + 6) % 7
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86_400_000)
}

/** Lunes de la semana de `iso`. */
export function startOfWeek(iso: string): string {
  return addDays(iso, -weekdayMon0(iso))
}

export const WEEKDAY_LETTERS = ['l', 'm', 'x', 'j', 'v', 's', 'd'] as const

export const WEEKDAY_SHORT = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'] as const

export const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
] as const
