# Servidor de notificaciones y backup

Node + cron (decisión cerrada en especificaciones §8.2: `web-push` asume el
`crypto` de Node). Solo decide si mandar un aviso y guarda copias: **el
registro de series nunca pasa por aquí.**

## Arranque

```bash
cd server
npm install
npm run vapid    # crea .env con claves VAPID (solo la primera vez)
npm run dev      # desarrollo (tsx watch, puerto 8787)
```

Producción: `npm run build && npm start`.

El frontend en desarrollo ya proxya `/api` a `localhost:8787` (vite.config.ts).
En producción, servir `dist/` del frontend y este servidor bajo el mismo
dominio, o definir `VITE_API_URL` al hacer el build del frontend.

## Endpoints

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/vapid-public` | Clave pública VAPID (sin auth) |
| POST | `/api/register` | Alta idempotente: token del cliente + timezone IANA |
| POST | `/api/subscription` | Guarda/actualiza la suscripción push |
| POST | `/api/prefs` | Preferencias de aviso (tipo, hora local, solo días programados) |
| PUT | `/api/schedule` | Programación semanal (weekday 0=lunes, nombre de rutina) |
| POST | `/api/facts` | Hechos del día: `{local_date, weighed_in?, trained?}` |
| POST | `/api/backup` | Snapshot completo; se conservan los últimos 7 |
| GET | `/api/backup` | Último snapshot |
| POST | `/api/test` | Envía un aviso de prueba ya |

Todo excepto `vapid-public` lleva `Authorization: Bearer <token>`; el token lo
genera el cliente en el primer arranque y aquí solo se guarda su SHA-256.

## Cron

Cada 15 minutos en UTC. Por usuario: hora local vía zona IANA (nunca offset:
el cambio de hora de octubre rompería el aviso de las 8:00), supresión
(ya pesado / ya entrenado / día sin sesión si `only_scheduled_days`),
idempotencia por `notification_log (user, type, local_date)` y limpieza de
suscripciones muertas (404/410 → borrar).
