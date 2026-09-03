# Plan de rediseño v2.0 — «Kinetic Nordic Craft»

Plan previo al código (CLAUDE.md, proceso obligatorio). Origen: los dos `DESIGN.md` exportados
de Stitch (oscuro y claro) y las 8 pantallas HTML del zip `stitch_redise_o_app_gimnasio_y_progreso`.

Decisiones ya tomadas por Pablo (2026-09-03):

1. **Oscuro y claro según el sistema**, con conmutador manual en Ajustes.
2. **Syne + Hanken Grotesk + JetBrains Mono en ambos modos.** El modo claro solo cambia colores.
3. **Fila de serie con la interacción de la maqueta:** serie activa expandida con steppers −/+ de
   carga y reps y botón «Completar serie». Cambio de comportamiento sobre la spec §4.2; se documenta allí.
4. **Barra superior en las pantallas raíz** («Hoy» + campana + acceso a Ajustes) y títulos de pantalla
   en Syne mayúsculas, como en la maqueta.

Lo que **no** cambia porque es restricción técnica o de comportamiento, no de aspecto:

- Cero CDN. Fuentes auto-alojadas (WOFF2 latin, ~110 KB las tres, menos que las actuales), iconos SVG
  propios en lugar de Material Symbols, sin fotos de ejercicios (no existen offline).
- Nada de la maqueta que la app no mide: racha, recuperación %, RPE, velocidad m/s, temporizador de
  descanso, calculadora de discos, mesociclos, sueño. Cada hueco se rellena con un dato **real** de la
  base o se quita.
- IndexedDB sigue siendo la fuente de verdad; ninguna pantalla nueva llama a la red.

---

## 1. Tokens (`src/styles/tokens.css`)

Nombres semánticos, independientes del modo. La paleta clara se define en `:root`, la oscura en
`@media (prefers-color-scheme: dark)` y ambas se fuerzan con `html[data-theme="dark|light"]`.

| Token | Oscuro | Claro | Uso |
|---|---|---|---|
| `--bg` | `#121315` | `#f8f7f4` | Lienzo |
| `--surface` | `#1b1c1e` | `#ffffff` | Tarjetas, paneles, barras |
| `--surface-hi` | `#25282e` | `#eae7e0` | Filas activas, botón secundario, pista del segmentado |
| `--well` | `#0d0e10` | `#f2f0eb` | Lecho de inputs y de la marca de ejercicio |
| `--ink` | `#e3e2e4` | `#111315` | Texto principal y cifras |
| `--ink-soft` | `#b9b5aa` | `#575a5e` | Texto secundario, unidades |
| `--ink-mute` | `#7b828e` | `#8c8f94` | Etiquetas, ejes, histórico |
| `--rule` | `rgba(230,225,214,.08)` | `#e5e3dc` | Hairline estructural |
| `--rule-strong` | `rgba(230,225,214,.14)` | `#dbd8cf` | Borde de botón secundario, tarjeta activa |
| `--volt` | `#c8f322` | `#c0eb1e` | Acento único: acción primaria, serie hecha, PR, dato vivo |
| `--on-volt` | `#141517` | `#111315` | Texto sobre volt |
| `--volt-edge` | `rgba(200,243,34,.35)` | `#9ec412` | Borde de fila hecha y del botón primario |
| `--volt-tint` | `rgba(200,243,34,.12)` | `#f4fcd4` | Fondo de chip PR / estado |
| `--volt-ink` | `#c8f322` | `#4d6100` | Texto sobre volt-tint |
| `--alert` | `#ff4a4a` | `#e53935` | Solo destructivo: borrar sesión, archivar |
| `--halo` | `0 0 24px -6px rgba(212,255,50,.18)` | `0 0 0 2px #c0eb1e, 0 4px 16px rgba(192,235,30,.28)` | Aura del bloque activo (serie en curso, sesión en curso) |
| `--card-shadow` | `none` | `0 1px 3px rgba(17,19,21,.04), 0 4px 12px rgba(17,19,21,.02)` | Única sombra permitida, solo en claro |
| `--chart-fill` | `rgba(200,243,34,.30)` → 0 | `rgba(192,235,30,.30)` → 0 | Relleno bajo la línea de datos |

**Tipografía** (`--font-display: Syne`, `--font-ui: Hanken Grotesk`, `--font-data: JetBrains Mono`):

| Clase | Fuente / peso | Tamaño / interlineado / tracking | Uso |
|---|---|---|---|
| `.t-display` | Syne 700 | 36 / 40 / −0.02em, mayúsculas | Nombre de rutina en Hoy, Rutinas, sesión pasada; «SESIÓN COMPLETADA» |
| `.t-h1` | Syne 600 | 28 / 34 / −0.02em, mayúsculas | Título de pantalla raíz («MIS RUTINAS», «PROGRESO», mes del calendario) |
| `.t-h2` | Syne 600 | 22 / 28 / −0.01em | Título de bloque («Entreno de hoy», «Peso corporal») |
| `.t-h3` | Hanken 600 | 18 / 24 | Nombre de ejercicio, título de fila |
| `.t-body` | Hanken 400 | 16 / 24 / −0.01em | Texto |
| `.t-body-sm` | Hanken 400 | 14 / 20 | Subtítulos, veredictos en tarjeta |
| `.t-caption` | Hanken 400 | 12 / 16 | Pies, avisos |
| `.t-metric-xl` | Mono 600 | 40 / 44 / −0.04em | Peso corporal, tendencia, cifra de la serie activa |
| `.t-metric` | Mono 500 | 20 / 24 / −0.02em | Peso y reps en la tabla de series, estadísticas |
| `.t-metric-sm` | Mono 600 | 15 / 20 | Columna «previo», chips de dato |
| `.t-label` | Mono 500 | 12 / 16 / +0.05em, mayúsculas | Etiquetas de sección, botones |
| `.t-label-sm` | Mono 500 | 10 / 12 / +0.08em, mayúsculas | Unidades (KG, REPS), tags de estado, barra inferior |

Todo lo numérico con `tabular-nums` (regla global que ya existe).

**Radios:** 4 controles/inputs/chips/botones · 8 tarjetas · 12 hojas · pill **solo** tags de estado y
barra de progreso. **Espaciado:** `--sp-1..8` = 4, 8, 12, 16, 20, 24, 32, 48. **Alturas:** barra
superior 64, barra inferior 64 + safe-area, fila de tabla de series 56, botón CTA 56, táctil 44,
botones de stepper 48, casilla de serie 28.

---

## 2. Componentes base (`src/styles/ui.css`, `src/components/`)

- **`Icon`** (nuevo): ~26 trazos SVG 24×24 a 2px, dibujados a mano (estilo Material Outlined):
  `bell, settings, target, calendar, trending, dumbbell, play, flag, check, plus, minus, chevron-l/r/d,
  back, arrow-r, more, edit, history, timer, scale, search, tune, bolt, download, upload, sync, trophy,
  drag, close, alarm`.
- **`TopBar`** rehecho: 64px, `--surface`, hairline abajo al scrollear. Raíz: punto volt 8px + nombre
  de pestaña `.t-h2` a la izquierda; campana (→ `/ajustes#avisos`) y engranaje (→ `/ajustes`) a la
  derecha. Apilada: flecha atrás 44px + título `.t-h3` en mayúsculas + acción opcional en texto.
- **`BottomNav`**: icono 24 + etiqueta `.t-label-sm`. Activa: icono y texto en `--volt`.
- **Botones:** `.btn` primario volt (`--on-volt`, `.t-label`, borde `--volt-edge`, 56px);
  `.btn--secondary` `--surface-hi` + borde `--rule-strong`; `.btn--ghost` texto `--ink-soft` que pasa
  a `--alert` al pulsar (destructivo). Todos con `transform: scale(.98)` en `:active`, 60ms lineal.
- **`Card`**: `--surface`, radio 8, borde 1px `--rule`, `--card-shadow`. Variantes `.card--active`
  (borde `--volt-edge` + `--halo`) y `.card--well` (panel interior recesado).
- **Chips:** `.chip` neutro (`--surface-hi`), `.chip--volt` (`--volt-tint` + `--volt-ink` + borde
  `--volt-edge`), padding 2×8, radio 4, `.t-label-sm`.
- **Segmentado:** pista `--surface-hi` radio 4, opción activa rellena en `--volt` con `--on-volt`.
  Sustituye al selector de texto subrayado en rango de Progreso, unidad y tipo de rutina.
- **Input numérico:** lecho `--well`, texto `.t-metric` en `--ink`; foco: borde 1px `--ink` +
  anillo 2px `--volt`.
- **Toggle:** pista `--surface-hi`, activo `--volt` con pomo `--on-volt`.
- **Casilla de serie:** 28×28, radio 4; inactiva `--surface-hi` + borde `--ink-mute`; hecha `--volt`
  con check `--on-volt` a 2.5px.
- **Stepper** `−  [valor]  +`: botones 48×48 `--surface-hi`, valor `.t-metric-xl` en lecho `--well`.
- **ExerciseMark** sin cambios de forma; trazo `--ink` sobre lecho `--well`, 40px.
- **Gráficas:** ejes y rejilla `--rule`, etiquetas `.t-label-sm` `--ink-mute`, dato medido en
  `--volt` 2px con relleno `--chart-fill`, puntos diarios `--ink-mute`, proyección discontinua 1px
  `--ink-mute`, hairline vertical donde acaban los datos. Último punto con círculo relleno volt.

Se eliminan: `MaterialHeader`, las cuatro texturas, `scripts/textures.mjs`, `fonts` Archivo/Plex,
`.sheet`, `.mat*`, `.seltext`.

---

## 3. Pantallas

Cada pantalla: wireframe a 380px, qué la hace única, y qué dato real sustituye a cada invento
de la maqueta.

### 3.1 Hoy (raíz)

```
┌──────────────────────────────────────┐
│ ● Hoy                        🔔   ⚙ │  topbar 64
├──────────────────────────────────────┤
│ [📅 SEMANA 2/4]  [⚖ 88,7 KG HOY]     │  2 chips de dato real
│ ┌──────────────────────────────────┐ │
│ │ ● DÍA DE ENTRENO      4 EJ · 12 S│ │  tag volt · resumen mono
│ │ PECHO &                          │ │  .t-display, 2 líneas
│ │ HOMBRO                           │ │
│ │ Sesión programada para hoy       │ │  .t-body-sm soft
│ │ ┌───────────────────────┐ ┌────┐ │ │
│ │ │ ▶ INICIAR SESIÓN      │ │ ⚙  │ │ │  volt 56 · tune → editor
│ │ └───────────────────────┘ └────┘ │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ ⚖ Peso corporal   [PESAJE HECHO] │ │  .t-h2 + chip estado
│ │ 88,7 KG              [↓ −0,3 AYER]│ │  .t-metric-xl
│ │  ╭─╮  ╭──╮                        │ │  sparkline 6 sem, volt + relleno
│ │ ─╯ ╰──╯  ╰─────                   │ │
│ │ ↗ El peso baja 0,27 kg/semana…    │ │  veredicto real (bodyWeightVerdict)
│ └──────────────────────────────────┘ │
│ Entreno de hoy                  ◔ 0% │  .t-h2 + anillo de progreso
│ 4 ejercicios · 12 series             │
│ ┌──────────────────────────────────┐ │
│ │ ▯ Press banca          92,5 KG   │ │  fila 72: marca en lecho, .t-h3,
│ │   3×8-10 · 0/3         ÚLTIMO    │ │  «3×8-10 · 0/3» mono, último peso volt
│ └──────────────────────────────────┘ │
│ ┌ (expandida: tabla de series) ────┐ │
│ ...                                  │
│ ┌──────────────────────────────────┐ │
│ │ ⊕ AÑADIR EJERCICIO               │ │  secundario
│ └──────────────────────────────────┘ │
├──────────────────────────────────────┤
│  ◎ HOY   📅 CALEND.  📈 PROG.  🏋 RUT.│  bottomnav 64
└──────────────────────────────────────┘
```

- **Orden por hora** (spec §4.1): por la mañana la tarjeta de peso va antes que la de sesión y con
  la gráfica abierta; a partir de las 15:00 o con pesaje hecho, la sesión va primero y la tarjeta de
  peso queda **compacta** (solo cifra + chip; tocarla despliega la gráfica). Sin control de conmutación:
  la prioridad la marca el orden y el tamaño, no un segmentado.
- **Sin pesar:** la cifra grande se sustituye por el input en lecho `--well` con el valor de ayer como
  marcador, enfocado.
- **Sesión en curso:** la tarjeta hero pasa a `.card--active` con halo; el tag dice «SESIÓN EN CURSO»
  con punto que pulsa; a la derecha el **cronómetro** desde `started_at` en `.t-metric` (dato real);
  debajo, barra de progreso pill volt «7/12 SERIES (58%)». El botón «Iniciar» desaparece de la hero; al
  final de la lista aparece «FINALIZAR ENTRENAMIENTO» (secundario mientras queden series, **volt cuando
  todas están hechas**: el color señala que hay algo hecho detrás, como en la v1).
- **Sesión hecha:** hero con tag «HECHA», botón «VER RESUMEN» secundario y enlace «Reabrir sesión».
- **Día sin rutina:** sin hero; solo la tarjeta de peso completa. Sesión improvisada desde Rutinas
  (spec §4.1 sin cambios).
- Los chips «RACHA» y «RECUPERACIÓN» de la maqueta se sustituyen por **semana N/M** (sesiones
  hechas/programadas esta semana) y **peso de hoy** o «SIN PESAR». Ninguno decorativo.
- Los 3 chips de la hero de la maqueta («Target», «RPE meta», «Ant.») desaparecen: no hay RPE y el
  objetivo ya está en cada fila.

### 3.2 Tarjeta de ejercicio y registro de series (la ruptura de escala)

```
┌──────────────────────────────────────┐
│ ▯ Press banca                   ⌃    │  cabecera 72 (toque: pliega)
│   3×8-10 · 1/3        92,5 KG ÚLTIMO │
├──────────────────────────────────────┤
│ SERIE   PREVIO     CARGA   REPS   ✓  │  .t-label-sm mute
│ (1)   87,5 × 10   90,0 KG   10   [✓] │  56px · hecha: borde volt, cifras --ink
│ ┌──────────────────────────────────┐ │
│ │ (2) SERIE EN CURSO   ANT. 90 × 9 │ │  bloque activo: --surface-hi + halo
│ │ CARGA (KG)   +2,5   REPETICIONES │ │  .t-label-sm · incremento real
│ │ ┌─┐┌──────┐┌─┐  ┌─┐┌──────┐┌─┐   │ │
│ │ │−││ 92,5 ││+│  │−││  9   ││+│   │ │  48×48 · cifra .t-metric-xl en --well
│ │ └─┘└──────┘└─┘  └─┘└──────┘└─┘   │ │  (tocar la cifra abre teclado)
│ │ ┌──────────────────────────────┐ │ │
│ │ │ ✓ COMPLETAR SERIE 2          │ │ │  volt 56
│ │ └──────────────────────────────┘ │ │
│ │ RIR −  2  +   · al fallo · borrar│ │  extras en .t-label-sm (antes: pulsación larga)
│ └──────────────────────────────────┘ │
│ (3)   90,0 × 8    90,0 KG   8    [ ] │  pendiente: --ink-mute (toque: pasa a activa)
├──────────────────────────────────────┤
│ ⊕ AÑADIR SERIE        CALENTAMIENTO  │  .t-label
└──────────────────────────────────────┘
```

- **La serie activa** es la primera sin confirmar; tocar otra pendiente la convierte en activa. Solo
  hay un bloque expandido por tarjeta y solo en sesión activa o en edición de sesión pasada.
- **Columna PREVIO:** dato real de `lastPerformance(exercise_id)` (la sesión anterior, misma
  posición). Si no hay, «—».
- **Steppers:** carga sube/baja `min_increment` del ejercicio (se muestra como «+2,5» en la etiqueta);
  reps ±1; tiempo ±5 s. En ejercicios `reps_only`/`time` no hay stepper de carga.
- **Hecha:** casilla volt, cifras en `--ink`, borde de fila `--volt-edge`, la fila deja de responder
  (deshacer por roce sigue siendo peor). Los extras RIR / al fallo / borrar viven en el bloque activo
  y desaparece la pulsación larga.
- **Calentamiento:** índice «C», opacidad .55, sin volt al confirmar.
- **A 320px:** columnas `28 · 1fr · 1fr · 44 · 36`; los steppers pasan a `40×40` y la cifra a 32px.
  Se mide con la fuente real antes de dar por bueno.
- **Ajuste a la spec §4.2:** se reescribe la tabla de zonas: casilla/bloque confirma; cifra abre teclado;
  `−`/`+` ajustan. Se anota que el `−` vuelve porque la serie activa expandida tiene sitio para dos
  botones de 48 incluso a 320.

### 3.3 Calendario

```
│ ┌──────────────────────────────────┐ │
│ │ SEPTIEMBRE [2026]         ‹   ›  │ │  .t-h1 + chip volt-tint · botones 44
│ └──────────────────────────────────┘ │
│ ┌─────────┐┌─────────┐┌─────────┐    │  3 tarjetas de métrica (dato real)
│ │ADHERENC.││HECHAS   ││PENDIENT.│    │  hechas/programadas del mes · sesiones
│ │ 92 %    ││ 14 SES  ││ 3       │    │  hechas (+Δ vs mes anterior) · programadas
│ │Obj. 4/sem││+2 vs ago││hasta 30 │    │  que quedan
│ └─────────┘└─────────┘└─────────┘    │
│ ┌──────────────────────────────────┐ │
│ │ L  M  X  J  V  S  D              │ │  .t-label-sm mute
│ │ 31 01 [02] 03 04 05 06           │ │  hoy: celda --surface-hi
│ │     •   ●  •  •                  │ │  punto: ● volt hecha · • mute programada
│ │ …                                │ │           · gris oscuro «sin hacer» (pasado)
│ │ ● Completada • Programada · Sin hacer│
│ └──────────────────────────────────┘ │
│ SESIONES · septiembre     (o el día tocado)
│ ┌──────────────────────────────────┐ │
│ │ ✓ Pierna                 [HECHA] │ │  .t-h3 + chip volt
│ │ mié 2 sep · 6 ejercicios          │ │
│ │ DURACIÓN  EJERCICIOS  VOLUMEN     │ │  fila de 3 métricas mono
│ │ 58 MIN    6           9.400 KG    │ │
│ │ ┌──────────────────────────────┐ │ │
│ │ │ VER SESIÓN                 → │ │ │  secundario → /sesion/:id
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ ◷ PRÓXIMA SESIÓN · JUE 18:30     │ │  siguiente día programado + hora del aviso
│ │ Pecho & Hombro                   │ │  (solo si hay programación)
│ └──────────────────────────────────┘ │
│ ┌ programada, sin hacer ───────────┐ │  tarjeta en --ink-mute, sin rojo (§6 v1)
```

- Tocar un día filtra la lista a ese día; volver a tocarlo muestra el mes.
- La tarjeta «Sesión pospuesta / Reasignar día» de la maqueta no existe: el reasignado se hace editando
  la fecha en la sesión pasada, como ahora.

### 3.4 Progreso

```
│ MÉTRICAS                              .t-label mute
│ PROGRESO                              .t-h1
│ [4 SEM][3 MESES][1 AÑO][TODO]         segmentado, activa volt
│ ┌──────────────────────────────────┐
│ │ ⚖ PESO CORPORAL     [↘ −0,27 KG/SEM]│  chip tendencia (dato real)
│ │ 88,7 KG                           │  .t-metric-xl
│ │ ╲╲__╲__  ── puntos diarios mute   │  media 7d volt + relleno; eje mono
│ │ 01 JUN (90,1)   01 JUL   HOY (88,7)│
│ │ El peso baja 0,27 kg/semana…      │  veredicto (voz del producto, §6 v1)
│ └──────────────────────────────────┘
│ ┌──────────────────────────────────┐
│ │ ▥ FRECUENCIA        [SEMANA 36]  │
│ │ 1 de 2 sesiones esta semana       │  .t-metric + body
│ │ ▮ ▯ ▯ ▯ ▯ · ·                     │  7 columnas L–D: volt hecha, --surface-hi
│ │ L M X J V S D                     │  programada, punteado sin nada
│ │ ▂▅▅▅▅▅▅▅ ---- objetivo            │  barras 8 semanas volt, línea objetivo
│ │ 0 de 2 sesiones esta semana.      │  veredicto semanal
│ └──────────────────────────────────┘
│ ┌──────────────────────────────────┐
│ │ ↗ SOBRECARGA PROGRESIVA          ●│
│ │ ┌ EJERCICIO ─────────────  ⇅ ┐   │  select nativo dentro de --surface-hi
│ │ │ Curl femoral tumbado        │   │
│ │ └─────────────────────────────┘   │
│ │ +8,7 % de e1RM en 5 sesiones      │  veredicto; si «insuficiente»: caja con
│ │                                   │  icono y «hacen falta 2 más»
│ │  e1RM: línea volt + proyección -- │  hairline donde empieza el cálculo
│ │ ÚLTIMAS SESIONES        +3,5 % MES│
│ │ 19 AGO   26 AGO   [2 SEP]         │  3 columnas: e1RM por sesión, última volt
│ │ 56 KG    57 KG     58 KG          │
│ │ [PR ACTUAL] 8 REPS × 45 KG        │  mejor serie real
│ │ Volumen por sesión (línea)        │
│ │ MEJORES SERIES  8 reps … 30 kg    │  filas mono
│ └──────────────────────────────────┘
```

- «Meta 86 kg» y «velocidad propulsiva» de la maqueta no existen: fuera.
- El feed de veredictos suelto de arriba desaparece; cada veredicto va **dentro de su tarjeta**, como
  frase de cierre. Los veredictos por ejercicio que no son el seleccionado se listan al final de la
  tarjeta de sobrecarga en `.t-body-sm` (no se pierde la voz del producto).

### 3.5 Rutinas

```
│ ● 3 RUTINAS · 4 SESIONES/SEM     2/4 ESTA SEMANA   fila de estado mono (dato real)
│ MIS RUTINAS                        [+ CREAR]        .t-display + volt
│ 3 plantillas activas                                .t-body-sm
│ ┌━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┐  borde superior volt = toca hoy
│ │ [TOCA HOY] JUEVES            ▯   │  chips · marca del 1er ejercicio en lecho
│ │ PECHO                            │  .t-h1
│ │ 4 ejercicios · Press banca, Fondos, Aperturas │
│ │ SERIES  EJERCICIOS  ÚLTIMA VEZ   │  fila de 3 métricas (reales)
│ │ 16      4           HACE 7 D     │
│ │ [▶ INICIAR SESIÓN         ] [⋮]  │  volt → crea borrador y va a Hoy · ⋮ → editor
│ └──────────────────────────────────┘
│ ┌──────────────────────────────────┐
│ │ [HACE 3 DÍAS] MAR Y SÁB      ▯   │
│ │ PIERNA                           │
│ │ 6 ejercicios · Sentadilla, Prensa, Gemelos │
│ │ [✎ EDITAR                 ] [▶]  │  secundario · ▶ = entrenar hoy
│ └──────────────────────────────────┘
│ ┌──────────────────────────────────┐
│ │ ⚡ SESIÓN VACÍA                  │  secundario ancho
│ └──────────────────────────────────┘
│ ⚙ Ajustes de entrenamiento y equipo     texto → /ajustes
```

- «Ciclo activo · semana 4» → «N rutinas · M sesiones/semana». «PR Sentadilla: 145 kg» de la maqueta
  → **última vez** en `fmtRelative` (el dato que delata plantillas zombis, §4 v1). Sin RPE.
- Plantillas archivadas siguen ocultas.

### 3.6 Editor de rutina (apilada)

- Barra: ← «RUTINA». Tarjeta de cabecera: segmentado FUERZA / MOVILIDAD / SIN TIPO; nombre en
  `.t-display` tocable con contador (límite 24 sigue); aviso «editar no cambia sesiones hechas» al primer
  cambio. Filas de ejercicio en tarjeta única con fold de steppers (48px, `.t-metric`) y «Quitar».
  «AÑADIR EJERCICIO» secundario. Tarjeta «DÍAS ASIGNADOS» con 7 casillas 44px (activa volt).
  Acciones: «ENTRENAR HOY» volt, «Archivar rutina» ghost→alert.

### 3.7 Catálogo (apilada)

```
│ ← EJERCICIOS                         │
│ LIBRERÍA                 [⊕ CREAR]   │  .t-label · botón volt-tint (usa el texto buscado)
│ Añadir ejercicio / Ejercicios        │  .t-h1 según modo (elegir / consultar)
│ ┌ 🔍 Buscar ejercicio, músculo… ───┐ │  lecho --well 56
│ [Todos][Pecho][Espalda][Hombro]…     │  chips scroll horizontal, activa volt-tint
│ ● RECIENTES               ÚLTIMOS 7 D│
│ ┌────────┐┌────────┐┌────────┐       │  mini tarjetas 112px: marca en lecho,
│ │  ▯     ││  ▯     ││  ▯     │       │  nombre .t-body-sm, «36 KG × 8» mono volt
│ └────────┘└────────┘└────────┘       │
│ EJERCICIOS                 42 DISPON.│
│ ┌──────────────────────────────────┐ │
│ │ ▯ Press de banca            [+]  │ │  marca 48 · .t-h3 · grupo body-sm ·
│ │   Pectoral · [BARRA] 36 KG × 8   │ │  chip carga mono + último dato
│ └──────────────────────────────────┘ │
│ ┌ AÑADIR 2 EJERCICIOS ─────────────┐ │  CTA fijo volt (selección múltiple)
```

- Seleccionado: `[+]` pasa a casilla volt con check. En modo consulta, chevron → detalle.
- Fotos: no. Marca geométrica en lecho, como decidido en v1.

### 3.8 Detalle de ejercicio (apilada)

- Barra ← «EJERCICIO». Nombre `.t-h1` + chips grupo/carga. Dos tarjetas de métrica: MEJOR E1RM y
  MEJOR PESO (`.t-metric`). Tarjeta gráfica e1RM. Tarjeta «RÉCORDS POR REPS» filas mono. Tarjeta
  «HISTÓRICO» filas fecha + series mono. Tarjeta «DATOS»: incremento con stepper, notas en lecho.

### 3.9 Sesión pasada (apilada)

- Barra ← fecha larga, acción «Editar/Hecho». Hero: tag «HECHA · 12/12 SERIES», nombre `.t-display`,
  fila DURACIÓN / EJERCICIOS / VOLUMEN. Tarjetas de ejercicio en modo lectura (tabla sin bloque
  activo); en edición se comportan como en Hoy. Notas. «REPETIR ESTA SESIÓN» secundario; en edición:
  fecha en lecho + «Borrar sesión» ghost→alert.

### 3.10 Resumen (apilada)

```
│ ← RESUMEN DE SESIÓN                  │
│ [● 12/12 SERIES]        REGISTRO #042│  adherencia real · nº de sesión terminada
│ SESIÓN                               │  .t-display
│ COMPLETADA                           │
│ Pecho & Hombro · Hoy, 10:48          │  .t-body-sm soft (sin serif ni cursiva)
│ ┌─────────────┐┌─────────────┐       │  bento 2×2 .t-metric-xl
│ │DURACIÓN   ◷ ││VOLUMEN    ⤢ │       │
│ │ 54 MIN      ││ 9.840 KG    │       │  Δ vs sesión anterior de la misma rutina
│ └─────────────┘└─────────────┘       │  (dato real, chip volt-tint si sube)
│ │SERIES     ✓✓││EJERCICIOS   │       │
│ │ 12 / 12     ││ 4           │       │
│ ┌──────────────────────────────────┐ │  SOLO si hay PRs
│ │ [🏆] 2 HITOS · Nuevos récords    │ │
│ │ Press banca  e1RM 92,5 · antes 90│ │  [+2,5 KG] chip volt
│ └──────────────────────────────────┘ │
│ DESGLOSE                    4 BLOQUES│
│ ┌ BLOQUE 01 · PECTORAL ────────────┐ │  numeración: aquí sí es secuencia real
│ │ Press de banca           3 SERIES│ │
│ │ [SET 1 85×10][SET 2 90×8][SET 3 92,5×9 ★]│ chips mono, PR en volt-tint
│ │ Volumen 2.372 kg                 │ │
│ ┌ ¿CÓMO FUE? ──────────────────────┐ │
│ │ [1][2][3][4][5]   notas en lecho │ │  1–5 (spec), elegida volt
│ ┌ GUARDAR COMO PLANTILLA ──────────┐ │  solo sesión improvisada
│ [ CERRAR ]                           │  volt. «Guardar en calendario» de la maqueta
│ Terminé sin querer: reabrir          │  miente (ya está guardado): «CERRAR».
```

- «RPE medio», «recuperación 48 h» y «RPE global 1-10»: fuera. Valoración 1–5 según spec §4.8.

### 3.11 Ajustes (apilada)

- Barra ← «AJUSTES». Cabecera: «PARÁMETROS» `.t-label` + «Ajustes» `.t-h1` + chip versión (de
  `package.json`). Secciones con punto volt + `.t-label`:
  - **APARIENCIA** (nuevo): segmentado SISTEMA / OSCURO / CLARO → `settings.theme`, aplicado en
    `<html data-theme>` y replicado en `localStorage` para pintar sin parpadeo antes de Dexie.
  - **UNIDAD DE PESO:** dos botones grandes 64px, activo volt con check.
  - **INCREMENTOS POR DEFECTO:** tarjeta con filas icono-en-lecho + nombre + descripción + stepper.
  - **PESO CORPORAL Y AVISOS:** filas con icono, título, subtítulo, chip de hora (input `time`
    estilizado) y toggle volt. Bloque de estado del push como ahora, en `.t-caption`.
  - **DATOS Y COPIA:** «Copia en el servidor · última: ayer 23:40», «SINCRONIZAR AHORA» secundario,
    «EXPORTAR» / «IMPORTAR» a media anchura.
- Sin pie «Nordic Athletic Precision · Engine 8.4»: decoración.

---

## 4. Auditoría del plan (paso 2 del proceso)

Brief genérico equivalente: «app de gimnasio en modo oscuro con acento neón, tarjetas, iconos y
cifras en mono». Un modelo llega solo a: fondo negro puro, acento verde-neón en todo, tarjetas con
sombra difusa, Inter, glassmorphism en la barra. Lo que aquí es decisión y no default:

1. **El volt es un solo color y significa una sola cosa** (acción primaria / hecho / dato vivo).
   No colorea títulos ni iconos decorativos. En la maqueta hay volt en más sitios (fila de estado,
   iconos de sección, «ÚLTIMO»): se recorta a los cuatro usos anteriores. Quitado un adorno.
2. **La ruptura de escala se conserva y se traslada**: antes era la fila de 64px; ahora es el bloque
   de serie activa con cifra a 40px y steppers de 48. El resto de la tabla es compacta (56px).
   Es la única audacia y todo lo demás calla.
3. **Ningún dato inventado.** Cada hueco de la maqueta se ha mapeado a un dato de la base o se ha
   quitado (racha, recuperación, RPE, velocidad, sueño, mesociclo, meta de peso).
4. **Sombras:** solo la micro-sombra del modo claro definida en el DESIGN; en oscuro ninguna. El halo
   volt existe únicamente en el bloque/tarjeta activa.
5. **Degradados:** un solo uso, el relleno bajo la línea de datos. No en fondos ni botones.
6. **Blur:** no. La barra superior es opaca con hairline.
7. **Serif itálica del subtítulo del resumen** (maqueta): fuera. Tres familias, ni una más.
8. **Mayúsculas con tracking** ahora son parte del sistema (etiquetas mono `.t-label`), pero solo
   como etiqueta de sección y de botón, nunca como texto corrido.

---

## 5. Cambios de documentación

- `DESIGN.md` → **v2.0** reescrito entero: brief, color (dos modos), tipografía, estructura, componentes,
  movimiento, escritura, lista negra actualizada (sale «mayúsculas con tracking», «mono para etiquetas»,
  «box-shadow» pasa a «solo la micro-sombra del claro»; entra «material fotográfico», «serif», «blur»,
  «volt fuera de sus cuatro usos»), suelo de calidad, decisiones abiertas (ninguna), changelog.
- `especificaciones-app-entrenamiento.md` §4.2: nueva tabla de zonas de la fila de serie; el `−` vuelve.
  §4.9: añade «Apariencia». §3.7: `settings.theme`.
- `CLAUDE.md`: la frase «la ruptura de escala al registrar series» sigue siendo cierta; se actualiza la
  referencia a texturas.
- `docs/mockups.html` se sustituye por las capturas de Stitch en `docs/stitch/` (referencia).

## 6. Orden de construcción y verificación

1. Fuentes (descarga latin WOFF2, `fonts.css`), tokens, `type.css`, `base.css`, `Icon.tsx`, tema
   (`settings.theme` + `<html data-theme>` + `theme-color`).
2. Shell: `TopBar`, `BottomNav`, layouts, botones, tarjetas, chips, segmentado, toggle, inputs.
3. Hoy + tarjeta de ejercicio + fila de serie (la pantalla que decide). Captura a 380 y 320, oscuro y claro.
4. Calendario, Progreso, Rutinas. Capturas.
5. Apiladas: editor, catálogo, detalle, sesión pasada, resumen, ajustes. Capturas.
6. Iconos PWA regenerados (`scripts/icons.mjs`: fondo `#121315`, barra en volt), manifest
   `theme_color`/`background_color`, `index.html`.
7. Borrado de texturas, MaterialHeader, fuentes viejas, CSS muerto. `tsc -b`, `oxlint`, `npm run build`.
8. `scripts/shots.mjs` ampliado con `?theme=light` y captura de la sesión en curso; revisión de cada
   captura contra la lista negra v2.0 antes de enseñarlas.
9. DESIGN.md v2.0 y spec actualizados. Commit.
