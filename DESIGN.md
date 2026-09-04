# DESIGN.md — App de registro de entrenamiento

Sistema de diseño «Kinetic Nordic Craft». Se lee **antes** de escribir cualquier UI.
Complementa `especificaciones-app-entrenamiento.md`, que define el comportamiento. Este documento define el aspecto.

**Versión:** 2.4 · septiembre 2026. Sustituye por completo a la v1.x (crema, material fotográfico, verde funcional). Las maquetas de origen y los dos DESIGN exportados de Stitch están en `docs/stitch/`; el plan de implementación en `docs/rediseno-v2-plan.md`.

---

## 0. Brief en una frase

Herramienta personal de registro de entrenamiento para un solo usuario. Precisión de instrumento de laboratorio con materiales minerales cálidos: carbón y hueso en oscuro, caliza y grafito en claro, y **un solo acento volt** que señala lo que importa. Vive en dos contextos físicos opuestos: el baño a las 8:00 recién despierto, y el gimnasio a las 19:00 con prisa y manos sudadas.

**La decisión estructural de la que cuelga todo lo demás:** la app es densa en todas partes y **rompe la escala en un único sitio**: el bloque de la serie en curso. Cifra a 40px, steppers de 48 y un botón volt de 56. Todo lo que lo rodea es compacto y callado. Ese contraste es el elemento memorable del producto.

---

## 1. Color

Tokens semánticos, independientes del modo. Ningún componente sabe si está en oscuro o en claro: usa el token. No se introducen colores nuevos sin actualizar este archivo y `tokens.css`.

| Token | Oscuro | Claro | Uso |
|---|---|---|---|
| `--bg` | `#121315` | `#f8f7f4` | Lienzo |
| `--surface` | `#1b1c1e` | `#ffffff` | Tarjetas, barras |
| `--surface-hi` | `#25282e` | `#eae7e0` | Filas activas, botón secundario, pista del segmentado, paneles interiores |
| `--well` | `#0d0e10` | `#f2f0eb` | Lecho de inputs y de la marca de ejercicio |
| `--ink` | `#e3e2e4` | `#111315` | Texto principal y cifras |
| `--ink-soft` | `#b9b5aa` | `#575a5e` | Texto secundario, unidades |
| `--ink-mute` | `#7b828e` | `#8c8f94` | Etiquetas, ejes, histórico, estados pendientes |
| `--rule` | `rgba(230,225,214,.08)` | `#e5e3dc` | Hairline estructural |
| `--rule-strong` | `rgba(230,225,214,.14)` | `#dbd8cf` | Borde de botón secundario |
| `--volt` | `#c8f322` | `#c0eb1e` | El acento |
| `--on-volt` | `#141517` | `#111315` | Texto sobre volt |
| `--volt-edge` | `rgba(200,243,34,.35)` | `#9ec412` | Borde de fila hecha, de botón primario, de tarjeta activa |
| `--volt-tint` | `rgba(200,243,34,.12)` | `#f4fcd4` | Fondo de chip de estado / PR |
| `--volt-ink` | `#c8f322` | `#4d6100` | Texto volt legible sobre superficie |
| `--alert` | `#ff4a4a` | `#e53935` | Solo destructivo |

### El acento

**Uno solo**, `--volt`, y significa exactamente cuatro cosas:

1. **Acción primaria** (Iniciar sesión, Completar serie, Cerrar, Crear).
2. **Hecho** (casilla de serie confirmada, día completado en el calendario, chip «Hecha»).
3. **Récord** (bloque de PRs, chip PR en el desglose).
4. **Dato vivo** (punto de la barra superior con sesión en curso, línea de la gráfica, último punto, cronómetro).

No colorea títulos, iconos de sección ni metadatos. Cuando se dude, no es volt. El botón «Finalizar entrenamiento» es secundario mientras queden series y **pasa a volt cuando todas están hechas**: el color señala que hay algo hecho detrás.

`--alert` aparece solo al pulsar una acción destructiva (borrar sesión, archivar rutina). Un día programado y no hecho **nunca** es rojo: es `--ink-mute` sobre `--surface`.

### Modo

El modo lo decide `<html data-theme="dark|light">`. Un script inline en `index.html` lo resuelve antes del primer pintado con el ajuste guardado en `localStorage` o `prefers-color-scheme`; `src/lib/theme.ts` lo mantiene y `settings.theme` (`system` / `dark` / `light`) lo persiste. Ajustes → Apariencia lo cambia.

---

## 2. Profundidad

Sin material fotográfico. La profundidad la dan **capas de superficie** (`--bg` → `--surface` → `--surface-hi` → `--well` hacia dentro) y **hairlines**.

- **Sombras:** ninguna en oscuro. En claro, solo la micro-sombra de tarjeta `--card-shadow` (`0 1px 3px rgba(17,19,21,.04), 0 4px 12px rgba(17,19,21,.02)`).
- **Halo volt** `--halo`: exclusivo del bloque activo (serie en curso, tarjeta de sesión en curso, bloque de PRs). Nunca en reposo.
- **Blur:** no. La barra superior es opaca.
- **Degradados:** uno solo, el relleno `--chart-fill` bajo la línea de una gráfica. Jamás en fondos, botones o tarjetas.

---

## 3. Tipografía

Una familia, Inter variable, auto-alojada en WOFF2 con subset latino (48 KB). Sin Google Fonts CDN: la app arranca sin red.

| Rol | Familia | Por qué |
|---|---|---|
| Display, títulos y nombres de ejercicio | **Inter** (variable 100–900, usada en 700–800) | Es la que se ve en las capturas de Stitch: los títulos llevan Inter 800 forzada con tracking −0.03em |
| Texto, cifras, unidades y etiquetas | **Inter** (la misma) | La serif que se veía en las capturas de Stitch era un fallback del navegador y a 10-12px no se leía. Pablo decidió (2026-09-03, v2.4) Inter para todo, con los tamaños pequeños un punto por encima de la maqueta: etiquetas 11 y 13, texto 13 y 15 |

Una sola familia. Inter tiene cifras tabulares (`tabular-nums` global), así que los pesos siguen alineándose en vertical. Los pesos intermedios (500/600) vuelven a estar disponibles.

### Escala

| Clase | Fuente / peso | Tamaño / interlineado / tracking | Uso |
|---|---|---|---|
| `.t-display` | Inter 800 | 36 / 40 / −0.03em, mayúsculas | Nombre de rutina (Hoy, Rutinas, sesión pasada, editor), «SESIÓN COMPLETADA», «MIS RUTINAS» |
| `.t-h1` | Inter 800 | 28 / 34 / −0.02em, mayúsculas | Título de pantalla raíz o apilada, mes del calendario, nombre de rutina en tarjeta |
| `.t-h2` | Inter 700 | 22 / 28 / −0.02em | Título de bloque («Entreno de hoy», «Peso corporal») y nombre de pestaña en la barra |
| `.t-h3` | Inter 700 | 18 / 24 / −0.01em | Nombre de ejercicio, título de fila, título de barra apilada |
| `.t-body` | Inter 400 | 16 / 24 | Texto |
| `.t-body-sm` | Inter 400 | 14 / 20 | Subtítulos, veredictos dentro de tarjeta |
| `.t-caption` | Inter 400 | 12 / 16 | Pies, avisos, ayudas |
| `.t-metric-xl` | Inter 600 | 40 / 44 / −0.04em | Peso corporal, cifra de la serie en curso, cifras del resumen |
| `.t-metric` | Inter 500 | 20 / 24 / −0.02em | Carga y reps en la tabla, estadísticas de tarjeta, cronómetro |
| `.t-metric-sm` | Inter 600 | 15 / 20 | Columna «previo», subtítulo `3×8-10 · 1/3`, chips de dato |
| `.t-label` | Inter 600 | 13 / 17 / +0.05em, mayúsculas | Etiquetas de sección, texto de botón, segmentado |
| `.t-label-sm` | Inter 600 | 11 / 13 / +0.08em, mayúsculas | Unidades (KG, REPS), tags de estado, barra inferior, cabecera de tabla |

Por debajo de 360px: `.t-display` baja a 32/36 y `.t-h2` a 20/26.

### Reglas

- **`tabular-nums` en todo** (regla global). Los pesos se comparan en vertical.
- **Mayúsculas con tracking solo como etiqueta o botón** (`.t-label`, `.t-label-sm`). Nunca en texto corrido.
- **Inter en mayúsculas solo como titular** (display, h1). `.t-h2` y `.t-h3` van en caja normal.
- **Las unidades van pegadas a la cifra** en `.t-label-sm` y `--ink-soft`: `70 KG`, `88,7 KG`.
- **Todo alineado a la izquierda**, salvo las cifras dentro de un stepper (centradas en su lecho) y las columnas numéricas de la tabla (reps centradas, casilla a la derecha).
- Sin cursivas, sin acentuar una palabra del titular en color.

---

## 4. Estructura y espaciado

**Rejilla de 4.** `--sp-1..8` = 4 · 8 · 12 · 16 · 20 · 24 · 32 · 48. Margen lateral 16. Entre tarjetas de una lista 8 (`.stack--tight`); entre bloques 20 (`.stack`); en Ajustes 32 (`.stack--loose`).

**Radios codifican jerarquía:** 4 controles, inputs, chips, botones · 8 tarjetas · 12 hojas · pill **solo** para la barra de progreso y los puntos de estado.

**Alturas:** barra superior e inferior 64 (+ safe area) · fila de ejercicio 72 · fila compacta de serie 56 · CTA 56 · táctil mínimo 44 · steppers de la serie en curso 48 · casilla de serie 28.

### Barra superior

Fija, opaca, `--bg`, hairline inferior solo al scrollear. Existe en **todas** las pantallas.

- **Raíz:** punto volt 8px (pulsa con sesión en curso) + nombre de la pestaña en `.t-h2`. A la derecha, campana (→ Ajustes, bloque de avisos) y acceso a Ajustes en círculo `--ink`.
- **Apilada:** flecha atrás 44px + título en `.t-h3` mayúsculas + acción opcional en texto `.t-label` («Editar» / «Hecho»).

### Barra inferior

`--surface`, hairline arriba, 64 + safe area. Cuatro destinos con icono 22 y etiqueta `.t-label-sm`; la activa en `--volt-ink`. Las pantallas apiladas la esconden.

### Hoy

```
┌──────────────────────────────────────┐
│ ● Hoy                        🔔   ⚙ │
├──────────────────────────────────────┤
│ [📅 SEMANA 2/4]  [⚖ SIN PESAR HOY]   │  chips de dato real
│ ┌──────────────────────────────────┐ │
│ │ ● DÍA DE ENTRENO      4 EJ · 12 S│ │  tag · resumen mono
│ │ TORSO                            │ │  .t-display, dos líneas como regla
│ │ SUPERIOR                         │ │
│ │ Sesión programada para hoy       │ │
│ │ [▶ INICIAR SESIÓN         ] [⚙]  │ │  volt · editor de la rutina
│ └──────────────────────────────────┘ │
│ Entreno de hoy                   ◔0% │  .t-h2 + anillo de progreso
│ 4 ejercicios · 12 series             │
│ ┌ tarjetas de ejercicio (8px) ─────┐ │
│ [⊕ AÑADIR EJERCICIO]                 │  secundario
│ ┌ Peso corporal ── compacto ───────┐ │
└──────────────────────────────────────┘
```

- **Dos bloques, siempre los dos, y el orden lo marca la hora:** antes de las 15:00 sin pesaje, la tarjeta de peso va primero y abierta (input en lecho enfocado, sparkline, veredicto); después, la sesión va primero y el peso queda **compacto** (cifra + chip; tocar la cabecera lo despliega). No hay conmutador.
- **Sesión en curso:** la tarjeta hero pasa a `.card--active` (halo), el tag dice «SESIÓN EN CURSO» con punto que pulsa, el cronómetro va a la derecha en `.t-metric`, y una barra de progreso pill volt muestra `hechas/total`. Al final de la lista aparece «FINALIZAR ENTRENAMIENTO».
- **Sesión hecha:** tag «SESIÓN HECHA», botones «Ver resumen» y reabrir.
- **Día sin rutina:** sin hero ni lista; solo la tarjeta de peso completa. Sesión improvisada desde Rutinas.
- Los chips de arriba solo llevan datos reales: sesiones de la semana contra programadas, y peso de hoy o «sin pesar».

### Sesión en vivo (`/entrenar`)

Pantalla apilada propia; Hoy solo la anuncia. Cuatro bloques, en este orden:

1. **Banner** `.card--active`: chip «SESIÓN EN CURSO» (pulsa) o «EN PAUSA» o «PREVIA»; botones pausa y ⋮ (añadir ejercicio · notas y RPE · descartar); nombre en `.t-display` a ancho completo; debajo, «Semana N · {bloque}» del ciclo a la izquierda y el cronómetro (descuenta pausas) a la derecha; «PROGRESO TOTAL · 7 / 12 SERIES (58%)» con barra pill volt.
2. **Descanso**: aparece al completar una serie con el `rest_seconds` del ejercicio. Anillo volt de 56, «DESCANSO SUGERIDO» + chip «RPE meta», `mm:ss restantes` a 32px mono, y una fila con «+30 s» y «Saltar». Vibra al llegar a cero y se apaga. Nunca suena.
3. **Ejercicio en curso**: chip sólido «SERIE PRINCIPAL» + «i de N ejercicios», nombre `.t-h2`, «{equipo} · {n} series de trabajo · Descanso {m} min», icono de regla que abre la **calculadora de discos**; tres tiles Target (kg) · RPE meta · Ant.; la tabla de series con la serie en curso; pie con «Calculadora de discos (x kg / lado)» y «Añadir serie».
4. **Siguiente en cola**: nombre, «Carga proyectada: x kg · RPE y», botón de intercambio que lo trae al frente, y la cola restante con asa de arrastre. Los ejercicios hechos quedan en una lista compacta con casilla volt y «+ serie».

Cierre: «Añadir ejercicio» y «Notas / RPE» a media anchura (la hoja de notas lleva RPE global 1–10 en rejilla 5×2 y notas), y «Finalizar entrenamiento», secundario hasta que todas las series están hechas.

### Tarjeta de ejercicio y tabla de series

```
┌──────────────────────────────────────┐
│ ▯ Press banca              70 KG  ⌄  │  72px · marca en lecho · último peso
│   3×8-10 · 1/3             ÚLTIMO    │
├──────────────────────────────────────┤
│ Nº   PREVIO     CARGA    REPS        │  .t-label-sm --ink-mute
│ (1)  70×10      70 KG     10    [✓]  │  56px, borde --volt-edge, casilla volt
│ ┌──────────────────────────────────┐ │
│ │ (2) SERIE EN CURSO   ANT. 70×9   │ │  --surface-hi + halo
│ │ CARGA (KG)                  ±2,5 │ │  incremento real del ejercicio
│ │ [−] [        70 KG        ] [+]  │ │  48 · .t-metric-xl · 48
│ │ REPETICIONES                     │ │
│ │ [−] [         9           ] [+]  │ │
│ │ [ ✓ COMPLETAR SERIE 2          ] │ │  volt 56
│ │ RIR [−] 2 [+]  · Al fallo · Borrar│ │  extras a la vista
│ └──────────────────────────────────┘ │
│ (3)  70×8       70 KG      8    [ ]  │  pendiente: --ink-mute; toque → en curso
├──────────────────────────────────────┤
│ ⊕ Añadir serie        Calentamiento  │
└──────────────────────────────────────┘
```

- **Una sola serie en curso por tarjeta**: la primera pendiente o la que se toque. Solo en sesión activa o en edición de sesión pasada; en lectura, la tabla es toda compacta.
- **Columna PREVIO:** la serie del mismo índice en la última sesión terminada (`lastPerformance`). Formato compacto `70×10` para caber a 320px.
- **Steppers:** carga ±`min_increment`, reps ±1, tiempo ±5 s. Tocar la cifra abre el teclado numérico. Ejercicios sin carga no tienen stepper de carga.
- **Hecha:** casilla volt con check de 2.5px, borde `--volt-edge`, cifras en `--ink`. La fila no responde al toque: deshacer por roce es peor que editar a propósito.
- **Calentamiento:** índice «C», opacidad .55, sin volt al confirmar. No cuenta para volumen ni PRs.
- Los extras (RPE en pasos de 0,5, al fallo, borrar) viven dentro del bloque en curso. Desaparece la pulsación larga. Una fila hecha muestra su RPE bajo las reps en 9px volt.
- Reordenable arrastrando con pulsación larga sobre la tarjeta entera.

### Calendario

Tarjeta de mes (`.t-h1` + chip de año + botones 44), tres métricas del mes (adherencia, hechas con delta contra el mes anterior, pendientes), rejilla en tarjeta y lista de sesiones como tarjetas.

- **El punto va debajo del número.** Volt = hecha; `--ink-mute` = programada; `--rule-strong` = programada y sin hacer. Hoy: celda `--surface-hi`. La ausencia no se dibuja (punto transparente que conserva la altura).
- Tocar un día filtra la lista a ese día; volver a tocarlo, la libera.
- La adherencia cuenta solo días ya pasados (y hoy si está hecha). Un día programado en curso no es un fallo.
- Tarjeta «Próxima sesión» con el siguiente día programado y la hora del aviso si está activo.

### Progreso

«MÉTRICAS» en `.t-label` + «PROGRESO» en `.t-h1`. Segmentado de rango con la opción activa en volt. Tres tarjetas:

1. **Peso corporal:** cifra actual `.t-metric-xl`, chip de tendencia kg/semana, gráfica (puntos diarios `--ink-mute`, media de 7 días en volt con relleno), veredicto en `.t-body-sm` al cierre.
2. **Frecuencia:** sesiones esta semana contra objetivo, siete columnas L–D (volt hecha, `--surface-hi` programada, punteado sin nada), barras de 8 semanas con la línea de objetivo discontinua, veredicto.
3. **Sobrecarga progresiva:** selector nativo dentro de un panel, veredicto (o caja «modelo en calibración» si faltan sesiones), gráfica de e1RM con proyección discontinua y hairline donde acaban los datos, e1RM de las tres últimas sesiones en columnas (la última en volt), mejor e1RM y mejor peso, volumen por sesión, mejores series por reps, y al final los veredictos de los demás ejercicios.

**Cada gráfica lleva su frase.** Los veredictos son la voz del producto (§6) y van dentro de la tarjeta a la que pertenecen.

### Gráficas

- **Ninguna gráfica sin eje.** Rejilla de hairlines `--rule`, valores en `.chart-label` (mono 10px, `--ink-mute`), fecha inicial y final; la final en `--ink`.
- **Lo medido: volt 2px con relleno `--chart-fill` → transparente.** Lo calculado o proyectado: discontinuo 1px `--ink-mute`, con hairline vertical `--rule-strong` donde empieza.
- Dato diario con ruido: puntos 1.5px `--ink-mute`. Último punto: círculo volt de 4px con borde `--surface`.
- Barras: pista `--surface-hi` completa detrás y relleno volt hasta el valor; una sola línea de objetivo discontinua.

### Rutinas

Fila de estado en `.t-label-sm` (rutinas · sesiones/semana · hechas esta semana), «MIS RUTINAS» en `.t-display` con el botón volt «Crear» a la derecha, y una tarjeta por rutina:

- Chip de estado (`TOCA HOY` volt sólido · `HECHA HOY` volt tint · «hace N días» neutro · «Nunca»), días en `--ink-mute`, nombre en `.t-h1`, `N ejercicios · tres primeros nombres`, marca del primer ejercicio en lecho 56.
- **La de hoy lleva filo superior volt de 2px**, tres métricas (series, ejercicios, última vez) y «INICIAR SESIÓN» en volt con `⋮` al editor. Las demás: «EDITAR» secundario y `▶` para entrenarla hoy.
- Al final, «SESIÓN VACÍA» secundario y un enlace de texto a Ajustes.

### Editor de rutina

Tarjeta de cabecera con segmentado FUERZA / MOVILIDAD / SIN TIPO, nombre en `.t-display` tocable (límite 24 caracteres, contador) y el aviso «editar no cambia sesiones hechas» tras el primer cambio. Una tarjeta por ejercicio con fold de steppers pequeños (series, reps mín, reps máx) y «Quitar». «AÑADIR EJERCICIO» secundario, tarjeta de días asignados (siete casillas 44, activa volt), «ENTRENAR HOY» volt y «Archivar rutina» en texto.

### Catálogo

«LIBRERÍA» + título `.t-h1`, botón «Crear propio» en chip volt, buscador en lecho con icono, chips de grupo muscular (activo volt tint), franja horizontal de recientes con la última serie en `--volt-ink`, y una tarjeta por ejercicio (marca, nombre, grupo, chip de carga) con `+` a la derecha que pasa a check volt al seleccionar. CTA fijo «AÑADIR N EJERCICIOS».

### Detalle de ejercicio

Título `.t-h1` con chips de grupo y carga, dos tarjetas de métrica (mejor e1RM, mejor peso), gráfica, récords por reps, histórico y datos (incremento con stepper, notas en lecho).

### Sesión pasada

Barra apilada con la fecha y «Editar» / «Hecho». Tarjeta con chip «HECHA · 12/12 SERIES», nombre en `.t-display` y tres métricas. Tarjetas de ejercicio en lectura; en edición se comportan como en Hoy. «REPETIR ESTA SESIÓN» secundario; en edición, fecha y «Borrar sesión».

### Resumen post-sesión

Pantalla de recompensa. Chip volt con series y ejercicios, número de registro, «SESIÓN COMPLETADA» en `.t-display`, y una rejilla 2×2 de métricas (duración, volumen con delta contra la sesión anterior de la misma rutina, series válidas, ejercicios).

- **La recompensa son los PRs.** Bloque `.card--active` con trofeo en volt, «Dos récords hoy», una fila por récord con el e1RM nuevo, el anterior y el delta en chip. **Si no hay PRs, el bloque no existe.**
- **Desglose:** una tarjeta por ejercicio con series hechas, `BLOQUE 01 · grupo` (aquí la numeración sí es una secuencia real), chips `SET n / 70×10`, la mejor serie del ejercicio con PR en volt tint, volumen.
- **Valoración 1–5** en cinco cuadrados (activo volt) y notas en lecho. Guardar como plantilla si la sesión fue improvisada.
- **«CERRAR»** en volt. No guarda nada: todo se guardó al escribir, y el botón no lo finge.

### Ajustes

Cabecera «PARÁMETROS» / «AJUSTES» con chip de versión. Secciones con etiqueta mono y punto volt: **Apariencia** (segmentado Sistema / Oscuro / Claro), **Unidad de peso** (dos opciones de 56px), **Incrementos por defecto** (filas título + descripción + stepper pequeño, sin icono para que el texto respire), **Peso corporal y avisos** (toggles volt, chips de hora, bloque de estado del push en texto sincero), **Datos y copia** (sincronizar, exportar, importar).

---

## 5. Componentes

**Regla de la v2.3:** una pantalla que tiene maqueta en `docs/stitch/` se construye con las clases de `src/styles/tw.css` siguiendo la maqueta bloque a bloque. Los componentes de abajo quedan para las pantallas sin maqueta y para la lógica compartida (`SetTable`, `StepperBare`, `Icon`).

- **Botones** `.btn` (56px, mono mayúsculas, radio 4, `scale(.98)` en 60ms lineal al pulsar): `--primary` volt con borde `--volt-edge`; `--secondary` `--surface-hi` con borde `--rule-strong`; `--ghost` texto `--ink-soft` que pasa a `--alert` al pulsar; `--square` 56×56 solo icono; `--sm` 44.
- **Tarjeta** `.card`: `--surface`, borde `--rule`, radio 8, padding 16. `--active` con `--volt-edge` y halo; `--today` con filo superior volt; `--flush` sin padding.
- **Panel** `.panel` y **tile** `.tile`: `--surface-hi`, radio 4, para métricas dentro de tarjeta. `.tile--card` es una tarjeta pequeña de métrica.
- **Chips** `.chip`: 3×8, radio 4, `.t-label-sm`. Neutro `--surface-hi`; `--volt` tint con borde; `--solid` volt; `--line` solo borde.
- **Segmentado** `.seg`: pista `--surface-hi`, opción activa volt. Sustituye al selector subrayado.
- **Campo** `.field` / `.numfield`: lecho `--well`; en foco, borde `--ink` y anillo 2px volt sobre `--surface`.
- **Stepper** `.stepper`: `[−] valor [+]`, botones 48 (`--sm`: 44/36), valor en lecho centrado; tocar la cifra la edita.
- **Toggle**: pista `--surface-hi`, activo volt con pomo `--on-volt`.
- **Casilla de serie** `.setcheck`: 28, radio 4; hecha = volt con check 2.5px.
- **Marca de ejercicio** `.mark`: lecho `--well` 48 (56 `--lg`, 36 `--sm`) con el trazo geométrico del grupo muscular en `currentColor`. Sin fotos: no existen offline.
- **Anillo** `.ring` y **barra** `.progress`: pista `--surface-hi`, relleno volt. Solo para la sesión de hoy.
- **Iconos** `Icon.tsx`: trazo 2px, 24×24, dibujados a mano. Sin fuente de iconos.

---

## 6. Movimiento

- **Una sola secuencia orquestada:** al abrir Hoy, la tarjeta hero entra y las de ejercicio escalonan con `animation-delay`. Una vez por sesión de app.
- El resto responde a una acción: fold de tarjeta (220 ms), casilla que se rellena y borde que pasa a volt (180 ms), barra de progreso (200 ms), botones con `scale(.98)` en 60 ms lineal (respuesta mecánica, sin curvas blandas).
- **Cambio de vista:** fundido de 140 ms entre pestañas, deslizamiento de 200 ms al apilar y 180 ms al volver; el gesto lateral anima en su dirección.
- **Curvas** (tokens en `tokens.css`): `--ease-out` para entradas y respuestas del sistema, `--ease-in-out` para lo que gira o se desplaza en pantalla, `--ease-drawer` para hojas inferiores. Ningún componente escribe un `cubic-bezier` a mano. La pulsación sigue a 60 ms lineal.
- **Lo que aparece por acción del usuario** (temporizador de descanso, menú ⋮, paneles de discos y notas, toast del catálogo, bloque de la serie en curso) entra con `@starting-style` en 150–250 ms con `--ease-out` (hojas con `--ease-drawer`), solo `transform` y `opacity`, y sale al instante. Las barras de progreso animan `transform: scaleX`, nunca `width`.
- **Pulso** solo en el punto de «sesión en curso» (barra superior, tag de la hero).
- **Prohibido:** animar al scrollear, hover con transición en cada tarjeta, glow permanente.
- `prefers-reduced-motion` apaga todo.

---

## 7. Escritura

- Frases en caja normal, verbos activos, sin relleno. Las etiquetas en mono mayúsculas son etiquetas, no frases.
- El botón dice lo que pasa: «Iniciar sesión», «Completar serie 2», «Finalizar entrenamiento», «Cerrar». Nunca «Guardar» cuando ya está guardado.
- **Los veredictos son la voz del producto.** Conclusión primero, texto plano, dentro de su tarjeta: «Press militar: e1RM plano desde hace 5 semanas». Sin emoji, sin exclamaciones, sin motivación.
- **Los huecos no regañan.** Un día programado y no hecho es `--ink-mute`, nunca rojo. Sin «ningún récord hoy»: si no hay, el bloque no existe.
- **Ningún dato inventado.** La app no mide RPE, racha, recuperación, velocidad ni sueño; ninguna pantalla los muestra. Cada hueco de una maqueta se rellena con un dato real o se quita.
- Los estados vacíos invitan a actuar; los errores dicen qué pasó y cómo arreglarlo, sin disculparse.

---

## 8. Lista negra

Cada línea es un tic reconocible de interfaz generada o una regresión a la v1. Ninguna aparece en este proyecto.

**Tipografía**
- Cualquier familia distinta de Inter: Roboto, Open Sans, Space Grotesk, Syne, Hanken Grotesk, JetBrains Mono, Times
- Cursivas; una palabra del titular acentuada en color
- Mayúsculas con tracking fuera de `.t-label` / `.t-label-sm`, o en Hanken

**Color y superficie**
- Volt fuera de sus cuatro usos (acción primaria, hecho, récord, dato vivo)
- Un segundo acento. Morado o azul en ningún sitio
- Rojo para un hueco o una sesión no hecha
- Sombras difusas en oscuro; en claro, cualquier sombra distinta de `--card-shadow`
- Halo volt en reposo
- Glassmorphism, blur de fondo
- Degradados fuera del relleno de una gráfica
- Material fotográfico, texturas, fotos de ejercicio

**Estructura**
- Un único `border-radius` para todo
- Marcadores numerados salvo en el desglose del resumen, donde el orden es real
- Metadatos unidos con puntos medios como adorno. El `·` de `3×8-10 · 1/3` separa dos datos reales
- Rejilla de tarjetas de métricas encima de una pantalla de datos, salvo las que llevan dato real y frase (mes del calendario, resumen)
- Proyecciones dibujadas con el mismo peso que los datos medidos
- Datos que la app no mide: RPE, racha, recuperación, velocidad, sueño, mesociclos, meta de peso, calculadora de discos, temporizador de descanso
- Cualquier recurso servido desde un CDN

---

## 9. Suelo de calidad

- Responsive hasta 320px, **en los dos modos**. La tarjeta de ejercicio con la serie en curso es lo primero que se rompe: comprobarla ahí. `scripts/shots.mjs` captura las pantallas a 380 y 320 en oscuro, a 380 en claro, y la sesión en curso; `?theme=light|dark` fuerza el modo.
- Foco de teclado visible: anillo de 2px volt.
- Contraste: texto normal 4.5:1, texto grande 3:1. `--volt-ink` en claro es `#4d6100` precisamente porque el volt puro no llega sobre blanco.
- `prefers-reduced-motion` respetado.
- Objetivos táctiles de 44px mínimo; 48px en los steppers de la serie en curso.
- Ningún hex fuera de `tokens.css`.

---

## 10. Decisiones abiertas

Ninguna. Las cuatro del flujo v2.1 se cerraron el 2026-09-03: velocidad, recuperación y sueño con interfaz pero sin fuente de datos (la recuperación se estima por tiempo y RPE); RPE sustituye a RIR; foto por ejercicio con hueco previsto; ciclo con bloques configurables.

Las anteriores: Las cuatro del rediseño se cerraron el 2026-09-03 antes de codificar: oscuro y claro según el sistema; Syne + Hanken Grotesk + JetBrains Mono en ambos; fila de serie con steppers y «Completar serie»; barra superior en las pantallas raíz.

---

## 11. Changelog

- **2026-09-04** — v2.5. Movimiento: tokens de curva, entradas con `@starting-style`, barras a `transform`, sin pulsos fuera de la sesión en curso (§6). **Hoja «Mover»** (`MoveSheet`): catorce días (esta semana y la siguiente) con el estado real de cada uno (punto por entreno programado, punto volt por hecho); tocar un día libre mueve; un día ocupado abre un panel con «Mover aquí» e «Intercambiar» (solo si el otro entreno es otra rutina); «Dejar como descanso» anula. Se abre desde Hoy (icono calendario junto a Iniciar), desde el menú ⋮ de la sesión previa y desde el Calendario (día programado seleccionado o pospuesto). Hoy sin entreno por un movimiento muestra «Hoy libre · movido al …» con Deshacer. «Cancelar inicio» devuelve una sesión iniciada sin querer (sin series) a borrador.

- **2026-09-03** — v2.4. Inter para todo: la serif de la captura no se leía a 10-12px. Tamaños pequeños de la maqueta un punto arriba (etiquetas 11/13, texto 13/15). Tinos sale del bundle.

- **2026-09-03** — v2.3 «posiciones y tamaños de Stitch». Por decisión de Pablo, las ocho pantallas se portan 1:1 desde el HTML de las maquetas: mismos contenedores, espaciados (2/4/8/12/16/20), radios (2/4/8/12), superficies MD3 (`--md-sc-lowest` → `--md-sc-highest`) y tipos (`.type-*`). Se añade `src/styles/tw.css`, un subconjunto de utilidades que replica las clases de Stitch, y los tokens semánticos (`--bg`, `--surface`, `--ink`…) pasan a apuntar a la paleta MD3 de la maqueta. Barra superior con punto + nombre de pestaña + campana + avatar; barra inferior con etiquetas en mayúsculas. Las cuatro pantallas sin maqueta (ciclo, editor de rutina, detalle de ejercicio, sesión pasada) conservan los componentes de la v2.1 sobre la misma paleta.

- **2026-09-03** — v2.2. Tipografía calcada de las capturas de Stitch por decisión de Pablo: Inter 800/700 en display, títulos y nombres; Times New Roman del sistema (Tinos de reserva) en texto, cifras y etiquetas. Syne, Hanken Grotesk y JetBrains Mono salen del bundle.

- **2026-09-03** — v2.1 «el flujo completo». Sesión en vivo como pantalla propia con banner, pausa, cronómetro, temporizador de descanso, tiles Target / RPE meta / Ant., calculadora de discos, siguiente en cola con intercambio y cola reordenable, hoja de notas y RPE global. RPE sustituye a RIR en la serie. Hoy: chips racha / semana / recuperación estimada, «~N min estimados», tarjeta de contexto del ciclo, sparkline de 7 días con meta, filas con objetivo, tarjeta de descanso nocturno sin datos. Resumen: adherencia, RPE medio con banda, descansos medios, desglose con RPE, recuperación estimada con ventana y anillo, sensaciones 1–10, «Guardar en calendario y cerrar» con estado real de la copia. Rutinas: fila de ciclo, cinco estados de tarjeta, tiles volumen / series / estimado, última mejor serie con RPE. Ciclo con bloques configurables (pantalla nueva). Calendario: reasignar día y sesiones pospuestas. Progreso: meta de peso, filtro por grupo, carga efectiva, PR actual con RPE, velocidad sin datos. Biblioteca: hueco de foto y última serie por fila. Ajustes: ciclo, meta de peso, descanso por defecto, barra y discos.

- **2026-09-03** — v2.0 «Kinetic Nordic Craft». Rediseño completo a partir de las maquetas de Stitch: dos modos de color con tokens semánticos, acento volt con cuatro usos, Syne + Hanken Grotesk + JetBrains Mono auto-alojadas, iconos SVG propios, barra superior en raíz, tarjetas con hairline, tabla de series compacta con bloque de serie en curso (steppers −/+ y «Completar serie»), calendario con métricas del mes, progreso en tres tarjetas con veredicto propio, rutinas en tarjetas con filo volt para la de hoy, resumen con rejilla 2×2 y desglose, apariencia en Ajustes. Fuera: material fotográfico, texturas, Archivo/Plex, verde funcional, hoja solapada, fila de 64px con el número como confirmar.
- **2026-09-02** — v1.0–v1.8. Dirección inicial (crema, material fotográfico por tipo de rutina, acento verde único, Archivo + IBM Plex) y su implementación completa. Archivada en el historial de git.
