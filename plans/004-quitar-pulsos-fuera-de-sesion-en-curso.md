# 004 — Quitar `.pulse` y `.ping` fuera del punto de «sesión en curso»

- **Status**: DONE (2026-09-04)
- **Commit**: e53b157
- **Severity**: HIGH
- **Category**: Purpose & frequency
- **Estimated scope**: 4 archivos TSX, 6 líneas (solo borrar una clase en cada una)

## Problem

`DESIGN.md §6`: «Pulso solo en el punto de "sesión en curso" (barra superior, tag de la hero)». En el código hay seis animaciones infinitas más, en pantallas que se ven a diario y en reposo. Una animación infinita sin propósito en una lista es ruido, gasta batería y devalúa el único pulso que sí significa algo.

```tsx
/* src/views/Rutinas.tsx:126 — actual */
return <span className="bg-volt text-on-primary-container type-label-sm uppercase px-xs py-2px rounded font-bold tracking-wider pulse">Toca hoy</span>

/* src/views/Rutinas.tsx:151 — actual */
<span className={`w-1p5 h-1p5 rounded-full ${cycle ? 'bg-volt ping' : 'bg-sc-highest'}`} />

/* src/views/Progreso.tsx:207 — actual */
<span className={`w-2 h-2 rounded-full ${calibrated ? 'bg-volt ping' : 'bg-outline'}`} />

/* src/views/Progreso.tsx:296 — actual */
<div className={`w-full bg-sc-highest rounded-sm${isToday ? ' pulse' : ''}`} style={{ height: isToday ? '55%' : '45%', opacity: isToday ? 1 : 0.6 }} />

/* src/views/Hoy.tsx:173 — actual */
<span className={`w-2 h-2 rounded-full flex-none ${recovery == null ? 'bg-sc-highest' : 'bg-volt pulse'}`} />

/* src/views/Catalogo.tsx:247 — actual */
<span className="w-1p5 h-1p5 rounded-full bg-volt pulse" />
```

Se conservan, porque sí son «sesión en curso» o tier raro:
- `src/components/TopBar.tsx:32` — punto de la barra raíz, `live`.
- `src/views/Hoy.tsx:185` — tag de la hero, `live`.
- `src/views/Entrenar.tsx:202` — punto de la cabecera de sesión, `live && !paused`.
- `src/views/Resumen.tsx:92` — `ping` en la pantalla de sesión completada (una vez por sesión: presupuesto de deleite).

## Target

Las seis líneas idénticas salvo por la clase eliminada:

```tsx
/* Rutinas.tsx:126 */ … rounded font-bold tracking-wider">Toca hoy</span>
/* Rutinas.tsx:151 */ ${cycle ? 'bg-volt' : 'bg-sc-highest'}
/* Progreso.tsx:207 */ ${calibrated ? 'bg-volt' : 'bg-outline'}
/* Progreso.tsx:296 */ className="w-full bg-sc-highest rounded-sm"
/* Hoy.tsx:173 */ ${recovery == null ? 'bg-sc-highest' : 'bg-volt'}
/* Catalogo.tsx:247 */ className="w-1p5 h-1p5 rounded-full bg-volt"
```

## Repo conventions to follow

- El volt sigue marcando «dato vivo» de forma estática (`DESIGN.md §1`, uso 4). Quitar el pulso no quita el color.
- `.pulse` y `.ping` siguen definidas en `ui.css:879-884` y `tw.css:248-250` para los cuatro usos legítimos. No borrarlas.

## Steps

1. `src/views/Rutinas.tsx:126`: quitar ` pulse` del `className`.
2. `src/views/Rutinas.tsx:151`: quitar ` ping` de la rama `cycle`.
3. `src/views/Progreso.tsx:207`: quitar ` ping` de la rama `calibrated`.
4. `src/views/Progreso.tsx:296`: quitar `${isToday ? ' pulse' : ''}` y dejar la clase fija.
5. `src/views/Hoy.tsx:173`: quitar ` pulse` de la rama con recuperación.
6. `src/views/Catalogo.tsx:247`: quitar ` pulse`.

## Boundaries

- No tocar los cuatro usos que se conservan.
- No borrar las definiciones de `.pulse` / `.ping`.
- Si alguna línea no coincide, PARAR y avisar.

## Verification

- **Mecánica**: `npm run build` sin errores. `grep -rn "pulse\|ping" src/views src/components --include=*.tsx` devuelve exactamente cuatro coincidencias: `TopBar.tsx`, `Hoy.tsx` (hero), `Entrenar.tsx`, `Resumen.tsx`.
- **Sensación**: `npm run dev`, `/?demo=1`, recorrer Hoy, Rutinas, Progreso y Catálogo sin sesión iniciada: nada parpadea. Iniciar sesión: parpadea el punto de la barra superior y el de la hero, y nada más.
- **Hecho cuando**: el grep da cuatro y las pantallas raíz están quietas sin sesión.
