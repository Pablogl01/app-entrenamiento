import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from './Icon'

interface RootProps {
  /** Nombre de la pestaña: «Hoy», «Calendario»… */
  tab: string
  /** El punto volt pulsa cuando hay una sesión en curso. */
  live?: boolean
}

function useScrolled(): boolean {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return scrolled
}

/** Barra superior de las pestañas raíz, calcada de la maqueta: punto + nombre, campana y avatar. */
export function RootTopBar({ tab, live = false }: RootProps) {
  const scrolled = useScrolled()
  return (
    <header className={`topbar${scrolled ? ' is-scrolled' : ''}`}>
      <div className="topbar__inner h-16 px-gutter flex items-center justify-between">
        <div className="flex items-center gap-sm">
          <div className={`w-2 h-2 rounded-full bg-volt${live ? ' pulse' : ''}`} />
          <span className="type-headline-md tracking-tight text-on-surface">{tab}</span>
        </div>
        <div className="flex items-center gap-sm">
          <Link to="/ajustes#avisos" className="w-touch h-touch flex items-center justify-center text-on-surface-variant" aria-label="Avisos">
            <Icon name="bell" size={20} />
          </Link>
          <Link to="/ajustes" className="w-8 h-8 rounded-circle bg-primary flex items-center justify-center text-on-primary" aria-label="Ajustes">
            <Icon name="user" size={18} />
          </Link>
        </div>
      </div>
    </header>
  )
}

interface StackedProps {
  title: string
  right?: ReactNode
}

/** Barra superior de las pantallas apiladas: flecha, título en mayúsculas y avatar. */
export function TopBar({ title, right }: StackedProps) {
  const navigate = useNavigate()
  const scrolled = useScrolled()
  return (
    <header className={`topbar${scrolled ? ' is-scrolled' : ''}`}>
      <div className="topbar__inner h-16 px-gutter flex items-center justify-between">
        <div className="flex items-center gap-sm min-w-0">
          <button className="w-touch h-touch -ml-sm flex items-center justify-center text-on-surface" aria-label="Volver" onClick={() => navigate(-1)}>
            <Icon name="arrow-left" size={24} />
          </button>
          <h1 className="type-headline-sm font-bold uppercase tracking-tight text-on-surface truncate">{title}</h1>
        </div>
        <div className="flex items-center gap-sm">
          {right !== undefined && <div className="type-label-md uppercase tracking-wider text-on-surface px-sm">{right}</div>}
          <Link to="/ajustes" className="w-8 h-8 rounded-circle bg-primary flex items-center justify-center text-on-primary" aria-label="Ajustes">
            <Icon name="user" size={18} />
          </Link>
        </div>
      </div>
    </header>
  )
}
