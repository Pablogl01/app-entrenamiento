# App de registro de entrenamiento — Especificaciones

**Versión:** 1.2 (alineado con DESIGN.md v1.6)
**Fecha:** septiembre 2026
**Plataforma:** PWA (React + TypeScript), local-first, con backend mínimo para notificaciones
**Alcance:** uso personal, un usuario

---

## 1. Objetivo

Registrar entrenamientos y peso corporal con el mínimo esfuerzo posible durante la sesión, y responder a dos preguntas concretas:

- ¿Mi peso corporal sube o baja, y a qué ritmo real?
- ¿Estoy progresando en cada ejercicio o estoy estancado?

Todo lo demás es secundario.

## 2. Principios de diseño

1. **Registrar una serie que repite lo anterior = un toque.** Es la métrica de éxito de la interfaz. Si se pierde, la app se abandona.
2. **La fuente de verdad del entrenamiento es local.** En el gimnasio no hay cobertura. Nada del flujo de entrenar depende de la red.
3. **Las plantillas y las sesiones son cosas distintas.** Una sesión es un *snapshot*, no una referencia viva a la plantilla.
4. **Las sesiones futuras no existen en la base de datos.** Lo programado es una proyección calculada.
5. **La app da conclusiones, no solo gráficas.** "Press militar plano desde hace 5 semanas" vale más que un `<canvas>`.
6. **El backend es un notificador y un backup, no un servidor de datos.**

---

## 3. Modelo de datos (cliente / IndexedDB)

### 3.1 `exercises` — catálogo

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | |
| `name` | string | |
| `muscle_group` | enum | pecho, espalda, hombro, bíceps, tríceps, cuádriceps, femoral, glúteo, gemelo, core |
| `load_type` | enum | `barbell`, `dumbbell`, `machine`, `cable`, `bodyweight` |
| `min_increment` | number | 2.5 en barra, 2 en mancuernas, etc. Alimenta los botones `+`/`−` |
| `unit_mode` | enum | `weight_reps` (por defecto), `reps_only`, `time` |
| `notes` | text | Notas propias: "agarre a 75 cm", "asiento en el 4" |
| `is_custom` | bool | Distingue los precargados de los creados por el usuario |
| `archived` | bool | Nunca se borra un ejercicio con histórico |

Se precarga con **50-80 ejercicios comunes**. Una app vacía es inservible.

### 3.2 `routines` y `routine_exercises` — plantillas

`routines`: `id`, `name`, `routine_type`, `notes`, `created_at`, `archived`

**`routine_type`** (`strength` · `mobility` · `null`) es el campo del que cuelga todo el sistema de material de DESIGN.md §2. Selección manual al crear la plantilla, en la cabecera del propio editor: no se infiere de los grupos musculares, porque falla justo en los casos raros y el usuario sabe qué es cada rutina.

`routine_exercises`:

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | |
| `routine_id` | uuid | |
| `exercise_id` | uuid | |
| `position` | int | Orden, reordenable arrastrando |
| `target_sets` | int | |
| `target_reps_min` / `target_reps_max` | int | Rango, p.ej. 8-10 |

`rest_seconds` se borró del modelo en la v1.2: el temporizador de descanso se descartó y ninguna pantalla lo consumía (DESIGN.md §9, cerrada en v1.6).

**Decisión: la plantilla no guarda peso objetivo.** El peso lo decide el histórico. Guardarlo aquí crea dos fuentes de verdad y la plantilla envejece mal.

### 3.3 `routine_schedules` — programación semanal

`id`, `routine_id`, `weekday` (0-6)

**Decisión: tabla aparte, no un campo `weekday` en `routines`.** Permite la misma rutina en lunes *y* jueves sin migrar nada, y cuesta lo mismo hoy.

### 3.4 `sessions` y `session_exercises` — el snapshot

`sessions`:

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | |
| `date` | date local | |
| `started_at` / `finished_at` | timestamp | Duración |
| `routine_id` | uuid nullable | Solo procedencia. No se consulta para renderizar |
| `routine_name_snapshot` | string | Nombre en el momento de hacerla |
| `notes` | text | |
| `rating` | int 1-5 nullable | Cómo fue la sesión |

`session_exercises` replica la estructura de `routine_exercises` (`exercise_id`, `position`, `target_sets`, `target_reps_*`) **copiada en el momento de crear la sesión**.

> **Por qué el snapshot:** si la sesión apunta en vivo a la plantilla, editar la plantilla en marzo corrompe el histórico de enero. Con snapshot, editar una plantilla actualiza automáticamente todas las proyecciones futuras y deja el pasado intacto. Sale gratis.

### 3.5 `sets` — la unidad atómica

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | |
| `session_exercise_id` | uuid | |
| `set_index` | int | |
| `weight` | number nullable | |
| `reps` | int | |
| `rir` | int nullable | Oculto tras toque largo o ajuste |
| `kind` | enum | `warmup`, `work`, `failure` |
| `completed` | bool | |
| `logged_at` | timestamp | |

**`kind` es imprescindible.** Sin separar calentamiento, el volumen y los PRs salen sucios.

### 3.6 `body_metrics`

`id`, `date` (único), `weight`, `notes`

Tabla independiente: el pesaje ocurre por la mañana, no en el gimnasio, y no pertenece a ninguna sesión. Genérica desde el principio para poder añadir cintura o % de grasa sin migrar.

### 3.7 `settings` y `outbox`

`settings`: fila única con unidades, incrementos por defecto y preferencias de aviso.

`outbox`: cola de hechos pendientes de enviar al servidor (ver §6.2), con reintento.

---

## 4. Vistas

Navegación: **`Hoy` · `Calendario` · `Progreso` · `Rutinas`**

El catálogo de ejercicios no tiene pestaña propia: vive dentro de Rutinas al añadir ejercicios y dentro de Progreso al consultar evolución.

### 4.1 Hoy

Sirve a dos momentos muy distintos del día.

**Mañana:** input de peso arriba, ya enfocado, con el valor de ayer como placeholder. Debajo, un sparkline de las últimas semanas con la media móvil. Sin navegar a ningún sitio.

**Tarde:** la lista de ejercicios de hoy, abierta, con el botón "Empezar sesión" al final. No hay tarjeta de arranque intermedia: Hoy y Entrenando son la misma pantalla.

**Los dos momentos son dos bloques y siempre están los dos.** El que corresponde a la hora está abierto y el otro es una fila plegada con su dato; tocarla cambia el contexto. No hay conmutador como control. A las 15:00, sin pesaje ni entreno hechos, manda el entreno.

**Día sin rutina programada: solo el bloque de peso.** Sin selector de plantillas. Una sesión improvisada arranca desde Rutinas.

### 4.2 Entrenando

La pantalla que decide si la app sobrevive.

**Estructura:** scroll vertical, una tarjeta por ejercicio. La actual expandida, el resto colapsadas mostrando nombre y `4×8-10`. Se descarta el patrón "un ejercicio a la vez con swipe" porque en el gimnasio el orden salta constantemente (máquina ocupada, se va a otra cosa, vuelve). Ver la lista completa permite decidir. Incluye reordenar arrastrando y saltar ejercicio.

**Filas de series:** cada serie aparece prellenada en gris con lo de la última vez (`60 kg × 10`). La fila tiene tres zonas:

| Zona | Gesto | Qué hace |
|---|---|---|
| Columna del número de serie | toque | Confirma la serie tal cual |
| Cifras de peso y reps | toque | Abre el teclado numérico |
| `+` (48px) | toque | Sube el peso un `min_increment` |

Confirmar una serie que repite lo anterior sigue siendo **un toque**. No hay botón `−`: con teclado en la cifra bajar peso ya tiene camino, y a 320px no caben dos botones de 48px más una zona de confirmar usable. Una fila ya confirmada no responde al toque.

**Calentamiento:** botón para añadir series marcadas como tal, visualmente apagadas. No cuentan para volumen ni PRs.

**Temporizador de descanso: descartado.** No hay barra de descanso, y confirmar una serie no arranca ninguna cuenta. De ahí que `rest_seconds` haya quedado huérfano (§3.2).

**Inicio de sesión:** la sesión empieza **al pulsar el botón**. Las series que se rellenen antes son borrador y el botón sigue diciendo "Empezar sesión" hasta que se pulsa.

**Añadir ejercicio:** abre el catálogo (§4.5). Disponible siempre, también en sesiones que vienen de plantilla.

### 4.3 Calendario

Absorbe lo que sería el historial. Vista mensual con punto por día, más lista cronológica debajo.

**Tres estados visualmente distintos:**

| Estado | Aspecto |
|---|---|
| Hecha | Punto sólido + nombre de la rutina |
| Programada (hoy o futuro) | Contorno punteado, apagado |
| Programada y no hecha (pasado) | Gris muy claro |

El último caso importa: se van a saltar días, y una app que llena el calendario de rojo se vuelve desagradable. Que se note el hueco sin regañar.

Debe tolerar la vida real: hacer UpperBody un jueves porque el lunes no se pudo, mover una sesión arrastrándola, dos sesiones el mismo día.

**Sesión pasada:** al abrir un día, la misma vista de Entrenando en modo lectura con botón de editar. Corregir, borrar y añadir series es obligatorio — se olvidan cosas, y si no se pueden arreglar el histórico se vuelve basura y se deja de confiar en él. Incluye **"repetir esta sesión"**, que crea una nueva hoy copiando ejercicios y pesos.

### 4.4 Rutinas

**Lista:** tarjetas con nombre, nº de ejercicios, días asignados y última vez realizada. Ese último dato delata las plantillas zombis.

**Editor:** lista reordenable. Cuatro campos por siete ejercicios es ilegible en móvil, así que cada fila se muestra colapsada como `Press banca — 4×8-10` —sin tiempo de descanso, que ya no existe— y despliega controles al tocarla. Se edita una a la vez, que es lo que se hace en realidad. `+` fijo abajo que abre el catálogo.

Al editar una plantilla, las sesiones ya hechas no cambian (son snapshots). **Hay que decírselo al usuario en algún sitio** o parecerá un bug.

### 4.5 Catálogo de ejercicios

Misma vista desde el editor de plantilla y desde una sesión. Por orden de importancia:

1. **Buscador arriba, enfocado.** El 80 % de los usos.
2. **Recientes.** Casi siempre se mete algo ya hecho.
3. Filtro por grupo muscular para explorar.
4. **"Crear ejercicio nuevo"** dentro del propio buscador cuando no hay resultados. El catálogo nunca estará completo y no se debe salir del flujo para arreglarlo.

### 4.6 Detalle de ejercicio

Alcanzable desde tres sitios (catálogo, progreso, nombre durante la sesión) y en los tres se busca lo mismo: **cuánto levanté la última vez y hacia dónde voy.**

- Gráfica de e1RM en el tiempo.
- Récords: mejor e1RM, mejor peso, mejor serie por reps (`5 reps: 80 kg`, `10 reps: 65 kg`).
- Histórico plano de sesiones con sus series. Es lo que se consulta al dudar del peso de hoy.
- Datos del ejercicio y **notas propias** (de lo más útil que va a tener la app).

### 4.7 Progreso

**Peso corporal:** puntos diarios en gris fino, media de 7 días en trazo grueso, y un número grande con la tendencia en **kg/semana**. Ese número es la respuesta a la pregunta real.

**Por ejercicio:** selector, e1RM en el tiempo, volumen por sesión, tabla de mejores series.

**Feed de veredictos** encima de todo, en texto: "Press militar: e1RM plano desde hace 5 semanas", "Sentadilla: +4 % este mes". Que la app dé la conclusión en lugar de obligar a interpretar una gráfica es la diferencia con las otras cincuenta apps.

**Línea de seguimiento previsto:** la gráfica de e1RM prolonga la regresión de §5.3 en trazo discontinuo, solo con 4 puntos o más. Cuando hay estancamiento sale horizontal, así que el dibujo y el veredicto dicen lo mismo.

**Sesiones por semana:** barras de sesiones hechas con una única línea de objetivo. Añadido en diseño, no estaba en la v1.0. Sin rojo y sin porcentaje: cada gráfica lleva su frase encima para que la app siga dando conclusiones y no solo trazos.

### 4.8 Resumen post-sesión

Pantalla de recompensa y última oportunidad de capturar contexto mientras se recuerda: duración, volumen total, **PRs del día destacados**, notas libres y valoración rápida (1-5 o caras).

La valoración cuesta un toque y meses después explica los estancamientos mejor que cualquier gráfica: dos semanas planas coincidiendo con sesiones marcadas como malas suele ser sueño o comida, no programación.

### 4.9 Ajustes

Parece relleno y contiene decisiones transversales:

- **Unidades** (kg/lb) e **incrementos por defecto**. Atraviesan cada input de peso, deben existir el día uno.
- **Peso corporal:** unidad y si Hoy lo pide.
- **Notificaciones** (§6.4).
- **Exportar / backup** (§6.5).

### 4.10 Primer arranque

Catálogo precargado, y luego un camino corto: crear la primera plantilla o empezar a entrenar. Sin tour ni pantallas de bienvenida.

---

## 5. Métricas y cálculos

### 5.1 Peso corporal

El dato diario es ruido: **±1-1,5 kg** por agua, glucógeno y hora de la última comida. No se muestra como conclusión.

- **Media móvil de 7 días** (trailing) sobre los pesajes disponibles.
- **Tendencia:** regresión lineal sobre la media móvil de las últimas 2-4 semanas, expresada en **kg/semana**.
- Tolerar huecos: no todos los días hay pesaje.

### 5.2 Progreso por ejercicio

No se usa el peso máximo, se usa el **1RM estimado**:

```
e1RM = peso × (1 + reps / 30)      // Epley
```

- Solo sobre series con `kind = 'work'`.
- Fiable hasta ~12 reps; por encima, Epley se degrada y conviene marcarlo o excluirlo.
- Por sesión se toma el **mejor e1RM** de las series de trabajo.

**Volumen por sesión:** `Σ (peso × reps)` sobre series de trabajo.

### 5.3 Detección de estancamiento

Regresión lineal sobre el mejor e1RM por sesión, ventana de las **últimas 4-6 sesiones** (mínimo 4 puntos, si no, no se emite veredicto).

Si la pendiente proyectada sobre la ventana implica un cambio por debajo de un umbral (orden de ~1 %), se emite el veredicto de estancamiento. El mismo cálculo sobre volumen sirve de señal secundaria.

> Umbral y tamaño de ventana quedan **pendientes de calibrar** con datos reales. Empezar conservador: es mejor no decir nada que dar falsas alarmas.

---

## 6. Notificaciones y backend

### 6.1 Restricción de plataforma (verificada, septiembre 2026)

**Lo que funciona:** las notificaciones nativas del sistema desde una PWA existen y se comportan como las de una app nativa — pantalla de bloqueo, centro de notificaciones, Apple Watch, badge en el icono.

**Requisitos en iOS:**
- Solo funcionan si la PWA está **instalada** vía Compartir → Añadir a pantalla de inicio. Una pestaña de Safari no cuenta.
- El permiso debe pedirse desde una **interacción del usuario** (botón "activar avisos"), nunca al abrir.
- Safari enruta los pushes por APNs, pero eso lo gestiona el navegador.
- **UE:** Apple planeó eliminar las web apps de pantalla de inicio en 2024 y rectificó. Siguen soportadas. (Circulan artículos recientes que dicen lo contrario porque se quedaron con el anuncio original.)

**Lo que no existe:** no se puede programar una notificación local sin servidor.

- La API que hacía exactamente eso (*Notification Triggers*, `showTrigger` + `TimestampTrigger`) fue **abandonada por Google** y nunca salió de fase experimental.
- Un `setTimeout` en el service worker no sirve: el navegador lo mata al cerrar la app.
- iOS no soporta Background Sync, Periodic Background Sync ni Background Fetch para PWAs, sin fecha prevista. No hay forma de despertarse a comprobar la hora.

**Conclusión:** aviso a hora concreta ⇒ Web Push con servidor. Decisión tomada: se construye el backend.

### 6.2 Alcance del backend

Solo lo necesario para decidir si mandar un aviso. **El registro de series nunca pasa por la API.**

| Tabla | Contenido |
|---|---|
| `users` | `id`, `token_hash`, `timezone` (IANA), `created_at` |
| `push_subscriptions` | `endpoint` (único), `p256dh`, `auth`, `last_seen_at` |
| `notification_prefs` | `type`, `enabled`, `local_time`, `only_scheduled_days` |
| `weekly_schedule` | `weekday`, `routine_name` |
| `daily_facts` | `local_date`, `weighed_in`, `trained` |
| `notification_log` | `(user_id, type, local_date)` **único** |
| `backups` | `created_at`, `blob` |

**Hechos del día:** al registrar peso o cerrar sesión, el cliente hace un POST diminuto `{fecha, tipo}`, fire-and-forget con cola de reintento local (`outbox`). No es sincronización — son solo los hechos que el notificador necesita para no dar la lata. Superficie total: ~4 endpoints.

### 6.3 Cron y envío

Ejecución **cada 15 minutos en UTC**, seleccionando a quien le coincida la hora local.

**Dos requisitos no negociables:**

1. **Zona horaria IANA, no offset.** Con offset guardado, el aviso de las 8:00 pasa a las 9:00 el último domingo de octubre. Bug clásico y silencioso.
2. **Idempotencia.** El cron se ejecutará dos veces alguna vez (reintento, redeploy). `notification_log` con clave `(usuario, tipo, fecha_local)` lo evita. Sin eso, algún día llegan cuatro avisos iguales y se desinstala la propia app.

**Lógica de supresión** (es lo que decide si el aviso es útil o molesto):
- Ya se pesó hoy → no enviar.
- Ya entrenó hoy → no enviar.
- Hoy no había sesión programada → silencio (si `only_scheduled_days`).
- Máximo un aviso por tipo y día. Sin reintentos.

**Gestión de suscripciones muertas** (fallo nº 1 de "las notificaciones dejaron de llegar"):
- Respuesta 404 o 410 del servicio de push → borrar la suscripción. Si no, se acumulan endpoints zombis.
- El cliente comprueba su suscripción al arrancar y la reenvía si el endpoint cambió (se invalidan al reinstalar o limpiar datos).

**Regla de iOS:** `userVisibleOnly: true` es obligatorio. Todo push debe terminar en una notificación visible; si el service worker recibe un push y no muestra nada, el navegador puede revocar el permiso.

**Nota de stack a verificar:** el paquete `web-push` de npm asume el `crypto` de Node y no funciona tal cual en runtimes edge tipo Workers, donde hace falta una alternativa basada en WebCrypto. Con una función Node normal + cron el problema no aparece.

### 6.4 Contenido y ajustes de aviso

Accionable, no informativo:

| Tipo | Cuerpo | Destino del clic |
|---|---|---|
| Peso | "¿Cuánto pesas hoy?" | Input de peso, enfocado |
| Entreno | "Hoy toca UpperBody" | Sesión lista para empezar |

Deep link vía evento `notificationclick` del service worker. **No apoyarse en los botones de acción** de la notificación: soporte irregular en iOS. Cuerpo claro + clic al sitio exacto cubre el caso.

**Ajustes:** dos interruptores (peso: activar + hora; entreno: activar + hora + solo días programados). Encima, un **bloque de estado sincero**:

- Si la app no está instalada en pantalla de inicio → decirlo y explicar cómo. En iOS es el fallo silencioso que deja sin avisos sin explicación.
- Si el permiso está denegado a nivel de sistema → la app no puede volver a pedirlo; hay que indicar que se vaya a Ajustes de iOS.
- **Botón de aviso de prueba.** Única forma de saber si realmente funciona en ese móvil.

### 6.5 Backup (no sync)

Con backend, mejor que exportar a mano: **subir un snapshot completo** al cerrar sesión o una vez al día. Un blob por usuario, sobrescribiendo o guardando los últimos 7.

Mantener también el **export a JSON manual** en Ajustes: un borrado de datos del navegador se lleva un año de entrenamientos sin avisar, y el botón cuesta media tarde.

**No hacer sync bidireccional.** Resolver conflictos entre dos dispositivos editando la misma sesión es un proyecto entero, y se entrena desde un móvil. El backup unidireccional elimina el único riesgo catastrófico real.

### 6.6 Autenticación

Con un usuario, no construir cuentas: token largo generado en el primer arranque, guardado en local, enviado en cada petición.

**Pero dejar la columna `user_id` en las tablas desde el día uno.** Cambiar el esquema después es molesto, y tener la columna no obliga a construir un login.

---

## 7. Fuera de alcance de la v1

Superseries, dropsets, cardio, fotos de progreso, medidas corporales adicionales, cuentas de usuario, sync multidispositivo, rotación por ciclos (Push/Pull/Legs girando cada N entrenamientos independientemente del día).

Todo ello es añadible sin romper el modelo gracias a tres decisiones tomadas de antemano: el campo `kind` en `sets`, la tabla `body_metrics` genérica, y `routine_schedules` como tabla aparte.

---

## 8. Decisiones pendientes

> Las decisiones de aspecto y de interacción cerradas durante el diseño están en el changelog de `DESIGN.md` (v1.1 a v1.5). Las de abajo son las de comportamiento y stack, que siguen abiertas.

Cerradas en la v1.2 (implementación):

1. **Detector de estancamiento:** implementado conservador — ventana de las últimas 5 sesiones (mínimo 4 puntos), umbral del 1 % de cambio proyectado sobre la ventana. Pendiente solo de calibrar con datos reales.
2. **Runtime del backend:** Node + cron. El paquete `web-push` asume el `crypto` de Node, y con una función Node normal el problema del edge no aparece.
3. **e1RM por encima de 12 reps:** se excluye del cálculo de e1RM (Epley degradado). La serie sigue contando para volumen.
4. **Guardar como plantilla desde una sesión improvisada:** hereda, por ejercicio, el nº de series de trabajo observadas y el rango min–max de reps observado.
