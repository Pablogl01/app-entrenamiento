# DESIGN.md — App de registro de entrenamiento

Sistema de diseño. Se lee **antes** de escribir cualquier UI.
Complementa `especificaciones-app-entrenamiento.md`, que define el comportamiento. Este documento define el aspecto.

**Versión:** 1.5 · septiembre 2026

---

## 0. Brief en una frase

Herramienta personal de registro de entrenamiento para un solo usuario. Densa y eficiente como una herramienta de software, pero en clima cálido y con materiales reales. Vive en dos contextos físicos opuestos: el baño a las 8:00 recién despierto, y el gimnasio a las 19:00 con prisa y manos sudadas.

**La decisión estructural de la que cuelga todo lo demás:** la app es densa en Hoy, Calendario, Progreso y Rutinas, y **rompe deliberadamente la escala** al entrar en modo de registro de series. Ese salto de escala es el elemento memorable del producto. No es una inconsistencia: es la respuesta a los dos contextos.

---

## 1. Color

Paleta base — seis valores, nombrados. No se introducen colores nuevos sin actualizar este archivo.

| Token | Hex | Uso |
|---|---|---|
| `--paper` | `#FAF8F4` | Fondo de app y de la hoja que scrollea |
| `--panel` | `#EDE6D9` | Tarjetas y bloques de contenido |
| `--panel-deep` | `#DED5C4` | Panel de la ilustración dentro de la tarjeta, campos de input |
| `--ink` | `#14100C` | Texto principal, botones de acción |
| `--ink-soft` | `#6A645A` | Texto secundario, datos de apoyo, chevrons |
| `--rule` | `#D9D1C1` | Hairlines, separadores, bordes de 1px |

`--ink` es un negro templado en cálido, no `#000` ni un gris azulado. Tiene una razón: sobre una base crema, un negro neutro se lee azulado y frío. Es una decisión, no chrome por defecto.

### Acento

**Uno solo.** `--go` `#1E8E3E`.

Significa **completado**. Nada más. Aparece exactamente en:

- Serie confirmada (la fila cambia de estado)
- PR del día
- Punto de día hecho en el calendario
- Botón cuando pasa a "Finalizar sesión"

Las acciones son `--ink`, no verde. "Empezar sesión" es negro; al pulsarlo el mismo botón pasa a verde y dice "Finalizar sesión". El color señala que hay algo hecho detrás.

`--go-bright` `#3FBF52` existe solo para rellenos y puntos sobre fondos oscuros, donde el verde oscuro no se ve. Nunca para texto.

**El acento es independiente del material.** La cabecera cambia de color según el tipo de rutina; si el acento dependiera de ella, unos días chocaría. Se queda fijo.

---

## 2. Material

El sistema visual que hace que esta app no se parezca a nada generado. **El material dice qué tipo de día es antes de leer una palabra.**

### Mapeo

| `routine_type` | Familia de material |
|---|---|
| `strength` | Hormigón, piedra natural, hierro |
| `mobility` | Arena, agua, hierba |
| `null` (sin tipo, o día sin entreno) | Neutro: piedra clara, sin carga |

Requiere un campo nuevo: **`routine_type` en `routines`**, de selección manual al crear la plantilla. No se infiere de los grupos musculares — falla justo en los casos raros, y el usuario sabe perfectamente qué es cada rutina.

### Reglas del material — no negociables

1. **Fotografía real de material, nunca un degradado.** Un degradado coral o terracota plano es el cliché exacto que estamos evitando. La textura tiene grano, dirección y sombra propia.
2. **Tratamiento idéntico en todas.** Mismo recorte, misma escala, misma capa de oscurecido (`rgba(20,16,12,.42)` encima). Deben ser intercambiables sin retocar el layout.
3. **Oscuras y sucias, no limpias y saturadas.** El texto blanco encima pasa 4.5:1 **sin excepciones**. Si una textura no llega, se descarta la textura, no se baja el contraste.
4. **Solo en el bloque de cabecera.** Nunca detrás de una gráfica de e1RM, de una lista de series o de una tabla. Ensucia la lectura del dato, que es lo único que la app tiene que hacer bien.
5. **Empaquetadas en la app, no servidas.** En el gimnasio no hay cobertura y nada del flujo de entrenar puede depender de la red. WebP, subset, presupuesto de ~80 KB por textura.
6. **Tres o cuatro, no una por grupo muscular.** El punto 5 pone el techo. Arrancar con: `stone`, `iron`, `sand`, `neutral`.

---

## 3. Tipografía

Dos familias, con roles claramente separados.

| Rol | Familia | Por qué |
|---|---|---|
| Display | **Archivo** (variable: `wght` 100-900, `wdth` 62-125) | Grotesca ancha; en 800 y mayúsculas aguanta encima de una textura sin necesitar caja ni sombra |
| Texto y UI | **IBM Plex Sans** | Carácter propio (terminales con muesca, la 'a', la 'g') sin ser Inter; cifras tabulares reales |
| Datos numéricos | **IBM Plex Mono** | Misma superfamilia, contraste claro de rol; alineación vertical de columnas de peso y reps |

**Auto-alojadas en WOFF2 con subset.** Sin Google Fonts CDN: la app tiene que arrancar y funcionar sin red.

### Escala (móvil, base 380px)

| Token | Tamaño / interlineado | Familia y peso |
|---|---|---|
| `display-hero` | 72 / 0.90 / `-0.03em` | Archivo 800, tabular — solo el número de tendencia kg/semana |
| `display-xl` | 40 / 0.90 / `-0.02em` | Archivo 800, `wdth 112`, **mayúsculas** — solo el nombre de la rutina en cabecera |
| `title` | 20 / 1.20 | Plex Sans 600 |
| `item` | 16 / 1.25 | Plex Sans 600 — nombre de ejercicio |
| `body` | 15 / 1.50 | Plex Sans 400 |
| `info` | 13 / 1.30 | Plex Sans 500 |
| `data` | 13 / 1.20 | Plex Mono 500, tabular |
| `data-lg` | 24 / 1.00 | Plex Mono 500, tabular — peso y reps en la fila de serie |
| `micro` | 11 / 1.20 | Plex Sans 500 — mínimo absoluto, solo en la rejilla del calendario |

Salto de 40 a 72 en el display, y de 16 a 24 en los datos al entrar en Entrenando. Los saltos son grandes a propósito.

### Reglas tipográficas

- **Todo alineado a la izquierda.** Sin excepciones, incluido el número de tendencia. El centrado es el default y aquí no aporta.
- **Longitud de línea por debajo de 80 caracteres.** Solo afecta a notas y veredictos; el resto es interfaz.
- **Mayúsculas permitidas como titular, prohibidas como etiqueta.** `TORSO SUPERIOR` en la cabecera es un titular y funciona. Un `PROGRESO` diminuto con tracking encima de una sección es el tic más reconocible del diseño generado.
- **"Día de entreno" encima del nombre de la rutina va en caja normal, sin tracking, sin color de acento.** Es un eyebrow por posición, pero lleva información real: distingue día de entreno de día de descanso. Que se lea como información y no como decoración.
- **Mono para cifras, nunca para etiquetas.** `60 kg × 10` en mono es funcional. Una etiqueta de sección en mono es chrome de plantilla.
- **`font-variant-numeric: tabular-nums`** en todo lo que sea número. Los pesos se comparan en vertical.
- Sin acentuar una sola palabra del titular en cursiva, negrita o color.

### `display-xl` va a dos líneas

Medido con la fuente real a 40px / `wght 800` / `wdth 112`: "TORSO SUPERIOR" ocupa **422px**, contra 348 disponibles a 380 y 288 a 320. **No cabe en una línea en ninguna de las dos anchuras**, y casi ningún nombre de dos palabras lo hará.

**Dos líneas son la regla, no la excepción.** La palabra suelta más larga de un nombre plausible —"SUPERIOR", 246px— cabe en las dos anchuras, así que el corte por palabra resuelve el caso general. Interlineado 0.90 para que las dos líneas se lean como una sola masa tipográfica en la esquina inferior izquierda; a 0.95 se separan.

**El eje `wdth` no se toca para hacer hueco.** Bajar a `wdth 90` mete "TORSO SUPERIOR" en una línea a 380, pero la grotesca ancha es una de las tres cosas que §7 identifica como lo que nos separa del cliché. Se comprime el nombre, no la tipografía.

**Y no se trunca nunca.** Para el nombre de una sola palabra imposible —`ACONDICIONAMIENTO` mide 525px— se previene en el origen: **el editor limita el nombre de la rutina a lo que cabe en dos líneas**, con contador. Puntos suspensivos en el único elemento memorable de la app no son una solución.

---

## 4. Estructura y espaciado

**Escala de espaciado:** 4 · 8 · 12 · 16 · 24 · 40 · 64.

**Radios — codifican jerarquía, no son un valor único repetido:**

| Elemento | Radio |
|---|---|
| Hoja sobre la cabecera | 20 (solo esquinas superiores) |
| Tarjeta | 14 |
| Control, input, botón | 10 |
| Punto de estado | pill |

**Separación:** las cosas se separan por **fondo tintado y hairlines**, no por sombra. Cero `box-shadow` en toda la app. Una sombra gris suave debajo de cada bloque es el kit de cards por defecto.

**Aire:** 8px entre tarjetas de la misma lista (denso). 40px entre bloques distintos (respiro). El contraste entre esos dos números es lo que hace que se lea eficiente en lugar de vacía.

### Hoy — día de entreno

```
┌──────────────────────────────┐
│                              │  ← material a sangre, según routine_type
│   Día de entreno             │     min 240px / 34vh
│   TORSO SUPERIOR             │     texto blanco, abajo-izquierda
│                              │
╭──────────────────────────────╮  ← hoja --paper, radio 20 arriba,
│  ┌────┬───────────────────┐  │     solapa -20px sobre la cabecera
│  │ ▟▚ │ Press banca    ⌄  │  │
│  │    │ 4×8-10 · 0/4      │  │  ← tarjeta 88px, gap 8
│  └────┴───────────────────┘  │
│  ┌────┬───────────────────┐  │
│  │ ▟▚ │ Remo con barra ⌄  │  │
│  │    │ 4×8-10 · 0/4      │  │
│  └────┴───────────────────┘  │
│           ...                │
│                              │
│  ┌────────────────────────┐  │
│  │    Empezar sesión      │  │  ← --ink; pasa a --go / "Finalizar"
│  └────────────────────────┘  │
╰──────────────────────────────╯
```

La hoja solapada resuelve el layout entero: la cabecera con material sostiene el titular, y la lista scrollea por encima.

### Hoy — dos bloques, y el plegado como conmutador

Hoy tiene **dos bloques y siempre están los dos**: peso y entreno. El que corresponde al momento del día está abierto; el otro es una **fila de 72px sobre `--paper`, sin relleno, con hairline arriba y abajo** y su chevron a la derecha. Cambiar de contexto es tocar la fila plegada.

**No hay control de conmutación.** Ni segmentado, ni pestañas, ni pill. Es la misma gramática de plegado que ya tienen las tarjetas de ejercicio, así que no añade componente ni vocabulario nuevo. Un segmentado sobre la cabecera obliga a poner una superficie propia encima del material —chrome sobre la fotografía— y sobre la lista mete una banda que compite con el borde solapado de la hoja, que es el elemento estructural del que cuelga el layout.

**La fila plegada lleva dato, no solo etiqueta.** `Peso de hoy` / `sin registrar · 78,4 kg ayer`. `Entreno de hoy` / `6 ejercicios · 0/22 series`. Una fila que solo dice el nombre del bloque obliga a abrirla para saber si hace falta.

**Orden por defecto según la hora:** por la mañana manda peso; a partir de media tarde manda el entreno. A las 15:00, sin pesaje ni entreno hechos, **manda el entreno**.

El bloque de peso abierto es: título en `title`, campo `--panel-deep` de 64px con el valor de ayer como marcador en `--ink-soft`, sparkline debajo (puntos diarios finos en `--ink-soft`, media de 7 días en trazo de 2px `--ink`) y el veredicto en `body`, conclusión primero. **El número de tendencia en `display-hero` no aparece en Hoy**: es de Progreso. Aquí basta el sparkline y la frase.

### Hoy — día sin rutina programada

Solo el bloque de peso. Sin fila de entreno y sin selector de plantillas.

`display-xl` sigue reservado al nombre de la rutina, y ese día no hay nombre, así que **el titular grande no existe**: material `neutral`, cabecera a 160px y "Día de descanso" en `title` blanco, abajo-izquierda. El día de descanso se nota por ser estructuralmente más ligero, no por un aviso. Los huecos no regañan (§6).

Consecuencia asumida: una sesión improvisada se arranca desde Rutinas, no desde Hoy.

### Tarjeta de ejercicio, expandida

```
┌──────────┬──────────────────────────┐
│    ▟▚    │  Press banca          ⌃  │   88px
│          │  4×8-10 · 2/4            │
├──────────┴──────────────────────────┤
│  cal   40 kg × 10          −    +   │   64px, opacidad .55
├─────────────────────────────────────┤
│▎ 1     60 kg × 10          −    +   │   64px, filo --go
├─────────────────────────────────────┤
│  3     60 kg × 10          −    +   │   64px, propuesto
└─────────────────────────────────────┘
```

Las filas de serie ocupan **el ancho completo de la tarjeta**, no la columna derecha. Separadas por hairline, sin radio propio. Motivo: así todos los pesos comparten borde izquierdo y se comparan en vertical, que es el trabajo de las cifras tabulares. Metidas en la columna derecha, la fila de 64px se queda sin sitio para los dos botones de 48px.

### Tarjeta de ejercicio, colapsada

```
┌──────────┬──────────────────────────┐
│          │  Press banca          ⌄  │   88px de alto
│    ▟▚    │  4×8-10 · 2/4            │
│          │                          │
└──────────┴──────────────────────────┘
   33%                67%
--panel-deep          --panel
```

- Ilustración: `grid-template-columns: 33% 1fr`. El panel de la ilustración **sangra hasta los bordes** de la tarjeta (`overflow: hidden` en la tarjeta, cero padding en el panel). No es una imagen con marco dentro de una caja.
- Columna derecha: nombre en `item`, y debajo `4×8-10 · 2/4` en `data` / `--ink-soft`. Sin ese segundo dato hay que ir expandiendo tarjetas una a una para saber por dónde vas.
- Chevron 16px `--ink-soft` a la derecha, rota 180° al expandir. Es la única affordance de despliegue; nada de texto "ver más".
- Reordenable arrastrando. El asa es la tarjeta entera en pulsación larga, no un icono de tres rayas.

### Ilustraciones de ejercicio

- Línea de trazo único, 2px, `--ink` sobre `--panel-deep`. Sin relleno, sin sombra, sin color.
- Mismo viewBox para todas. La figura ocupa el 70% de la altura del panel, centrada.
- Solo la figura y el aparato. Sin suelo, sin fondo, sin líneas de movimiento.
- **Estado sin ilustración obligatorio.** Los ejercicios que crea el usuario no tienen una. En su lugar, una marca geométrica derivada de `muscle_group`, en el mismo panel y a la misma escala. Nunca un hueco, un icono de imagen rota ni un placeholder gris.

### Registro de series — la ruptura de escala

Aquí y solo aquí la app deja de ser densa. Se usa de pie, entre series, con prisa.

- Fila de serie: **64px de alto**, no 40.
- Peso y reps en `data-lg` (24px).
- Botón `+`: **48×48px** de área táctil real, a la derecha. Sube el peso en pasos de `min_increment`. No confirma.
- **No hay botón `−`.** Con teclado en la cifra, bajar peso ya tiene camino, y a 320px la columna de confirmar más las cifras más dos botones de 48px no caben con un objetivo usable.

**Las tres zonas de la fila**, de izquierda a derecha:

| Zona | Gesto | Qué hace |
|---|---|---|
| Columna del número de serie | toque | Confirma la serie tal cual está propuesta |
| Cifras de peso y reps | toque | Abre el teclado numérico sobre ese campo |
| `+` | toque | Sube el peso un `min_increment` |

El número de serie **es** el control de confirmar: el dato que ya estaba ahí, no un checkbox añadido. El filo `--go` aparece en ese mismo borde, debajo del dedo. Un hairline vertical `--rule` separa el confirmar del editar; no es adorno, marca el límite entre dos gestos.

Una fila ya confirmada no responde al toque. Deshacer una serie hecha por un roce es peor que tener que ir a editarla a propósito.
- Prellenado con la última vez en `--ink-soft`. Al confirmar, el valor pasa a `--ink` y aparece `--go` en el borde izquierdo de la fila. La diferencia entre propuesto y confirmado tiene que ser evidente de reojo.
- Series de calentamiento (`kind = 'warmup'`): mismo tamaño, opacidad 0.55, sin acento verde al confirmar. No cuentan para volumen ni PRs y se tiene que ver.

### Calendario

Vista densa y plana. **Sin cabecera de material:** la textura dice de qué tipo es un día, y en una rejilla mensual hay treinta días de tipos distintos, así que cualquier material ahí sería decorativo. Arranca directamente en `--paper`.

Mes en `title` con el año en `data` a la derecha. Iniciales de los días en minúscula (`l m x j v s d`): en mayúscula serían una etiqueta en caja alta, prohibida en §7.

**El punto de estado va debajo del número, nunca detrás.** El círculo de color con el número dentro es el patrón por defecto de cualquier calendario y además obliga a pelear el contraste del número contra el relleno. Separados, el número se lee siempre igual y el punto solo carga el estado.

Celda de 48px, que es también el objetivo táctil del día. **Por debajo de 360px la rejilla sangra hasta los bordes de la pantalla**, sin padding lateral: con los 16px de margen la celda se queda en 41,1px de ancho a 320, por debajo del mínimo táctil de 44 de §8. A sangre son 45,7px. Punto de 8px:

| Estado | Punto |
|---|---|
| Hecha | Relleno `--go` |
| Programada y no hecha (pasado) | Relleno `--rule` |
| Programada hoy | Anillo de 1px `--ink-soft` |
| Programada a futuro | Anillo de 1px `--rule` |
| Sin nada | Nada. La ausencia no se dibuja |

**La distinción es relleno contra anillo**, no sólido contra punteado: a 8px un punteado no se resuelve y "futuro" y "hueco pasado" se confunden. Relleno significa que el día ya pasó; anillo, que está por venir. Hoy destaca por el peso del número **y** por el tono del anillo.

Lista cronológica debajo, a 40px. Filas de 72px con hairline: fecha en `data`, nombre en `item`, metadatos en `data` / `--ink-soft`, y chevron a la derecha, que es la única señal de que la fila se abre. Una sesión programada y no hecha aparece en la lista con el nombre en `--ink-soft` y "programada, sin hacer" como metadato. Nunca en rojo.

### Progreso

**Sin título de pantalla.** La pestaña activa ya dice dónde estás; un `title` "Progreso" repite la palabra dos veces en la misma vista.

Orden: feed de veredictos en texto plano arriba, luego peso corporal, luego por ejercicio. El número grande queda en segundo lugar y funciona precisamente por eso: llega después de tres líneas tranquilas.

`display-hero` (72px) aparece **aquí y solo aquí**, en el número de tendencia kg/semana, alineado a la izquierda, con su unidad y ventana en `info` debajo. No se tiñe: bajar de peso puede ser bueno o malo según el objetivo, y `--go` significa "completado", nada más. La interpretación la da el veredicto en texto.

Nada de rejilla de tarjetas de métricas y nada de envoltorio de tarjeta alrededor de las gráficas. Las gráficas van desnudas sobre `--paper`.

Mejores series en filas de 48px con hairline: reps en `--ink-soft` a la izquierda, peso en `--ink` a la derecha. Alineados a la derecha para que las cifras se comparen en vertical.

### Gráficas

- **Ninguna gráfica sin eje.** Rejilla de hairlines `--rule`, valores del eje y referencia temporal. Un trazo suelto sobre el papel no es una gráfica, es un adorno con forma de dato.
- **Etiquetas de eje en `data` (13px mono), nunca en `micro`.** `micro` es exclusivo de la rejilla del calendario.
- **Lo medido va en trazo sólido de 2px `--ink`. Lo calculado o proyectado va discontinuo de 1px `--ink-soft`.** Una proyección con el mismo peso que los datos reales es una mentira gráfica. Un hairline vertical `--rule` marca dónde acaban los datos y empieza el cálculo.
- Dato diario con ruido: puntos finos `--ink-soft`. Media móvil: el trazo grueso.
- **Cada gráfica lleva su frase encima**, conclusión primero. Sin ella, Progreso se convierte en cuatro gráficas y ningún veredicto, y ahí se cae el argumento de por qué esta app no es como las otras cincuenta.
- Selector de rango: fila de opciones en `info` con subrayado de 2px `--ink` en la activa, reutilizando la gramática de la barra de navegación. Sin segmentado.

**Línea de seguimiento previsto** (e1RM): prolonga la regresión de la ventana de §5.3 de las especificaciones. Solo se dibuja **con 4 puntos o más**, igual que el veredicto; con tres sesiones la recta es ruido con aspecto de certeza. Cuando hay estancamiento sale horizontal, así que el dibujo y el mensaje dicen lo mismo y no hace falta teñir nada.

**Mensaje de estancamiento:** va donde van los demás veredictos, en texto plano, sin banda de color, sin icono y sin distintivo. Si el estancamiento se destaca y el progreso no, la pantalla se convierte en una pantalla de regañinas.

**Cumplimiento de sesiones por semana:** barras `--ink` de sesiones hechas y **una sola** línea discontinua de objetivo. Sin rojo, sin porcentaje y sin barra fantasma del ideal detrás de cada semana. Una semana incompleta se lee como barra más corta, no como falta marcada.

### Rutinas — lista

Filas de hairline de 80px, no tarjetas. Nombre en `item`, `6 ejercicios · lun y jue` en `data` / `--ink-soft`, chevron a la derecha.

**La última vez realizada va en columna propia alineada a la derecha**, en `data` tabular. Es el dato que delata las plantillas zombis, y en columna se leen de un barrido: `hace 3 días` sobre `hace 8 meses` no necesita ningún aviso encima. Metida dentro de una tarjeta, hay que buscarla plantilla por plantilla. El default aquí eran tarjetas con una pastilla de colores para los días asignados.

**Por debajo de 360px la columna derecha abrevia:** `3 d`, `5 sem`, `8 mes`. La fila completa mide 281px de contenido contra 260 disponibles a 320; con la columna abreviada baja a 223. Sigue siendo `data` tabular y sigue leyéndose en vertical, que era toda la función.

Sin título de pantalla: la pestaña activa ya lo dice. `Crear rutina` en `--ink` al final de la lista.

### Rutinas — editor

**El editor es el bloque de cabecera de esa rutina.** Ahí se resuelve `routine_type`: el selector cambia el material que estás mirando a tamaño real, en su sitio legítimo. El selector en sí es **texto** —`Fuerza` · `Movilidad` · `Sin tipo`, con el subrayado de 2px de la barra de navegación—, nunca muestras de textura: tres cuadraditos de piedra en una fila son material convertido en adorno, contra la regla 4 de §2.

El nombre se edita tocándolo en la cabecera, con la misma gramática que la cifra en la fila de serie: se toca el valor y se escribe encima.

Fila colapsada: nombre en `item` y `4×8-10` en `data`. **Sin tiempo de descanso.** Las especificaciones ponían `4×8-10 · 2min` como ejemplo, pero el temporizador se descartó y pedirle al usuario que configure un campo que nadie consume es peor que no tenerlo.

Se despliega una fila a la vez, en controles de 64px con hairline: `Series` con `−` / `+` de 44px, y `Reps` como dos cifras de `8` a `10`. **Aquí el `−` sí existe**: se eliminó de la fila de serie por espacio a 320px, no del sistema. Esta es una pantalla sentada y con calma.

Las cifras editables llevan fondo `--panel-deep`, que es el token de "aquí se escribe".

**No hay botón de guardar.** Se guarda al cambiar, que es lo coherente con IndexedDB como fuente de verdad. El aviso de que editar la plantilla no cambia las sesiones ya hechas sale **al hacer el primer cambio**, no como pie de página permanente: al final de un scroll largo lo ve justo quien no lo necesita.

### Barra superior

**Las cuatro pantallas raíz no la tienen.** Hoy, Calendario, Progreso y Rutinas ya llevan la barra inferior y no hay dónde volver; una cabecera de navegación ahí mete un elemento vacío encima del material, que es lo que sostiene el titular. La barra aparece solo en pantallas apiladas: editor, catálogo, detalle de ejercicio, sesión pasada, resumen, ajustes.

**Solo lleva navegación, nunca el título.** Un título centrado en la barra es el default de todo sistema operativo y contradice el "todo alineado a la izquierda" de §3. El título vive en el contenido, a `title` completo.

56px de alto. Chevron `‹` en un objetivo de 44px.

| Fondo | Chevron | Hairline |
|---|---|---|
| Material | Blanco, **sin superficie propia detrás** | No |
| `--paper` | `--ink` | Abajo, solo cuando hay contenido pasando por detrás |

Sobre material la capa de `rgba(20,16,12,.42)` ya garantiza el contraste; un círculo translúcido debajo del chevron sería glassmorphism (§7).

La acción de la derecha, cuando existe, va **en texto** en `item`: "Editar" se entiende, un lápiz hay que adivinarlo.

En una sesión pasada, el eyebrow de la cabecera lleva la fecha, en el mismo hueco donde Hoy pone "Día de entreno". Coherente por posición: ahí va siempre qué día es esto. **Solo la fecha:** si el eyebrow acumula duración u otros datos, deja de ser el sitio donde se lee qué día es esto.

**Las pantallas apiladas esconden la barra inferior.** Tienen chevron y una salida propia, no cuatro destinos.

### Resumen post-sesión

Pantalla de recompensa, y donde más tira el default: confeti, tres tarjetas de métricas en fila, estrellas y un "¡Buen trabajo!" arriba. Nada de eso entra.

**La recompensa no es un número grande, son los PRs.** `display-hero` está confinado a Progreso, así que volumen y duración van en `data-lg` (24px). Y §6 prohíbe emoji, así que la valoración son cifras del 1 al 5, no caras ni estrellas.

Orden: PRs, cifras, valoración, notas.

**PRs del día:** una tarjeta con una fila de 72px por récord, cada una con el filo de 3px `--go` de la serie confirmada. Es el segundo y último sitio de la app donde aparece el verde. Nombre en `item`, `e1RM 82,5 kg · antes 80,0` en `data`, y la diferencia contra el récord anterior a la derecha en `data-lg`. El titular del bloque es la conclusión —"Dos récords hoy"—, no un "PRs" seco encima de una lista.

**Si no hay PRs, el bloque no existe.** No aparece "Ningún récord hoy": se lee como suspenso, y una sesión normal es la mayoría de las sesiones.

**Cifras:** filas de 56px con hairline, etiqueta en `body` a la izquierda y valor en `data-lg` a la derecha. Alineadas a la derecha para que se comparen en vertical. Nada de rejilla de tarjetas de métricas.

**Valoración:** cinco objetivos de 48px en `--panel-deep` con la cifra en `data-lg` / `--ink-soft`; la elegida pasa a fondo `--ink` con la cifra en `--paper`. Sin verde: `--go` significa completado, no "buena sesión".

**Notas:** campo `--panel-deep` de 88px mínimo, con un ejemplo real como marcador, no "Escribe aquí".

`Cerrar` en `--ink` al final. No guarda nada —todo se guarda al escribir—, solo cierra, y el nombre lo dice sin fingir.

---

## 5. Movimiento

- **Una sola secuencia orquestada:** al abrir Hoy, la cabecera aparece y las tarjetas entran escalonadas con `animation-delay`. Ocurre una vez por sesión de app.
- El resto del movimiento responde a una acción del usuario y muestra qué ha cambiado: expandir tarjeta (plegado a 220 ms), confirmar serie (el filo `--go` crece desde arriba, 200 ms), arrastrar para reordenar.
- **Cambio de vista (v1.7):** entra solo la vista nueva — fundido de 140 ms entre pestañas, deslizamiento corto de 200 ms al apilar y de 180 ms al volver. La vista vieja no se anima y nada dura más de 220 ms.
- **Prohibido:** fade-and-slide-up en cada sección al scrollear, y transición de hover en cada tarjeta. Es el default y se lee como generado.
- `prefers-reduced-motion` respetado en todo.

---

## 6. Escritura

- Frases en caja normal, verbos activos, sin relleno.
- El botón dice lo que pasa: "Empezar sesión", "Finalizar sesión". La acción conserva el nombre en todo el flujo.
- **Los veredictos son la voz del producto.** Conclusión primero, en texto plano: "Press militar: e1RM plano desde hace 5 semanas". Sin emoji, sin signos de exclamación, sin motivación.
- **Los huecos no regañan.** Una sesión programada y no hecha es `--rule` sobre `--paper`. Nunca rojo. Se van a saltar días y una app que llena el calendario de rojo se abandona.
- Sin `→` pegado al texto de botones y enlaces.
- Los estados vacíos invitan a actuar; los errores dicen qué pasó y cómo arreglarlo, sin disculparse.

---

## 7. Lista negra

Cada línea es un tic reconocible de interfaz generada. Ninguna aparece en este proyecto.

**Tipografía**
- Inter, Roboto, Open Sans, Lato, fuentes de sistema
- Space Grotesk (es la convergencia por defecto del propio modelo)
- Etiquetas en MAYÚSCULAS con tracking encima de las secciones
- Una palabra del titular acentuada en cursiva, negrita o color
- Mono para etiquetas decorativas

**Color y superficie**
- Degradados de cualquier tipo. La profundidad la da el material, no un gradiente.
- Crema `#F4F1EA` + serif de display + acento terracota `#D97757`. **Es el cliché número uno del diseño generado, y nuestra paleta es peligrosamente cercana.** Lo que nos separa: la textura es material fotografiado y no un naranja plano, el display es una grotesca ancha y no un serif editorial, y el acento es un verde funcional y no un terracota decorativo. Esas tres cosas son las que impiden que esto se convierta en el cliché. No se negocian.
- `box-shadow` en cualquier elemento
- Un único `border-radius` para todo
- Morado o azul-morado en ningún sitio
- Glassmorphism, blur de fondo
- Más de un color de acento

**Estructura**
- Contenido troceado en tarjetas redondeadas idénticas cuando no lo pide la jerarquía
- Marcadores numerados `01 / 02 / 03`. Solo si el contenido es realmente una secuencia; aquí no lo es en ningún sitio.
- Metadatos unidos con puntos medios como adorno (`A · B · C`). El `·` de `4×8-10 · 2/4` sí separa dos datos reales.
- Rejillas de tres columnas de features
- Rejilla de tarjetas de métricas encima de una pantalla de datos
- Proyecciones o cálculos dibujados con el mismo peso que los datos medidos
- Componentes de shadcn sin tunear

---

## 8. Suelo de calidad

- Responsive hasta 320px. La tarjeta de ejercicio es lo primero que se rompe: comprobarla ahí. **Y el titular de cabecera es lo segundo, pero se rompe también a 380.** El navegador parte la línea por su cuenta y la rotura pasa desapercibida en una captura: medir el ancho de la cadena con la fuente real, no confiar en que se vea bien.
- Foco de teclado visible, con contorno de 2px `--ink`.
- Contraste: texto normal 4.5:1, texto grande 3:1. Texto blanco sobre material, verificado por textura.
- `prefers-reduced-motion` respetado.
- Objetivos táctiles de 44px mínimo en la app, 48px en registro de series.

---

## 9. Decisiones abiertas

Ninguna. Las siete de la v1.5 se cerraron en la v1.6:

1. **`routine_type`** — añadido al modelo de datos (`routines.routine_type`), selección manual en la cabecera del editor.
2. **`rest_seconds`** — borrado del modelo. El temporizador se descartó y ninguna pantalla lo consumía.
3. **Días asignados** — bloque propio al final del editor, debajo del `+` de añadir ejercicio (no entre los ejercicios y el `+`, que rompe la lectura): siete objetivos de 44px (`l m x j v s d`), el activo con relleno `--ink` y la letra en `--paper`.
4. **Cifras editables** — unificadas: la zona de cifras de la fila de serie lleva también fondo `--panel-deep`. El token de "aquí se escribe" es el mismo en toda la app.
5. **Barra de navegación inferior** — confirmada la provisional: 56px, hairline arriba, etiquetas de texto en `info` sin iconos, activa en `--ink` con subrayado de 2px.
6. **Sesión improvisada** — desde Rutinas: fila `Sesión vacía` al final de la lista (crea una sesión sin plantilla y lleva a Hoy) y acción `Entrenar hoy` en el editor de cada rutina, que la entrena fuera de su día programado.
7. **Veredicto de estancamiento** — sin consejo. Solo el hecho, en texto plano, como el resto de veredictos.

### Cerradas en la v1.1

- **Inicio de sesión:** empieza **al pulsar el botón**. Las series que se rellenen antes son borrador; el botón sigue diciendo "Empezar sesión" hasta que se pulsa.
- **Hoy a las 15:00:** manda el entreno.
- **Hoy sin rutina:** solo el bloque de peso.
- **Conmutador peso/entreno:** no existe como control; es el plegado de los dos bloques.

---

## 10. Changelog

- **2026-09-02** — v1.7. Movimiento implementado y acotado: transiciones de cambio de vista (fundido entre pestañas, deslizamiento al apilar/volver), plegado animado de tarjetas y filas de editor, filo `--go` que crece al confirmar. Todo ≤220 ms, bajo `prefers-reduced-motion`.
- **2026-09-02** — v1.6. Se cierran las siete decisiones abiertas de §9 para la implementación: `rest_seconds` borrado, barra inferior confirmada, cifras editables unificadas con `--panel-deep`, días asignados al final del editor, sesión improvisada desde Rutinas (`Sesión vacía` + `Entrenar hoy`), veredicto de estancamiento sin consejo.
- **2026-09-02** — v1.5. Barrido a 320px midiendo con las fuentes reales. Tres correcciones: `display-xl` va a dos líneas con interlineado 0.90 y el editor limita el nombre de la rutina; la columna derecha de Rutinas abrevia por debajo de 360px; la rejilla del calendario sangra a los bordes por debajo de 360px para conservar los 44px táctiles.
- **2026-09-02** — v1.4. Resumen post-sesión definido: los PRs son la recompensa y el segundo sitio donde aparece el verde. El eyebrow de cabecera queda restringido a la fecha. Las pantallas apiladas esconden la barra inferior.
- **2026-09-02** — v1.3. Rutinas y su editor definidos; `routine_type` se elige en la cabecera del propio editor. Nueva subsección de barra superior: no existe en las pantallas raíz y nunca lleva el título. El editor pierde el botón de guardar y el tiempo de descanso.
- **2026-09-02** — v1.2. Calendario y Progreso definidos. Nueva subsección de gráficas: eje obligatorio, medido sólido contra calculado discontinuo, línea de seguimiento previsto y cumplimiento semanal. Etiquetas de eje corregidas a `data`; `micro` vuelve a ser exclusivo del calendario.
- **2026-09-02** — v1.1. Hoy queda definida en sus tres estados (mañana, tarde, día de descanso). Se cierran las decisiones 2, 3 y 5 de la v1.0. Se descarta el control de conmutación en favor del plegado de bloques. Se fija la anatomía de la tarjeta expandida: filas de serie a ancho completo. `display-hero` queda confinado a Progreso. Filas de serie: el número de serie pasa a ser el control de confirmar, la cifra abre teclado, y se elimina el botón `−`.
- **2026-09-02** — v1.0. Dirección inicial: base crema, material fotográfico por tipo de rutina, acento verde único, Archivo + IBM Plex, ruptura de escala en registro de series.
