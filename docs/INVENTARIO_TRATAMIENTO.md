# Inventario de la pantalla de Tratamiento: vigente vs Atlas (2026-08-02)

**Por qué existe.** Se reportó el estado de T2b sin haber hecho el inventario completo de la pantalla de Tratamiento del HTML vigente. Santiago comparó Atlas contra sus capturas y falta mucho más de lo que los reportes decían. Esto recorre la pantalla del `ATLAS_v7.html` de arriba a abajo (fuente autoritativa) y mapea cada elemento contra Atlas, su bloque, y qué lo bloquea. Lo construido NO está mal; el problema era no saber contra qué medirlo.

**Bloques posibles:** T2b (lo actual), T3 (nutracéuticos), Plan alimentario E+F, T4 (reportes), la cadena calórica (EN PAUSA esperando las 4 respuestas de Gildardo), o **NO ASIGNADO** (lo que había que descubrir).

## La tabla

| # | Elemento (vigente, arriba → abajo) | ¿En Atlas? | Bloque | Bloqueado por |
|---|---|---|---|---|
| 1 | **Dos subpestañas**: "Rutas de atención del DFI" + una por profesión ("Nutricionista") | **NO** (todo en una sola vista) | **T2b** | no bloqueado; nuestra decisión "no subtabs" hay que REVISARLA (ver abajo) |
| 2 | Sección Rutas de atención (del DFI) | SÍ | T1/T2b | — |
| 3 | Remisiones | SÍ | T1 | — |
| 4 | Nivel III · Salud celular (badges) | SÍ (2026-08-02) | T2b | — |
| 5 | Confirmación del diagnóstico (gate de las 5 ops) | SÍ | T2b | — |
| 6 | **Apartado A · Resumen clínico** (2 párrafos narrativos) | **NO** | **NO ASIGNADO** (sale de `atlas-resumen-clinico.js`, artefacto que llegó APARTE, no está en el HTML) | sin asignar a ningún bloque |
| 7 | **Meta terapéutica** (objetivo a 24 semanas) | **NO** | **NO ASIGNADO** (mismo módulo aparte) | sin asignar |
| 8 | **Sección 2 · VITACELLEBIS**: nutracéuticos con prioridad (P1 Multi-Cell Base, P2 Omega Complex), dosis, vía, descripción, botón "Registrar despacho" | **PARCIAL / DESCONECTADO** (el motor los calcula, `output.nutraceuticos` = string "MULTI-CELL BASE, OMEGA COMPLEX", sale en el texto de la guía; pero la UI muestra un selector de CATÁLOGO vacío "sin nutracéuticos", sin P1/P2, sin dosis, sin despacho) | **T3** | T3 sin construir + una DESCONEXIÓN (tenemos el dato y no lo mostramos) |
| 9 | **Apartado D · Fórmula sintética**: GEB, PAL, GET, objetivo calórico, peso de cálculo, proteína, grasas, CHO | **NO** (el `ProtocolForm` tiene inputs de AJUSTE, no la fórmula portada) | **cadena calórica** | EN PAUSA (Gildardo) |
| 10 | **Validación del plan**: tabla de 17 nutrientes con % de cubrimiento e ICN | **NO** | Plan alimentario / cadena | EN PAUSA / sin construir |
| 11 | **Lista de intercambio**: 12 grupos con porciones editables | **NO** | **Plan alimentario (E+F)** | sin construir |
| 12 | **Distribución por tiempos de comida** | **NO** | Plan alimentario (E+F) | sin construir |
| 13 | **Menú semanal**: tabla 7 días × 5 tiempos, editable, con generación por IA | **PARCIAL** (`MenuSection` genera menú por IA, pero NO la tabla 7×5 editable) | T2b (menú IA) + Plan alimentario | parcial |
| 14 | **Imprimir / Guardar plan / Enviar** | **PARCIAL** (el reporte PDF + envío es T4/B10; no "guardar/imprimir el plan alimentario") | T4 | parcial |

## La lectura preliminar de Santiago: CONFIRMADA en todo

- Fórmula sintética, objetivos calóricos, validación nutricional → **cadena calórica (en pausa). Correcto que no estén.** ✓
- Lista de intercambio, distribución, menú semanal → **Plan alimentario (E+F), bloque propio. Correcto que no estén.** ✓
- Nutracéuticos P1/P2 + despacho → **T3, sin construir. Correcto** (+ la desconexión). ✓
- Resumen clínico y meta terapéutica → salen de `atlas-resumen-clinico.js` (módulo que NO está en el HTML, autoría aparte). **¿A qué bloque? A NINGUNO: no están asignados.** ✓ (esto es lo que había que descubrir).
- Las dos subpestañas → **esto SÍ es T2b y no lo construimos.** ✓

## Tres cosas que salen del inventario (para replantear)

1. **Resumen clínico + Meta terapéutica NO tienen bloque.** Vienen de `atlas-resumen-clinico.js` (artefacto aparte de Gildardo, no en el HTML). Hay que ASIGNARLES un bloque (¿T2b? ¿un bloque propio de contenido narrativo?), porque hoy caen entre las grietas: ningún bloque los cubre y por eso no aparecían en los reportes de estado.
2. **La decisión "no separar en dos subpestañas" hay que revisarla.** Se tomó cuando el panel del nutricionista era chico (rutas + protocolo + badges). Pero la subpestaña "Nutricionista" del vigente contiene casi TODO el trabajo del nutricionista (resumen, meta, fórmula, validación, intercambio, menú), casi todo sin construir. La estructura de dos subpestañas (Rutas del DFI, que es común, vs Nutricionista, que es su workspace) SÍ está justificada; hoy Atlas mezcla rutas + remisiones + protocolo + badges en una sola vista.
3. **La desconexión de nutracéuticos es el caso más claro:** tenemos el dato (`output.nutraceuticos`) y no lo mostramos donde va (la sección de nutracéuticos muestra el CATÁLOGO para AGREGAR, no la RECOMENDACIÓN del modelo). Dos conceptos mezclados (lo que el modelo recomienda vs lo que el profesional agrega), la misma familia del bug de las restricciones. Es T3, pero la parte de "mostrar lo que el motor ya calculó" es una desconexión, no un bloque futuro.

## Consecuencia para B13 y el mapa

**B13 es solo una parte de un hueco mayor.** Lo que queda de Tratamiento de verdad es: el Plan alimentario (E+F, bloque propio: intercambio + distribución + menú 7×5), T3 (nutracéuticos con P1/P2 + despacho + la desconexión), la cadena calórica (fórmula + validación, en pausa), el resumen clínico + meta (sin asignar), y las dos subpestañas (T2b). Absorber B13 sin ver este conjunto sería construir a ciegas. Se replantea qué queda de Tratamiento con este inventario a la vista.

## Propuesta: replanteo por DEPENDENCIA (2026-08-02)

**Alcance CONFIRMADO por Santiago:** el Hito 1 mantiene su alcance (producto completo para el Integrante, sin recortar). TODO lo del inventario es obligatorio antes del Hito 1; no hay nada que dejar fuera. Por eso se ordena por DEPENDENCIA, no por tamaño.

**La restricción que manda:** casi todo lo que falta depende de la CADENA CALÓRICA. La fórmula ES la cadena; la validación de 17 nutrientes valida CONTRA el objetivo calórico; la distribución reparte ESAS calorías; el menú se genera contra ESE plan; las porciones del intercambio se calculan contra ESE objetivo. Así que las **cuatro respuestas de Gildardo son el cuello de botella de TODO Tratamiento**, no de un bloque.

### (a) Construible HOY, sin la cadena — es POCO
1. **Nutracéuticos: la desconexión.** Mostrar lo que el motor RECOMIENDA (`output.nutraceuticos`, hoy solo en el texto de la guía) en la sección de nutracéuticos, SEPARADO de lo que el profesional AGREGA (el selector de catálogo actual). No exige el catálogo estructurado (P1/P2/dosis) ni el despacho: eso es T3. Es la misma separación recomienda-vs-agrega de las restricciones. **Pequeño, alto valor (el hueco más visible), va PRIMERO.**
2. **Resumen clínico narrativo.** Portar `atlas-resumen-clinico.js` (párrafos por profesión). **VERIFICADO: NO está portado** (Atlas solo tiene un `resumenClinico` de una línea, placeholder en `engine.ts`); es trabajo real (transcripción con golden, lee campos de encuesta d1_*). NO depende de la cadena (es el cuadro clínico, no la prescripción). **Medio.**
3. **Las dos subpestañas** (navegación Rutas del DFI / Nutricionista). Ver el dilema abajo: probablemente ESPERAR.

### (b) Lo que la cadena calórica desbloquea — es la MAYOR PARTE
Fórmula sintética · validación de 17 nutrientes · distribución por tiempos · menú semanal 7×5 · las porciones del intercambio · la reconciliación del peso meta + Nivel V convencional · CA-3 · (posiblemente la meta terapéutica, si toca el peso meta). **~8-9 elementos de los 14: más de la mitad.**

### (c) No depende de la cadena, tampoco urgente — es POCO
T3 completo: el catálogo estructurado de nutracéuticos (P1/P2/dosis/vía) + "Registrar despacho". Independiente de la cadena, pero no urgente (la desconexión de (a) cubre lo visible).

### Conclusión de grueso
- **(a) construible hoy: ~2-3 elementos** (1 pequeño listo para hacer, 1 medio, 1 dudoso).
- **(b) espera la cadena: más de la mitad del inventario.**
- **(c) independiente no urgente: ~1 bloque.**

**Lo que esto significa:** Tratamiento está más parado de lo que parecía, y el trabajo útil AHORA está en gran parte FUERA de Tratamiento (Seguimiento, que solo espera las tres frases de Q25; y los bloques de pulido). Dentro de Tratamiento, lo construible sin Gildardo es: la desconexión de nutracéuticos (ya) y el resumen narrativo (portar el módulo).

### Las dos subpestañas: las dos opciones
- **Construir la navegación AHORA:** hoy el workspace del nutricionista tendría dentro solo el protocolo, las badges y el resumen (si se porta); casi todo su contenido (fórmula, validación, intercambio, menú) espera la cadena. La barra de dos pestañas quedaría con una "Nutricionista" casi vacía hasta que llegue la cadena.
- **Construir la navegación CUANDO haya contenido que separar** (al desbloquearse la cadena): la separación Rutas-vs-Nutricionista rinde cuando el workspace del nutricionista es grande, que es justo lo que la cadena desbloquea. **Recomendación: esperar.** La revisión de la decisión anterior NO la invalida: la separación SÍ va, pero cuando haya qué separar; hoy dejaría una pestaña casi vacía, el mismo argumento (correcto) por el que no se construyó la barra la primera vez.
