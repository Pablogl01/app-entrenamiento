# 005 — Entradas con `@starting-style` en Entrenar y Catálogo

- **Status**: DONE (2026-09-04). Nota: `.finish-cta` tuvo que escribirse como `.press.finish-cta` con el `transform 60ms linear` incluido, porque `.press` (tw.css) tiene la misma especificidad y se declara después.
- **Commit**: e53b157
- **Severity**: MEDIUM
- **Category**: Missed opportunities · Physicality & origin
- **Estimated scope**: 1 archivo CSS (+ ~30 líneas), 3 archivos TSX (añadir una clase en 7 sitios)
- **Depende de**: 001 (tokens de curva)

## Problem

En la sesión en vivo hay seis elementos que aparecen por render condicional sin ningún puente: se materializan de golpe. Un puente de 150–250 ms con ease-out fuerte evita el salto sin hacerse notar. La salida sigue siendo instantánea (desmontaje): es asimetría deliberada, el sistema responde y no se hace esperar.

```tsx
/* src/views/Entrenar.tsx:62-63 — RestTimer, actual */
  return (
    <div className="px-gutter mb-md">

/* src/views/Entrenar.tsx:249-250 — menú ⋮, actual */
            {menuOpen && (
              <div className="mt-md rounded-lg bg-sc-high flex flex-col">

/* src/views/Entrenar.tsx:335-336 — discos, actual */
                {platesOpen && current.exercise.load_type === 'barbell' && (
                  <div className="bg-sc-lowest rounded-lg p-2p5">

/* src/views/Entrenar.tsx:452-453 — notas/RPE, actual */
          {notesOpen && (
            <div className="bg-sc rounded-xl p-md shadow-sm flex flex-col gap-sm" aria-label="Notas y RPE">

/* src/views/Entrenar.tsx:502 — Finalizar, actual */
                  className={`w-full h-touch rounded-lg type-label-md font-bold uppercase tracking-widest flex items-center justify-center gap-xs press shadow-sm${allDone ? ' bg-volt text-on-volt' : ' bg-sc-highest text-secondary-fixed'}`}

/* src/components/SetRow.tsx:106 — bloque de la serie en curso, actual */
    <div className="rounded-xl p-md bg-sc-highest shadow-md my-xxs">

/* src/views/Catalogo.tsx:329 — toast de selección, actual */
        <div className="cat-toast" style={{ position: 'fixed', bottom: 24, left: 16, right: 16, zIndex: 40, maxWidth: 528, margin: '0 auto' }}>
```

## Target

Cuatro clases de entrada nuevas en `ui.css`, sección «Movimiento», y una transición de color para Finalizar:

```css
/* src/styles/ui.css — target, añadir al final de la sección "Movimiento (DESIGN.md §6)" */

/* Entradas por @starting-style: solo transform y opacity; la salida es instantánea a propósito. */
.enter-soft {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 0.18s var(--ease-out), transform 0.18s var(--ease-out);
  @starting-style { opacity: 0; transform: translateY(-4px); }
}

.enter-panel {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 0.2s var(--ease-out), transform 0.2s var(--ease-out);
  @starting-style { opacity: 0; transform: translateY(-4px); }
}

.enter-menu {
  opacity: 1;
  transform: scale(1);
  transform-origin: top right;
  transition: opacity 0.15s var(--ease-out), transform 0.15s var(--ease-out);
  @starting-style { opacity: 0; transform: scale(0.97); }
}

.enter-sheet {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 0.25s var(--ease-drawer), transform 0.25s var(--ease-drawer);
  @starting-style { opacity: 0; transform: translateY(100%); }
}

.enter-block {
  opacity: 1;
  transform: scale(1);
  transition: opacity 0.18s var(--ease-out), transform 0.18s var(--ease-out);
  @starting-style { opacity: 0; transform: scale(0.98); }
}

/* Finalizar: pasa a volt cuando todas las series están hechas (DESIGN.md §1). */
.finish-cta { transition: background-color 0.2s ease, color 0.2s ease; }
```

Asignación:

| Sitio | Clase |
| --- | --- |
| `Entrenar.tsx:63` RestTimer (el `div.px-gutter`) | `enter-soft` |
| `Entrenar.tsx:250` menú ⋮ | `enter-menu` |
| `Entrenar.tsx:336` discos | `enter-panel` |
| `Entrenar.tsx:453` notas/RPE | `enter-panel` |
| `Entrenar.tsx:502` Finalizar | `finish-cta` |
| `SetRow.tsx:106` bloque `SetActive` | `enter-block` |
| `Catalogo.tsx:329` toast | `enter-sheet` |

## Repo conventions to follow

- Clases de movimiento en `ui.css`, sección «Movimiento (DESIGN.md §6)», con un comentario que explique el «cuándo». Ejemplar: `.fold` en `ui.css:888-905`.
- Solo `transform` y `opacity`. Nada de `height`.
- `@starting-style` anidado dentro de la regla (sintaxis CSS nesting; Vite lo sirve tal cual y los navegadores objetivo, Chrome/Safari 2024+, lo soportan). Si el `build` se queja del anidado, escribirlo como bloque aparte: `@starting-style { .enter-soft { opacity: 0; transform: translateY(-4px); } }`.
- `prefers-reduced-motion` de `tokens.css:179` acorta todas estas transiciones a 0.01 ms automáticamente; no hace falta nada más.

## Steps

1. En `src/styles/ui.css`, tras la regla `.setrow` (línea 907), añadir el bloque CSS del Target.
2. `src/views/Entrenar.tsx:63`: `className="px-gutter mb-md enter-soft"`.
3. `src/views/Entrenar.tsx:250`: añadir ` enter-menu` al final del `className`.
4. `src/views/Entrenar.tsx:336`: añadir ` enter-panel`.
5. `src/views/Entrenar.tsx:453`: añadir ` enter-panel`.
6. `src/views/Entrenar.tsx:502`: añadir ` finish-cta` antes de la interpolación `${allDone …}`.
7. `src/components/SetRow.tsx:106`: `className="rounded-xl p-md bg-sc-highest shadow-md my-xxs enter-block"`.
8. `src/views/Catalogo.tsx:329`: `className="cat-toast enter-sheet"`.
9. Actualizar `DESIGN.md §6` con una viñeta: «Lo que aparece por acción del usuario entra con `@starting-style` (150–250 ms, `--ease-out`; hojas con `--ease-drawer`) y sale al instante.»

## Boundaries

- No animar la altura del bloque de la serie al colapsar a fila (haría falta FLIP en JS; fuera de alcance).
- No añadir animación de salida a nada.
- No tocar `.press`, ni los steppers, ni la tabla de series aparte de la clase en `SetRow.tsx:106`.
- No añadir dependencias.
- Si una línea no coincide, PARAR y avisar.

## Verification

- **Mecánica**: `npm run build` sin errores ni avisos de CSS. `npm run lint` limpio.
- **Sensación** (`npm run dev`, `/?demo=1`, Rutinas → empezar sesión):
  - Confirmar una serie: el temporizador de descanso aparece con un fundido corto; al pulsar «Saltar» desaparece de golpe. El nuevo bloque de serie en curso aparece ligeramente «hinchándose» desde 0.98. Si a velocidad real el bloque llama la atención, bajar `enter-block` a 0.14 s; si el descanso resulta lento tras 10 series seguidas, bajar `enter-soft` a 0.14 s. **Este punto no se puede juzgar desde el código: probar en el móvil real.**
  - Pulsar ⋮: el menú escala desde su esquina superior derecha, no desde el centro.
  - En Catálogo con `?session=`, marcar un ejercicio: el toast sube desde el borde inferior en 250 ms.
  - Completar todas las series: «Finalizar entrenamiento» funde a volt en 200 ms en vez de saltar.
  - DevTools → Rendering → «Emulate prefers-reduced-motion»: todo aparece al instante y nada se rompe.
- **Hecho cuando**: las siete clases están aplicadas, el build pasa, y `node scripts/flow.mjs` termina sin errores de consola con `shots/entrenando-380.png` visualmente igual que antes en reposo.
