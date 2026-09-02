import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

interface Props {
  /** Sobre material: chevron blanco sin superficie propia, sin hairline. */
  onMaterial?: boolean
  right?: ReactNode
}

/** Barra superior: solo en pantallas apiladas, solo navegación, nunca título. */
export function TopBar({ onMaterial = false, right }: Props) {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    if (onMaterial) return
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [onMaterial])

  return (
    <div className={onMaterial ? 'topbar topbar--material' : `topbar topbar--paper${scrolled ? ' is-scrolled' : ''}`}>
      <button className="topbar__back" aria-label="Volver" onClick={() => navigate(-1)}>
        ‹
      </button>
      {right !== undefined && <div className="topbar__action t-item">{right}</div>}
    </div>
  )
}
