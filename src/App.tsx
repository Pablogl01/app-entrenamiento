import { useEffect } from 'react'
import { BrowserRouter, Outlet, Route, Routes, useLocation, useNavigationType } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
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
import { cleanupStaleDrafts } from './db/repo'
import { seedDemo } from './db/demo'
import { initOutbox } from './lib/outbox'
import { ensureSubscription } from './lib/push'
import { dailyBackupIfDue } from './lib/backup'

/** La vista nueva entra: fundido entre pestañas, deslizamiento al apilar. */
function AnimatedOutlet({ root }: { root: boolean }) {
  const location = useLocation()
  const navType = useNavigationType()
  const cls = navType === 'POP' ? 'view-pop' : root ? 'view-fade' : 'view-push'
  return (
    <div key={location.pathname} className={cls}>
      <Outlet />
    </div>
  )
}

function RootLayout() {
  return (
    <div className="app-shell">
      <AnimatedOutlet root />
      <BottomNav />
    </div>
  )
}

function StackedLayout() {
  return (
    <div className="app-shell">
      <AnimatedOutlet root={false} />
    </div>
  )
}

function App() {
  useEffect(() => {
    const boot = async () => {
      if (new URLSearchParams(window.location.search).has('demo')) await seedDemo()
      await cleanupStaleDrafts()
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
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
