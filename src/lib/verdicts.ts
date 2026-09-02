// Los veredictos son la voz del producto (DESIGN.md §6): conclusión primero,
// texto plano, sin emoji, sin exclamaciones, sin motivación.
import { db } from '../db/db'
import { bestE1rmSeries } from '../db/repo'
import { exerciseTrend, weightTrendPerWeek, type Point } from './calc'
import { fmtNum } from './format'
import { isoOf, parseISO, startOfWeek, todayISO } from './dates'

export function bodyWeightVerdict(metrics: Point[]): string {
  const trend = weightTrendPerWeek(metrics)
  if (trend === null) return 'Aún pocos pesajes para calcular la tendencia. Con unos días más sale.'
  const abs = Math.abs(trend)
  if (abs < 0.05) return 'Peso corporal estable en las últimas 4 semanas.'
  const dir = trend > 0 ? 'sube' : 'baja'
  return `El peso ${dir} ${fmtNum(abs, 2)} kg/semana de media en las últimas 4 semanas.`
}

export interface ExerciseVerdict {
  exercise_id: string
  text: string
}

/** Veredictos por ejercicio, solo con 4+ sesiones en la ventana (§5.3). */
export async function exerciseVerdicts(limit = 6): Promise<ExerciseVerdict[]> {
  const exercises = await db.exercises.filter((e) => !e.archived).toArray()
  const out: { verdict: ExerciseVerdict; lastDate: string }[] = []
  for (const exercise of exercises) {
    const series = await bestE1rmSeries(exercise.id)
    const trend = exerciseTrend(series)
    if (trend.kind === 'insufficient') continue
    const lastDate = series.at(-1)?.date ?? ''
    if (trend.kind === 'plateau') {
      out.push({
        verdict: {
          exercise_id: exercise.id,
          text: `${exercise.name}: e1RM plano desde hace ${trend.sinceWeeks} semanas.`,
        },
        lastDate,
      })
    } else {
      const pct = trend.pctChange * 100
      const sign = pct > 0 ? '+' : '−'
      out.push({
        verdict: {
          exercise_id: exercise.id,
          text: `${exercise.name}: ${sign}${fmtNum(Math.abs(pct))} % de e1RM en las últimas ${trend.window.length} sesiones.`,
        },
        lastDate,
      })
    }
  }
  return out
    .sort((a, b) => b.lastDate.localeCompare(a.lastDate))
    .slice(0, limit)
    .map((x) => x.verdict)
}

export interface WeeklyCompliance {
  weekStart: string
  done: number
}

export async function weeklySessions(weeks = 8): Promise<{ bars: WeeklyCompliance[]; target: number }> {
  const sessions = (await db.sessions.toArray()).filter((s) => s.started_at !== null)
  const byWeek = new Map<string, number>()
  for (const s of sessions) {
    const w = startOfWeek(s.date)
    byWeek.set(w, (byWeek.get(w) ?? 0) + 1)
  }
  const bars: WeeklyCompliance[] = []
  const currentWeek = parseISO(startOfWeek(todayISO()))
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(currentWeek)
    d.setDate(d.getDate() - 7 * i)
    const key = isoOf(d)
    bars.push({ weekStart: key, done: byWeek.get(key) ?? 0 })
  }
  const scheduleDays = await db.routine_schedules.toArray()
  const target = new Set(scheduleDays.map((s) => s.weekday)).size
  return { bars, target }
}

export function weeklyVerdict(bars: WeeklyCompliance[], target: number): string {
  const current = bars.at(-1)?.done ?? 0
  if (target === 0) return `${current} ${current === 1 ? 'sesión' : 'sesiones'} esta semana.`
  return `${current} de ${target} sesiones esta semana.`
}
