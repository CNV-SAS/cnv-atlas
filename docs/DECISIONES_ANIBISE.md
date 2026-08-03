# DECISIONES ANI-BIS-E — documento consolidado (borrador para firma de Gildardo)

**Qué es.** La fuente normativa única de las decisiones clínicas del modelo ANI-BIS-E. Firmado por la Dirección Científica (Gildardo), mantenido por el equipo de Atlas. Por la regla de autoridad, este documento manda sobre el archivo prototipo: donde discrepen, manda el documento, y la divergencia queda anotada aquí.

**Cómo leerlo.** Una decisión por entrada, numerada `D-NNN` (número estable). Cada una lleva:
- **Fecha** de la decisión (para saber, cuando dos se contradigan, cuál es posterior).
- **Origen:** la ronda y fecha del mensaje de Gildardo del que salió (para poder volver al original).
- **Estado:** distingue lo IMPLEMENTADO en Atlas de lo DECIDIDO pero AÚN NO construido. Al firmar, una parte ya opera en Atlas y otra todavía no.
- **Afecta:** qué toca (frozen, pipeline, pantalla, datos, proceso), y la divergencia contra el archivo si la hay.

**Regla de entrada:** antes de preguntar, buscar aquí. Si está, implementar (citando el `D-NNN`). Si está y no sirve, citar el número y decir qué falla. Si no está, preguntar; la respuesta entra con número nuevo.

**Estados:** `IMPLEMENTADO` · `PARCIAL` · `DECIDIDO / SIN IMPLEMENTAR` · `ADOPTADO` · `FIRMADO`.

**Nota:** las tres consultas del 2026-08-03 (factor de actividad, mecánica de la salvaguarda TCA, cita = campo de fecha) NO entran todavía: entran cuando Gildardo responda.

---

## Cadena calórica y prescripción

**D-001 · Peso de referencia obligatorio para prescribir.**
Decisión: sin peso de referencia registrado no se emite prescripción calórica ni proteica. El peso de referencia es el que el profesional registra al medir (la meta a la que quiere llevar al paciente), NO un peso ajustado por fórmula sobre el peso medido; esa fórmula no entra en la cadena y su respaldo se quita del archivo.
- Fecha: 2026-08-02 (P1), reafirmada 2026-08-03. · Origen: P1 / confirmaciones A y B (2026-08-03).
- Estado: **PARCIAL / SIN IMPLEMENTAR en lo esencial.** Falta: (1) la cadena calórica que lo consume (D-002); (2) quitar el respaldo por fórmula; (3) **el campo `weight_goal_kg` hoy es OPCIONAL (`z.number().positive().max(500).nullable().optional()`); tiene que volverse OBLIGATORIO**, o el gate de "sin peso de referencia no se prescribe" se dispararía en casi todos los pacientes. · Afecta: cadena calórica (pipeline + pantalla de Evaluación).

**D-002 · Cadena calórica: Mifflin sobre peso de referencia + asimetría de estrategias.**
Decisión: el gasto se calcula con Mifflin sobre el peso de referencia; Cunningham sobre el peso medido queda como dato informativo, no entra a la prescripción. Las estrategias que RESTAN no llevan ajuste (la meta ya lo produce); las que SUMAN llevan ajuste explícito sobre el gasto calculado en peso de referencia. Cáncer activo = gasto + sobrecosto (la regla kcal/kg se descarta). El factor de actividad es valor fijo por defecto, ligero, elegido por el profesional.
- Fecha: 2026-08-03. · Origen: ronda 2026-08-03 §6.1-6.4 (sobre P1 2026-08-02).
- Estado: **DECIDIDO / SIN IMPLEMENTAR.** Regla cerrada; pendiente C6 (sobrecosto por condición y proteína en cifras) y la construcción. · Afecta: cadena calórica (pipeline + pantalla).
- **Requisito duro — SALVAGUARDA DE TCA (conducta, no solo el nombre):** cuando hay riesgo de conducta alimentaria Y el plan tiene déficit calórico, el sistema pone el DÉFICIT EN CERO, vuelve la dieta NORMOCALÓRICA y marca REMITIR a valoración especializada (prescribir pérdida de peso con riesgo de TCA es dañino). La detección es DOBLE: el motor nutricional detecta por la encuesta directa (métodos de riesgo reportados), y el motor de psicología amplía con un caso más (su `tcaFlag`: conducta de riesgo, o pérdida de control con insatisfacción). **La cadena NO se da por construida sin esta salvaguarda**, e idealmente con el motor de psicología para la detección amplia (por eso los tres motores van antes, ver D-008).

## Clasificación y diagnóstico

**D-003 · C11: la referencia del profesional sale del clasificador, con dirección explícita.**
Decisión: la referencia que ve el profesional sale del clasificador (no de la tabla de presentación); la dirección del indicador es explícita (IFC: bueno hacia arriba; IRC: hacia abajo); el candado que impide que las dos se separen en silencio se conserva.
- Fecha: firmado 2026-08-03. · Origen: C11 (firmado ronda 2026-08-03 §2).
- Estado: **FIRMADO · IMPLEMENTADO.** · Afecta: frozen + pantalla de diagnóstico.

**D-004 · Fenotipo estructural F1-F12 (MCCB) sellado y mostrado de aquí en adelante.**
Decisión: se agrega el fenotipo F1-F12; los diagnósticos ya emitidos conservan solo la clasificación de nueve estados y no se reescriben.
- Fecha: confirmado 2026-08-03. · Origen: confirmación C (ronda 2026-08-03) / Q19.
- Estado: **IMPLEMENTADO** (sellado en `emission_versions.structural_mccb`). · Afecta: pipeline.

**D-005 · Frontera de desnutrición re-sincronizada al archivo vigente.**
Decisión: cortes FMI H 3.0, FFMI H 17 / M 15 (unificación de la frontera de desnutrición del vigente).
- Fecha: re-sync del vigente 2026-07-30, implementado 2026-08-02. · Origen: archivo vigente (por regla de autoridad; verificado con el clasificador).
- Estado: **IMPLEMENTADO** (con bump de versión del protocolo). · Afecta: frozen `protocolo-fenotipo`. · Divergencia: Atlas sigue el vigente, no la versión de julio.

**D-006 · ICEC (índice contextual): activar el mapeo en Atlas sin esperar el archivo.**
Decisión: se activa el mapeo del ICEC en Atlas; si el archivo prototipo difiere, el desactualizado es el archivo (divergencia deliberada).
- Fecha: C1 2026-07-28, reactivación 2026-08-03. · Origen: C1 / D / Q26 (ronda 2026-08-03 §1.D).
- Estado: **DECIDIDO / BLOQUEADO POR INTERACCIÓN (verificado 2026-08-03).** Activar el mapeo cambia la ESCALA del índice contextual, pero la media (58,578) y la desviación (13,332) con las que la EB-BIS v5 lo estandariza se derivaron con el mapeo APAGADO. Activarlo sin revisar esa calibración movería la edad bioeléctrica por un cambio de escala, no por el estado del paciente (el coeficiente del z-score es −7.982; subir el ICEC baja la EB-BIS). Pendiente de confirmación de la Dirección Científica. **AGRAVANTE:** el propio comentario de Gildardo en el vigente (L6520-6528) dice textual "DESACTIVADO A PROPÓSITO, NO PONER EN true SIN RESOLVER LO SIGUIENTE" y estima que activarlo baja la EB-BIS de todos 1-8 años; su instrucción de "actívenlo en Atlas" (D/Q26) contradice ese comentario. Y la procedencia de μ/σ está SIN documentar incluso por él (su comentario pregunta "de dónde salieron"). No se ejecuta hasta resolver la calibración. · Afecta: frozen `engine.dfi` (ciencia-frozen) + calibración EB-BIS (C2b).

**D-007 · Encuesta incompleta: se diagnostica el bioeléctrico, pero no lo que depende de lo que falta.**
Decisión: el diagnóstico bioeléctrico se emite siempre (sale de la medición). Lo que depende de la encuesta NO se emite si está incompleta: no índice contextual con defaults, no edad bioeléctrica, no ruta derivada de esos dominios. El profesional ve qué dominios faltan y qué queda suspendido. La completitud se guarda con el diagnóstico; al completar, versión nueva sin sobrescribir.
- Fecha: 2026-08-03. · Origen: Q28 (ronda 2026-08-03 §3).
- Estado: **DECIDIDO / SIN IMPLEMENTAR** (bloque grande, toca el pipeline). · Afecta: pipeline + pantalla.

**D-015 · Regla general: manda el clasificador del motor, no la tabla de presentación.**
Decisión (regla general, aplica más allá de un indicador): cuando la ciencia (los clasificadores `cXXX` del motor) y la capa de presentación (`dXXX`) difieran, la referencia y la clasificación que valen son las del MOTOR. La tabla de presentación no define ciencia.
- Fecha: 2026-07-30 (Q20), reforzada al firmar C11 el 2026-08-03. · Origen: Q20 / C11.
- Estado: **IMPLEMENTADO** (aplicada a los rangos IFC/IRC/FMI y al candado de C11). · Afecta: frozen + pantallas. Es la regla de fondo que D-003 (C11) aplica a un caso concreto.

## Tratamiento

**D-008 · Los cuatro bloques de tratamiento por profesión se portan tal como están.**
Decisión: el modelo tiene cuatro bloques (nutricionista, médico, deportólogo/ejercicio, psicólogo), cada uno con su motor, ya escritos y funcionando en el archivo. Se portan verbatim, sin interpretarlos. INVARIANTE: el tratamiento nutricional lo activa SOLO el nutricionista; ninguna otra profesión genera protocolo nutricional, prescribe calorías o proteína, ni arma el plan alimentario.
- Fecha: 2026-08-03. · Origen: Q22 (ronda 2026-08-03 §4).
- Estado: **PARCIAL** (solo el del nutricionista, y parcial; los otros tres pendientes de portar; orden psico→ejercicio→médico). · Afecta: pantalla + pipeline de tratamiento.

**D-009 · Remisión es una acción registrable; a la propia profesión no es remisión.**
Decisión: remitir se registra (a quién, motivo, fecha, si el paciente volvió). Cuando la ruta remite a la MISMA profesión del que atiende, no es remisión sino conducta propia; corregir la redacción de todas las rutas en ese sentido.
- Fecha: 2026-08-03. · Origen: Q23 (ronda 2026-08-03 §5).
- Estado: **DECIDIDO / SIN IMPLEMENTAR.** · Afecta: datos (tabla nueva) + frozen (texto de rutas, modificación autorizada).

**D-010 · Comunicación del cambio al paciente: tres redacciones + confirmación + cita.**
Decisión: tres textos (mejoró / sin cambio / empeoró), sin cifra y sin nombrar el indicador (textos en RESPUESTA_GILDARDO 7.1). "Empeoró" solo sale si el profesional lo CONFIRMA (acto aparte de aprobar el reporte) y acompañada de la próxima cita agendada; sin confirmación o sin cita, el reporte sale sin esa sección. Mientras la calibración sea provisional, "sin cambio" se comunica como "sin cambios significativos con la información disponible" (no "se mantuvo estable").
- Fecha: 2026-08-03. · Origen: Q25 / ronda 2026-08-03 §7.
- Estado: **DECIDIDO / SIN IMPLEMENTAR** (P0 Parte 2). · Afecta: reporte + seguimiento. · Consulta abierta: si "cita agendada" se cumple con el campo de fecha lleno.

**D-011 · Presentación de la EB-BIS (paciente vs profesional).**
Decisión: la cifra de EB-BIS nunca va al paciente; al profesional con marca "calibración provisional, no comunicable". Primera medición del paciente: sin cifra ni la expresión "edad biológica", solo lectura funcional. Desde la segunda: el cambio en tres bandas (ver D-010).
- Fecha: 2026-08-01. · Origen: P0.
- Estado: **PARCIAL.** La cifra al profesional (terminología "Edad Bioeléctrica") está; la MARCA visible "calibración provisional / no comunicable" es gate del Hito 3 y está pendiente de verificar/implementar; las bandas al paciente son D-010, sin implementar. · Afecta: reporte.

**D-012 · Retirar el examen de telómeros/estrés oxidativo; ningún ítem cita el propio modelo.**
Decisión: se retira ese ítem del listado de exámenes sugeridos; ningún ítem del listado puede citar el propio modelo como referencia. (Verificado: es el único que lo hacía.)
- Fecha: 2026-08-03. · Origen: ronda 2026-08-03 §4.
- Estado: **DECIDIDO / SIN IMPLEMENTAR** (modificación autorizada del frozen: editar citando esta decisión, bump de versión, re-ancla de golden). · Afecta: frozen `atlas-protocolo` (ciencia-frozen).

**D-013 · Pantallas de las otras profesiones: decir que hay contenido pendiente de portar.**
Decisión: mientras los otros tres bloques no estén portados, la pantalla de esas profesiones dice explícitamente que el modelo SÍ tiene contenido para su disciplina, pendiente de portar.
- Fecha: 2026-08-03. · Origen: ronda 2026-08-03 §4.
- Estado: **DECIDIDO / SIN IMPLEMENTAR.** · Afecta: pantalla.

## Proceso

**D-014 · Autoridad y método.**
Decisión: el archivo prototipo deja de ser la fuente de ejecución; la fuente es la instrucción escrita. Donde discrepen, manda la instrucción y se registra la divergencia sin preguntar. Todo lo decidido se consolida en este documento numerado y firmado; las modificaciones a la ciencia congelada son una vista de este mismo documento (las entradas que afectan el frozen), no un archivo aparte. Regla de entrada: revisar antes de preguntar.
- Fecha: 2026-08-03. · Origen: ronda 2026-08-03 (cómo dejamos de repetir la conversación).
- Estado: **ADOPTADO.** · Afecta: proceso.

---

### Pendiente de Gildardo (su lado)
- **C6:** proteína y sobrecosto por condición, en cifras (destraba D-001/D-002).
- **P2:** destraba los nutracéuticos por ruta. **P3.**
- Respuesta a las tres consultas del 2026-08-03 (factor de actividad, salvaguarda TCA, cita).
- Sub-consulta ligada a D-006: sobre qué ICEC se calibró μ/σ de la EB-BIS (para activar el mapeo sin doble corrección).
