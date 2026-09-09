# 007 — Cuenta de usuario con sesión persistente (access + refresh token)

- **Status**: HECHO y **DESPLEGADO** (2026-09-05, versión `0faec116`): migración remota aplicada, `AUTH_SECRET` subido, hash de producción igual al de `dist/`. Aprobado por Pablo con las cuatro recomendaciones de §6. Commit `d720b19` en `master`.
- **Resultado**: `worker/src/auth.ts` + rutas en `index.ts`, `migrations/001-auth.sql`, `scripts/auth-smoke.sh` (todo OK contra `wrangler dev`); cliente `src/lib/auth.ts`, `apiFetch` con reintento, `views/Cuenta.tsx`, sección Cuenta en Ajustes. PBKDF2 fijado en **50 000** iteraciones (100 000 = ~12 ms en local; el plan gratuito da 10 ms). Verificado con Playwright: registro → recarga mantiene sesión → cookie rotada → cookie borrada = «Sesión caducada» → reentrada → salir. Capturas 380/320, oscuro/claro, sin errores de consola.
- **Severity**: —  (funcionalidad nueva, no corrección)
- **Category**: Backend · Cliente · UI (dos pantallas tocadas)
- **Estimated scope**: worker `schema.sql` + `src/index.ts` (~350 líneas nuevas), cliente `src/lib/auth.ts` (nuevo, ~120), `outbox.ts` (~20), `App.tsx` (~3), `types.ts`/`db.ts` (~4), `Ajustes.tsx` (sección nueva, ~60), `views/Cuenta.tsx` (nueva, ~140), `especificaciones §6.6 y §7`, `DESIGN.md §4 Ajustes + changelog`
- **Depende de**: nada. No toca `server/` (Express): producción es el worker.

## 0. Qué cambia respecto a las especificaciones

`especificaciones §6.6` dice «con un usuario, no construir cuentas» y `§7` lista «cuentas de usuario» fuera de alcance. Este plan las **supersede** por decisión de Pablo (2026-09-05). Lo que **no** cambia:

- Sigue sin sync bidireccional (`§6.5`). La cuenta solo da identidad al notificador y a la copia.
- **Nada del flujo de entrenar depende de la cuenta.** Sin sesión, la app funciona igual que hoy: IndexedDB manda. Solo avisos push y copia en el servidor necesitan estar dentro.
- La columna `user_id` que `§6.6` pedía dejar «desde el día uno» es la que hace posible esto sin migrar datos locales.

Valor real de la cuenta, en orden: (1) avisos y copias que sobreviven a reinstalar la PWA o cambiar de móvil; (2) restaurar la copia en un dispositivo nuevo con solo entrar (fuera de este plan, ver §8); (3) más de un usuario en el mismo worker.

## 1. Cómo se consigue «no tener que iniciar sesión cada vez»

Dos credenciales con vidas distintas, opción 2 de la conversación:

| Credencial | Qué es | Vive | Dónde se guarda | Caduca |
| --- | --- | --- | --- | --- |
| **Access token** | JWT HS256 firmado con `AUTH_SECRET` (`sub`, `iat`, `exp`) | 15 min | **Solo en memoria** del cliente (variable de módulo en `auth.ts`). Nunca en IndexedDB ni localStorage. | Se renueva solo |
| **Refresh token** | 32 bytes aleatorios en base64url; el servidor guarda su SHA-256 | 90 días deslizantes | Cookie `rt`: `HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=7776000` | Al no entrar en 90 días, al salir, o si se detecta reutilización |

Flujo:

1. **Login o registro** → el worker devuelve `{ access_token, user }` en el cuerpo y pone la cookie `rt`.
2. **Cada petición a `/api/*`** lleva `Authorization: Bearer <access>`.
3. **Al arrancar la app** (`App.tsx` boot), antes de `initOutbox()`, el cliente llama `POST /api/auth/refresh` sin cuerpo. La cookie viaja sola (mismo origen). Si responde 200, hay access token nuevo y la sesión «sigue abierta» sin que el usuario haga nada. Si responde 401, la app queda **sin sesión** y lo dice solo en Ajustes.
4. **Si una petición recibe 401** con sesión abierta, `apiFetch` refresca **una vez** y reintenta. Un solo refresh en vuelo aunque haya tres peticiones a la vez (promesa compartida).
5. **Rotación**: cada refresh emite un `rt` nuevo y marca el anterior como `replaced_by`. Si llega un `rt` ya reemplazado → alguien lo copió: se revoca **toda la familia** y se responde 401. El legítimo tendrá que entrar de nuevo; es la señal de robo.

Por qué cookie y no localStorage: un XSS en la PWA se lleva localStorage entero durante 90 días; una cookie `HttpOnly` no la puede leer. Y en iOS, la caducidad de 7 días de ITP afecta al almacenamiento escribible por script, no a una cookie puesta por el servidor en una PWA instalada.

Por qué `Path=/api/auth`: la cookie solo viaja a `login`, `refresh`, `logout`. El resto de la API ni la ve. Menos superficie.

Por qué `SameSite=Strict` funciona aquí: PWA y API salen del mismo worker, mismo origen, sin CORS. En desarrollo Vite proxya `/api` a `localhost:8787`, que es el puerto por defecto de `wrangler dev`, así que también es mismo origen. **Ojo:** para desarrollar la auth hay que arrancar `wrangler dev` en `worker/`, no el Express de `server/`.

## 2. Servidor (worker)

### 2.1 Esquema D1 (`worker/schema.sql`, migración aditiva)

```sql
-- users: pasa de «token anónimo» a «cuenta». token_hash se conserva para las
-- instalaciones anteriores a la cuenta (ver 2.4) y desaparece en una versión futura.
ALTER TABLE users ADD COLUMN email TEXT;               -- minúsculas, UNIQUE por índice
ALTER TABLE users ADD COLUMN password_hash TEXT;       -- PBKDF2-SHA256, base64
ALTER TABLE users ADD COLUMN password_salt TEXT;       -- 16 bytes, base64
ALTER TABLE users ADD COLUMN password_iterations INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS users_email ON users(email);
-- token_hash deja de ser NOT NULL: en SQLite eso exige recrear la tabla; en su
-- lugar los usuarios con cuenta llevan token_hash = 'acct:' || id (único, inútil).

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  family TEXT NOT NULL,            -- una familia por login; la rotación la conserva
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  replaced_by TEXT,                -- id del token que lo sustituyó (detección de reutilización)
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS refresh_tokens_user ON refresh_tokens(user_id);

CREATE TABLE IF NOT EXISTS login_attempts (
  email TEXT PRIMARY KEY,
  failures INTEGER NOT NULL,
  locked_until INTEGER
);
```

### 2.2 Endpoints nuevos (`POST` salvo `me`)

| Ruta | Entrada | Salida | Notas |
| --- | --- | --- | --- |
| `/api/auth/register` | `{ email, password, legacy_token? }` | `201 { access_token, user: { id, email } }` + cookie `rt` | Email normalizado (`trim().toLowerCase()`), contraseña **≥ 10** caracteres (sin más reglas). 409 si el email existe. |
| `/api/auth/login` | `{ email, password, legacy_token? }` | `200 { access_token, user }` + cookie `rt` | 401 genérico «correo o contraseña incorrectos» (no revelar cuál). Bloqueo: 10 fallos → `locked_until = ahora + 15 min` en `login_attempts`; 429 con `Retry-After`. Comparación de hashes en tiempo constante. |
| `/api/auth/refresh` | cookie `rt` | `200 { access_token, user }` + cookie `rt` **nueva** | Rotación + detección de reutilización (§1 paso 5). Actualiza `expires_at` (deslizante). |
| `/api/auth/logout` | cookie `rt` | `204` + cookie `rt` borrada (`Max-Age=0`) | Revoca ese token. No revoca otros dispositivos. |
| `GET /api/auth/me` | Bearer | `200 { id, email, created_at }` | Para la sección Cuenta. |

Los endpoints existentes (`subscription`, `prefs`, `schedule`, `facts`, `backup`, `test`) no cambian de contrato. `authUser()` pasa a: primero intenta verificar el Bearer como JWT; si no es un JWT válido, cae al camino actual `token_hash` (§2.4). `POST /api/register` (el alta anónima) se mantiene por compatibilidad hasta retirar el token anónimo.

### 2.3 Contraseñas en Workers

No hay bcrypt ni argon2 nativos. Se usa **PBKDF2-SHA-256 con WebCrypto** (`crypto.subtle.deriveBits`), sal de 16 bytes por usuario, iteraciones guardadas por fila (para poder subirlas después sin romper las cuentas viejas).

**Restricción verificada** (2026-09-05): Workers limita PBKDF2 a **100 000 iteraciones** como máximo, y el plan gratuito da **10 ms de CPU por petición**; la experiencia publicada sitúa lo viable entre 20 000 y 80 000. OWASP recomienda 600 000 para SHA-256, así que **estamos por debajo del estándar sea cual sea la cifra**. Mitigación honesta: mínimo de 10 caracteres, bloqueo por intentos, y aceptar que un volcado de D1 no es tan resistente como con argon2. Paso 6 de §7 mide el coste real y fija la cifra. Alternativa si Pablo la prefiere: plan de pago de Workers (30 s de CPU) y 100 000 iteraciones sin dudas.

Fuentes: [Web Crypto · Cloudflare Workers docs](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/), [Issue #1346 workerd: 100 000 iterations of PBKDF2 is insecure](https://github.com/cloudflare/workerd/issues/1346), [Hashing passwords on Cloudflare Workers · Jamie Lord](https://lord.technology/2024/02/21/hashing-passwords-on-cloudflare-workers.html), [Configure PBKDF2-iteration cap · Cloudflare Community](https://community.cloudflare.com/t/configure-pbkdf2-iteration-cap/848334).

Secreto nuevo: `wrangler secret put AUTH_SECRET` (32 bytes aleatorios en base64). Se añade a `Env`. Sin él el worker responde 500 en `/api/auth/*` y lo dice en el log.

### 2.4 La instalación actual de Pablo no se pierde

Hoy en producción hay una fila en `users` con el `token_hash` del móvil de Pablo, con sus prefs, su suscripción push, su programación semanal y sus copias. Al crear la cuenta o entrar desde ese móvil, el cliente manda `legacy_token` (el `api_token` de Settings):

- **register** con `legacy_token` cuya fila es anónima (sin `email`): esa **misma fila** se convierte en la cuenta (se le ponen email y hash). Cero movimientos de datos.
- **login** con `legacy_token` desde un móvil anónimo con datos: se **fusionan** en la cuenta (`UPDATE … SET user_id = ?` en `push_subscriptions`, `notification_prefs`, `weekly_schedule`, `daily_facts`, `notification_log`, `backups`; las claves primarias compuestas con `user_id` se resuelven con `INSERT OR REPLACE`), y la fila anónima se borra. Todo en un `DB.batch`.
- Sin `legacy_token` o si la fila ya tiene email: no se toca nada.

Tras eso el cliente deja de usar `api_token` para ese usuario. El token anónimo sigue aceptado **una versión más** para las instalaciones que aún no hayan entrado; luego se retira (plan futuro).

## 3. Cliente

### 3.1 `src/lib/auth.ts` (nuevo)

```ts
let accessToken: string | null = null          // memoria, nada más
let refreshing: Promise<boolean> | null = null  // single-flight

export type AuthState = { status: 'anon' } | { status: 'in'; email: string } | { status: 'expired'; email: string }
export function authState(): AuthState                  // sincrónico, para la UI
export async function refreshSession(): Promise<boolean> // POST /api/auth/refresh; fija accessToken
export async function login(email, password): Promise<'ok' | 'bad-credentials' | 'locked' | 'offline'>
export async function register(email, password): Promise<'ok' | 'exists' | 'weak' | 'offline'>
export async function logout(): Promise<void>           // POST logout, borra accessToken, account_email = null
export function subscribe(fn: (s: AuthState) => void)   // para que Ajustes se repinte
```

`login`/`register` leen `settings.api_token` y lo mandan como `legacy_token` (§2.4). En `ok` guardan `account_email` en Settings (para pintar la sección Cuenta **sin red**) y disparan `ensureSubscription()` + `syncPrefs()` para que el notificador quede al día bajo la cuenta.

### 3.2 `apiFetch` (`outbox.ts`)

```ts
export async function apiFetch(path, init?, retry = true): Promise<Response> {
  const settings = await getSettings()
  const bearer = accessToken ?? settings.api_token          // cuenta si hay, anónimo si no
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}`, ...init?.headers } })
  if (res.status === 401 && retry && settings.account_email !== null && (await refreshSession())) {
    return apiFetch(path, init, false)
  }
  return res
}
```

El outbox ya trata 401 como «descartar el hecho» (4xx). Con el reintento tras refresh eso sigue siendo correcto: solo descarta si el refresh también falló, es decir, sesión realmente caducada.

### 3.3 Arranque (`App.tsx`)

En `boot()`, justo antes de `initOutbox()`: `await refreshSession()`. Cuesta una petición al abrir la app; si no hay red, `authState()` queda en `expired` solo si había `account_email`, y **nada más cambia**: entrenar sigue igual. `initOutbox` deja de llamar a `POST /api/register` cuando hay cuenta.

### 3.4 Settings (`types.ts`, `db.ts`)

Un campo: `account_email: string | null` (defecto `null`). `getSettings()` ya rellena campos nuevos con su defecto; **no hace falta versión Dexie**. `api_token` se conserva.

### 3.5 Service worker

Sin cambios. `sw.ts` solo precachea y gestiona push; no intercepta `/api`, así que ni cookies ni 401 pasan por él.

## 4. UI

Dos sitios. Las dos pantallas siguen la regla de la v2.3 (clases de `tw.css` como Ajustes), porque Cuenta cuelga de Ajustes y comparte su anatomía.

### 4.1 Ajustes — sección «Cuenta»

**Posición:** inmediatamente **antes** de «Peso corporal y recordatorios», que es la primera sección que la necesita. No arriba del todo (ver auditoría §5).

```
┌──────────────────────────────────────────────┐
│ • CUENTA                       Avisos y copia │   SectionHead (label-md mayús + hint)
│ ┌──────────────────────────────────────────┐ │
│ │ [👤] Sin cuenta                          › │ │   Row (icono 32 sc-high, body-md + label-sm)
│ │      Avisos y copia se quedan en este móvil│ │   Link → /cuenta
│ └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘

estado «in»:
│ │ [👤] p.garcia@mdmsystems.es      [ Salir ] │ │   email en body-md (truncate); botón texto
│ │      Sesión abierta · desde 5 sep          │ │   label-md mayús on-surface-variant, 44px
estado «expired» (refresh falló):
│ │ [👤] p.garcia@mdmsystems.es              › │ │
│ │      Sesión caducada · toca para entrar    │ │   hint en on-surface-variant, NO alert ni rojo
```

Además, en «Peso corporal y recordatorios» y «Gestión de datos y copia», cuando `status !== 'in'`, la primera línea de la tarjeta de estado dice, en `type-body-sm text-on-surface-variant`: «Sin cuenta, los avisos se quedan en este móvil: si reinstalas, se pierden.» / «Sin cuenta, la copia se guarda con la clave de este móvil.» Los botones siguen funcionando (token anónimo). Estados vacíos que invitan a actuar, sin regañar (`DESIGN §7`).

### 4.2 `/cuenta` — pantalla apilada nueva (`StackedLayout`)

```
┌──────────────────────────────────────────────┐
│ ←  CUENTA                              (👤)  │   TopBar (existente)
│                                              │
│  ACCESO                              Servidor │   label-sm mayús primary-dim / hint
│  Entrar o crear cuenta                        │   headline-sm mayús
│                                              │
│ ┌─────────────────┬────────────────────────┐ │   segmentado idéntico al de Apariencia:
│ │ ▮ ENTRAR        │   CREAR CUENTA         │ │   p-xxs rounded-xl bg-sc-low, opción activa bg-volt
│ └─────────────────┴────────────────────────┘ │   (volt = acción primaria: uso 1 de 4)
│                                              │
│  CORREO                                       │   label-sm mayús on-surface-variant
│ ┌──────────────────────────────────────────┐ │   .field: lecho --well, 56px, radio 4
│ │ nombre@dominio.es                        │ │   type=email autocomplete=email inputmode=email
│ └──────────────────────────────────────────┘ │   foco: borde --ink + anillo 2px volt (DESIGN §5)
│  CONTRASEÑA                        Mostrar   │   label-sm; «Mostrar/Ocultar» botón texto 44px
│ ┌──────────────────────────────────────────┐ │
│ │ ••••••••••                               │ │   autocomplete=current-password | new-password
│ └──────────────────────────────────────────┘ │
│  Mínimo 10 caracteres.                        │   solo en «Crear cuenta», body-sm on-surface-variant
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │              ENTRAR                      │ │   56px bg-volt text-on-volt label-md mayús
│ └──────────────────────────────────────────┘ │   (o «CREAR CUENTA»); deshabilitado mientras envía
│  Correo o contraseña incorrectos.            │   error: body-sm on-surface-variant, sin icono,
│                                              │   sin rojo, dice qué pasó y qué hacer (DESIGN §7)
│  Los avisos y la copia de este móvil          │   solo si hay datos anónimos que fusionar (§2.4)
│  pasarán a la cuenta.                         │   body-sm on-surface-variant
└──────────────────────────────────────────────┘
```

- **Un solo campo de contraseña** con «Mostrar». Nada de «repetir contraseña»: en móvil duplica el error, no lo evita.
- **Sin «¿Olvidaste tu contraseña?»**: no hay proveedor de correo, así que no se promete. Cuando lo haya, se añade (ver §8).
- **Sin botones sociales, sin logo, sin ilustración.** Es una pantalla de Ajustes, no un onboarding.
- Al entrar con éxito: `navigate(-1)` a Ajustes. La sección Cuenta ya pinta el email.
- Teclado: en iOS el `.app-scroll` es el único que hace scroll; el campo enfocado se lleva a la vista con `scrollIntoView({ block: 'center' })` en `onFocus`. Comprobar a 320 con teclado abierto en la captura.
- **Mensajes de error** (todos `body-sm on-surface-variant`):
  - 401: «Correo o contraseña incorrectos.»
  - 409: «Ya hay una cuenta con este correo. Entra con ella.»
  - 429: «Demasiados intentos. Espera 15 minutos.»
  - sin red: «Sin conexión. La cuenta necesita red; entrenar no.»
  - 500 sin `AUTH_SECRET`: «El servidor no tiene configurada la cuenta.» (solo lo verá Pablo)

### 4.3 Tokens y clases que se usan (ninguno nuevo)

`--well`, `--surface`/`bg-sc-low`, `bg-sc-high`, `--ink`/`text-on-surface`, `text-on-surface-variant`, `text-primary-dim`, `bg-volt`, `text-on-volt`, `--volt` (anillo de foco), `--radius-control` (4), `rounded-xl` (12, tarjetas), `--h-cta` (56), `h-touch` (44), `type-label-sm/md`, `type-body-sm/md`, `type-headline-sm`, `.field`, `.press`. Iconos existentes: `user`, `chevron-right`, `arrow-left`. **No hace falta icono nuevo** (no hay «ojo»: «Mostrar» va en texto, que además es más claro).

## 5. Auditoría del plan (brief genérico frente a este)

Un brief genérico «añade login con email y contraseña a una PWA» produce: pantalla de login como puerta de entrada al arrancar, sección «Perfil» arriba de Ajustes con avatar grande, «repetir contraseña», «¿Olvidaste tu contraseña?» sin backend detrás, botones de Google/Apple, y el refresh token en localStorage «porque es más fácil». Cada uno era el default y se ha cambiado:

| Default | Aquí | Por qué |
| --- | --- | --- |
| Login como puerta al abrir la app | Login opcional, vive en Ajustes | «Nada del flujo de entrenar depende de la red» (`CLAUDE.md`). La cuenta es un medio para avisos y copia, no la identidad de la app. |
| Sección «Cuenta/Perfil» en cabeza de Ajustes con avatar | Sección compacta justo antes de las dos secciones que la necesitan | El orden de Ajustes es por lo que el usuario toca: primero cómo se ve la app, luego cómo entrena, y al final lo que habla con el servidor. Ponerla arriba diría «esto es una app con cuentas». No lo es. |
| Repetir contraseña | Un campo + «Mostrar» | En móvil, dos campos ciegos duplican el error. Mostrar lo elimina. |
| Enlace «¿Olvidaste…?» | No existe hasta que haya correo saliente | La app no promete lo que no puede hacer (`DESIGN §7`, «ningún dato inventado» aplicado a acciones). |
| Refresh en localStorage | Cookie `HttpOnly` `Path=/api/auth` | XSS; ITP de iOS; superficie mínima. |
| Cuenta nueva = datos desde cero | Fusión con la fila anónima vía `legacy_token` | El móvil de Pablo tiene prefs, suscripción y copias en producción hoy. |
| Error en rojo con icono ⚠ | Texto `on-surface-variant` que dice qué hacer | Lista negra: rojo solo en `--alert` y no para huecos; «los errores dicen qué pasó y cómo arreglarlo, sin disculparse». |

Lo que sí es «default» y se mantiene a conciencia: email + contraseña (no passkeys todavía: iOS en PWA instalada tiene soporte irregular y no hay fallback sin correo), 15 min / 90 días, rotación con detección de reutilización. Son el estándar porque funcionan.

## 6. Decisiones que necesita Pablo antes de construir

1. **Registro abierto o solo tú.** Recomendación: abierto (es lo que pediste: «usuarios»), sin verificación de correo por ahora. Consecuencia: cualquiera con la URL puede crearse una cuenta y guardar copias en tu D1 gratuito. Alternativa barata: variable `SIGNUP_CODE` en el worker y un campo «código de invitación» solo al crear cuenta.
2. **Iteraciones PBKDF2 frente al plan gratuito** (§2.3). Recomendación: medir en el paso 6 y quedarse con la cifra más alta que quepa en 10 ms con margen; documentar la cifra en `especificaciones §6.6`. Si prefieres no transigir: plan de pago.
3. **Duración de la sesión.** Recomendación: 90 días deslizantes. Un mes sin abrir la app y sigues dentro; tres meses y vuelves a entrar.
4. **Fin del token anónimo.** Recomendación: convive una versión más y se retira en un plan posterior, junto con `POST /api/register`.

## 7. Pasos

1. **Worker · esquema.** Migración aditiva de §2.1 aplicada con `wrangler d1 execute entrenamiento --remote --file=schema.sql` (idempotente: `IF NOT EXISTS`; los `ALTER TABLE ADD COLUMN` fallan si ya existen, se envuelven en un script `migrations/001-auth.sql` que se ejecuta una vez y se anota en el README del worker).
2. **Worker · `src/auth.ts` (nuevo).** `hashPassword`, `verifyPassword` (tiempo constante), `signJwt`/`verifyJwt` (HS256 con `crypto.subtle`), `newRefreshToken`, `setCookie`/`clearCookie`, `readCookie`. Sin dependencias nuevas.
3. **Worker · rutas `/api/auth/*`** en `index.ts` según §2.2, más `authUser()` con JWT primero y `token_hash` de respaldo. Fusión de §2.4 en un `DB.batch`.
4. **Worker · secreto.** `wrangler secret put AUTH_SECRET`. Añadir a `Env` y documentar en `wrangler.jsonc` (comentario) y README.
5. **Worker · pruebas con `curl`** contra `wrangler dev`: register → me → refresh (cookie nueva) → reutilizar cookie vieja → 401 y familia revocada → login de nuevo → logout → refresh 401. Bloqueo tras 10 fallos. Guardar el guion en `worker/scripts/auth-smoke.sh`.
6. **Medir CPU** de `login` con 100 000 iteraciones en `wrangler dev` y en el panel de Cloudflare tras un deploy de prueba. Fijar la cifra (decisión 2).
7. **Cliente · `auth.ts`, `apiFetch`, boot, Settings** (§3). `npx tsc -p tsconfig.app.json --noEmit` limpio.
8. **Cliente · UI** según §4, **solo después de que Pablo apruebe este plan** y con las capturas del paso 9.
9. **Verificación visual** con `scripts/shots.mjs` + Playwright: `/cuenta` (vacía, con error, «crear cuenta» con nota de fusión) y `/ajustes` (anon, in, expired), a 380 y 320, oscuro y claro. Comprobar `/cuenta` a 320 con teclado abierto (viewport reducido a 320×420). Revisar contra la lista negra.
10. **Documentos.** `especificaciones §6.6` reescrito (cuenta opcional, dos tokens, cifra PBKDF2, fusión del token anónimo) y `§7` sin «cuentas de usuario»; `DESIGN.md §4 Ajustes` con la sección Cuenta y changelog v2.7; `worker/README.md` con endpoints y secreto; memoria del proyecto.
11. **Despliegue** con la secuencia conocida (build → `rm -rf .wrangler/deploy` → `wrangler deploy` desde `worker/` → comprobar hash de `assets/index-*.js`). Antes, entrar desde el móvil de Pablo con `legacy_token` y comprobar en D1 que la fila anónima pasó a ser la cuenta y que el aviso de prueba sigue llegando.

## 8. Fuera de este plan (siguientes, si Pablo quiere)

- **Restaurar copia al entrar en un móvil nuevo**: si la base local está vacía y la cuenta tiene copias, `/cuenta` ofrece «Restaurar copia del 3 sep» (`GET /api/backup` → `importSnapshot`). Es la razón de peso para tener cuenta y encaja en una tarde, pero es otra pantalla y otro plan.
- **Recuperar contraseña** y **verificar correo**: necesitan correo saliente (Resend, Mailchannels…). Sin eso, no se muestra.
- **«Dispositivos conectados» y «Salir de todos»**: `refresh_tokens` ya lo permite (`user_agent`, familias). UI pendiente.
- **Passkeys** como segunda forma de entrar.
- **Retirar el token anónimo** y `POST /api/register`.
- Replicar la auth en `server/` (Express) si algún día vuelve a usarse.
