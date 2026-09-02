import { NavLink } from 'react-router-dom'

export const TABS = [
  { to: '/', label: 'Hoy' },
  { to: '/calendario', label: 'Calendario' },
  { to: '/progreso', label: 'Progreso' },
  { to: '/rutinas', label: 'Rutinas' },
] as const

export function BottomNav() {
  return (
    <nav className="bottomnav">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="t-info">{t.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
