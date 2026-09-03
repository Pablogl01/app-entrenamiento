interface Props {
  /** 0..1 */
  value: number
  size?: number
  stroke?: number
  label?: string
}

/** Anillo de progreso volt sobre pista --surface-hi. Solo para sesión de hoy. */
export function Ring({ value, size = 44, stroke = 4, label }: Props) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={label ?? `${Math.round(v * 100)} %`}>
      <svg width={size} height={size}>
        <circle className="ring__track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle
          className="ring__fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
        />
      </svg>
      {label !== undefined && <span className="ring__text t-label-sm">{label}</span>}
    </div>
  )
}
