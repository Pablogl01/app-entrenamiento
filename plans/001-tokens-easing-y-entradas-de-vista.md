# 001 — Crear tokens de easing y usarlos en las entradas de vista

- **Status**: DONE (2026-09-04)
- **Commit**: e53b157
- **Severity**: MEDIUM
- **Category**: Easing & duration · Cohesion & tokens
- **Estimated scope**: 2 archivos CSS, ~15 líneas

## Problem

No existe ningún token de curva. Todas las entradas usan el `ease` nativo, que arranca flojo justo en el fotograma que el usuario mira. Los demás planes (002, 003, 005) necesitan `var(--ease-out)` y `var(--ease-in-out)`, así que este va primero.

```css
/* src/styles/ui.css:871-877 — actual */
@keyframes view-fade { from { opacity: 0; } }
@keyframes view-push { from { opacity: 0; transform: translateX(24px); } }
@keyframes view-pop { from { opacity: 0; transform: translateX(-16px); } }

.view-fade { animation: view-fade 0.14s ease both; }
.view-push { animation: view-push 0.2s ease both; }
.view-pop { animation: view-pop 0.18s ease both; }
```

```css
/* src/styles/ui.css:718 — actual */
  transition: transform 0.15s ease;
```

```css
/* src/styles/ui.css:657 — actual */
.ring__fill { stroke: var(--volt); transition: stroke-dashoffset 0.2s ease; }
```

## Target

```css
/* src/styles/tokens.css — nuevo bloque, dentro de :root, justo después de --focus-ring (línea 125) */
  /* ---- Movimiento (DESIGN.md §6). Curvas fuertes: las nativas son flojas. ---- */
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);       /* entradas y respuestas del sistema */
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);   /* algo que se mueve o gira en pantalla */
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);    /* hojas inferiores */
```

```css
/* src/styles/ui.css — target */
.view-fade { animation: view-fade 0.14s var(--ease-out) both; }
.view-push { animation: view-push 0.2s var(--ease-out) both; }
.view-pop { animation: view-pop 0.18s var(--ease-out) both; }

.xcard__chev { /* …resto igual… */ transition: transform 0.15s var(--ease-in-out); }

.ring__fill { stroke: var(--volt); transition: stroke-dashoffset 0.2s var(--ease-out); }
```

Las duraciones **no cambian**: 140/200/180 ms vienen de `DESIGN.md §6`.

## Repo conventions to follow

- Todos los tokens viven en `src/styles/tokens.css` dentro de `:root` (ejemplo: `--radius-control: 4px;` en la línea 110). Los dos modos de color son bloques aparte; las curvas no dependen del modo, así que van una sola vez en el `:root` común.
- Cada bloque de tokens lleva un comentario de sección `/* ---- Nombre ---- */`.
- Ningún componente escribe un `cubic-bezier` a mano: siempre `var(--ease-*)`.

## Steps

1. En `src/styles/tokens.css`, después de la línea `--focus-ring: 2px;`, añadir el bloque de tres tokens del Target.
2. En `src/styles/ui.css:875-877`, sustituir `ease` por `var(--ease-out)` en las tres reglas `.view-*`.
3. En `src/styles/ui.css:718`, sustituir `ease` por `var(--ease-in-out)`.
4. En `src/styles/ui.css:657`, sustituir `ease` por `var(--ease-out)`.
5. Actualizar `DESIGN.md §6` con una línea: «Curvas: `--ease-out` para entradas y respuestas, `--ease-in-out` para lo que gira o se desplaza en pantalla, `--ease-drawer` para hojas. Pulsación: 60 ms lineal (sin cambio).»

## Boundaries

- No tocar `.press`, `.btn`, `.stepper__btn` (60 ms lineal es decisión de `DESIGN.md §6`).
- No tocar `.pulse`, `.ping` (plan 004) ni `.fold` (correcto tal cual).
- No cambiar duraciones ni marcado.
- Si una línea citada no coincide con el código, PARAR y avisar.

## Verification

- **Mecánica**: `npm run build` termina sin errores; `grep -rn "cubic-bezier" src --include=*.css --include=*.tsx` devuelve solo las tres líneas de `tokens.css` y la de `.ping` en `tw.css:250` (esa se trata en 004).
- **Sensación**: `npm run dev`, abrir `/rutinas` y entrar en el editor de una rutina. La vista debe entrar «seca»: casi todo el recorrido en los primeros 80 ms. En DevTools → Animations al 10 % debe verse que arranca rápido y frena al final, no al revés.
- **Hecho cuando**: existen los tres tokens, ninguna regla de entrada usa `ease` nativo, y `DESIGN.md §6` los nombra.
