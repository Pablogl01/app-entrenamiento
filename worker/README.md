# Worker: PWA, notificador, copia y cuenta

Cloudflare Workers + D1 (plan gratuito). Sirve `../dist` (la PWA) y toda la API bajo `/api/*`.
Misma superficie que `server/` (Express) más la **cuenta de usuario** de `plans/007`, que solo
existe aquí: producción es este worker. **El registro de series nunca pasa por la API.**

## Desarrollo

```bash
cd worker
npm install
npx wrangler d1 execute entrenamiento --local --file=schema.sql   # base local, solo la primera vez
echo "AUTH_SECRET=$(openssl rand -base64 32)" > .dev.vars          # firma de los access tokens (gitignored)
npm run dev                                                         # http://127.0.0.1:8787
bash scripts/auth-smoke.sh http://127.0.0.1:8787                    # prueba de humo de /api/auth/*
```

El frontend en desarrollo (`npm run dev` en la raíz) proxya `/api` a `127.0.0.1:8787`. Con la IP
explícita: `localhost` puede resolver a `::1` y acabar en el Express de `server/` si está arrancado.

## Secretos (`wrangler secret put`)

| Secreto | Para qué |
|---|---|
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Web Push |
| `AUTH_SECRET` | HMAC de los access tokens (≥ 32 bytes en base64). Sin él, `/api/auth/*` responde 500 y lo dice en el log. |

## Base de datos

`schema.sql` crea todo desde cero (idempotente). Una base **anterior a la cuenta** se pone al día
una sola vez con `migrations/001-auth.sql` (`ALTER TABLE` no es idempotente):

```bash
npx wrangler d1 execute entrenamiento --remote --file=migrations/001-auth.sql
```

## Endpoints

| Método | Ruta | Auth | Qué hace |
|---|---|---|---|
| GET | `/api/vapid-public` | — | Clave pública VAPID |
| POST | `/api/auth/register` | — | `{email, password, legacy_token?, timezone?}` → 201 `{access_token, user}` + cookie `rt`. Contraseña ≥ 10. 409 si el correo existe. Si `legacy_token` es de una fila anónima, esa fila se convierte en la cuenta. **Tope: 5 altas por hora y dirección IP** (`CF-Connecting-IP`, fila `register:<ip>` en `login_attempts`); 429 + `Retry-After`. |
| POST | `/api/auth/login` | — | Igual, 200. 401 genérico; 429 + `Retry-After` tras 10 fallos (15 min). Si `legacy_token` es de otra fila anónima, se fusiona en la cuenta. |
| POST | `/api/auth/refresh` | cookie `rt` | Access token nuevo + cookie **rotada**. Reutilizar una cookie ya rotada revoca toda la familia (401). |
| POST | `/api/auth/logout` | cookie `rt` | Revoca ese refresh token; 204 y cookie borrada |
| GET | `/api/auth/me` | Bearer | `{id, email, created_at}` |
| POST | `/api/register` | Bearer anónimo | Alta anónima idempotente (compatibilidad; se retirará con el token anónimo) |
| POST | `/api/subscription` | Bearer | Suscripción push |
| POST | `/api/prefs` | Bearer | Preferencias de aviso |
| PUT | `/api/schedule` | Bearer | Programación semanal |
| POST | `/api/facts` | Bearer | Hechos del día |
| POST / GET | `/api/backup` | Bearer | Subir snapshot (se guardan 7) / último snapshot |
| POST | `/api/test` | Bearer | Aviso de prueba |

`Bearer` acepta primero un access token (JWT HS256, 15 min) y, si no lo es, el token anónimo del
primer arranque (SHA-256 en `users.token_hash`).

Cookie `rt`: `HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=7776000` (90 días
deslizantes). Solo viaja a `/api/auth/*`.

Contraseñas: PBKDF2-SHA-256 con WebCrypto, sal de 16 bytes, **50 000 iteraciones** (guardadas por
fila). Workers limita a 100 000 y el plan gratuito a 10 ms de CPU por petición; 100 000 midieron
~12 ms en local. Comprobar el tiempo de CPU real de `login` en el panel tras desplegar.

## Cabeceras y ficheros estáticos

`public/_headers` (Workers Static Assets lo aplica a lo que sirve sin pasar por el worker): CSP sin
`unsafe-inline` en scripts (por eso el script del tema es `public/theme-init.js`), HSTS, `nosniff`,
`X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, y `Cache-Control: immutable` un año para
`/assets/*`. La API añade `nosniff` en `json()`. También en `public/`: `robots.txt`, `sitemap.xml`,
`favicon.svg` + `favicon.ico`, `og.png` (1200×630) y un `icon-maskable-512.png` con zona segura real.

## Cron

Cada 15 minutos en UTC (`wrangler.jsonc`). Igual que `server/README.md`: hora local por zona IANA,
supresión, idempotencia por `notification_log`, limpieza de suscripciones muertas.

## Despliegue

Desde la raíz: `npm run build`, luego `rm -rf .wrangler/deploy` (el plugin de Vite deja un
`deploy/config.json` que hace fallar a wrangler), luego `npx wrangler deploy` desde `worker/`.
Comprobar que el hash de `assets/index-*.js` en producción coincide con `dist/index.html`.

**Nunca `wrangler deploy` desde la raíz**: el `wrangler.jsonc` de la raíz es solo para `wrangler dev` con
assets y no tiene worker, D1 ni cron; desplegarlo sustituye la API por un worker de solo assets (pasó el
2026-09-09). El script `npm run deploy` de la raíz ya encadena build, limpieza y despliegue desde `worker/`.
