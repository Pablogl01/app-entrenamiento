# 002 — Barras de progreso: de `width` a `transform: scaleX`

- **Status**: DONE (2026-09-04)
- **Commit**: e53b157
- **Severity**: HIGH
- **Category**: Performance · Easing & duration
- **Estimated scope**: 3 archivos, ~8 líneas
- **Depende de**: 001 (usa `var(--ease-out)`)

## Problem

Tres barras animan `width`, que dispara layout y pintado en cada fotograma. Una de ellas dura 500 ms, por encima del techo de 300 y en contra de los 200 ms que fija `DESIGN.md §6`. Las tres llevan duraciones distintas para el mismo gesto.

```tsx
/* src/views/Entrenar.tsx:240 — actual */
<div className="bg-volt rounded-full" style={{ height: '100%', width: `${pct}%`, transition: 'width 0.5s' }} />
```

```tsx
/* src/views/Hoy.tsx:353 — actual */
<div className="bg-volt h-full" style={{ width: `${pct}%`, transition: 'width 0.3s' }} />
```

```css
/* src/styles/ui.css:645-652 — actual */
.progress__fill {
  height: 100%;
  background: var(--volt);
  border-radius: var(--radius-pill);
  transition: width 0.2s ease;
}
```

```tsx
/* src/views/Ciclo.tsx:152 — actual (consume .progress__fill) */
<div className="progress__fill" style={{ width: `${pct}%` }} />
```

## Target

Una sola regla compartida, y las tres barras la usan:

```css
/* src/styles/ui.css — target, sustituye a .progress__fill */
.progress__fill {
  width: 100%;
  height: 100%;
  background: var(--volt);
  border-radius: var(--radius-pill);
  transform-origin: left;
  transition: transform 0.2s var(--ease-out);
}
```

```tsx
/* Entrenar.tsx:240 — target */
<div className="progress__fill" style={{ transform: `scaleX(${pct / 100})` }} />

/* Hoy.tsx:353 — target */
<div className="progress__fill" style={{ transform: `scaleX(${pct / 100})` }} />

/* Ciclo.tsx:152 — target */
<div className="progress__fill" style={{ transform: `scaleX(${pct / 100})` }} />
```

Los contenedores ya tienen `overflow: hidden` y `rounded-full`, así que el extremo escalado no asoma. El redondeo del borde derecho se comprime con la escala; a 6 px de alto no se aprecia.

## Repo conventions to follow

- Clases de componente en `ui.css` con prefijo BEM (`.progress`, `.progress__fill`); las vistas no repiten estilos que ya existen como clase.
- `Ciclo.tsx:151-152` es el ejemplar: contenedor `.progress` + relleno `.progress__fill` con solo el valor dinámico inline.

## Steps

1. En `src/styles/ui.css:645-652`, reemplazar la regla `.progress__fill` por la del Target.
2. En `src/views/Ciclo.tsx:152`, cambiar `style={{ width: \`${pct}%\` }}` por `style={{ transform: \`scaleX(${pct / 100})\` }}`.
3. En `src/views/Entrenar.tsx:240`, sustituir el `div` por `<div className="progress__fill" style={{ transform: \`scaleX(${pct / 100})\` }} />`. Mantener el contenedor de la línea 239 tal cual (ya es `overflow-hidden rounded-full`).
4. En `src/views/Hoy.tsx:353`, igual que el paso 3. Mantener el contenedor de la línea 352.

## Boundaries

- No tocar los anillos SVG (`stroke-dashoffset` en `Hoy.tsx:347`, `Entrenar.tsx:74`, `Resumen.tsx:285`): son atributo SVG y el coste es aceptable; solo cambia su curva en 001.
- No cambiar alturas, colores ni marcado de los contenedores.
- Si `pct` puede ser `NaN` en algún sitio, no arreglarlo aquí: avisar.

## Verification

- **Mecánica**: `npm run build` sin errores. `grep -rn "transition: 'width\|transition: width" src` no devuelve nada.
- **Sensación**: `npm run dev`, `/?demo=1`, Rutinas → empezar sesión → confirmar una serie. La barra de «Progreso total» crece en unos 200 ms y frena al llegar. En DevTools → Performance, grabar una confirmación: no debe haber eventos «Layout» disparados por la barra.
- **Hecho cuando**: las tres barras usan `.progress__fill` con `scaleX`, ninguna anima `width`, y a 320 px en claro y oscuro se ven igual que antes (capturas `shots/entrenando-320.png`, `hoy-380-light.png`, `ciclo-380.png` regeneradas con `node scripts/shots.mjs`).
