# CLAUDE.md

App de registro de entrenamiento. PWA React + TypeScript, local-first, un solo usuario.

## Documentos de referencia

Antes de escribir UI, lee **los dos**:

- `especificaciones-app-entrenamiento.md` — comportamiento, modelo de datos, vistas, cálculos
- `DESIGN.md` — tokens, tipografía, material, anatomía de componentes, lista negra

Además: `src/styles/tokens.css` es la traducción de DESIGN.md a variables CSS (fuente de verdad para componentes), `docs/stitch/` guarda las maquetas de referencia del rediseño v2 (HTML y capturas exportadas de Stitch, más los dos DESIGN originales) y `docs/rediseno-v2-plan.md` el plan con el que se implementó.

Si algo entra en conflicto entre ambos, `DESIGN.md` manda en aspecto y `especificaciones` manda en comportamiento. Si el conflicto es real y no se resuelve así, pregunta antes de decidir.

## Proceso obligatorio: plan antes de código

**No escribas UI sin un plan aprobado.** Para cualquier pantalla o componente nuevo:

1. **Plan.** Tokens que vas a usar, wireframe ASCII del layout, y qué hace única a esta pantalla. Sin código.
2. **Auditoría del plan.** Reescribe mentalmente el mismo brief de forma genérica y comprueba si llegarías al mismo sitio. Si sí, es un default y no una decisión: revísalo y di qué has cambiado y por qué.
3. **Enséñame el plan y espera.** No empieces a construir por tu cuenta.
4. **Construye** siguiendo el plan revisado.
5. **Verifica visualmente.** Captura la pantalla renderizada, critícala contra `DESIGN.md` y la lista negra, y arregla lo que falle. Comprueba también a 320px.

Ese paso 5 no es opcional. Una captura vale más que mil tokens.

## Estética

<frontend_aesthetics>
Tiendes a converger hacia salidas genéricas, "on distribution". En diseño frontend eso produce la estética que los usuarios llaman "AI slop". Evítalo.

En este proyecto la dirección estética ya está decidida y documentada en `DESIGN.md`. No la reinterpretes ni la "mejores" en cada generación: aplícala. Donde `DESIGN.md` fija algo, se sigue exactamente. Donde deja un eje libre, no gastes esa libertad en el default.

Gasta la audacia en un solo sitio. En esta app es la ruptura de escala al registrar series: el bloque de la serie en curso, con la cifra a 40px y los steppers de 48. El volt tiene cuatro usos y ninguno más. Todo lo que rodea eso va callado y disciplinado. Antes de dar algo por terminado, quita un adorno.

Revisa cada salida contra la sección 7 de `DESIGN.md` (lista negra) antes de enseñármela.
</frontend_aesthetics>

## Restricciones técnicas que afectan al diseño

- **Nada del flujo de entrenar depende de la red.** Fuentes auto-alojadas en WOFF2 con subset latino, iconos SVG propios (`src/components/Icon.tsx`), cero llamadas a CDN. Si una decisión visual necesita red, no es válida.
- **Presupuesto de peso:** las tres fuentes juntas ~110 KB. Sin imágenes de ejercicio: la marca geométrica por grupo muscular es el sustituto.
- **Dos modos de color** (oscuro y claro) desde los mismos tokens semánticos; ningún componente sabe en qué modo está. Verificar las capturas en los dos.
- **IndexedDB es la fuente de verdad.** El registro de series nunca pasa por la API.
- **Un solo usuario**, pero la columna `user_id` existe desde el día uno.
- **Cifras tabulares en todo lo numérico.** Los pesos se comparan en vertical.

## Estilo de código

- TypeScript estricto. Sin `any`.
- Cuidado con la especificidad de los selectores CSS: es fácil generar clases que se anulan entre sí, sobre todo con padding y margin entre secciones. Vigila los selectores por tipo (`.section`) contra los de elemento (`.cta`).
- Tokens de `DESIGN.md` como variables CSS. Ningún hex escrito a mano en un componente.
- Componentes pequeños y con un solo trabajo.

## Qué hacer cuando falta información

`DESIGN.md` tiene una sección 9 de decisiones abiertas. Si tu tarea toca una de ellas, **pregunta**. No rellenes el hueco con lo más probable y sigas: es exactamente así como el diseño se desliza hacia el default.
