# 000 — Auditoría de movimiento (skills de Emil Kowalski)

- **Fecha**: 2026-09-04 · **Commit**: e53b157
- **Skills aplicadas**: `emil-design-eng`, `review-animations`, `find-animation-opportunities`, `improve-animations` (instaladas en `.claude/skills/`).
- **Alcance**: todo `src/` salvo `src/assets`. Solo movimiento; tipografía, color y estructura los gobierna `DESIGN.md` y no se revisan aquí.

---

## 0. Reconocimiento

- **Stack**: React 19 + TS, CSS plano. Sin Framer Motion ni librería de motion. El movimiento vive en `src/styles/ui.css` (sección «Movimiento»), `tw.css` (`.press`, `.ping`), `screens.css` (`.hoy-stagger`), `tokens.css` (`prefers-reduced-motion`) y estilos inline en `Entrenar.tsx`, `Hoy.tsx` y `Ajustes.tsx`.
- **Tokens de movimiento**: ninguno. No hay `--ease-*` ni `--dur-*`; cada sitio escribe su duración y usa `ease` o `linear` nativos.
- **Personalidad**: «precisión de instrumento de laboratorio», densa, callada, un solo acento. Pide movimiento escaso, rápido y seco. `DESIGN.md §6` ya fija: 60 ms lineal en pulsación, 140/200/180 ms en cambio de vista, 220 ms en fold, 200 ms en barra de progreso, pulso solo en «sesión en curso», nada al scrollear.
- **Mapa de frecuencia** (por sesión de gimnasio, ~1 h):
  - 100+ al día: steppers ±, tocar la cifra, cambio de pestaña raíz. Nada o casi nada.
  - Decenas al día: confirmar serie (15–25), aparecer y desaparecer el temporizador de descanso, fold de tarjeta. Casi imperceptible.
  - Ocasional: menú ⋮, panel de discos, notas/RPE, toast del catálogo, editor de rutina. Estándar.
  - Raro: Resumen de sesión, estados vacíos. Aquí vive el presupuesto de deleite.

---

## 1. `emil-design-eng` — revisión general

| Before | After | Why |
| --- | --- | --- |
| `transition: 'all 0.15s'` y el pomo se mueve con `ml-auto` (`src/views/Ajustes.tsx:53`) | `transform: translateX(…)`; `transition: transform 150ms var(--ease-out), background-color 150ms ease` | `all` anima propiedades no previstas y el margen dispara layout; `ui.css:633` ya lo hace bien con `transform` |
| `transition: 'width 0.5s'` en la barra de la sesión (`src/views/Entrenar.tsx:240`) | `transform: scaleX(p)` + `transform-origin: left` + `transition: transform 200ms var(--ease-out)` | `width` no va por GPU; 500 ms rebasa el techo de 300 y contradice los 200 ms de `DESIGN.md §6` |
| `transition: 'width 0.3s'` (`Hoy.tsx:353`) y `width 0.2s ease` (`ui.css:651`) | igual que la fila anterior | tres barras, tres duraciones, ninguna en GPU |
| `view-fade 0.14s ease` / `view-push 0.2s ease` / `view-pop 0.18s ease` (`ui.css:875-877`) | mismas duraciones con `var(--ease-out)` = `cubic-bezier(0.23, 1, 0.32, 1)` | son entradas: ease-out fuerte; el `ease` nativo es flojo justo en el primer fotograma |
| `.hoy-stagger`, `.anim-enter`, `enter-up` (`screens.css:17-24`, `ui.css:864-869`) | borrar | código muerto: ninguna vista los usa. La «única secuencia orquestada» de `DESIGN.md §6` no existe en la app real |
| `.pulse` infinito en «Toca hoy» (`Rutinas.tsx:126`), barra de hoy (`Progreso.tsx:296`), recuperación (`Hoy.tsx:173`), recientes (`Catalogo.tsx:247`) | quitar la clase | `DESIGN.md §6`: pulso solo en el punto de «sesión en curso». Una animación infinita en reposo, en listas vistas a diario, es ruido |
| `.ping` 1 s infinito en ciclo (`Rutinas.tsx:151`) y calibrado (`Progreso.tsx:207`) | quitar; conservar el de `Resumen.tsx:92` | mismo motivo; Resumen es raro y puede permitírselo |
| `RestTimer` entra y sale por render condicional (`Entrenar.tsx:56-62`) | `@starting-style { opacity: 0; transform: translateY(-4px) }`, `transition: opacity 180ms var(--ease-out), transform 180ms var(--ease-out)` | aparece de la nada 15–25 veces por sesión; un fundido corto evita el salto sin hacerse notar |
| Menú ⋮ `menuOpen &&` (`Entrenar.tsx:249`) | `transform-origin: top right; @starting-style { opacity: 0; transform: scale(0.97) }`, 150 ms `var(--ease-out)` | popover anclado a su disparador: escala desde él, no desde el centro |
| Toast fijo del catálogo (`Catalogo.tsx:329`) | `@starting-style { opacity: 0; transform: translateY(100%) }`, 250 ms `cubic-bezier(0.32, 0.72, 0, 1)` | hoja inferior: entra por el borde en que se ancla; porcentaje, no píxeles |
| «Finalizar entrenamiento» pasa a volt por cambio de clase (`Entrenar.tsx:502`) | `transition: background-color 200ms ease, color 200ms ease` | es un cambio de estado que `DESIGN.md §1` pone en valor; un fundido lo hace legible |
| `.xcard__chev` `transform 0.15s ease` (`ui.css:718`) | `transform 150ms var(--ease-in-out)` | rota sobre la pantalla: ease-in-out |
| `stroke-dashoffset 0.3s` sin curva (`Hoy.tsx:347`) y `0.2s ease` (`ui.css:657`) | `200ms var(--ease-out)` en ambos | misma métrica, misma duración |
| `prefers-reduced-motion` a 0.01 ms para todo (`tokens.css:179-184`) | conservar opacidad y color; quitar solo desplazamientos | «menos y más suave, no cero»: hoy el usuario con reducción de movimiento pierde el feedback de estado. **Decisión de Pablo** (ver §5) |
| `.press` / `.btn` `transform 60ms linear` (`tw.css:193`, `ui.css:385`, `ui.css:577`) | Emil: 100–160 ms ease-out. `DESIGN.md §6`: 60 lineal a propósito | decisión documentada: **se respeta**, solo se anota |

Lo que ya está bien y no se toca: `.fold` con `grid-template-rows` + `visibility` (`ui.css:889-905`, técnica correcta para acordeón), `.setrow` color 180 ms (`ui.css:907`), `.toggle` con `transform` (`ui.css:633`), cero `:hover` (correcto en app táctil), stagger de 60 ms bien dimensionado (aunque muerto), pulso en el punto de barra superior (`TopBar.tsx:32`) y hero (`Hoy.tsx:185`).

---

## 2. `review-animations` — veredicto sobre lo que ya se mueve

Tabla de hallazgos: la de §1 (mismo formato Before/After/Why).

**Regresiones que rompen la sensación**
- `Ajustes.tsx:53`: `transition: all` más margen para mover el pomo. Escalación automática.
- `Entrenar.tsx:240`: 500 ms en una barra de progreso de UI, sin justificación, sobre `width`.

**Simplificaciones perdidas**
- Cuatro `.pulse` y dos `.ping` infinitos fuera del único uso permitido. Borrar es la mejor animación.
- `.hoy-stagger` y `.anim-enter`: 20 líneas de CSS sin consumidor.

**Rendimiento**
- Tres barras animan `width` (`Entrenar.tsx:240`, `Hoy.tsx:353`, `ui.css:651`). Arreglo trivial: `scaleX`.

**Interrumpibilidad y timing**
- Cambio de vista con keyframes (`ui.css:871-877`): aceptable porque cada ruta remonta con `key`, pero el gesto lateral rápido puede encadenar dos entradas. Sin arreglo barato; se anota.
- Nada asimétrico que revisar: los press son 60/60 por decisión de `DESIGN.md`.

**Origen, física y cohesión**
- Sin tokens de curva: seis duraciones y tres curvas escritas a mano. Consolidar.
- Curvas nativas (`ease`) en todas las entradas.

**Accesibilidad**
- La reducción de movimiento a cero incluye los fundidos de color que explican estado (fold, fila hecha, Finalizar). Emil pediría conservarlos. Choca con `DESIGN.md §6` («apaga todo»).

**Decisión: BLOCK.** Motivos: `transition: all` con propiedad de layout, animación de `width` con arreglo GPU evidente y una duración de 500 ms en UI. Ninguno es caro de corregir (planes 001–003).

---

## 3. `find-animation-opportunities` — dónde falta movimiento

| # | Sitio | Hoy | Propósito | Frecuencia | Movimiento propuesto |
| --- | --- | --- | --- | --- | --- |
| 1 | `Entrenar.tsx:56-62` (RestTimer) | Aparece y desaparece de golpe tras cada serie | Evitar un salto | Decenas/día | Entrada casi imperceptible: `@starting-style { opacity: 0; transform: translateY(-4px) }` → `transition: opacity 180ms var(--ease-out), transform 180ms var(--ease-out)`. Salida instantánea (el sistema responde: asimétrico) |
| 2 | `SetRow.tsx:106` (bloque `SetActive`) | Al confirmar, el bloque grande se convierte en fila y el siguiente se expande sin puente | Indicación de estado | Decenas/día | Solo la entrada del nuevo bloque: `@starting-style { opacity: 0; transform: scale(0.98) }`, 180 ms `var(--ease-out)`. El salto de altura se queda (animarlo exige FLIP en JS y no compensa). **Sensación no juzgable desde el código: probar en el móvil** |
| 3 | `Entrenar.tsx:502` (Finalizar) | Pasa de secundario a volt por swap de clase | Indicación de estado | 1/sesión | `transition: background-color 200ms ease, color 200ms ease` |
| 4 | `Entrenar.tsx:249` (menú ⋮) | Aparece sin relación con su botón | Consistencia espacial | Ocasional | `transform-origin: top right; @starting-style { opacity: 0; transform: scale(0.97) }`, 150 ms `var(--ease-out)` |
| 5 | `Catalogo.tsx:329` (toast «N seleccionados») | Aparece fijo abajo de golpe | Consistencia espacial | Ocasional | `@starting-style { opacity: 0; transform: translateY(100%) }`, 250 ms `cubic-bezier(0.32, 0.72, 0, 1)` |
| 6 | `Entrenar.tsx:335` y `:452` (discos, notas/RPE) | Paneles que se despliegan de golpe | Evitar un salto | Ocasional | `@starting-style { opacity: 0; transform: translateY(-4px) }`, 200 ms `var(--ease-out)` |
| 7 | `Resumen.tsx:89` (pantalla «sesión completada») | Entra plana, como cualquier apilada | Deleite (tier raro) | 1/sesión | Escalonar sus secciones 40 ms con `enter-up` 300 ms `var(--ease-out)`. **Requiere cambiar `DESIGN.md §6`**, que reserva la única secuencia orquestada a Hoy (y esa ya no existe) |

**Rechazados** (y la pregunta que los mató):
- `Stepper.tsx` ± y cifra. **100+ al día. Nunca animar el cambio de valor.** El press de 60 ms es todo lo que toca.
- `App.tsx:33` cambio de pestaña raíz. **Navegación núcleo, 100+ al día.** Ya tiene un fundido de 140 ms; no añadir nada, y si algún día molesta, quitarlo.
- `charts.tsx` / `Progreso.tsx` gráficas. **Dato que se lee.** Dibujar la línea sería decoración sobre información.
- `Calendario.tsx` cambio de mes. **Dato que se lee**, y la rejilla debe estar quieta para comparar días.
- `useReorder.ts` arrastre. Springs con velocidad exigen JS o librería; `CLAUDE.md` veta dependencias de UI por peso y red, y reordenar es raro. No compensa.
- Cualquier `:hover`. App táctil: correcto que no haya ninguno.

**Veredicto.** La app necesita poco movimiento y ya está cerca de lo correcto en filosofía (nada al scrollear, sin hover, press seco). Lo que sobra son pulsos infinitos; lo que falta son puentes de 150–200 ms en los cuatro sitios de Entrenar donde algo aparece de la nada. La palanca más alta es la fila 1 (descanso) porque se ve en cada serie. Todas las filas están recogidas en el plan **005**.

---

## 4. `improve-animations` — hallazgos priorizados

| # | Severidad | Categoría | Sitio | Hallazgo | Arreglo | Plan |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | HIGH | Rendimiento | `Ajustes.tsx:53` | `transition: all` y pomo movido con `margin` | `transform: translateX`, propiedades explícitas | 003 |
| 2 | HIGH | Rendimiento / duración | `Entrenar.tsx:240`, `Hoy.tsx:353`, `ui.css:651` | Barras animan `width`; una a 500 ms | `scaleX` + `transform-origin: left`, 200 ms `--ease-out` | 002 |
| 3 | HIGH | Propósito | `Rutinas.tsx:126,151`, `Progreso.tsx:207,296`, `Hoy.tsx:173`, `Catalogo.tsx:247` | Pulsos infinitos fuera de «sesión en curso» | Borrar la clase | 004 |
| 4 | MEDIUM | Easing / tokens | `ui.css:875-877`, `:718`, `:657`; `Hoy.tsx:347` | Curvas nativas, sin tokens | `--ease-out`, `--ease-in-out`, `--ease-drawer` en `tokens.css` | 001 |
| 5 | MEDIUM | Oportunidades | `Entrenar.tsx`, `Catalogo.tsx`, `SetRow.tsx` | Seis entradas que teletransportan | `@starting-style`, 150–250 ms | 005 |
| 6 | LOW | Cohesión | `screens.css:17-24`, `ui.css:864-869`, `Ring.tsx`, `Toggle.tsx`, `.setcheck` | Movimiento y componentes muertos | Borrar y corregir `DESIGN.md §6` | 006 |

---

## 5. Decisiones que quedan para Pablo (no se planifican)

1. **`prefers-reduced-motion`**: `DESIGN.md §6` dice «apaga todo»; Emil dice «conserva opacidad y color, quita desplazamientos». Si se acepta la versión de Emil, el cambio es solo en `tokens.css:179-184`: dejar fuera del apagado `color`, `background-color`, `border-color` y `opacity`.
2. **Press a 60 ms lineal**: decisión explícita de `DESIGN.md §6`. Emil daría 100–160 ms ease-out. Se respeta; anotado por si algún día se revisa.
3. **La «única secuencia orquestada»**: `DESIGN.md §6` la sitúa en Hoy, pero el código v2 de Hoy no la usa. O se recupera en Hoy, o se mueve a Resumen (donde el tier raro la justifica), o se borra la frase. El plan 006 asume «borrar» hasta que se decida.
