// Página de texto largo (privacidad, términos, ayuda). Pantalla apilada, sin adornos:
// el título lo pone la barra superior; las secciones son h2 y párrafos.
import { TopBar } from '../components/TopBar'
import type { TextDocument } from '../content/legal'

export function TextPage({ doc }: { doc: TextDocument }) {
  return (
    <div className="screen screen--stacked">
      <TopBar title={doc.title} />
      <main className="flex-1 w-full pb-24 px-gutter flex flex-col relative">
        <article className="flex flex-col w-full gap-lg pb-2xl">
          <div className="flex flex-col pt-xs gap-xxs">
            <span className="type-label-sm uppercase tracking-wider text-primary-dim">{doc.kicker}</span>
            <span className="type-label-sm text-on-surface-variant">Actualizado el {doc.updated}</span>
            {doc.intro !== undefined && <p className="type-body-md text-on-surface pt-xs">{doc.intro}</p>}
          </div>
          {doc.sections.map((s) => (
            <section key={s.title} className="flex flex-col gap-xs">
              <h2 className="type-body-md font-semibold text-on-surface">{s.title}</h2>
              {s.paragraphs?.map((p) => (
                <p key={p} className="type-body-md text-on-surface-variant">
                  {p}
                </p>
              ))}
              {s.bullets !== undefined && (
                <ul className="flex flex-col gap-xs" style={{ paddingLeft: 'var(--sp-4)', margin: 0 }}>
                  {s.bullets.map((b) => (
                    <li key={b} className="type-body-md text-on-surface-variant">
                      {b}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </article>
      </main>
    </div>
  )
}
