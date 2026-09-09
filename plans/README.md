# Planes de movimiento

Salida de `improve-animations` (skill de Emil Kowalski) sobre el commit `e53b157`, 2026-09-04. El diagnóstico completo, con las tablas de `emil-design-eng`, `review-animations` y `find-animation-opportunities`, está en `000-auditoria-movimiento.md`.

Ningún plan toca el código por sí mismo: cada uno está escrito para que lo ejecute cualquier agente sin contexto. Antes de ejecutar, aplica el proceso de `CLAUDE.md` (plan aprobado → construir → captura).

| # | Plan | Severidad | Estado |
| --- | --- | --- | --- |
| 000 | Auditoría de movimiento | — | HECHO |
| 001 | Tokens de easing y entradas de vista | MEDIUM | HECHO (2026-09-04) |
| 002 | Barras de progreso a `transform` | HIGH | HECHO (2026-09-04) |
| 003 | Interruptor de Ajustes sin `transition: all` | HIGH | HECHO (2026-09-04) |
| 004 | Quitar pulsos fuera de «sesión en curso» | HIGH | HECHO (2026-09-04) |
| 005 | Entradas con `@starting-style` en Entrenar y Catálogo | MEDIUM | HECHO (2026-09-04) |
| 006 | Limpiar CSS de movimiento muerto y alinear `DESIGN.md §6` | LOW | TODO (espera decisión) |

## Orden recomendado

1. **001** primero: crea `--ease-out`, `--ease-in-out`, `--ease-drawer`. 002, 003 y 005 los usan.
2. **004** en cualquier momento: solo borra clases, no depende de nada. Es el cambio de más impacto por línea.
3. **002** y **003**: los dos HIGH de rendimiento. Independientes entre sí.
4. **005**: el único plan que añade movimiento. Probar en el móvil real antes de dar por bueno.
5. **006** cuando Pablo decida qué hacer con la «secuencia orquestada» (`000 §5`, decisión 3).

## Decisiones pendientes (no son planes)

Ver `000-auditoria-movimiento.md §5`: reducción de movimiento «a cero» frente a «conservar color y opacidad»; press a 60 ms lineal; destino de la secuencia orquestada.

## Otros planes (fuera de la auditoría de movimiento)

| # | Plan | Estado |
| --- | --- | --- |
| 007 | Cuenta de usuario con sesión persistente (access + refresh token) | HECHO, desplegado y en GitHub (`d720b19`, 2026-09-05) |
| 008 | Auditoría de lanzamiento (20 puntos) y arreglos | HECHO en local (2026-09-05). Sin commit ni desplegar; faltan responsable y contacto en `src/content/legal.ts` |
