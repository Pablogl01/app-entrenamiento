# 008 — Auditoría de lanzamiento (20 puntos) y sus arreglos

- **Status**: HECHO, en GitHub (`9ffd6f1`) y desplegado el 2026-09-09. **Pendiente**: rellenar `RESPONSABLE` y `CONTACTO` en `src/content/legal.ts`.
- **Category**: Legal · SEO · Accesibilidad · Formularios · Rendimiento
- **Origen**: checklist de 20 puntos pedida por Pablo tras abrir el registro de cuentas (plan 007). Auditoría con evidencia archivo:línea en la conversación del 2026-09-05; aquí queda el resultado.

## Qué se arregló

| nº | Punto | Arreglo |
| --- | --- | --- |
| 1, 2 | Privacidad y términos | `src/content/legal.ts` (textos) + `src/views/TextPage.tsx` (pantalla) en `/privacidad` y `/terminos`. Enlaces desde Ajustes › «Legal y ayuda» y frase de aceptación en «Crear cuenta». **Huecos por rellenar**: `RESPONSABLE` y `CONTACTO` en `legal.ts`. |
| 15 | Cookies | Sin banner: todo el almacenamiento es técnico (cookie `rt` solo al entrar, `localStorage.theme`, IndexedDB, caché del SW) y no hay terceros. Documentado en la política, sección «Cookies y almacenamiento». |
| 3 | CTA | «Repetir esta sesión» pasa a `btn--primary` en Sesión pasada. **Pendiente de decisión de producto**: Detalle de ejercicio y Calendario siguen sin acción primaria (§ Fuera). |
| 4 | FAQ | `/ayuda` con ocho preguntas reunidas de textos que ya existían. |
| 7 | 404 | `src/views/NoEncontrado.tsx` en `<Route path="*">` con «Ir a Hoy». El HTTP sigue siendo 200 (fallback SPA de Workers Assets). |
| 5, 6 | robots y sitemap | `public/robots.txt` (permite todo salvo `/api/`, referencia el sitemap) y `public/sitemap.xml` con `/`, `/ayuda`, `/privacidad`, `/terminos`. |
| 10 | Títulos | `DocumentTitle` en `App.tsx`: «Hoy · Entrenamiento», etc., por ruta. `<title>` base más descriptivo. |
| 11, 14, 12 | Description, canonical, Open Graph | En `index.html`. `public/og.png` 1200×630 generado (23 KB). |
| 13 | Favicon | `favicon.svg` + `favicon.ico` (16/32/48) y sus `<link rel="icon">`; `icon-maskable-512.png` regenerado con zona segura del 10 % (antes era una copia del 512 normal); `icons.svg` (sprite de Bluesky sin uso) borrado. |
| 16 | Móvil | Zona táctil de 44 con `.hit` / `.hit-lg` (pseudo-elemento, sin cambiar el tamaño visible) en steppers e interruptores de Ajustes, avatar de la barra, chips de objetivo, botones Mover/Quitar; celdas del calendario `h-10` → `h-11`; `.seg button` a `var(--touch)`. Sin breakpoint de tablet (§ Fuera). |
| 17 | Accesibilidad | `.text-volt` → `--volt-ink`; `.text-primary-dim` → token nuevo `--volt-dim-ink`; `--md-outline` claro `#6a6e58`. Un solo h1 por pantalla (`TopBar as="p"`, `.sr-only` en Calendario, «Mis rutinas» h1). Foco visible en `.bare-input` y `.select-well`. Radiogroups con flechas y tabindex itinerante (`src/lib/a11y.ts`); chips de Catálogo y Ciclo con `role="radio"`. `role="timer"` en el descanso; `role="status"` en el resultado de importar. |
| 18 | Formularios | Tope de 5 altas por hora y dirección IP en `/api/auth/register` (`login_attempts` con clave `register:<ip>`, 429 + `Retry-After`); el cliente valida el formato del correo antes de habilitar el botón y muestra un mensaje propio para el 429 del registro. Sin CAPTCHA ni verificación de correo (§ Fuera). |
| 19 | Enlaces | `/?focus=peso` del aviso push ya enfoca el campo de peso en Hoy. |
| 9 | Analítica | No hay y no se añade. |
| 20 | Rendimiento | `public/_headers`: CSP sin `unsafe-inline` en scripts (el script del tema pasa a `public/theme-init.js`), HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`; `Cache-Control: immutable` para `/assets/*`. `React.lazy` en Calendario, Progreso, Editor y páginas de texto: el chunk inicial baja de 162 a 141 KB gzip. `<link rel="preload">` de la fuente. |

## Verificado

- `tsc` limpio en cliente y worker; `npm run build` correcto.
- `wrangler dev` sirviendo `dist`: cabeceras aplicadas en `/`, `immutable` en `/assets/*`, `robots.txt` como `text/plain`, `sitemap.xml` como `application/xml`, `favicon.ico` como icono; sexta alta desde la misma IP → 429.
- Playwright: título correcto y **un solo h1** en las siete rutas comprobadas; flechas mueven el radiogroup de Apariencia y solo una opción es tabulable; botón «Entrar» deshabilitado con correo inválido; avatar de la barra mide 44×44; `.hit` añade 6 px por lado. **Cero errores de consola con la CSP activa.**
- Capturas a 380 y 320, oscuro y claro: `/ayuda`, `/privacidad`, `/terminos`, 404, Ajustes › Legal y ayuda, Cuenta › Crear cuenta, Hoy (contraste).

## Fuera de este plan

- Rellenar `RESPONSABLE` y `CONTACTO` en `src/content/legal.ts` y revisar los textos legales antes de desplegar.
- CTA en Detalle de ejercicio («Añadir a rutina» necesita un selector de rutina) y en Calendario: decisiones de producto.
- CAPTCHA (Cloudflare Turnstile) y verificación de correo: requieren servicio externo o correo saliente.
- Breakpoint de tablet o escritorio: la app está pensada para móvil.
- El 404 con código HTTP 404 real exigiría pasar todas las rutas por el worker (`run_worker_first: true`) y decidir allí; no compensa en una PWA.
