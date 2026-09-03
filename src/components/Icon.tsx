import type { SVGProps } from 'react'

/**
 * Iconos propios (DESIGN.md v2 §5): trazo de 2px, 24×24, dibujados a mano.
 * Sustituyen a Material Symbols porque nada del flujo depende de la red y la
 * fuente de iconos pesa más que las tres tipografías juntas.
 */
const PATHS = {
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
  sliders: 'M21 4h-3M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4',
  target: 'M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20M12 6a6 6 0 1 0 0 12a6 6 0 1 0 0-12M12 10a2 2 0 1 0 0 4a2 2 0 1 0 0-4',
  calendar: 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2M16 2v4M8 2v4M3 10h18',
  trending: 'M3 17l6-6 4 4 8-8M14 7h7v7',
  'trending-down': 'M3 7l6 6 4-4 8 8M14 17h7v-7',
  dumbbell: 'M6.5 6.5l11 11M21 21l-1-1M3 3l1 1M18 22l4-4M2 6l4-4M3 10l7-7M14 21l7-7',
  play: 'M7 4l13 8-13 8z',
  flag: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7',
  check: 'M20 6L9 17l-5-5',
  'check-circle': 'M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4L12 14l-3-3',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  'chevron-down': 'M6 9l6 6 6-6',
  'chevron-up': 'M18 15l-6-6-6 6',
  'chevron-left': 'M15 18l-6-6 6-6',
  'chevron-right': 'M9 18l6-6-6-6',
  'arrow-left': 'M19 12H5M12 19l-7-7 7-7',
  'arrow-right': 'M5 12h14M12 5l7 7-7 7',
  'arrow-down': 'M12 5v14M19 12l-7 7-7-7',
  'arrow-up': 'M12 19V5M5 12l7-7 7 7',
  more: 'M12 4.5v1M12 11.5v1M12 18.5v1',
  edit: 'M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z',
  history: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5M12 7v5l4 2',
  clock: 'M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20M12 6v6l4 2',
  weight: 'M12 2a3 3 0 1 0 0 6a3 3 0 1 0 0-6M6.5 8a2 2 0 0 0-1.9 1.46L2.1 18.5A2 2 0 0 0 4 21h16a2 2 0 0 0 1.93-2.54L19.4 9.5A2 2 0 0 0 17.48 8Z',
  search: 'M11 3a8 8 0 1 0 0 16a8 8 0 1 0 0-16M21 21l-4.3-4.3',
  bolt: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  sync: 'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M8 16H3v5',
  trophy:
    'M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z',
  close: 'M18 6L6 18M6 6l12 12',
  grip: 'M9 5v1M9 12v1M9 19v1M15 5v1M15 12v1M15 19v1',
  wave: 'M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  archive: 'M21 8v13H3V8M1 3h22v5H1zM10 12h4',
  layers: 'M12 2L2 7l10 5 10-5-10-5M2 17l10 5 10-5M2 12l10 5 10-5',
  scale: 'M3 6h18M6 6l-3 8a3 3 0 0 0 6 0L6 6M18 6l-3 8a3 3 0 0 0 6 0l-3-8M12 3v18M8 21h8',
  pause: 'M8 5v14M16 5v14',
  swap: 'M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4',
  note: 'M4 4h12l4 4v12H4zM16 4v4h4M8 13h8M8 17h5',
  calculator: 'M6 3h12v18H6zM9 7h6M9 12h1M12 12h1M15 12h1M9 16h1M12 16h1M15 16h1',
  ruler: 'M3 17L17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2',
  fire: 'M12 2c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4 1-6 1-9',
  moon: 'M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10',
  gauge: 'M12 14l4-6M4 18a8 8 0 1 1 16 0',
  'skip-forward': 'M5 4l10 8-10 8zM19 5v14',
  'check-all': 'M18 6L7 17l-4-4M22 10l-7.5 7.5',
  flame: 'M12 2c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4 1-6 1-9',
  trash: 'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14',
  camera: 'M4 7h3l2-2h6l2 2h3v12H4zM12 10a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7',
  user: 'M12 3a4 4 0 1 0 0 8a4 4 0 1 0 0-8M4 21a8 8 0 0 1 16 0',
  hourglass: 'M6 3h12M6 21h12M7 3v3l5 6-5 6v3M17 3v3l-5 6 5 6v3',
  'next-plan': 'M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20M9 12h6M13 9l3 3-3 3',
  'add-circle': 'M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20M12 8v8M8 12h8',
} as const

export type IconName = keyof typeof PATHS

interface Props extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName
  size?: number
  /** Solo para `check` dentro de la casilla de serie, que va más grueso. */
  strokeWidth?: number
}

export function Icon({ name, size = 20, strokeWidth = 2, ...rest }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
