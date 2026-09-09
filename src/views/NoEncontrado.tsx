// Ruta desconocida. El servidor devuelve la app con 200 (fallback de SPA), así que
// la salida la da esta pantalla: dice qué pasó y ofrece volver a Hoy.
import { Link } from 'react-router-dom'
import { TopBar } from '../components/TopBar'

export function NoEncontrado() {
  return (
    <div className="screen screen--stacked">
      <TopBar title="No encontrado" />
      <main className="flex-1 w-full pb-24 px-gutter flex flex-col relative">
        <div className="flex flex-col w-full gap-lg pt-xs">
          <p className="type-body-md text-on-surface-variant">Esta dirección no existe en la app. Puede que el enlace esté mal escrito o que la pantalla haya cambiado de sitio.</p>
          <Link to="/" replace className="w-full rounded-lg bg-volt text-on-volt type-label-md uppercase tracking-wider font-bold flex items-center justify-center press" style={{ minHeight: 'var(--h-cta)' }}>
            Ir a Hoy
          </Link>
        </div>
      </main>
    </div>
  )
}
