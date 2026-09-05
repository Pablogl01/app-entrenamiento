import { useEffect, useRef } from 'react'
import { BrowserRouter, Outlet, Route, Routes, useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { BottomNav, TABS } from './components/BottomNav'
import { Hoy } from './views/Hoy'
import { Calendario } from './views/Calendario'
import { Progreso } from './views/Progreso'
import { Rutinas } from './views/Rutinas'
import { RutinaEditor } from './views/RutinaEditor'
import { Catalogo } from './views/Catalogo'
import { EjercicioDetalle } from './views/EjercicioDetalle'
import { SesionPasada } from './views/SesionPasada'
import { Resumen } from './views/Resumen'
import { Ajustes } from './views/Ajustes'
import { Cuenta } from './views/Cuenta'
import { Entrenar } from './views/Entrenar'
import { Ciclo } from './views/Ciclo'
import { getSettings } from './db/db'
import { cleanupStaleDrafts, syncCatalog } from './db/repo'
import { seedDemo } from './db/demo'
import { initOutbox } from './lib/outbox'
import { hydrateAuthState, refreshSession } from './lib/auth'
import { ensureSubscription } from './lib/push'
import { dailyBackupIfDue } from './lib/backup'
import { applyTheme } from './lib/theme'

/** La vista nueva entra: fundido entre pestañas, deslizamiento al apilar.
 *  Un cambio por gesto lateral anima en la dirección del deslizamiento. */
function AnimatedOutlet({ root }: { root: boolean }) {
  const location = useLocation()
  const navType = useNavigationType()
  const swipe = (location.state as { swipe?: 'next' | 'prev' } | null)?.swipe
  const cls =
    swipe === 'next' ? 'view-push' : swipe === 'prev' ? 'view-pop' : navType === 'POP' ? 'view-pop' : root ? 'view-fade' : 'view-push'
  return (
    <div key={location.pathname} className={cls}>
      <Outlet />
    </div>
  )
}

const SWIPE_MIN_X = 60
const SWIPE_MAX_MS = 600

function RootLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const start = useRef<{ x: number; y: number; t: number } | null>(null)

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement
    // no robar el gesto a lo que ya se desliza o se escribe
    if (target.closest('.hscroll, .chips, .recent-strip, input, textarea, select')) {
      start.current = null
      return
    }
    start.current = { x: e.clientX, y: e.clientY, t: Date.now() }
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const s = start.current
    start.current = null
    if (s === null || Date.now() - s.t > SWIPE_MAX_MS) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    // horizontal claro: umbral y dominancia sobre el eje vertical
    if (Math.abs(dx) < SWIPE_MIN_X || Math.abs(dx) < 2 * Math.abs(dy)) return
    const index = TABS.findIndex((t) => t.to === location.pathname)
    if (index === -1) return
    const next = dx < 0 ? index + 1 : index - 1
    if (next < 0 || next >= TABS.length) return
    navigate(TABS[next].to, { state: { swipe: dx < 0 ? 'next' : 'prev' } })
  }

  return (
    <div
      className="app-shell app-shell--swipe"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        start.current = null
      }}
    >
      <div className="app-scroll">
        <AnimatedOutlet root />
      </div>
      <BottomNav />
    </div>
  )
}

function StackedLayout() {
  return (
    <div className="app-shell">
      <div className="app-scroll app-scroll--stacked">
        <AnimatedOutlet root={false} />
      </div>
    </div>
  )
}

function App() {
  useEffect(() => {
    const boot = async () => {
      const params = new URLSearchParams(window.location.search)
      if (params.has('demo')) await seedDemo()
      const settings = await getSettings()
      // ?theme=light|dark fuerza el modo para las capturas de verificación.
      const forced = params.get('theme')
      applyTheme(forced === 'light' || forced === 'dark' ? forced : settings.theme)
      await syncCatalog()
      await cleanupStaleDrafts()
      // Sesión: primero lo que sabe el móvil (sin red), luego la renovación con la cookie.
      // Si falla, la app sigue igual: solo avisos y copia necesitan cuenta (plans/007).
      await hydrateAuthState()
      await refreshSession()
      initOutbox()
      void ensureSubscription()
      void dailyBackupIfDue()
    }
    void boot()
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<RootLayout />}>
          <Route path="/" element={<Hoy />} />
          <Route path="/calendario" element={<Calendario />} />
          <Route path="/progreso" element={<Progreso />} />
          <Route path="/rutinas" element={<Rutinas />} />
        </Route>
        {/* Las pantallas apiladas esconden la barra inferior (DESIGN.md §4). */}
        <Route element={<StackedLayout />}>
          <Route path="/rutinas/:id" element={<RutinaEditor />} />
          <Route path="/catalogo" element={<Catalogo />} />
          <Route path="/ejercicio/:id" element={<EjercicioDetalle />} />
          <Route path="/sesion/:id" element={<SesionPasada />} />
          <Route path="/resumen/:id" element={<Resumen />} />
          <Route path="/ajustes" element={<Ajustes />} />
          <Route path="/cuenta" element={<Cuenta />} />
          <Route path="/entrenar" element={<Entrenar />} />
          <Route path="/ciclo" element={<Ciclo />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
