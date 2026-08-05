# DECISIONES ANI-BIS-E — documento consolidado (borrador para firma de Gildardo)

> **Gildardo:** este documento reemplaza las rondas de preguntas. Contiene todo lo decidido hasta hoy, numerado, para tu firma. Las preguntas abiertas están al final y ninguna nos bloquea; respóndelas cuando puedas. De aquí en adelante, antes de preguntarte algo revisamos si ya está aquí.

> **MÉTODO ACORDADO (2026-08-04, a pedido de Gildardo): un solo documento, no más rondas.** Gildardo pidió que NO le mandemos más rondas de preguntas sueltas. Toda duda (las consultas sin responder de rondas anteriores, las que salgan del v8, y lo que surja) se acumula en la sección **Preguntas abiertas** de ESTE documento, numerada `P-NNN`, y **no se le envía nada hasta que el trabajo lo exija** (un bloqueo real sin alternativa). Él responde todo al final, de una vez. Su instrucción explícita: "avancen lo más que puedan con el HTML nuevo y con Atlas; si no hay nada bloqueante, sigan hasta donde puedan". Así que el modo por defecto es AVANZAR con lo construible (ver `BACKLOG.md`), acumulando preguntas aquí, sin interrumpirlo.


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
- Estado: **DECIDIDO / BLOQUEADO POR INTERACCIÓN (verificado 2026-08-03).** Activar el mapeo cambia la ESCALA del índice contextual, pero la media (58,578) y la desviación (13,332) con las que la EB-BIS v5 lo estandariza se derivaron con el mapeo APAGADO. Activarlo sin revisar esa calibración movería la edad bioeléctrica por un cambio de escala, no por el estado del paciente (el coeficiente del z-score es −7.982; subir el ICEC baja la EB-BIS). Pendiente de confirmación de la Dirección Científica. **AGRAVANTE:** el propio comentario de Gildardo en el vigente (L6520-6528) dice textual "DESACTIVADO A PROPÓSITO, NO PONER EN true SIN RESOLVER LO SIGUIENTE" y estima que activarlo baja la EB-BIS de todos 1-8 años; su instrucción de "actívenlo en Atlas" (D/Q26) contradice ese comentario. Y la procedencia de μ/σ está SIN documentar incluso por él (su comentario pregunta "de dónde salieron"). **DECISIÓN NUESTRA (excepción a D-014, ver ARCHITECTURE): NO se activa.** La instrucción manda sobre el archivo salvo cuando el archivo advierte explícitamente contra ella; aquí el archivo lo hace ("no poner en true sin resolver esto"). Tampoco se decide de nuestro lado (mueve la edad de todos): se registra y se pregunta cuando haya ocasión (ver P-01). Además, ni queriendo se puede activar hoy: requiere `calcPatron` (C9, no portado) + `d7_agua` (no capturado). · Afecta: frozen `engine.dfi` (ciencia-frozen) + calibración EB-BIS (C2b).

**D-007 · Encuesta incompleta: se diagnostica el bioeléctrico, pero no lo que depende de lo que falta.**
Decisión: el diagnóstico bioeléctrico se emite siempre (sale de la medición). Lo que depende de la encuesta NO se emite si está incompleta: no índice contextual con defaults, no edad bioeléctrica, no ruta derivada de esos dominios. El profesional ve qué dominios faltan y qué queda suspendido. La completitud se guarda con el diagnóstico; al completar, versión nueva sin sobrescribir.
- Fecha: 2026-08-03. · Origen: Q28 (ronda 2026-08-03 §3).
- Estado: **DECIDIDO / SIN IMPLEMENTAR** (bloque grande, toca el pipeline). · Afecta: pipeline + pantalla.
- Avance (2026-08-04): la mitad de "completar sin sobrescribir" YA está construida y funciona (el flujo de corrección soporta agregar respuestas que faltaban, sin bloquear, y completar una pregunta con field_key mueve `dfi.complete`). Lo que falta es SOLO la otra mitad: suspender la emisión de lo que depende de la encuesta cuando está incompleta (completitud por dominio + gate + superficie de lo suspendido).

**D-015 · Regla general: manda el clasificador del motor, no la tabla de presentación.**
Decisión (regla general, aplica más allá de un indicador): cuando la ciencia (los clasificadores `cXXX` del motor) y la capa de presentación (`dXXX`) difieran, la referencia y la clasificación que valen son las del MOTOR. La tabla de presentación no define ciencia.
- Fecha: 2026-07-30 (Q20), reforzada al firmar C11 el 2026-08-03. · Origen: Q20 / C11.
- Estado: **IMPLEMENTADO** (aplicada a los rangos IFC/IRC/FMI y al candado de C11). · Afecta: frozen + pantallas. Es la regla de fondo que D-003 (C11) aplica a un caso concreto.

**D-016 · El ángulo de fase (AF) se informa SIEMPRE con UN decimal, en cualquier sitio.**
Decisión de la Dirección Científica (entrega v8, §2.2): "el AF se informa siempre con un decimal, en cualquier sitio donde aparezca. Dos decimales sugieren una exactitud que el equipo no tiene." El valor almacenado NO cambia (el cálculo interno sigue con precisión completa); solo la presentación.
- Fecha: 2026-08-04. · Origen: CAMBIOS_ATLAS_v8 §2.2.
- Estado: **DECIDIDO / SIN IMPLEMENTAR.** Verificado: Atlas muestra el AF con DOS decimales hoy. Sitios a corregir (mismo alcance que él enumera): la tabla de indicadores (`evaluation-results.tsx:68`, el `toFixed(2)` general) y su Δ (`indicator-ranges.ts:112`, `f(..., 2)`), la sección de composición, la tabla del PDF del paciente (`report-document.tsx`), la comparación de seguimiento (`comparison-reader`), el chip de AF bajo (`celular-badges.ts`), y el prompt de IA. Es carril rápido pero es decisión clínica suya (por eso va como decisión). CUIDADO: el `toFixed(2)` de `evaluation-results.tsx:68` es GENERAL de la tabla; el AF necesita 1 decimal SIN cambiar los demás indicadores a 1 (habría que formatear el AF aparte). · Afecta: display (varias pantallas + PDF + prompt).

## Tratamiento

**D-008 · Los cuatro bloques de tratamiento por profesión se portan tal como están.**
Decisión: el modelo tiene cuatro bloques (nutricionista, médico, deportólogo/ejercicio, psicólogo), cada uno con su motor, ya escritos y funcionando en el archivo. Se portan verbatim, sin interpretarlos. INVARIANTE: el tratamiento nutricional lo activa SOLO el nutricionista; ninguna otra profesión genera protocolo nutricional, prescribe calorías o proteína, ni arma el plan alimentario.
- Fecha: 2026-08-03. · Origen: Q22 (ronda 2026-08-03 §4).
- Estado: **PARCIAL (avanzado 2026-08-03).** Los TRES motores faltantes (médico, ejercicio, psicología) PORTADOS verbatim (`frozen/atlas-tratamiento.js`, DIFF + goldens) y CABLEADOS display-only en la vista del profesional (salida profesional-facing, nada al paciente). Se selló ASMI en el snapshot del diagnóstico (lo consumen médico/ejercicio) y se completó el port de los field_keys de tratamiento (d3_29 estrés, d5_40 medicamentos, d7_57 sed) con `used_in_diagnosis=false` (no gatean dfi.complete). Falta SOLO el del nutricionista: la cadena calórica (fórmula, validación, intercambio, menú), que espera C6. Invariante respetada: solo el nutricionista genera protocolo nutricional. · Afecta: frozen + pantalla + pipeline de tratamiento.

**D-009 · Remisión es una acción registrable; a la propia profesión no es remisión.**
Decisión: remitir se registra (a quién, motivo, fecha, si el paciente volvió). Cuando la ruta remite a la MISMA profesión del que atiende, no es remisión sino conducta propia; corregir la redacción de todas las rutas en ese sentido.
- Fecha: 2026-08-03. · Origen: Q23 (ronda 2026-08-03 §5).
- Estado: **DECIDIDO / SIN IMPLEMENTAR.** · Afecta: datos (tabla nueva) + frozen (texto de rutas, modificación autorizada).

**D-010 · Comunicación del cambio al paciente: tres redacciones + confirmación + cita.**
Decisión: tres textos (mejoró / sin cambio / empeoró), sin cifra y sin nombrar el indicador (textos en RESPUESTA_GILDARDO 7.1). "Empeoró" solo sale si el profesional lo CONFIRMA (acto aparte de aprobar el reporte) y acompañada de la próxima cita agendada; sin confirmación o sin cita, el reporte sale sin esa sección. Mientras la calibración sea provisional, "sin cambio" se comunica como "sin cambios significativos con la información disponible" (no "se mantuvo estable").
- Fecha: 2026-08-03. · Origen: Q25 / ronda 2026-08-03 §7.
- Estado: **DECIDIDO / SIN IMPLEMENTAR** (P0 Parte 2). · Afecta: reporte + seguimiento. · Consulta abierta: si "cita agendada" se cumple con el campo de fecha lleno.
- Dependencia de implementación (hallazgo 2026-08-03): las tres bandas salen de comparar la medición actual contra la previa, y esa comparación debe anclarse a la versión VIGENTE, no a una reemplazada por corrección. Hoy la comparación no filtra las reemplazadas (bug conocido, ver `BACKLOG.md` flujo de corrección); mal anclada, las tres bandas comparan contra el yo pre-corrección del paciente. Es lo primero a arreglar del checkpoint 2 del flujo de corrección.
- Sellado del corte provisional (implementación, 2026-08-04): la banda se SELLA en cada reporte junto con el corte (`cutYears`) con el que se calculó. Motivo: el corte es provisional (±2 años, se reemplaza por el cambio mínimo detectable cuando exista); el día que cambie, los reportes VIEJOS conservan su banda calculada con el corte anterior (no se reescribe lo emitido), y un profesional comparando dos reportes del mismo paciente podría ver bandas con criterios distintos. El `cutYears` sellado hace esa diferencia AUDITABLE. Escrito también en `eb-trajectory.ts` para que nadie lo lea como redundante y lo quite.

**D-011 · Presentación de la EB-BIS (paciente vs profesional).**
Decisión: la cifra de EB-BIS nunca va al paciente; al profesional con marca "calibración provisional, no comunicable". Primera medición del paciente: sin cifra ni la expresión "edad biológica", solo lectura funcional. Desde la segunda: el cambio en tres bandas (ver D-010).
- Fecha: 2026-08-01. · Origen: P0.
- Estado: **PARCIAL.** La cifra al profesional (terminología "Edad Bioeléctrica") está; la MARCA visible "calibración provisional / no comunicable" es gate del Hito 3 y está pendiente de verificar/implementar; las bandas al paciente son D-010, sin implementar. · Afecta: reporte.
- Dependencia de implementación (2026-08-03): el "cambio en tres bandas desde la segunda medición" depende del anclaje correcto de la comparación (ver la nota en D-010): debe ser contra la versión vigente anterior, no una reemplazada.

**D-012 · Retirar el examen de telómeros/estrés oxidativo; ningún ítem cita el propio modelo.**
Decisión: se retira ese ítem del listado de exámenes sugeridos; ningún ítem del listado puede citar el propio modelo como referencia. (Verificado: es el único que lo hacía.)
- Fecha: 2026-08-03. · Origen: ronda 2026-08-03 §4.
- Estado: **IMPLEMENTADO (2026-08-03), primera modificación autorizada del frozen (CA-1).** Se construyó por el MECANISMO de modificaciones autorizadas: el original `atlas-protocolo.js` queda intacto (byte-idéntico a Gildardo, su DIFF-vs-fuente sigue verde); el manifiesto `authorized-modifications.js` registra CA-1 (con la instrucción verbatim); un generador determinista produce `atlas-protocolo.authorized.js` (el que corre) = original menos el examen; un test byte-exacto prueba que el generado es original + manifiesto y nada más; `PROTOCOL_ENGINE_VERSION` subió a `anibise-protocolo-2026-08-03` (el listado de exámenes se sella). · Afecta: frozen `atlas-protocolo` (vía manifiesto, sin tocar el original).

**D-013 · Pantallas de las otras profesiones: decir que hay contenido pendiente de portar.**
Decisión: mientras los otros tres bloques no estén portados, la pantalla de esas profesiones dice explícitamente que el modelo SÍ tiene contenido para su disciplina, pendiente de portar.
- Fecha: 2026-08-03. · Origen: ronda 2026-08-03 §4.
- Estado: **IMPLEMENTADO (2026-08-03).** Con los tres motores cableados (D-008), el texto se corrigió: ya no dice "llega en una entrega posterior" (falso) ni "en construcción" con el protocolo debajo (contradictorio); dice que es vista de consulta, el protocolo del modelo está para el criterio del profesional, y la conducta se registra fuera de Atlas. · Afecta: pantalla.

## Proceso

**D-014 · Autoridad y método.**
Decisión: el archivo prototipo deja de ser la fuente de ejecución; la fuente es la instrucción escrita. Donde discrepen, manda la instrucción y se registra la divergencia sin preguntar. Todo lo decidido se consolida en este documento numerado y firmado; las modificaciones a la ciencia congelada son una vista de este mismo documento (las entradas que afectan el frozen), no un archivo aparte. Regla de entrada: revisar antes de preguntar.
- Fecha: 2026-08-03. · Origen: ronda 2026-08-03 (cómo dejamos de repetir la conversación).
- Estado: **ADOPTADO.** · Afecta: proceso.

---

## Preguntas abiertas (canal único, 2026-08-03)

Desde ahora las preguntas a Gildardo viven AQUÍ, no en mensajes sueltos (ver ARCHITECTURE, "Canal único"). Se numeran `P-NNN`, en la misma secuencia estable que las decisiones. Él las lee cuando pueda; solo se le escribe suelto si algo BLOQUEA trabajo real y no hay alternativa. Cuando responde, la pregunta se resuelve y su respuesta entra como decisión `D-NNN`.

**P-01 · ICEC y calibración de la EB-BIS (ligada a D-006). NO bloquea (no se puede activar hoy de todos modos).**
La EB-BIS v5 estandariza el ICEC contra μ=58,578 y σ=13,332 (vigente L5758), constantes derivadas con el mapeo del ICEC APAGADO. Activar el mapeo cambia la escala del índice pero deja μ/σ viejas, moviendo la edad bioeléctrica por escala, no por el paciente. Su propio comentario (vigente L6520-6528) marca el interruptor "DESACTIVADO A PROPÓSITO, NO PONER EN true SIN RESOLVER LO SIGUIENTE", estima 1-8 años de bajada, y deja abierta la procedencia de μ/σ. **Pregunta:** ¿μ y σ se ajustan junto con el mapeo (recalibración), o hay algo que no estamos viendo? Mientras tanto queda preparado pero sin activar.

**P-02 · Factor de actividad (ligada a D-002). NO bloquea.**
En 6.4 instruiste no construir el factor de actividad sugerido (valor fijo ligero). Al inventariar el archivo vimos que YA existe: el motor de ejercicio calcula un factor recomendado (moderado si obesidad, ligero en el resto) y el nutricional lo usa como default, con la última palabra del profesional. **Pregunta:** al portar el motor de ejercicio, ¿usamos ese factor como default (como hace el archivo) o lo dejamos fuera y mantenemos el fijo ligero (como pediste en 6.4)?

**P-03 · Salvaguarda de TCA (ligada a D-002). NO bloquea. Confirmación.**
Confirmar que la leímos bien: con riesgo de conducta alimentaria y déficit calórico, el motor nutricional pone el déficit en cero, vuelve la dieta normocalórica y marca remitir. Detección doble: el nutricional por la encuesta directa + el motor de psicología (definición ampliada). ¿Correcto?

**P-04 · Cita agendada (ligada a D-010). NO bloquea.**
En tu prototipo la "cita" es un campo de fecha (con frecuencia opcional), sin calendario ni recordatorios. Nosotros tenemos exactamente eso. **Pregunta:** ¿el requisito "empeoró solo con cita agendada" se cumple con ese campo lleno, o hace falta agenda real?

**P-05 · PHQ-9/GAD-7 son consult-only (ligada a D-008). NO bloquea. Confirmación.**
Al portar el motor psicológico verificamos que SCOFF se computa desde la encuesta (con conducta definida: remitir), pero PHQ-9 y GAD-7 quedan "aplicar en consulta" y el sistema no los captura ni computa. Así, Atlas nunca auto-detecta depresión/ansiedad/riesgo suicida. **Pregunta:** ¿es intencional dejar PHQ-9/GAD-7 a la consulta (fuera del sistema), o el sistema debería capturarlos?

**P-06 · Alcohol. NO bloquea.** El consumo de alcohol que el paciente reporta en la encuesta hoy no influye en ningún resultado del análisis. ¿Debería influir en algo?

**P-07 · Contaminantes ambientales. NO bloquea.** Lo que el paciente reporta sobre exposición a contaminantes ambientales hoy no cambia el diagnóstico ni activa ninguna ruta de atención. ¿Debería?

**P-08 · Indicadores que alertan juntos (Q24). NO bloquea, material no urgente.**
(Trasladada de Q24.) Indicadores que miden el mismo fenómeno y alertan a la vez; material para revisión de Gildardo, sin urgencia.

**P-09 · Dependencia de la suspensión por encuesta incompleta (D-007 Fase B). NO bloquea (Fase A ya informa).** (2026-08-04.) D-007 decidió que, con la encuesta incompleta, lo que depende de ella no se emite (edad bioeléctrica, ICEC, rutas derivadas), mientras el bioeléctrico de la medición se emite igual. Para construir la suspensión (Fase B) hace falta la dependencia exacta: ¿CUALQUIER dominio faltante suspende el trío entero (EB-BIS + ICEC + rutas dependientes), o cada salida depende de dominios específicos (p. ej. la EB-BIS depende de d2/d3/d5 vía LE8, pero no de d8)? Con la respuesta se decide si la suspensión es todo-o-nada o granular por salida. Fase A (el aviso que dice qué falta y qué se suspendería) ya está construida e informa; la suspensión real espera esto.

**P-10 · Validación de las 7 constantes de REF_POB (entrega v8 §6.2). NO bloquea (Atlas ya hace lo conservador).** (2026-08-04.) En el v8, cuando el Excel no trae referencias, un bloque `REF_POB` las calcula desde peso/talla/sexo. Gildardo marcó EXPLÍCITAMENTE que **siete de sus constantes las introdujo su asistente y NINGUNA estaba aprobada**: hidratación de la MLG 73,2%, reparto del agua 42/58, proteína total 19,4% MLG, proteína activa 70% de la total, mineral óseo 5,6% MLG, mineral no óseo 1,2% MLG, masa celular activa 50% MLG. Pide que la Dirección Científica las valide antes de usarlas con pacientes. **Su alternativa conservadora: dejar la columna Referencia VACÍA cuando el Excel no la trae, en vez de mostrar una referencia poblacional.** **Verificado (2026-08-04): Atlas YA hace lo conservador** — no tiene `REF_POB`, y la columna Referencia sale de los clasificadores `cXXX` (rango de normalidad del modelo, ciencia aprobada) o "-" cuando no aplica; no calcula referencias poblacionales. Así que la decisión es: **NO portar `REF_POB` hasta que Gildardo valide esas 7 constantes.** (Las otras dos de REF_POB, grasa 17,5/25 y ASMI 7,0/5,5, SÍ estaban aprobadas.)

**P-11 · Coherencia de la ruta R2 (de Q11). NO bloquea.** Dos reglas distintas activan R2: `computeDFI` por severidad del dominio 2 (autoritativa) y `RUTA_COND.R2` por umbral-OR (referencia); para un paciente real pueden discrepar. ¿Cuál representa el modelo vigente? Y confirmar que la regla del 2026-07-21 ("`rutasPorCondicion` no autoritativa") cubre R1-R6, no solo R5. Nuestro lado está verificado/cerrado; solo espera la respuesta de coherencia del modelo. (Migrada de Q11.)

**P-12 · ¿Gildardo mantiene su HTML sincronizado con las modificaciones autorizadas? (de Q21). NO bloquea, su flujo.** Ahora que el HTML dejó de ser material de formación (es su referencia científica) y Atlas aplicará modificaciones autorizadas que hacen divergir los dos a propósito: ¿mantiene su HTML actualizado con esos cambios (para conservarlo como entorno de prueba contra el que verificar Atlas), o lo deja como está y se apoya solo en `DIVERGENCIAS.md`/registro de cambios? Es decisión de SU flujo, prioridad baja. (Migrada de Q21.)

**P-13 · `estadoPBI`: ¿vigente o remanente? (de Q20). NO bloquea, sin urgencia.** Su `motorDiagnostico` computa `estadoPBI`, un clasificador de 9 estados Ángulo de Fase × Radio de Impedancia con umbrales de AF propios (distintos de `cAF` y del badge de AF). Atlas no lo muestra (se declaró de modelo anterior). ¿Sigue vigente en su modelo, o es remanente de una versión previa? Él mismo lo marcó "sin urgencia, ronda posterior". (Migrada de Q20.) Menor/opcional ligada: para IR y FFMI el motor y la presentación coinciden en cortes pero nombran el estado distinto ("Inflamación bajo grado" vs "de bajo grado"; "Bajo — riesgo desnutrición" vs "Desnutrición"); ¿qué palabra ve el profesional? Cosmético.

### Pendiente de Gildardo (su lado)
> **PRIORIDAD (2026-08-04): C6 es lo que MÁS pesa.** Es lo único que bloquea trabajo grande (la cadena calórica y todo lo que depende de ella); las demás consultas no detienen nada construible hoy. Cuando Santiago le escriba a Gildardo, C6 va primero.
- **C6:** proteína y sobrecosto por condición, en cifras (destraba D-001/D-002). **← el bloqueo de mayor peso.**
- **P2:** destraba los nutracéuticos por ruta. **P3.**
- Respuesta a las tres consultas del 2026-08-03 (factor de actividad, salvaguarda TCA, cita).
- Sub-consulta ligada a D-006: sobre qué ICEC se calibró μ/σ de la EB-BIS (para activar el mapeo sin doble corrección).
