// Gráficas dibujadas a mano (DESIGN.md v2 §5 Gráficas): eje siempre, etiquetas
// mono, lo medido en --volt 2px con relleno bajo la línea, lo calculado
// discontinuo 1px --ink-mute con hairline vertical donde empieza.
import { useEffect, useId, useRef, useState } from 'react'
import type { Point } from '../lib/calc'
import { daysBetween, parseISO } from '../lib/dates'
import { fmtNum } from '../lib/format'
import { MONTHS } from '../lib/dates'

function useWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(320)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const apply = () => {
      if (el.clientWidth >= 80) setW(el.clientWidth)
    }
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    apply()
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

function shortDate(iso: string): string {
  const d = parseISO(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3).toUpperCase()}`
}

const M = { top: 10, right: 10, bottom: 22, left: 40 }

function Fill({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" style={{ stopColor: 'var(--chart-fill)' }} />
        <stop offset="100%" style={{ stopColor: 'var(--chart-fill-0)' }} />
      </linearGradient>
    </defs>
  )
}

interface LineChartProps {
  main: Point[]
  dots?: Point[]
  projection?: Point[]
  height?: number
  ariaLabel: string
  /** Etiqueta del último punto («HOY (88,7)»). */
  endLabel?: string
  startLabel?: string
  /** Línea discontinua de objetivo (meta de peso). */
  target?: number | null
  targetLabel?: string
}

export function LineChart({ main, dots = [], projection = [], height = 180, ariaLabel, endLabel, startLabel, target = null, targetLabel = 'OBJ' }: LineChartProps) {
  const [ref, width] = useWidth()
  const gradId = useId()
  const all = [...main, ...dots, ...projection]
  if (all.length === 0) return null
  const datesSorted = all.map((p) => p.date).sort()
  const d0 = datesSorted[0]
  const spanDays = Math.max(1, daysBetween(d0, datesSorted[datesSorted.length - 1]))
  const values = all.map((p) => p.value)
  if (target !== null) values.push(target)
  let vMin = Math.min(...values)
  let vMax = Math.max(...values)
  if (vMax - vMin < 1) {
    vMin -= 1
    vMax += 1
  }
  const pad = (vMax - vMin) * 0.08
  vMin -= pad
  vMax += pad

  const plotW = width - M.left - M.right
  const plotH = height - M.top - M.bottom
  const x = (iso: string) => M.left + (daysBetween(d0, iso) / spanDays) * plotW
  const y = (v: number) => M.top + (1 - (v - vMin) / (vMax - vMin)) * plotH

  const path = (pts: Point[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.date).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ')
  const area =
    main.length > 1
      ? `${path(main)} L${x(main[main.length - 1].date).toFixed(1)} ${(height - M.bottom).toFixed(1)} L${x(main[0].date).toFixed(1)} ${(height - M.bottom).toFixed(1)} Z`
      : ''

  const gridVals = [vMin + pad, (vMin + vMax) / 2, vMax - pad]
  const boundary = projection.length > 0 && main.length > 0 ? main[main.length - 1].date : null
  const last = main.length > 0 ? main[main.length - 1] : null

  return (
    <div ref={ref} role="img" aria-label={ariaLabel}>
      <svg width={width} height={height}>
        <Fill id={gradId} />
        {gridVals.map((v) => (
          <g key={v}>
            <line x1={M.left} x2={width - M.right} y1={y(v)} y2={y(v)} stroke="var(--rule)" strokeWidth={1} />
            <text x={0} y={y(v) + 3} className="chart-label">
              {fmtNum(Math.round(v * 10) / 10)}
            </text>
          </g>
        ))}
        {boundary !== null && (
          <line x1={x(boundary)} x2={x(boundary)} y1={M.top} y2={height - M.bottom} stroke="var(--rule-strong)" strokeWidth={1} />
        )}
        {target !== null && (
          <g>
            <line x1={M.left} x2={width - M.right} y1={y(target)} y2={y(target)} stroke="var(--ink-mute)" strokeWidth={1} strokeDasharray="3 3" />
            <text x={width - M.right} y={y(target) - 4} textAnchor="end" className="chart-label">
              {fmtNum(target)} {targetLabel}
            </text>
          </g>
        )}
        {area !== '' && <path d={area} fill={`url(#${gradId})`} />}
        {dots.map((p) => (
          <circle key={p.date} cx={x(p.date)} cy={y(p.value)} r={1.5} fill="var(--ink-mute)" />
        ))}
        {projection.length > 1 && (
          <path d={path(projection)} fill="none" stroke="var(--ink-mute)" strokeWidth={1} strokeDasharray="4 4" />
        )}
        {main.length > 1 && <path d={path(main)} fill="none" stroke="var(--volt)" strokeWidth={2} strokeLinejoin="round" />}
        {last !== null && <circle cx={x(last.date)} cy={y(last.value)} r={4} fill="var(--volt)" stroke="var(--surface)" strokeWidth={2} />}
        <text x={M.left} y={height - 6} className="chart-label">
          {startLabel ?? shortDate(d0)}
        </text>
        <text x={width - M.right} y={height - 6} textAnchor="end" className="chart-label chart-label--ink">
          {endLabel ?? shortDate(datesSorted[datesSorted.length - 1])}
        </text>
      </svg>
    </div>
  )
}

interface WeekSparklineProps {
  dots: Point[]
  ma: Point[]
  today: string
  goal: number | null
  height?: number
  ariaLabel: string
}

const DAY_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

/** Siete días con etiqueta por día (Hoy): media de 7 días en volt, meta discontinua. */
export function WeekSparkline({ dots, ma, today, goal, height = 96, ariaLabel }: WeekSparklineProps) {
  const [ref, width] = useWidth()
  const gradId = useId()
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = parseISO(today)
    d.setDate(d.getDate() - (6 - i))
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const wDots = dots.filter((p) => p.date >= days[0])
  const wMa = ma.filter((p) => p.date >= days[0])
  if (wDots.length === 0 && wMa.length === 0) return null
  const values = [...wDots, ...wMa].map((p) => p.value)
  if (goal !== null) values.push(goal)
  const vMin = Math.min(...values) - 0.3
  const vMax = Math.max(...values) + 0.3
  const left = 36
  const bottom = height - 22
  const step = (width - left - 8) / 6
  const x = (iso: string) => left + days.indexOf(iso) * step
  const y = (v: number) => 6 + (1 - (v - vMin) / (vMax - vMin)) * (bottom - 12)
  const path = wMa.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.date).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ')
  const area = wMa.length > 1 ? `${path} L${x(wMa[wMa.length - 1].date).toFixed(1)} ${bottom} L${x(wMa[0].date).toFixed(1)} ${bottom} Z` : ''
  const last = wMa.at(-1) ?? wDots.at(-1)
  return (
    <div ref={ref} role="img" aria-label={ariaLabel}>
      <svg width={width} height={height}>
        <Fill id={gradId} />
        <line x1={left} x2={width} y1={bottom} y2={bottom} stroke="var(--rule)" strokeWidth={1} />
        <text x={0} y={12} className="chart-label">{fmtNum(Math.round(vMax * 10) / 10)}</text>
        <text x={0} y={bottom} className="chart-label">{fmtNum(Math.round(vMin * 10) / 10)}</text>
        {goal !== null && (
          <g>
            <line x1={left} x2={width} y1={y(goal)} y2={y(goal)} stroke="var(--ink-mute)" strokeWidth={1} strokeDasharray="3 3" />
            <text x={width} y={y(goal) - 3} textAnchor="end" className="chart-label">{fmtNum(goal)} OBJ</text>
          </g>
        )}
        {area !== '' && <path d={area} fill={`url(#${gradId})`} />}
        {wDots.map((p) => (
          <circle key={p.date} cx={x(p.date)} cy={y(p.value)} r={2} fill="var(--ink-mute)" />
        ))}
        {wMa.length > 1 && <path d={path} fill="none" stroke="var(--volt)" strokeWidth={2} strokeLinejoin="round" />}
        {last !== undefined && <circle cx={x(last.date)} cy={y(last.value)} r={3.5} fill="var(--volt)" stroke="var(--surface)" strokeWidth={2} />}
        {days.map((iso) => (
          <text key={iso} x={x(iso)} y={height - 4} textAnchor="middle" className={iso === today ? 'chart-label chart-label--ink' : 'chart-label'}>
            {iso === today ? 'HOY' : DAY_LETTERS[(parseISO(iso).getDay() + 6) % 7]}
          </text>
        ))}
      </svg>
    </div>
  )
}

interface SparklineProps {
  dots: Point[]
  ma: Point[]
  height?: number
  ariaLabel: string
}

/** Sparkline de peso en Hoy: puntos diarios finos y media de 7 días en volt. */
export function Sparkline({ dots, ma, height = 72, ariaLabel }: SparklineProps) {
  const [ref, width] = useWidth()
  const gradId = useId()
  if (dots.length === 0) return null
  const sorted = dots.map((p) => p.date).sort()
  const d0 = sorted[0]
  const span = Math.max(1, daysBetween(d0, sorted.at(-1) ?? d0))
  const values = [...dots, ...ma].map((p) => p.value)
  const vMin = Math.min(...values) - 0.3
  const vMax = Math.max(...values) + 0.3
  const left = 36
  const bottom = height - 10
  const x = (iso: string) => left + (daysBetween(d0, iso) / span) * (width - left - 6)
  const y = (v: number) => 6 + (1 - (v - vMin) / (vMax - vMin)) * (bottom - 12)
  const path = ma.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.date).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ')
  const area = ma.length > 1 ? `${path} L${x(ma[ma.length - 1].date).toFixed(1)} ${bottom} L${x(ma[0].date).toFixed(1)} ${bottom} Z` : ''
  const last = ma.at(-1) ?? dots.at(-1)
  return (
    <div ref={ref} role="img" aria-label={ariaLabel}>
      <svg width={width} height={height}>
        <Fill id={gradId} />
        <line x1={left} x2={width} y1={bottom} y2={bottom} stroke="var(--rule)" strokeWidth={1} />
        <text x={0} y={12} className="chart-label">{fmtNum(Math.round(vMax * 10) / 10)}</text>
        <text x={0} y={bottom} className="chart-label">{fmtNum(Math.round(vMin * 10) / 10)}</text>
        {area !== '' && <path d={area} fill={`url(#${gradId})`} />}
        {dots.map((p) => (
          <circle key={p.date} cx={x(p.date)} cy={y(p.value)} r={1.5} fill="var(--ink-mute)" />
        ))}
        {ma.length > 1 && <path d={path} fill="none" stroke="var(--volt)" strokeWidth={2} strokeLinejoin="round" />}
        {last !== undefined && <circle cx={x(last.date)} cy={y(last.value)} r={3.5} fill="var(--volt)" stroke="var(--surface)" strokeWidth={2} />}
      </svg>
    </div>
  )
}

interface BarsProps {
  bars: { label: string; value: number }[]
  target?: number
  height?: number
  ariaLabel: string
}

/** Barras volt con una sola línea discontinua de objetivo. Sin rojo. */
export function Bars({ bars, target, height = 120, ariaLabel }: BarsProps) {
  const [ref, width] = useWidth()
  if (bars.length === 0) return null
  const max = Math.max(...bars.map((b) => b.value), target ?? 0, 1)
  const plotW = width - M.left - M.right
  const plotH = height - M.top - M.bottom
  const bw = Math.min(24, (plotW / bars.length) * 0.55)
  const x = (i: number) => M.left + (i + 0.5) * (plotW / bars.length) - bw / 2
  const y = (v: number) => M.top + (1 - v / max) * plotH
  return (
    <div ref={ref} role="img" aria-label={ariaLabel}>
      <svg width={width} height={height}>
        {[0, max].map((v) => (
          <g key={v}>
            <line x1={M.left} x2={width - M.right} y1={y(v)} y2={y(v)} stroke="var(--rule)" strokeWidth={1} />
            <text x={0} y={y(v) + 3} className="chart-label">{v}</text>
          </g>
        ))}
        {target !== undefined && target > 0 && (
          <line
            x1={M.left}
            x2={width - M.right}
            y1={y(target)}
            y2={y(target)}
            stroke="var(--ink-mute)"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        )}
        {bars.map((b, i) => (
          <g key={b.label}>
            <rect x={x(i)} y={M.top} width={bw} height={plotH} rx={2} fill="var(--surface-hi)" />
            {b.value > 0 && <rect x={x(i)} y={y(b.value)} width={bw} height={plotH - (y(b.value) - M.top)} rx={2} fill="var(--volt)" />}
            {i % 2 === 0 && (
              <text x={x(i) + bw / 2} y={height - 6} textAnchor="middle" className="chart-label">
                {b.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  )
}
