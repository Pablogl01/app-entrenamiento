import { NavLink } from 'react-router-dom'
import { Icon, type IconName } from './Icon'

export const TABS: readonly { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Hoy', icon: 'target' },
  { to: '/calendario', label: 'Calendario', icon: 'calendar' },
  { to: '/progreso', label: 'Progreso', icon: 'trending' },
  { to: '/rutinas', label: 'Rutinas', icon: 'dumbbell' },
]

/** Barra inferior calcada de la maqueta: h-16, cuatro destinos, activa en volt. */
export function BottomNav() {
  return (
    <nav className="bottomnav">
      <div className="bottomnav__row">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            <Icon name={t.icon} size={22} />
            <span className="bottomnav__label">{t.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
