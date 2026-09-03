# Plan v2.1 — el flujo completo de las maquetas

Complementa `rediseno-v2-plan.md` (aspecto, ya implementado). Este plan cubre **todo lo que las 8
pantallas de Stitch hacen y la app aún no**. Decisiones de Pablo (2026-09-03):

1. Velocidad, recuperación y sueño: **la interfaz existe tal cual, sin datos por ahora** («—» / «Sin datos»).
   Excepción: la recuperación se puede estimar con datos reales (horas desde la última sesión frente a la
   ventana que fija su RPE), y así se hace; queda etiquetada «estimada».
2. **RPE sustituye a RIR.** Migración: `rpe = 10 − rir`.
3. **Fotos:** hueco previsto (`exercise.image`); Pablo las pasará después. Mientras, marca geométrica.
4. **Ciclo con bloques configurables.**

---

## 1. Modelo de datos (Dexie v2, migración automática)

| Tabla | Cambio |
|---|---|
| `sets` | `rir` → **`rpe: number \| null`** (6–10, paso 0,5). Nuevo `velocity: number \| null` (m/s, sin entrada por ahora). |
| `routine_exercises`, `session_exercises` | Nuevos `target_rpe: number \| null` y **`rest_seconds: number`** (por defecto `settings.default_rest_seconds`). El temporizador vuelve; la decisión v1.6 de borrarlo se revierte. |
| `sessions` | `rating` pasa a **RPE global 1–10** (los 1–5 existentes se multiplican por 2). Nuevos `paused_at: number \| null`, `paused_ms: number`. |
| `exercises` | Nuevo `image: string \| null` (clave del asset empaquetado). |
| `body_metrics` | Nuevos `sleep_hours: number \| null`, `recovery: number \| null` (sin entrada; preparados). |
| `settings` | Nuevos `body_weight_goal`, `default_rest_seconds` (90), `bar_weight` (20), `plates` (`[25,20,15,10,5,2.5,1.25]`). |
| **`cycles`** (nueva) | `id, user_id, name, goal, start_date, archived`. Un ciclo activo como máximo. |
| **`cycle_blocks`** (nueva) | `id, cycle_id, position, name, weeks, goal` (`fuerza` · `volumen` · `hipertrofia` · `descarga`). |
| **`schedule_overrides`** (nueva) | `id, user_id, routine_id, from_date, to_date \| null`. Reasigna un día programado a otra fecha (o lo anula). |

Derivados del ciclo: semana actual = `floor(días desde start_date / 7) + 1`; bloque actual por semanas
acumuladas; microciclo = semana dentro del bloque. «3/4 completadas» = sesiones hechas esta semana
frente a programadas. **Racha** = días programados consecutivos cumplidos hasta hoy (contando reasignados).

Backup: snapshot `version: 2` con las tres tablas nuevas; el import acepta v1 y le aplica la misma migración.
Demo (`?demo=1`): ciclo de 3 bloques, RPE en las series, un día reasignado.

---

## 2. Pantallas: lo que falta y de dónde sale el dato

### Hoy
- **Chips:** `RACHA N DÍAS` (real) · `SEMANA x/y` (real) · `RECUPERACIÓN N%` (estimada: horas desde la última sesión terminada / ventana según su RPE global; sin sesiones → «—»).
- **Hero:** «~N min estimados» = media de duración de las sesiones terminadas de esa rutina (sin histórico: 4 min × series). Subtítulo «Sesión programada para hoy · Enfoque {objetivo del bloque}». En curso: «SESIÓN EN CURSO» + botón **Continuar** → `/entrenar`.
- **Tarjeta de contexto** (solo con ciclo activo): imagen de la rutina o marca, `MESOCICLO {nombre}`, «Bloque N · Microciclo M», «{series} series · {objetivo}». Sin ciclo: fila «Sin ciclo activo · Crear» → `/ciclo`.
- **Peso corporal** como la maqueta: chip «Pesaje completado», cifra + delta «vs ayer», sparkline **7 días con etiquetas L…Hoy**, línea discontinua de la meta si existe, pie «Tendencia … (±x kg este mes)».
- **Entreno de hoy:** cabecera con anillo; filas con marca, nombre, «3 series · 8-10 reps», y a la derecha el **objetivo** («92,5 kg · Objetivo», de la última vez) ; botón «Ver desglose técnico y calentamiento» → `/entrenar` en modo previa. Las filas ya no despliegan la tabla aquí: la tabla vive en la sesión en vivo.
- **Descanso nocturno:** tarjeta con «— · Sin datos» y chip «Sin datos» (interfaz lista, sin entrada).

### Sesión en vivo — `/entrenar` (nueva pantalla apilada, esconde la barra inferior)
- Barra: ← y «SESIÓN ACTIVA».
- **Banner:** «SESIÓN EN CURSO» con punto, **pausa** (congela el cronómetro: `paused_at`/`paused_ms`) y ⋮ (añadir ejercicio · notas y RPE · descartar sesión). Nombre en display, «Semana N · {bloque}» del ciclo, cronómetro, «PROGRESO TOTAL · 7/12 SERIES (58%)» con barra.
- **Temporizador de descanso:** aparece al completar una serie con `rest_seconds` del ejercicio; anillo volt, «DESCANSO SUGERIDO · RPE {meta}», `mm:ss restantes`, **+30 s** y **Saltar**; al llegar a 0 vibra si el dispositivo puede y el widget se apaga. Sin sonido.
- **Tarjeta del ejercicio activo:** «SERIE PRINCIPAL · i de N ejercicios», nombre, «{equipo} · {n} series de trabajo · Descanso {m} min», icono de regla → **calculadora de discos** (hoja inferior: barra, discos por lado para la carga actual, con los discos de Ajustes). Chips **Target** (última carga × rango), **RPE meta**, **Ant.** Tabla de series con la serie en curso (steppers) + stepper de **RPE** (0,5) en el bloque activo. Pie: pill «Calculadora de discos (36,25 kg / lado)» y «Añadir serie».
- **Siguiente en cola:** tarjeta con el próximo ejercicio, «Carga proyectada: {última carga} · RPE {meta}» y botón **intercambiar** (lo pone en primer lugar). Debajo, la cola con asa de arrastre (reordenar).
- Botones: «Añadir ejercicio», «Notas / RPE» (hoja: notas de sesión + RPE global 1–10), «Finalizar entrenamiento» → resumen.
- Un ejercicio se marca completado cuando todas sus series están hechas y la cola avanza sola.

### Resumen
- Chip «{done}/{planned} series · 100% adherencia», «REGISTRO #n».
- Rejilla 2×2: **Duración** (+ «Descansos: ~N s», media real entre series), **Volumen** (+ delta vs sesión anterior de la rutina), **Series válidas** x/y (+ «N ejercicios»), **RPE medio** /10 con banda («Suave» <7,5 · «Intensidad óptima» 7,5–9 · «Al límite» >9).
- PRs (ya hecho) con el tipo de récord («+1 rep récord» · «Carga máxima»).
- Desglose: chips `SET n · 85×10 · RPE 7,5`; pie «Volumen acumulado» y «Velocidad pico: —».
- **Recuperación estimada:** «Ventana de {24|48|72} horas» según RPE medio, frase con la próxima sesión programada de esa rutina, anillo con el % transcurrido (0% recién terminada; en Hoy se ve crecer).
- **Sensaciones:** «Esfuerzo percibido (RPE global)» 1–10 + «Notas de biomecánica y estado físico».
- Botón «Guardar en calendario y cerrar» y pie «SINCRONIZACIÓN AUTOMÁTICA» que refleja el estado real de la copia (`uploadBackup`).

### Rutinas
- Fila «CICLO ACTIVO · SEMANA N» / «x/y COMPLETADAS» (sin ciclo: «SIN CICLO · CREAR» → `/ciclo`).
- Subtítulo «{n} bloques calibrados para {objetivo del ciclo}».
- Tarjeta por rutina con **estado**: `TOCA HOY` · `HECHA HOY` · `COMPLETADO AYER` · `PRÓXIMO {día}` · `EN CICLO ACTUAL`; días; nombre; «{n} ejercicios · {foco}»; imagen o marca.
  - Toca hoy: tiles **Volumen** (proyectado desde la última vez), **Series**, **Est. min**; «Iniciar sesión» + ⋮.
  - Completado ayer / hecha: fila «PR {ejercicio}: {kg}» o mejor serie + «RPE x»; «Ver resumen» + ▶.
  - Resto: «Editar bloque» o «Detalles» + ▶.
- «Sesión vacía / Freestyle», «Ajustes de entrenamiento y equipo».

### Ciclo — `/ciclo` (nueva pantalla apilada)
Nombre, objetivo, fecha de inicio, y lista de **bloques** (nombre, semanas, objetivo) reordenable con «Añadir bloque». Cabecera con «Semana N de M · Bloque {nombre}». Archivar ciclo. Enlace desde Rutinas y Ajustes.

### Calendario
- Días programados sin hacer (pasado): tarjeta «Sesión sin hacer · {fecha}» con **«Reasignar día»** (selector de fecha → `schedule_overrides`). El día reasignado aparece como programado y la tarjeta pasa a «Sesión pospuesta · Reasignada al {fecha}».
- Detalle de sesión: «Ver resumen de cargas y RPE» → `/resumen/:id`.

### Progreso
- Peso corporal: **Meta** (`body_weight_goal`) con línea discontinua «86,0 OBJ» y chip delta contra el inicio del rango; etiquetas «01 JUN (90,1) · … · HOY (88,7)».
- Sobrecarga: chip de **grupo muscular** junto al selector («ISQUIO»), «Carga efectiva (últimas series)» = mejor serie de las tres últimas sesiones (real) con «+x% este mes», «PR ACTUAL · RPE {rpe de esa serie}» y «Vel. media propulsiva — (sin datos)».

### Biblioteca
- Hueco de **foto** por ejercicio (`image`) con la marca como respaldo; «Recientes en tu ciclo · últimos 7 días»; filas con chip de equipo y última serie «36 kg × 8 reps» (real).

### Ajustes
- Nuevos bloques: **Ciclo** (enlace), **Meta de peso**, **Descanso por defecto**, **Barra y discos** (para la calculadora). Pie «Entrenamiento v2 · local-first».

### Detalle de ejercicio
- RPE meta y descanso por defecto del ejercicio; hueco de foto.

---

## 3. Especificaciones que cambian

- §3.2 / §3.4 / §3.5: campos nuevos; `rest_seconds` **vuelve**; `rir` → `rpe`.
- §3.8 nuevo: ciclos y bloques. §3.9: reasignaciones.
- §4.1 Hoy: chips, contexto de ciclo, tarjeta de sueño.
- §4.2 Entrenando: pantalla propia `/entrenar`, temporizador de descanso (revierte «descartado»), pausa, RPE, cola y calculadora.
- §4.3: reasignar día. §4.4: estados de tarjeta y ciclo. §4.7: meta de peso. §4.8: RPE medio, recuperación estimada, RPE global. §4.9: nuevos ajustes. §4.11 nueva: Ciclo.
- §7 fuera de alcance: velocidad y sueño pasan a «interfaz preparada, sin fuente de datos».

## 4. Orden de construcción

1. Modelo + migración + backup v2 + demo.
2. `/entrenar` completo (temporizador, pausa, RPE, cola, calculadora). Es la pantalla que decide.
3. Hoy, Resumen. 4. Ciclo + Rutinas. 5. Calendario (reasignar), Progreso (meta, grupo, carga efectiva), Biblioteca, Ajustes, Detalle.
6. Capturas a 380/320 en los dos modos, incluidas `/entrenar` y `/ciclo`. `tsc`, `oxlint`, `build`.
7. DESIGN.md v2.1 y spec.
