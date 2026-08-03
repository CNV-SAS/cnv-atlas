# DECISIONES ANI-BIS-E — documento consolidado (borrador para firma de Gildardo)

**Qué es.** La fuente normativa única de las decisiones clínicas del modelo ANI-BIS-E. Firmado por la Dirección Científica (Gildardo), mantenido por el equipo de Atlas. Por la regla de autoridad, este documento manda sobre el archivo prototipo: donde discrepen, manda el documento, y la divergencia queda anotada aquí.

**Cómo leerlo.** Una decisión por entrada, numerada `D-NNN` (número estable). Cada una lleva su **Estado**, que distingue lo IMPLEMENTADO en Atlas de lo DECIDIDO pero AÚN NO construido. Esto importa: al firmar, una parte de estas decisiones ya opera en Atlas y otra todavía no.

**Regla de entrada:** antes de preguntar, buscar aquí. Si está, implementar (citando el `D-NNN`). Si está y no sirve, citar el número y decir qué falla. Si no está, preguntar; la respuesta entra con número nuevo.

**Estados usados:** `IMPLEMENTADO` · `PARCIAL` (parte construida, parte no) · `DECIDIDO / SIN IMPLEMENTAR` · `ADOPTADO` (regla de proceso) · `FIRMADO` (Gildardo lo cerró explícitamente).

**Nota:** las tres consultas del intercambio del 2026-08-03 (factor de actividad, mecánica de la salvaguarda TCA, cita = campo de fecha) NO entran todavía: entran cuando Gildardo responda.

---

## Cadena calórica y prescripción

**D-001 · Peso de referencia obligatorio para prescribir.**
Decisión: sin peso de referencia registrado no se emite prescripción calórica ni proteica. El peso de referencia es el que el profesional registra al medir (la meta a la que quiere llevar al paciente), NO un peso ajustado por fórmula sobre el peso medido; esa fórmula no entra en la cadena y su respaldo se quita del archivo.
Estado: **PARCIAL.** El campo de peso meta existe; la cadena calórica que lo consume no está construida; el respaldo por fórmula está pendiente de quitar. · Origen: P1 / confirmaciones A, B. · Afecta: cadena calórica (pipeline + pantalla).

**D-002 · Cadena calórica: Mifflin sobre peso de referencia + asimetría de estrategias.**
Decisión: el gasto se calcula con Mifflin sobre el peso de referencia; Cunningham sobre el peso medido queda como dato informativo, no entra a la prescripción. Las estrategias que RESTAN no llevan ajuste (la meta ya lo produce); las que SUMAN llevan ajuste explícito sobre el gasto calculado en peso de referencia. Cáncer activo = gasto + sobrecosto (la regla kcal/kg se descarta). El factor de actividad es valor fijo por defecto, ligero, elegido por el profesional.
Estado: **DECIDIDO / SIN IMPLEMENTAR.** Regla cerrada; pendiente C6 (sobrecosto y proteína en cifras) y la construcción. · Origen: 6.1-6.4. · Afecta: cadena calórica.
- **Requisito duro:** la SALVAGUARDA DE TCA va dentro de esta decisión. Si hay riesgo de conducta alimentaria y déficit, el déficit se pone en cero y la dieta vuelve normocalórica. La cadena NO se da por construida sin la salvaguarda. La detección amplia depende del motor de psicología (ver D-008).

## Clasificación y diagnóstico

**D-003 · C11: la referencia del profesional sale del clasificador, con dirección explícita.**
Decisión: la referencia que ve el profesional sale del clasificador (no de la tabla de presentación); la dirección del indicador es explícita (IFC: bueno hacia arriba; IRC: hacia abajo); el candado que impide que las dos se separen en silencio se conserva.
Estado: **FIRMADO · IMPLEMENTADO.** · Origen: C11. · Afecta: frozen + pantalla de diagnóstico.

**D-004 · Fenotipo estructural F1-F12 (MCCB) sellado y mostrado de aquí en adelante.**
Decisión: se agrega el fenotipo F1-F12; los diagnósticos ya emitidos conservan solo la clasificación de nueve estados y no se reescriben.
Estado: **IMPLEMENTADO** (sellado en `emission_versions.structural_mccb`). · Origen: confirmación C / Q19. · Afecta: pipeline.

**D-005 · Frontera de desnutrición re-sincronizada al archivo vigente.**
Decisión: cortes FMI H 3.0, FFMI H 17 / M 15 (unificación de la frontera de desnutrición del vigente).
Estado: **IMPLEMENTADO** (con bump de versión del protocolo). · Origen: re-sync 2026-07-30. · Afecta: frozen `protocolo-fenotipo`. · Divergencia: Atlas sigue el vigente, no la versión de julio.

**D-006 · ICEC (índice contextual): activar el mapeo en Atlas sin esperar el archivo.**
Decisión: se activa el mapeo del ICEC en Atlas; si el archivo prototipo difiere, el desactualizado es el archivo (divergencia deliberada).
Estado: **DECIDIDO / ACTIVACIÓN A VERIFICAR** (confirmar si ya está activo en el pipeline o queda pendiente). · Origen: C1 / D / Q26. · Afecta: pipeline.

**D-007 · Encuesta incompleta: se diagnostica el bioeléctrico, pero no lo que depende de lo que falta.**
Decisión: el diagnóstico bioeléctrico se emite siempre (sale de la medición). Lo que depende de la encuesta NO se emite si está incompleta: no índice contextual con defaults, no edad bioeléctrica, no ruta derivada de esos dominios. El profesional ve qué dominios faltan y qué queda suspendido. La completitud se guarda con el diagnóstico; al completar, versión nueva sin sobrescribir.
Estado: **DECIDIDO / SIN IMPLEMENTAR** (bloque grande, toca el pipeline). · Origen: Q28. · Afecta: pipeline + pantalla.

## Tratamiento

**D-008 · Los cuatro bloques de tratamiento por profesión se portan tal como están.**
Decisión: el modelo tiene cuatro bloques (nutricionista, médico, deportólogo/ejercicio, psicólogo), cada uno con su motor, ya escritos y funcionando en el archivo. Se portan verbatim, sin interpretarlos. INVARIANTE: el tratamiento nutricional lo activa SOLO el nutricionista; ninguna otra profesión genera protocolo nutricional, prescribe calorías o proteína, ni arma el plan alimentario.
Estado: **PARCIAL** (solo el del nutricionista, y parcial; los otros tres pendientes de portar). · Origen: Q22. · Afecta: pantalla + pipeline de tratamiento.

**D-009 · Remisión es una acción registrable; a la propia profesión no es remisión.**
Decisión: remitir se registra (a quién, motivo, fecha, si el paciente volvió). Cuando la ruta remite a la MISMA profesión del que atiende, no es remisión sino conducta propia; corregir la redacción de todas las rutas en ese sentido.
Estado: **DECIDIDO / SIN IMPLEMENTAR.** · Origen: Q23. · Afecta: datos (tabla nueva) + frozen (texto de rutas, modificación autorizada).

**D-010 · Comunicación del cambio al paciente: tres redacciones + confirmación + cita.**
Decisión: tres textos (mejoró / sin cambio / empeoró), sin cifra y sin nombrar el indicador (textos en RESPUESTA_GILDARDO 7.1). "Empeoró" solo sale si el profesional lo CONFIRMA (acto aparte de aprobar el reporte) y acompañada de la próxima cita agendada; sin confirmación o sin cita, el reporte sale sin esa sección.
Estado: **DECIDIDO / SIN IMPLEMENTAR** (P0 Parte 2). · Origen: Q25 / 7. · Afecta: reporte + seguimiento. · Consulta abierta: si "cita agendada" se cumple con el campo de fecha lleno.

**D-011 · Presentación de la EB-BIS (paciente vs profesional).**
Decisión: la cifra de EB-BIS nunca va al paciente; al profesional con marca "calibración provisional, no comunicable". Primera medición del paciente: sin cifra ni la expresión "edad biológica", solo lectura funcional. Desde la segunda: el cambio en tres bandas (ver D-010).
Estado: **PARCIAL** (la cifra al profesional con marca provisional: implementado; las bandas al paciente: D-010, sin implementar). · Origen: P0. · Afecta: reporte.

**D-012 · Retirar el examen de telómeros/estrés oxidativo; ningún ítem cita el propio modelo.**
Decisión: se retira ese ítem del listado de exámenes sugeridos; ningún ítem del listado puede citar el propio modelo como referencia. (Verificado: es el único que lo hacía.)
Estado: **DECIDIDO / SIN IMPLEMENTAR** (modificación autorizada del frozen: editar citando esta decisión, bump de versión, re-ancla de golden). · Origen: ronda 2026-08-03 §4. · Afecta: frozen `atlas-protocolo` (ciencia-frozen).

**D-013 · Pantallas de las otras profesiones: decir que hay contenido pendiente de portar.**
Decisión: mientras los otros tres bloques no estén portados, la pantalla de esas profesiones dice explícitamente que el modelo SÍ tiene contenido para su disciplina, pendiente de portar.
Estado: **DECIDIDO / SIN IMPLEMENTAR.** · Origen: ronda 2026-08-03 §4. · Afecta: pantalla.

## Proceso

**D-014 · Autoridad y método.**
Decisión: el archivo prototipo deja de ser la fuente de ejecución; la fuente es la instrucción escrita. Donde discrepen, manda la instrucción y se registra la divergencia sin preguntar. Todo lo decidido se consolida en este documento numerado y firmado; las modificaciones a la ciencia congelada son una vista de este mismo documento (las entradas que afectan el frozen), no un archivo aparte. Regla de entrada: revisar antes de preguntar.
Estado: **ADOPTADO.** · Origen: ronda 2026-08-03 (cómo dejamos de repetir la conversación). · Afecta: proceso.

---

### Pendiente de Gildardo (su lado)
- **C6:** proteína y sobrecosto por condición, en cifras (destraba D-001/D-002).
- **P2:** destraba los nutracéuticos por ruta. **P3.**
- Respuesta a las tres consultas del 2026-08-03 (factor de actividad, salvaguarda TCA, cita).
