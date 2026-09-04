# 003 — Interruptor de Ajustes: quitar `transition: all` y mover el pomo con `transform`

- **Status**: DONE (2026-09-04)
- **Commit**: e53b157
- **Severity**: HIGH
- **Category**: Performance · Interruptibility
- **Estimated scope**: 1 archivo, ~6 líneas
- **Depende de**: 001 (usa `var(--ease-out)`)

## Problem

El interruptor de Ajustes anima `all` y desplaza el pomo cambiando el margen (`ml-auto`), es decir, layout en cada fotograma. Además existe ya un interruptor correcto en `ui.css:611-636` (`.toggle`) que nadie usa.

```tsx
/* src/views/Ajustes.tsx:43-55 — actual */
function MockToggle({ checked, onChange, label, small = false }: { … }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`${small ? 'w-10 h-6 p-0p5' : 'w-12 h-7 p-1'} rounded-full flex items-center flex-none ${checked ? 'bg-volt' : 'bg-sc-highest'}`}
      onClick={() => onChange(!checked)}
    >
      <div className={`w-5 h-5 rounded-full shadow-sm ${checked ? 'ml-auto' : ''}`} style={{ background: checked ? 'var(--md-on-primary-container)' : 'var(--md-on-surface-variant)', transition: 'all 0.15s' }} />
    </button>
  )
}
```

## Target

Mismo aspecto, mismo marcado; el pomo se desplaza con `translateX` y solo se animan `transform` y `background-color`.

```tsx
/* src/views/Ajustes.tsx — target */
      <div
        className="w-5 h-5 rounded-full shadow-sm"
        style={{
          background: checked ? 'var(--md-on-primary-container)' : 'var(--md-on-surface-variant)',
          transform: checked ? `translateX(${small ? 16 : 20}px)` : 'translateX(0)',
          transition: 'transform 150ms var(--ease-out), background-color 150ms ease',
        }}
      />
```

Recorrido: el botón grande mide 48 px de ancho con 4 px de padding y pomo de 20 px → 48 − 8 − 20 = **20 px**. El pequeño mide 40 px con 2 px de padding → 40 − 4 − 20 = **16 px**. Si las clases `w-12`/`p-1`/`w-10`/`p-0p5` no miden eso en `tw.css`, recalcular antes de escribir.

## Repo conventions to follow

- `src/styles/ui.css:633-636` es el ejemplar: `.toggle::after { transition: transform 0.15s ease, background 0.15s ease; }` y `.toggle[aria-checked='true']::after { transform: translateX(20px); }`. Este plan replica esa idea en el componente inline de Ajustes; unificar ambos en un solo componente queda para 006.
- Color por variable, nunca hex.

## Steps

1. Comprobar en `src/styles/tw.css` los valores reales de `w-12`, `w-10`, `p-1`, `p-0p5`, `w-5` y ajustar los 20/16 px si hace falta.
2. En `src/views/Ajustes.tsx:53`, quitar `${checked ? 'ml-auto' : ''}` del `className` del pomo y sustituir el `style` por el del Target.
3. Nada más.

## Boundaries

- No tocar el `button` contenedor ni sus clases.
- No reemplazar `MockToggle` por `.toggle` de `ui.css` aquí (es un cambio de marcado; va en 006 si Pablo lo aprueba).
- Si la línea 53 no coincide, PARAR y avisar.

## Verification

- **Mecánica**: `npm run build` sin errores. `grep -rn "transition: 'all\|transition: all" src` vacío.
- **Sensación**: `npm run dev`, `/ajustes`. Pulsar un interruptor 5 veces seguidas rápido: el pomo debe invertir su camino desde donde esté, nunca saltar al extremo y volver (eso demuestra que es una transición, no un keyframe). Al 10 % en DevTools → Animations, el pomo y el color llegan a la vez.
- **Hecho cuando**: ningún `transition: all` en `src`, el pomo se mueve con `transform`, y `shots/ajustes-380.png` y `ajustes-380-light.png` regeneradas se ven igual que antes en reposo.
