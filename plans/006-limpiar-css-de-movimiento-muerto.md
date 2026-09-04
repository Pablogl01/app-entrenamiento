# 006 — Limpiar el movimiento muerto de la v1 y alinear `DESIGN.md §6`

- **Status**: TODO (pendiente de la decisión 3 de `000-auditoria-movimiento.md §5`)
- **Commit**: e53b157
- **Severity**: LOW
- **Category**: Cohesion & tokens
- **Estimated scope**: 2 archivos CSS (−25 líneas), 2 componentes TSX a borrar, 1 línea de `DESIGN.md`

## Problem

Tras el rediseño v2 quedaron reglas y componentes de movimiento sin ningún consumidor. Confunden a quien lee `DESIGN.md §6`, que describe una «secuencia orquestada» en Hoy que ya no ocurre.

```css
/* src/styles/screens.css:17-24 — actual, sin uso (grep "hoy-stagger" en src/views: 0 resultados) */
.hoy-stagger .xcard { animation: enter-up 0.3s ease both; }
.hoy-stagger .xcard:nth-of-type(2) { animation-delay: 60ms; }
…
.hoy-stagger .xcard:nth-of-type(8) { animation-delay: 420ms; }

/* src/styles/ui.css:864-869 — actual; enter-up solo lo usaba .hoy-stagger */
@keyframes enter-up {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: none; }
}
.anim-enter { animation: enter-up 0.3s ease both; }

/* src/styles/ui.css:660-680 — .setcheck, sin uso */
/* src/components/Ring.tsx — sin uso (grep "<Ring" : 0) */
/* src/components/Toggle.tsx — sin uso (grep "<Toggle" : 0); Ajustes usa MockToggle inline */
```

```md
<!-- DESIGN.md §6, primera viñeta — actual -->
- **Una sola secuencia orquestada:** al abrir Hoy, la tarjeta hero entra y las de ejercicio escalonan con `animation-delay`. Una vez por sesión de app.
```

## Target

Depende de la decisión de Pablo:

- **(a) Borrar** (asumido por defecto): eliminar `screens.css:17-24`, `ui.css:864-869`, `ui.css:660-680` (`.setcheck`, `.setcheck.on`), `src/components/Ring.tsx`, `src/components/Toggle.tsx` y la regla `.toggle` de `ui.css:611-636` (o bien sustituir `MockToggle` de Ajustes por `.toggle`; en ese caso conservar `.toggle` y borrar `MockToggle`). Reescribir la viñeta de `DESIGN.md §6` como: «Sin secuencias orquestadas. Todo movimiento responde a una acción del usuario.»
- **(b) Recuperar en Hoy**: añadir `className="hoy-stagger"` al contenedor de tarjetas de Hoy y cambiar `ease` por `var(--ease-out)` en `screens.css:17`. Requiere que las tarjetas de Hoy vuelvan a llevar `.xcard`, que hoy no llevan: es un cambio de marcado y necesita plan propio.
- **(c) Mover a Resumen**: aplicar `enter-up 0.3s var(--ease-out)` con `animation-delay` de 0/40/80/120 ms a las cuatro secciones de `Resumen.tsx` y reescribir la viñeta de `DESIGN.md §6` para nombrar Resumen en vez de Hoy.

## Repo conventions to follow

- `DESIGN.md` manda en aspecto; cualquier cambio de movimiento se refleja allí y en el changelog (§11) con fecha.
- Sin CSS huérfano: cada clase en `ui.css`/`screens.css` tiene al menos un consumidor en `src/views` o `src/components`.

## Steps (variante a)

1. Borrar `src/styles/screens.css:17-24`.
2. Borrar `src/styles/ui.css:864-869` (`@keyframes enter-up` y `.anim-enter`).
3. Borrar `src/styles/ui.css:660-680` (`.setcheck`, `.setcheck.on`) y su comentario de sección.
4. Borrar `src/components/Ring.tsx` y `src/components/Toggle.tsx`; borrar la regla `.toggle` (`ui.css:611-636`) y el comentario `/* ---- Interruptor ---- */`, salvo que se decida usarla desde Ajustes.
5. Borrar las variables `--check` de `tokens.css:122` si `.setcheck` era su único consumidor (comprobar con grep).
6. Reescribir la primera viñeta de `DESIGN.md §6` y añadir una entrada en §11 con fecha 2026-09-04.

## Boundaries

- No tocar `.fold`, `.view-*`, `.pulse`, `.ping`, `.press`.
- No borrar nada que tenga un consumidor: grep antes de cada borrado.
- Si Pablo elige (b) o (c), escribir un plan nuevo; no improvisar aquí.

## Verification

- **Mecánica**: `npm run build` y `npm run lint` limpios. Para cada clase borrada, `grep -rn "<clase>" src` devuelve 0.
- **Sensación**: ninguna. Es limpieza; nada debe cambiar en pantalla. Regenerar `node scripts/shots.mjs` y comparar `shots/*.png` con los anteriores.
- **Hecho cuando**: el CSS de movimiento no tiene reglas huérfanas y `DESIGN.md §6` describe lo que la app hace de verdad.
