// Gráficas dibujadas a mano sobre --paper (DESIGN.md §4 Gráficas):
// eje siempre, etiquetas en `data`, lo medido sólido 2px --ink, lo calculado
// discontinuo 1px --ink-soft con hairline vertical donde empieza.
import { useEffect, useRef, useState } from 'react'
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
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    setW(el.clientWidth)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

function shortDate(iso: string): string {
  const d = parseISO(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`
}

const M = { top: 8, right: 8, bottom: 22, left: 44 }

interface LineChartProps {
  main: Point[]
  dots?: Point[]
  projection?: Point[]
  height?: number
  ariaLabel: string
}

export function LineChart({ main, dots = [], projection = [], height = 180, ariaLabel }: LineChartProps) {
  const [ref, width] = useWidth()
  const all = [...main, ...dots, ...projection]
  if (all.length === 0) return null
  const datesSorted = all.map((p) => p.date).sort()
  const d0 = datesSorted[0]
  const spanDays = Math.max(1, daysBetween(d0, datesSorted[datesSorted.length - 1]))
  const values = all.map((p) => p.value)
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

  const gridVals = [vMin + pad, (vMin + vMax) / 2, vMax - pad]
  const boundary = projection.length > 0 && main.length > 0 ? main[main.length - 1].date : null

  return (
    <div ref={ref} role="img" aria-label={ariaLabel}>
      <svg width={width} height={height}>
        {gridVals.map((v) => (
          <g key={v}>
            <line x1={M.left} x2={width - M.right} y1={y(v)} y2={y(v)} stroke="var(--rule)" strokeWidth={1} />
            <text x={0} y={y(v) + 4} className="chart-label">
              {fmtNum(Math.round(v * 10) / 10)}
            </text>
          </g>
        ))}
        {boundary !== null && (
          <line x1={x(boundary)} x2={x(boundary)} y1={M.top} y2={height - M.bottom} stroke="var(--rule)" strokeWidth={1} />
        )}
        {dots.map((p) => (
          <circle key={p.date} cx={x(p.date)} cy={y(p.value)} r={1.5} fill="var(--ink-soft)" />
        ))}
        {projection.length > 1 && (
          <path d={path(projection)} fill="none" stroke="var(--ink-soft)" strokeWidth={1} strokeDasharray="4 4" />
        )}
        {main.length > 1 && <path d={path(main)} fill="none" stroke="var(--ink)" strokeWidth={2} />}
        {main.length === 1 && <circle cx={x(main[0].date)} cy={y(main[0].value)} r={2.5} fill="var(--ink)" />}
        <text x={M.left} y={height - 6} className="chart-label">
          {shortDate(d0)}
        </text>
        <text x={width - M.right} y={height - 6} textAnchor="end" className="chart-label">
          {shortDate(datesSorted[datesSorted.length - 1])}
        </text>
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

/** Sparkline de peso en Hoy: puntos diarios finos y media de 7 días en 2px. */
export function Sparkline({ dots, ma, height = 64, ariaLabel }: SparklineProps) {
  const [ref, width] = useWidth()
  if (dots.length === 0) return null
  const d0 = dots.map((p) => p.date).sort()[0]
  const span = Math.max(1, daysBetween(d0, dots.map((p) => p.date).sort().at(-1) ?? d0))
  const values = [...dots, ...ma].map((p) => p.value)
  const vMin = Math.min(...values) - 0.3
  const vMax = Math.max(...values) + 0.3
  const left = 40
  const x = (iso: string) => left + (daysBetween(d0, iso) / span) * (width - left - 4)
  const y = (v: number) => 4 + (1 - (v - vMin) / (vMax - vMin)) * (height - 12)
  const path = ma.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.date).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ')
  return (
    <div ref={ref} role="img" aria-label={ariaLabel}>
      <svg width={width} height={height}>
        <line x1={left} x2={width} y1={height - 8} y2={height - 8} stroke="var(--rule)" strokeWidth={1} />
        <text x={0} y={10} className="chart-label">{fmtNum(Math.round(vMax * 10) / 10)}</text>
        <text x={0} y={height - 4} className="chart-label">{fmtNum(Math.round(vMin * 10) / 10)}</text>
        {dots.map((p) => (
          <circle key={p.date} cx={x(p.date)} cy={y(p.value)} r={1.5} fill="var(--ink-soft)" />
        ))}
        {ma.length > 1 && <path d={path} fill="none" stroke="var(--ink)" strokeWidth={2} />}
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

/** Barras --ink con una sola línea discontinua de objetivo. Sin rojo. */
export function Bars({ bars, target, height = 140, ariaLabel }: BarsProps) {
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
            <text x={0} y={y(v) + 4} className="chart-label">{v}</text>
          </g>
        ))}
        {target !== undefined && target > 0 && (
          <line
            x1={M.left}
            x2={width - M.right}
            y1={y(target)}
            y2={y(target)}
            stroke="var(--ink-soft)"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        )}
        {bars.map((b, i) => (
          <g key={b.label}>
            {b.value > 0 && <rect x={x(i)} y={y(b.value)} width={bw} height={plotH - (y(b.value) - M.top)} fill="var(--ink)" />}
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
