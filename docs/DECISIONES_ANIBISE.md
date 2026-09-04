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

**D-002 · Cadena calórica: Mifflin sobre PESO ACTUAL, el déficit sale del peso meta + cifras C6.**
Decisión (ENMENDADA 2026-08-09 por Gildardo, ver `entregas/gildardo-2026-08-09/`): el gasto (Mifflin) se calcula sobre el **PESO ACTUAL**, no sobre el de referencia; "el gasto basal es una medición del cuerpo que existe HOY; lo que sale del peso meta es el DÉFICIT, no el gasto". Cunningham sobre el peso medido queda informativo. **El DÉFICIT sale del peso meta** = (peso actual − peso meta), NO un valor fijo por fenotipo (el motor hoy aplica −500 en obesidad; se reemplaza). El fenotipo puede sugerir un inicial, pero el peso meta lo reemplaza en cuanto está fijado. El factor de actividad usa el `faRec` del motor de ejercicio como default editable (ver P-02, resuelto).
- **COTEJO CONTRA EL ORIGINAL: PASÓ (2026-08-09).** El `.md` original de Gildardo llegó a `entregas/gildardo-2026-08-09/RESPUESTA_GILDARDO_2026-08-09.md` (reemplazó la transcripción; header "De: Gildardo Uribe"). Se cotejaron TODAS las cifras C6 de abajo contra el original, una por una: **ni un decimal movido.** Detalle nuevo que precisa el original (no estaba en la transcripción): el gatillo del sodio por "alteración hídrica" = **IEHH>1, AEC/ACT>44% o sed reportada** (2000 mg si no hay otro límite). Las cifras de abajo quedan VERIFICADAS, aptas para construir.
- **Cifras C6 (verbatim de Gildardo 2026-08-09, no reconstruir de memoria; detalle en el registro de la respuesta):** PROTEÍNA g/kg SOBRE EL PESO META: sin condición 1.0 · cáncer/desnutrición 1.25 · obesidad 1.3 · obesidad+sarcopenia 1.4 · sarcopenia 1.4 · **ERC 0.7 (0.6-0.8), y la ERC MANDA sobre la proteína alta** (ERC+sarcopenia → 0.7). ENERGÍA: cáncer/desnutrición 27.5 kcal/kg de PESO ACTUAL; resto GET−déficit; piso SOLO con déficit 1500 H/1200 M; el arranque 10-15 kcal/kg (realimentación) es NOTA CLÍNICA, no cálculo. GRASA 25% dislipidemia (saturada <7%) / 30% resto. SODIO: gana la más restrictiva (HTA 1500+DASH / ERC 2000 / hídrica 2000 si no hay otra). DM2: sin cambio de cifras, agrega CHO controlados bajo IG. Las CONDICIONES se derivan de la COMPOSICIÓN (obesidad IMC≥30 o FMI>6H/9M; sarcopenia FFMI 17/15 o ASMI<7.0/5.5; desnutrición IMC<18.5): un paciente sin diagnóstico puede activar el protocolo igual.
- **DEFECTO CRÍTICO (nota 3 de Gildardo, defecto en su propio código):** el peso meta tiene un DEFAULT (Lorentz) y si el profesional no lo fija, se usa SIN QUE NADIE LO NOTE; como la proteína se calcula sobre él, **la prescripción cambia en silencio.** El default hay que **hacerlo VISIBLE en pantalla**. Además: `pesoAjust` se calcula y no se usa (código muerto: usar o retirar); el default de Lorentz solo aplica con IMC fuera de 18.5-25 (si no, usa el peso actual). Es la misma familia de defectos silenciosos que venimos cazando.
  - **EN ATLAS EL DEFECTO ES OTRO Y PEOR (verificado 2026-08-09):** el campo de peso meta **NO EXISTE en la interfaz**. El panel edita kcal/proteína directo; el action lee `adjPesoMeta` pero **ningún input lo envía**, así que `computeProtocoloEfectivo` cae SIEMPRE a `pesoEfectivo = pesoCalculo`, y `pesoCalculo` lo computa el FROZEN `motorProtocolo` (atlas-protocolo.js:57) como `(IRC||Cáncer)?peso : imc<25?peso : PI+0.25*(peso-PI)`. **Para obesidad (IMC≥25) ese `PI+0.25*(peso-PI)` es EXACTAMENTE `pesoAjust`, la fórmula que Gildardo llama código muerto.** O sea: Atlas usa la fórmula muerta como peso de cálculo VIVO, en el frozen, sin decirlo, y **no hay forma de fijar el peso meta**. (Corrige una imprecisión previa: no es "peso medido" siempre; es pesoAjust para obesidad.)
  - **Consecuencia para el orden de construcción:** el default vive en el FROZEN (`pesoCalculo`), así que "alinearlo al peso meta de Lorentz" es parte del RE-PORT (Pieza 2, autorizado + versión de emisión + DIFF), no un cambio de glue. Un cambio glue-only del fallback del efectivo, con el frozen sugerido todavía en pesoAjust, crearía un desajuste sugerido/efectivo. **Pieza 1 = surfacing honesto del peso meta ACTUAL** (mostrar `pesoCalculo` con su `pesoCalculoLabel`, editable vía `adjPesoMeta`): visible y fijable, shown==used, sin tocar frozen. **Pieza 2** cambia `pesoCalculo` al default de peso meta (Lorentz `round(PI)`, ya portado en `peso-meta.ts` `1e0eb09`) y retira pesoAjust, con una sola versión de emisión. `pesoAjust` como símbolo no existe en Atlas, pero su FÓRMULA sí (dentro de pesoCalculo): se retira en el re-port.
- Fecha: 2026-08-03, ENMENDADA 2026-08-09. · Origen: ronda 2026-08-03 §6 + respuesta 2026-08-09 (C6).
- Estado: **DECIDIDO / SIN IMPLEMENTAR, ahora COMPLETO (C6 desbloqueado).** · Afecta: cadena calórica (pipeline + pantalla).
- **SALVAGUARDA DE TCA — ES ALERTA, NO BLOQUEA (CORREGIDO 2026-08-09).** Lo teníamos MAL como requisito duro ("déficit a cero, normocalórica, la cadena no se da por construida sin ella"). Gildardo: la salvaguarda genera **ALERTA**, y el **peso meta acordado sigue gobernando el cálculo**; el `pausadoTCA` que anula el déficit es un BUG que él ya corrigió en el v8. Menos mal que no lo construimos. La detección (SCOFF + tcaFlag) sí se conserva, pero su efecto es alertar/remitir, no anular el cálculo. (TCA = Trastorno de la Conducta Alimentaria, SIN relación con ICA-BIS = carga alostática; verificado que no los mezclamos.)

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
- Estado: **IMPLEMENTADO (2026-08-05, lote de carril rapido).** Se formatea el AF a 1 decimal en los sitios reales de Atlas (menos que en su prototipo: la composicion usa la clasificacion no el numero, la badge no muestra el numero, no hay prompt IA con AF). Sitios a corregir (mismo alcance que él enumera): la tabla de indicadores (`evaluation-results.tsx:68`, el `toFixed(2)` general) y su Δ (`indicator-ranges.ts:112`, `f(..., 2)`), la sección de composición, la tabla del PDF del paciente (`report-document.tsx`), la comparación de seguimiento (`comparison-reader`), el chip de AF bajo (`celular-badges.ts`), y el prompt de IA. Es carril rápido pero es decisión clínica suya (por eso va como decisión). CUIDADO: el `toFixed(2)` de `evaluation-results.tsx:68` es GENERAL de la tabla; el AF necesita 1 decimal SIN cambiar los demás indicadores a 1 (habría que formatear el AF aparte). · Afecta: display (varias pantallas + PDF + prompt).

## Tratamiento

**D-008 · Los cuatro bloques de tratamiento por profesión se portan tal como están.**
Decisión: el modelo tiene cuatro bloques (nutricionista, médico, deportólogo/ejercicio, psicólogo), cada uno con su motor, ya escritos y funcionando en el archivo. Se portan verbatim, sin interpretarlos. INVARIANTE: el tratamiento nutricional lo activa SOLO el nutricionista; ninguna otra profesión genera protocolo nutricional, prescribe calorías o proteína, ni arma el plan alimentario.
- Fecha: 2026-08-03. · Origen: Q22 (ronda 2026-08-03 §4).
- Estado: **PARCIAL (avanzado 2026-08-03).** Los TRES motores faltantes (médico, ejercicio, psicología) PORTADOS verbatim (`frozen/atlas-tratamiento.js`, DIFF + goldens) y CABLEADOS display-only en la vista del profesional (salida profesional-facing, nada al paciente). Se selló ASMI en el snapshot del diagnóstico (lo consumen médico/ejercicio) y se completó el port de los field_keys de tratamiento (d3_29 estrés, d5_40 medicamentos, d7_57 sed) con `used_in_diagnosis=false` (no gatean dfi.complete). Falta SOLO el del nutricionista: la cadena calórica (fórmula, validación, intercambio, menú), que espera C6. Invariante respetada: solo el nutricionista genera protocolo nutricional. · Afecta: frozen + pantalla + pipeline de tratamiento.

**D-009 · Remisión es una acción registrable; a la propia profesión no es remisión.**
Decisión: remitir se registra (a quién, motivo, fecha, si el paciente volvió). Cuando la ruta remite a la MISMA profesión del que atiende, no es remisión sino conducta propia; corregir la redacción de todas las rutas en ese sentido.
- Fecha: 2026-08-03. · Origen: Q23 (ronda 2026-08-03 §5).
- Estado: **Parte A (registro) COMPLETA 2026-08-08** (tabla + trigger de inmutabilidad write-once + RLS + dominio + UI; el retorno lo marca cualquier profesional asignado ahora; avisos de fecha futura rechazada, remisión repetida pendiente, y origen de la consulta en la lista, tras el smoke de Santiago). **Parte B (redacción "conducta propia")** espera a Gildardo (Q32/P-15, con la lista de auto-remisiones por ruta). Afecta: datos (tabla nueva) + frozen (texto de rutas, modificación autorizada).
- **Decisión del guard del retorno (2026-08-08, NO endurecer): "el paciente volvió" lo puede marcar CUALQUIER profesional asignado al paciente AHORA, no el que registró la remisión.** Argumento: entre la remisión y el retorno pueden pasar MESES y otro tratamiento de por medio; puede atender otro profesional cuando el paciente vuelve. Exigir el mismo que remitió volvería el segundo acto imposible en el caso normal. La pertenencia la impone la RLS `is_patient_professional(patient_id)` (asignado ahora), no el creador. Parece un hueco pero es lo que hace usable el retorno; no cambiar a "solo el creador".

**D-010 · Comunicación del cambio al paciente: tres redacciones + confirmación + cita.**
Decisión: tres textos (mejoró / sin cambio / empeoró), sin cifra y sin nombrar el indicador (textos en RESPUESTA_GILDARDO 7.1). "Empeoró" solo sale si el profesional lo CONFIRMA (acto aparte de aprobar el reporte) y acompañada de la próxima cita agendada; sin confirmación o sin cita, el reporte sale sin esa sección. Mientras la calibración sea provisional, "sin cambio" se comunica como "sin cambios significativos con la información disponible" (no "se mantuvo estable").
- Fecha: 2026-08-03. · Origen: Q25 / ronda 2026-08-03 §7.
- Estado: **DECIDIDO / SIN IMPLEMENTAR** (P0 Parte 2). · Afecta: reporte + seguimiento. · Consulta abierta: si "cita agendada" se cumple con el campo de fecha lleno.
- Dependencia de implementación (hallazgo 2026-08-03): las tres bandas salen de comparar la medición actual contra la previa, y esa comparación debe anclarse a la versión VIGENTE, no a una reemplazada por corrección. Hoy la comparación no filtra las reemplazadas (bug conocido, ver `BACKLOG.md` flujo de corrección); mal anclada, las tres bandas comparan contra el yo pre-corrección del paciente. Es lo primero a arreglar del checkpoint 2 del flujo de corrección.
- Sellado del corte provisional (implementación, 2026-08-04): la banda se SELLA en cada reporte junto con el corte (`cutYears`) con el que se calculó. Motivo: el corte es provisional (±2 años, se reemplaza por el cambio mínimo detectable cuando exista); el día que cambie, los reportes VIEJOS conservan su banda calculada con el corte anterior (no se reescribe lo emitido), y un profesional comparando dos reportes del mismo paciente podría ver bandas con criterios distintos. El `cutYears` sellado hace esa diferencia AUDITABLE. Escrito también en `eb-trajectory.ts` para que nadie lo lea como redundante y lo quite.

**D-011 · Presentación de la EB-BIS (paciente vs profesional).**
Decisión: la cifra de EB-BIS nunca va al paciente; al profesional con marca "calibración provisional, no comunicable". Primera medición del paciente: sin cifra ni la expresión "edad biológica", solo lectura funcional. Desde la segunda: el cambio en tres bandas (ver D-010).
- Fecha: 2026-08-01. · Origen: P0.
- Estado: **PARCIAL.** La cifra al profesional (terminología "Edad Bioeléctrica") está; la MARCA visible "calibración provisional / no comunicable" está pendiente de verificar/implementar (su hito y estado como gate: `LANZAMIENTO.md`); las bandas al paciente son D-010, sin implementar. · Afecta: reporte.
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

**P-01 · ICEC y calibración de la EB-BIS (ligada a D-006). ELEVADA A BLOQUEANTE 2026-08-13: es la única pieza del motor que queda mal para TODO paciente.**
La EB-BIS v5 estandariza el ICEC contra μ=58,578 y σ=13,332 (vigente L5758), constantes derivadas con el mapeo del ICEC APAGADO. Activar el mapeo cambia la escala del índice pero deja μ/σ viejas, moviendo la edad bioeléctrica por escala, no por el paciente. Su propio comentario (vigente L6520-6528) marca el interruptor "DESACTIVADO A PROPÓSITO, NO PONER EN true SIN RESOLVER LO SIGUIENTE", estima 1-8 años de bajada, y deja abierta la procedencia de μ/σ. **Pregunta:** ¿μ y σ se ajustan junto con el mapeo (recalibración), o hay algo que no estamos viendo?

**ADDENDUM 2026-08-13 (salió al construir la guarda de calcLE8, CA-3).** Esto NO es una pregunta menor: con `LE8_MAPEO_CORREGIDO=false`, DOS de los OCHO dominios del LE8 corren con valores FIJOS para todo el mundo. Alimentación clavada en 30 (lee d1_9/d1_10, que la encuesta no captura) e Hidratación en 20 (lee d1_16, idem). Es un índice que se calcula con dos octavos inventados, y arrastra al ICEC, a la edad bioeléctrica y al riesgo integrado. **Estado del código para activarlo (más avanzado de lo que decía el comentario stale):** (a) `d7_agua` YA se captura (seed, field_key contador); (b) `calcPatron` YA está portado (`engine.patron.js`), solo NO está cableado dentro de `engine.dfi.js`; (c) el flip va por modificaciones autorizadas (rompe DIFF-dfi si se toca a mano). El trabajo de código restante es CHICO: cablear calcPatron + el flip.

**CIERRE 2026-08-13 (verificado en el HTML al día, `gildardo-2026-08-13/ATLAS_v8.html` L7850-7864): P-01 YA NO ES PREGUNTA PARA GILDARDO.** Su "Condición de activación (Dirección Científica, 9-ago, punto 13 del paquete)" resuelve el fondo: *"el ICEC afecta la edad bioeléctrica, y por tanto NO puede activarse el mapeo dejando intactas μ y σ. Se recalibran en el MISMO acto, nunca por separado."* Da igual si las actuales salieron del ICEC roto: se recalibran al activar, punto. Así que P-01 pasa de PREGUNTA a **TAREA nuestra (C1):** (1) recalcular μ y σ del ICEC sobre NUESTROS registros con el mapeo ya corregido; (2) sustituir esos dos números en `_zBis` del término contextual; (3) cablear calcPatron + el flip por modificaciones autorizadas. **Dependencia real:** tener un dataset de ICEC (corregido) suficiente para recalcular μ/σ. No hay nada que preguntarle a Gildardo. Hoy NO bloquea el lanzamiento (el mapeo sigue apagado y el sistema funciona; el defecto de los dos octavos fijos queda registrado aquí). Va al BACKLOG como C1, no a una ronda.

**ADVERTENCIA 2026-08-22 (pieza 1b, PARA QUIEN HAGA EL FLIP):** desde 1b, `d7_agua` YA tiene field_key (`treatmentEngine`, para el parrafo de dieta del Resumen Clinico) y por tanto YA FLUYE al input del motor. Hoy no tiene efecto SOLO porque `LE8_MAPEO_CORREGIDO=false` (el frozen lee `d1_16`=0, no `d7_agua`); probado en `diet-fields-engine-inert.test`. Consecuencia: cuando se voltee el switch (paso 3 de la tarea C1), `d7_agua` empezara a alimentar la hidratacion del LE8 -> ICEC -> EB-BIS -> DFI **AUTOMATICAMENTE, sin tocar el seed** (el dato ya llega). Eso **baja la EB-BIS de todos 1-8 años** (su comentario L6520-6528). NO es un flip mecanico: es un cambio de diagnostico, con golden nuevo, la recalibracion de μ/σ del mismo acto (obligatoria, Dirección Científica) y la validacion correspondiente. La nota vive tambien en `seed.ts` (d7_agua) y en `2026-08-22_diet_field_keys.sql`.

**P-02 · Factor de actividad (ligada a D-002). NO bloquea.**
En 6.4 instruiste no construir el factor de actividad sugerido (valor fijo ligero). Al inventariar el archivo vimos que YA existe: el motor de ejercicio calcula un factor recomendado (moderado si obesidad, ligero en el resto) y el nutricional lo usa como default, con la última palabra del profesional. **Pregunta:** al portar el motor de ejercicio, ¿usamos ese factor como default (como hace el archivo) o lo dejamos fuera y mantenemos el fijo ligero (como pediste en 6.4)?

**P-03 · Salvaguarda de TCA (ligada a D-002). NO bloquea. Confirmación.**
Confirmar que la leímos bien: con riesgo de conducta alimentaria y déficit calórico, el motor nutricional pone el déficit en cero, vuelve la dieta normocalórica y marca remitir. Detección doble: el nutricional por la encuesta directa + el motor de psicología (definición ampliada). ¿Correcto?

**P-04 · Cita agendada (ligada a D-010). NO bloquea.**
En tu prototipo la "cita" es un campo de fecha (con frecuencia opcional), sin calendario ni recordatorios. Nosotros tenemos exactamente eso. **Pregunta:** ¿el requisito "empeoró solo con cita agendada" se cumple con ese campo lleno, o hace falta agenda real?

**P-05 · PHQ-9/GAD-7 son consult-only (ligada a D-008). RESUELTA POR EL ARCHIVO (2026-08-08): NO se le pregunta a Gildardo.**
Al portar el motor psicológico verificamos que SCOFF se computa desde la encuesta (con conducta definida: remitir), pero PHQ-9 y GAD-7 quedan "aplicar en consulta" y el sistema no los captura ni computa. **El v8 mismo los define como "aplicar en consulta": ES su diseño (consult-only, intencional).** Así que la parte "¿es intencional?" está respondida por el archivo. Que Atlas los capture o no es DECISIÓN NUESTRA (producto), no clínica de Gildardo. Se saca del paquete para no re-preguntar lo que su archivo ya muestra.

**P-06 · Alcohol. NO bloquea.** El consumo de alcohol que el paciente reporta en la encuesta hoy no influye en ningún resultado del análisis. ¿Debería influir en algo?

**P-07 · Contaminantes ambientales. NO bloquea.** Lo que el paciente reporta sobre exposición a contaminantes ambientales hoy no cambia el diagnóstico ni activa ninguna ruta de atención. ¿Debería?

**P-08 · Indicadores que alertan juntos (Q24). NO bloquea, material no urgente.**
(Trasladada de Q24.) Indicadores que miden el mismo fenómeno y alertan a la vez; material para revisión de Gildardo, sin urgencia.

**P-09 · Dependencia de la suspensión por encuesta incompleta (D-007 Fase B). NO bloquea (Fase A ya informa).** (2026-08-04.) D-007 decidió que, con la encuesta incompleta, lo que depende de ella no se emite (edad bioeléctrica, ICEC, rutas derivadas), mientras el bioeléctrico de la medición se emite igual. Para construir la suspensión (Fase B) hace falta la dependencia exacta: ¿CUALQUIER dominio faltante suspende el trío entero (EB-BIS + ICEC + rutas dependientes), o cada salida depende de dominios específicos (p. ej. la EB-BIS depende de d2/d3/d5 vía LE8, pero no de d8)? Con la respuesta se decide si la suspensión es todo-o-nada o granular por salida. Fase A (el aviso que dice qué falta y qué se suspendería) ya está construida e informa; la suspensión real espera esto.

**P-10 · Validación de las 7 constantes de REF_POB (entrega v8 §6.2). NO bloquea (Atlas ya hace lo conservador).** (2026-08-04.) En el v8, cuando el Excel no trae referencias, un bloque `REF_POB` las calcula desde peso/talla/sexo. Gildardo marcó EXPLÍCITAMENTE que **siete de sus constantes las introdujo su asistente y NINGUNA estaba aprobada**: hidratación de la MLG 73,2%, reparto del agua 42/58, proteína total 19,4% MLG, proteína activa 70% de la total, mineral óseo 5,6% MLG, mineral no óseo 1,2% MLG, masa celular activa 50% MLG. Pide que la Dirección Científica las valide antes de usarlas con pacientes. **Su alternativa conservadora: dejar la columna Referencia VACÍA cuando el Excel no la trae, en vez de mostrar una referencia poblacional.** **Verificado (2026-08-04): Atlas YA hace lo conservador** — no tiene `REF_POB`, y la columna Referencia sale de los clasificadores `cXXX` (rango de normalidad del modelo, ciencia aprobada) o "-" cuando no aplica; no calcula referencias poblacionales. Así que la decisión es: **NO portar `REF_POB` hasta que Gildardo valide esas 7 constantes.** (Las otras dos de REF_POB, grasa 17,5/25 y ASMI 7,0/5,5, SÍ estaban aprobadas.)

**REPLANTEO 2026-08-15 (Santiago + CC): portarlas CON MARCA "en validación", no dejarlas vacías.** Al releer la cita EXACTA de Gildardo (v8 §6.2, L6616-6636 del HTML 08-04): *"ATENCIÓN — DECISIÓN CLÍNICA... Estas constantes las debe validar la Dirección Científica... valores estándar de BIA que yo introduje y NO estaban aprobadas aquí... validar"*. Dijo **"validar", NO "no mostrar"**: y **su propio HTML LAS USA** (el bloque REF_POB las computa como "último recurso" y muestra las lecturas que dependen de ellas). Dejarlas vacías fue NUESTRA interpretación conservadora, no su instrucción. Propuesta: portar REF_POB y **mostrar las referencias derivadas de las 5 constantes no validadas con una marca visible "en validación"** (las 2 que él ya validó en §9 -hidratación 73,2% y MCA 52,4%- van SIN marca). Así el profesional ve lo mismo que su modelo y no ocultamos que esperan confirmación. **Pregunta para la ronda SIGUIENTE (no abrir ronda nueva aún; la del 14 está sin procesar):** "las mostramos marcadas como en validación; ¿confirmas o prefieres otra cosa? Tu propio archivo las usa, así que quizá la instrucción de 'no darlas por validadas' era para otro momento y ya no aplica." Registrada en la cola.

**P-11 · Coherencia de la ruta R2 (de Q11). NO bloquea.** Dos reglas distintas activan R2: `computeDFI` por severidad del dominio 2 (autoritativa) y `RUTA_COND.R2` por umbral-OR (referencia); para un paciente real pueden discrepar. ¿Cuál representa el modelo vigente? Y confirmar que la regla del 2026-07-21 ("`rutasPorCondicion` no autoritativa") cubre R1-R6, no solo R5. Nuestro lado está verificado/cerrado; solo espera la respuesta de coherencia del modelo. (Migrada de Q11.)

**P-12 · ¿Gildardo mantiene su HTML sincronizado con las modificaciones autorizadas? (de Q21). NO bloquea, su flujo.** Ahora que el HTML dejó de ser material de formación (es su referencia científica) y Atlas aplicará modificaciones autorizadas que hacen divergir los dos a propósito: ¿mantiene su HTML actualizado con esos cambios (para conservarlo como entorno de prueba contra el que verificar Atlas), o lo deja como está y se apoya solo en `DIVERGENCIAS.md`/registro de cambios? Es decisión de SU flujo, prioridad baja. (Migrada de Q21.)

**P-13 · `estadoPBI`: RESUELTA POR EL ARCHIVO (2026-08-08): es VIGENTE, no remanente.** Su `motorDiagnostico` computa `estadoPBI`, un clasificador de 9 estados Ángulo de Fase × Radio de Impedancia con umbrales de AF propios. **Verificado en el v8: está en la "CAPA 2 — TESIS DOCTORAL (MCCB + PBI + EIEC)", se computa y se usa en la narrativa del diagnóstico ("El estado PBI resultante es de riesgo funcional...").** Nuestra suposición previa (que era de un modelo anterior) era ERRÓNEA. Así que la pregunta "¿vigente o remanente?" está respondida: vigente. Se saca del paquete de Gildardo; queda como **hueco de Atlas** (Atlas no muestra un clasificador que el v8 sí usa): decisión nuestra de si portarlo, con su matiz de umbrales de AF propios (distintos de `cAF`). Va al inventario del cotejo, no a Gildardo. Menor/opcional cosmético ligado (nombres de estado IR/FFMI): sigue abierto pero es del mismo grupo que P-18.

**P-14 · La próxima cita del "empeoró": ¿debe aparecer en el reporte del paciente? (de D-010, tras el smoke 2026-08-05). NO bloquea (implementado formalmente).** Pusiste como condición que el empeoramiento solo se comunique con la próxima cita AGENDADA. Lo implementamos: el profesional no puede confirmar la comunicación sin poner la fecha. **Pero esa fecha queda registrada en el TRATAMIENTO y NO aparece en el reporte del paciente, y el texto que él recibe dice "Tu profesional revisará contigo el plan en la próxima consulta" SIN decir cuándo.** Así, el requisito se cumple formalmente pero quizá no su propósito (que nadie reciba un empeoramiento sin saber cuándo lo vuelven a ver). **¿La fecha debería aparecer en el reporte del paciente, o el requisito es solo que el profesional la tenga registrada?** No lo decidimos de nuestro lado: es tu condición y tu propósito.

**P-15 · Redacción "conducta propia" de las rutas (D-009 Parte B, de Q32). NO bloquea (el registro ya opera).** Cuando una ruta remite a la MISMA profesión del que atiende, no es remisión sino conducta propia. Necesitamos la lista de auto-remisiones por ruta y la redacción con que corregir el texto de cada una (modificación autorizada del frozen).

**P-16 · La pregunta de CIRUGÍAS digestivas/metabólicas que falta portar (de Q34). NO bloquea el cotejo, puede tocar el motor.** Tu v8 tiene en D6 una pregunta (colecistectomía, bariátrica, resección, gastrectomía) que nuestra encuesta no tenía; la vamos a portar. Una bariátrica cambia la absorción. **¿Alimenta el motor nutricional (con `field_key`), o es solo registro clínico?** Si alimenta, qué opción cambia qué.

**P-17 · Dos valores de referencia que el import del Biody BIS no trae (de Q35). Toca el import del equipo real.** El equipo que CNV tiene (Biody BIS) trae la espectroscopía, así que Atlas lo importa; pero su export corto no trae `MCA_ref` ni `hidSG_ref`. Tus identidades de derivación resuelven todo lo demás, pero esos dos son referencias poblacionales que ninguna identidad produce, y gatean el término MCA de ISCM y dos badges. **¿Nos das la tabla de referencia de esos dos por sexo/edad, o gateamos a null (para no degradar en silencio)?**

**P-18 · Nombres largos de indicadores que difieren entre tus vistas (del cotejo de Diagnóstico). NO bloquea, nomenclatura.** Cotejando la pantalla de diagnóstico contra el v8, varios nombres largos difieren en SIGNIFICADO, y en algunos tu propio HTML se contradice entre vistas: IFC ("función celular" / "Función Celular" / "Fuerza Celular"), PABU ("proporción áurea" vs "distancia a la proporción áurea"), ICA-BIS, ISCM ("cardiometabólica" vs "multicomponente"), IEHH ("espectro de hidratación" vs "equilibrio hídrico"). **¿Cuál es el nombre canónico de cada uno?** No los adivinamos porque no hay un valor "tuyo" único que copiar.

**P-19 · Dos detalles de presentación del diagnóstico (del cotejo). NO bloquea, menor.** (a) La severidad por dominio del DFI: tu clasificador emite "Leve/Moderado/Alto" pero tu array de display dice "Vigilancia/Crítico"; ¿cuál ve el profesional? (b) IRC: tu tabla lo muestra ×10; Atlas lo muestra crudo (coherente con su referencia). ¿Adoptamos el ×10?

**P-20 · Los seis campos sociodemográficos (del cotejo de Encuesta). NO bloquea, pero puede evitar trabajo legal.** Decidimos capturar etnia, nivel educativo, ocupación, estado civil, estrato y motivo de consulta (el observatorio los necesita; después no se reconstruyen). Su archivo también los captura. **Preguntas:** (a) ¿alguno alimenta el modelo, o son solo caracterización? (b) La etnia es dato sensible (Ley 1581 art. 5) y el consentimiento actual no la cubre; antes de pedírsela a un paciente, ¿la considera necesaria para el observatorio? Si no, nos ahorramos ampliar el consentimiento. Ver el bloque de construcción en `BACKLOG.md` (gate legal en etnia).

**P-21 · El riesgo integrado del DFI con encuesta incompleta (de la suspensión Q28/D-007). NO bloquea (Atlas ya hace lo conservador en el interín).** (2026-08-12.) Al implementar la suspensión por encuesta incompleta (Q28) medimos el efecto sobre el mismo paciente: la edad bioeléctrica se inflaba 14 años y el riesgo integrado subía un nivel (de MEDIO a ALTO). Suspendimos las tres salidas que nombraste (edad bioeléctrica, índice contextual y rutas). El riesgo integrado no lo nombraste, así que hoy se sigue mostrando al profesional. El riesgo integrado es un promedio ponderado de los cinco dominios, y dos de ellos (envejecimiento y contextual) se calculan sobre las mismas salidas suspendidas, así que hereda la inflación. **Pregunta:** ¿debería suspenderse también, o se conserva como orientación con su rótulo? **En el interín, Atlas hace lo conservador en la vista del profesional:** con la encuesta incompleta el nivel concreto NO se muestra (se marca "Provisional · se recalcula al completar la encuesta") y los dos dominios inflados (envejecimiento y contextual) se marcan "No evaluable", para no contradecir el "no se emitieron". Si respondes que se conserva como orientación, se relaja el display; si respondes que se suspende, ya estamos ahí. Es tu decisión, no la damos por dicha.

**P-22 · La MCA derivada entra a tu ISCM y nuestro valor diverge del tuyo (del cotejo de números, 2026-08-14). NO bloquea (misma CLASE), pero conviene fijarlo.** Cotejo del mismo caso (masculino, 22a, mismo archivo Biody BIS): la composición, los indicadores, el fenotipo (81 estados) y toda la cadena LE8 (ICEC 69 · EB-BIS 34,3 · IAE +12,3) coinciden componente por componente. La única divergencia de valor es ISCM: el nuestro da **−5,09**, el tuyo **−1,75**. Tu `computeISCM` es byte-idéntico al nuestro; la diferencia es un solo insumo, **MCA_dif**. Tu HTML lo lee de una columna del export (`...ECARTTHEORIQUEEXPORT kg`) que el export corto NO trae, y tu MCA queda "—", así que tu ISCM usa el término MCA en 0. Nuestro import SÍ deriva MCA con tu propia fórmula (`MCA = 1,0162 × AIC + MPM`, de derivar-composicion.js) y de ahí MCA_dif = 4,86, que entra al ISCM y lo lleva a −5,09. **Anular ese término deja ≈ −1,75.** Nota: ambos valores clasifican igual (`cISCM ≤ −1` → "ISCM-1 Bajo riesgo"), así que el profesional ve lo mismo y ninguna ruta cambia AQUÍ; pero en un paciente con MCA_dif negativo (déficit celular) el término podría cambiar la clase. **Pregunta:** ¿la MCA debe derivarse cuando el equipo no la trae, y entrar al ISCM (como hacemos), o quedar sin valor y el ISCM calcularse sin ella (como tu HTML)? Relacionado: P-17 (referencias). **Cotejado contra §9 del 12 (verificación anti-duplicado):** §9 resuelve `MCA_ref` (la referencia), NO esta pregunta (si el MCA *valor* debe derivarse y su MCA_dif entrar al ISCM). Matiz: al cablear MCA_ref, §9 HABILITA el MCA_dif, así que se inclina hacia "derivar y usar", pero no confirma la consecuencia sobre el ISCM. Sigue abierta. **Hilo secundario a pinnear:** el IEHH también diverge poco (0,805 vs 0,89); no usa MCA, viene de una diferencia en la FFW derivada (tu ~44,8 vs nuestra 41,95 = ACT − 0,15×FM); ¿qué derivación de FFW alimenta tus índices?

### Pendiente de Gildardo (su lado) — RESPONDIDO 2026-08-09
> **TODO RESPONDIDO (2026-08-09):** C6 con cifras (en D-002), P2 cerrado (§2), las tres consultas (FA/TCA/cita), y las 17. Ver la sección de resoluciones abajo y `entregas/gildardo-2026-08-09/`.

---

## RONDA 2026-08-09 (respuesta de Gildardo a las 17) — resoluciones

Gildardo respondió el paquete completo. Detalle en `entregas/gildardo-2026-08-09/RESPUESTA_GILDARDO_2026-08-09.md`. Resumen de lo que cambia:

- **C6 CERRADO → cifras en D-002** (proteína/energía/grasa/sodio/DM2 + condiciones derivadas de la composición + el déficit desde el peso meta). Desbloquea la cadena calórica.
- **DOS ENMIENDAS FIRMADAS (en D-002):** el gasto va sobre el PESO ACTUAL (no el de referencia); la salvaguarda de TCA es ALERTA, no bloqueo (el `pausadoTCA` era un bug, ya corregido en el v8).
- **DEFECTO nuevo (en D-002):** el peso meta usa un default de Lorentz en silencio y cambia la prescripción; hacerlo VISIBLE. `pesoAjust` es código muerto. → nuevo trabajo.
- **P-02 (factor de actividad):** usar el `faRec` del motor de ejercicio como default editable (seguir el archivo). Resuelto.
- **P-03 (TCA):** ver enmienda en D-002 (alerta, no bloqueo).
- **P-04/P-14 (cita):** la fecha de la cita **SÍ va al reporte del paciente** ("si se le comunica un empeoramiento, tiene que ver cuándo será revisado"). Actualiza D-010.
- **P-09 (D-007 Fase B, suspensión):** CUALQUIER dominio faltante suspende las TRES salidas (EB-BIS + ICEC + rutas). Todo-o-nada, sin mapa por dominio. El bioeléctrico sí se emite. Actualiza D-007.
- **P-15 (Q32 conducta propia):** el motor de remisión vigente ES la referencia; no hay manual aparte (ver §2/P2).
- **P-16 (Q34 cirugías):** solo REGISTRO clínico, NO modifican el cálculo. → portar `d6_qx` sin field_key.
- **P-17 (Q35 referencias):** entrega la tabla `MCA_ref`/`hidSG_ref` por sexo/edad; mientras tanto salidas VACÍAS (no degradadas). Son 2 de las 7 constantes no aprobadas.
- **P-18 (nombres, §10):** IFC = Índice de **FUNCIÓN** Celular (no "Funcionalidad"). PABU = Proporción Áurea Bioeléctrica **DE URIBE** (teníamos "Universal"). IEHH = Índice del **ESTADO** de Hidratación Humana (no "Espectro"). ISCM e IRC quedan como están. → corregir el registry.
- **P-19 (display, §11):** severidad Leve/Moderado/Alto, manda el clasificador. IRC lo tenemos bien.
- **P-20 (§12 sociodemográficos):** etnia SÍ es necesaria para el observatorio pero NO se captura hasta ampliar el consentimiento; los otros cinco son solo caracterización. → construir los 5, gatear etnia a lo legal (como ya estaba en BACKLOG).
- **P-01 (§13 ICEC/EB-BIS):** confirma nuestra lectura: μ/σ se recalculan junto con el mapeo, la bandera queda en false hasta las constantes nuevas.
- **P-06/P-07 (§14 alcohol/contaminantes):** solo caracterización.
- **§9 (remisiones en el reporte):** se **consolidan por DESTINATARIO** (una línea por profesión con el resumen), no ruta por ruta. → rehace parte del display de D-009.
- **§15 (renombramiento):** estructura → **E1-E9**; mapa FyR unificado → **A1-A9**; rutas siguen **R1-R6**. **Los datos sellados NO se reescriben: se traducen AL MOSTRAR.** → nuevo trabajo, toca datos sellados (con cuidado).
- **§16:** mantiene su HTML al día.
- **Biody BIS:** el proveedor corrigió el export (espectroscopía sí viene), pero MANTENER el mecanismo de la foto como segunda opción por si algún equipo no la trae. → afecta el plan de EA1 (la foto no se descarta, queda de fallback).

**P-23 · Tres puntos de la tabla de Wang (del cotejo celda-por-celda, 2026-08-15). NO bloquean.** Del smoke fila-por-fila de la tabla de composicion, tres cosas que no decidimos nosotros:
- **(a) FFW: CERRADA A NUESTRO FAVOR (RESPUESTA_GILDARDO 2026-08-15 §0).** La divergencia (su 44,66 vs nuestro 41,95) era un DEFECTO de su archivo: en agosto agrego `FFW = MLG × hidratacion` ANTES de `derivarFaltantes`, y como `poner()` solo rellena lo vacio, la canonica `FFW = ACT − 0,15×FM` nunca se aplicaba. Nuestros valores eran los correctos. Corregido de su lado el 15. Regla que dejo: "donde derivarFaltantes tenga formula, manda esa; ninguna aproximacion debe adelantarse a una formula del modelo". Arrastra al IEHH (dependia de la FFW mal derivada, `computeIEHH` usa `bis.FFW`): nuestro 0,81 es el bueno, su 0,885 salia del defecto. **P-22, P-23a, P-23b y el IEHH: cerradas.**
- **(b) Agua sin grasa (L) y E/I sin grasa: CERRADAS A NUESTRO FAVOR (RESPUESTA_GILDARDO §0).** Mismo defecto que (a): su reparto proporcional para las aguas sin grasa se adelantaba a las canonicas `AEC_sg = AEC − 0,1125×FM`, `AIC_sg = AIC − 0,0375×FM`. Por eso su HTML repetia el valor con grasa (17,33/27,33) y el E/I sin grasa repetia 0,634. Nuestros 15,30/26,65 y 0,57 eran los correctos. Su prueba de coherencia: `AEC_sg + AIC_sg = FFW` exacto (con la que ademas construimos los % sin grasa, causa D, sobre FFW).
- **(c) Criterio del Δ (afecta FFMI/FMI/AF y todos los de rango): CERRADA (RESPUESTA_GILDARDO 2026-08-17 §2).** El Δ va contra EL BORDE QUE DECIDE la clasificacion (no el punto medio ni el borde mas cercano), revirtiendo CA-2 opcion B. Tabla de limites por fila (Gildardo §2): IMC 24,9 sup; cintura 94/80 sup; ICC 0,90/0,85 sup; ICT 0,50 sup; FFMI 17/15 inf; FMI 6/9 sup; ASMI 7,0/5,5 inf; SMM/W 27/24 inf; AEC% 40 sup; AIC% 65 inf; E/I 0,40 sup; AF 6,5/6,0 inf; IR 0,78/0,82 sup; AEC/MCA 0,45 sup; ACT/MLG 74 sup. Aplicado en wangRowDx (composition-display) e indicator-ranges; candados actualizados. Donde hay VALOR de referencia (tabla de Antropometria) sigue siendo valor − referencia: son dos tablas con criterios distintos y no se mezclan. **Dos bordes NO en su tabla, a la ronda 2026-08-18: FM_pct (grasa %) e IAE (siguen en punto medio hasta que confirme).** Y una incoherencia interna de su carta: SMM/W mujeres dice 24 en §2 pero el motor cSMM usa 22 (manda el motor, dejamos 22; reportado con el numero).

**RONDA 2026-08-18 (respuesta de Gildardo), cierres.** Los dos bordes que quedaban a la ronda y la incoherencia del SMM/W, resueltos:
- **FM_pct (grasa %): CERRADO.** Borde SUPERIOR H 22 / M 32 (§1). Nuestra suposicion era correcta; su archivo del 18 ya media contra 22/32. Aplicado en wangRowDx (quitar el punto medio pendiente).
- **IAE: CERRADO, es de DOS COLAS.** Unico clasificador de dos colas: <-5 desacelerado / -5 a +5 concordante / >+5 acelerado, sin sexo. El Delta ira contra el borde DEL LADO DEL SIGNO (+5 si IAE>=0, -5 si <0). PERO por decision de Santiago (2026-08-19) el Delta del IAE se deja en "—" (Gildardo lo prefiere: "el dato que manda es el valor, no el Delta"; el IAE ya es una diferencia, su Delta seria la distancia de una distancia). Se conserva la referencia "-5 a +5 años" y el valor con su signo. **Regla general de dos colas REGISTRADA** aunque el IAE no muestre su Delta: cualquier clasificador de dos colas mide el Delta contra el borde del lado del signo, sin volver a preguntar.
- **SMM/W mujeres: 22 CONFIRMADO** (§3). El 24 de su tabla del §2 era error de transcripcion suyo (lo copio del display desactualizado, no de cSMM). Procedimos bien aplicando "manda el motor" y reportandolo con el numero. Banda: mujeres <22 sarcopenia / 22-28 normal / >28 optimo (espejo de la masculina 27-33). Ya estaba en 22; nada que cambiar.

**LC-01 (limitacion conocida): el reparto AEC/ACT lo decide la edad, no la impedancia (§0, 2026-08-18).** Gildardo retiro su peticion del 17 de calibrar el 42% del agua EC; nuestra reproduccion independiente (Node, 5.885 registros) CONFIRMA sus tres pruebas (distribucion identica; R2 impedancia <0,04 vs edad ~0,33; mujeres con la misma Re/Rinf, 2,10 pts menos por edad). El detalle completo, los numeros de nuestra reproduccion y las cuatro consecuencias (a-d) viven en CLINICAL_ENGINE.md, seccion "Limitaciones conocidas". El 42% sigue marcado "en validacion"; el umbral AEC/ACT > 44% lee al reves en el eje de la edad (limitacion, no se toca).

**RE-PORT DEL MOTOR, swap del core (2026-08-19).** Swap de Gildardo de `engine.core.js` contra ATLAS_v8.html del 18 (region calcIFC..getDX, verbatim; diff del cuerpo contra el 18: VACIO). Cuatro cambios, todos con procedencia (criterio a/b/c; b "sin procedencia clara, parar" no se disparo):
- **Q27 RESUELTO: cPABU direccional.** Cita de Gildardo (2026-08-17): "cPABU: portenlo tal cual, y no lo graduen. Es un marcador direccional, dice hacia donde se desvia la celula respecto de phi=1,618, no cuanto... El 'cuanto' ya lo da el ICA-BIS." Portado de 8 situaciones (con ROJO "Zona critica"/"Colapso por defecto") a 3 direccional (Homeostasis / Desviacion por deficit / Desviacion por exceso), todas ambar, SIN rojo. Nuestra retencion del rojo era prudencia, no ciencia; el la conocia (Q27) y la descarto con argumento. Llamadores stale limpiados (analysis.ts, severity.ts: quitado el `ifc` que JS ignoraba en silencio).
- **HUECO DE ALARMA (cuidado b): NO hay.** La magnitud (con el rojo) vive ahora en la fila ICA-BIS via `clasificarIcaBis` (la rama de desviacion del cPABU viejo, ya portada al indicator-ranges), exactamente como dice Gildardo. El profesional ve DIRECCION en la fila PABU (ambar) y MAGNITUD con rojo en la fila ICA-BIS. El caso extremo sigue rojo por ICA-BIS y por los indicadores estructurales (FMI/FFMI/ASMI), donde Gildardo situa la magnitud.
- **cMMEM unificado en EWGSOP2** (H<7,0 · M<5,5; antes M<5,7 con las ramas intercambiadas, bug del 07-28). DORMANT y DEBE seguirlo: nada lo consume; el clasificador de sarcopenia VIVO es `cASMI` (ASMI H<7,0/M<5,5 mas fuerza prensil 27/16 Kgf). Cablear cMMEM DUPLICARIA la señal de sarcopenia con otro corte. NO CABLEAR (registrado para que nadie lo cable "porque estaba ahi").
- **cFMI banda "Alto SS" femenina (9-12): PORTE FUERA DE LOS DIEZ PUNTOS.** Añadida por Gildardo el 2026-07-28 (anterior a la base del 05-ago; por eso no esta en los diez puntos del delta). Solo afina el rotulo de una mujer con FMI 9-12 (antes saltaba de "Normal" a "Alto CS"); k=3 sin cambio, NO mueve estado EFR ni diagnostico. Portada por ser ciencia vigente con procedencia clara (criterio a).
- **cISCM/cIEHH/cIAE:** comentarios "sin distincion por sexo" (07-28), sin cambio de codigo.
Hallazgo estructural: `engine.core.js` venia de v7 (julio), anterior al 05-ago, por eso el swap trajo correcciones que Gildardo NO enumero en los diez puntos (todas con fecha y motivo). Los chunks mas viejos (core, indices, protocolo, de julio) cubren mas terreno; dfi/patron/derivar-composicion (08-04/05) menos.

**RE-PORT DEL MOTOR, capas autorizadas contra el 18 (2026-08-19).** Las tres modificaciones autorizadas se re-aplicaron LIMPIAS sobre la base nueva y SIGUEN SIENDO NECESARIAS (ninguna sobra):
- **CA-1 (atlas-protocolo, retira telomeros del listado):** el 18 AUN trae la linea de telomeros; su oldSlice esta en el array de examenes, no en el bloque de deficit que se porto (punto 6). Sigue necesaria.
- **CA-2 (atlas-tratamiento, salvaguarda TCA avisa-no-bloquea, D-002):** IMPORTANTE, registrar explicito para el reporte a Gildardo. **Su archivo del 18 TODAVIA trae el texto que BLOQUEA** ("Salvaguarda activa: el modulo nutricional PAUSA la restriccion calorica automatica", L15675). NO es que nos hayamos adelantado: es que Gildardo NO ha llevado su instruccion del 9 de agosto (D-002: alerta, no bloqueo) a su archivo. Nuestra correccion manda por su propia instruccion escrita, no por el archivo. atlas-tratamiento.js es byte-identico al 18 salvo eso, que CA-2 corrige.
- **CA-3 (engine.dfi, guard de calcLE8):** calcLE8 no cambio en el 18; su oldSlice intacto, se re-aplica.
Constelacion: ENGINE_VERSION 1.0.0 -> 1.1.0, PROTOCOL 2026-08-03 -> 2026-08-19. Los diagnosticos EXISTENTES quedaron sellados con 1.0.0 (o anterior); un seguimiento que se haga ahora cruza a 1.1.0 y muestra el aviso calmado (aceptable: es cierto que cruzan, y el aviso no alarma; se apaga cuando se acumulen evaluaciones 1.1.0).

**P-24 · SMM/W: el gate del FENOTIPO usa mujer <24, el clasificador cSMM usa mujer <22 (barrido 2026-08-19). NO bloquea; QUERY para Gildardo, no fix.** El barrido de "aplicadas sin candado" lo encontro. Dos umbrales distintos para el mismo indicador SMM/W en MUJERES:
- **cSMM** (clasificador de sarcopenia): mujer <22 = Sarcopenia (confirmado §3 2026-08-18; el 24 "no salia de ningun clasificador", error de transcripcion suyo). Nuestro codigo y display: 22. Correcto.
- **Gate de sarcopenia del FENOTIPO** (obesidad sarcopenica): mujer **smmW < 24** (`protocolo-fenotipo.ts:123`). VERIFICADO que el 18 usa lo MISMO (`ATLAS_v8.html:12462`, `const sarcopenia = (sexoM ? smmW < 27 : smmW < 24)`), y v7 tambien. NO es un error de porte: somos fieles a su archivo. Por eso NO se toca unilateralmente (cambiarlo a 22 divergiria del 18).
CONSECUENCIA: una mujer con SMM/W entre 22 y 24 sale "Normal" por cSMM pero "sarcopenica" por el gate del fenotipo. Puede ser deliberado (el composite usa un umbral distinto) o una incoherencia de su modelo. Su §3 dijo que el 24 "no salia de ningun clasificador", pero este gate lo usa. **PREGUNTA para Gildardo (ronda o anexo al reporte del re-port):** ¿el gate de sarcopenia del fenotipo debe ser mujer <22 como cSMM, o <24 es deliberado? Mientras responde, se deja en 24 (fiel al 18). No hay caso de paciente bloqueado.

**RESIDENCIA PROLONGADA + altitud fisiologica (Gildardo §1, construido 2026-08-19).** Se agrego el campo "¿En que ciudad o municipio vivio la mayor parte de su vida?" (opcional, caracterizacion) en la FASE DE FIRMA, junto a la ciudad actual, mismo selector (dropdown de Colombia + "Otra"). NO necesito bump de encuesta: la fase de firma no es contenido de encuesta (dictamen 10-ago), es perfil. Persistencia: `patient_profiles.longest_residence_city` (perfil, ultimo conocido, prefill) + `evaluations.longest_residence_city` (VERSIONADO por evaluacion: alguien puede mudarse entre consultas, y ese es el dato que importa para la adaptacion a la altura). Migracion aditiva 0071.
DISTINCION REGISTRADA (Gildardo §1, 2026-08-17): la altitud FISIOLOGICA sale de la residencia PROLONGADA, NO de la actual ("la adaptacion a la altura viene de vivir años en altura, no de donde esta el paciente hoy; derivar la altitud de la residencia actual produce una variable que parece medir adaptacion y no la mide"). Hoy la altitud NO alimenta el motor (es caracterizacion de observatorio, via `cityGeo` sobre la ciudad de la lista). Cuando el observatorio la use, la fisiologica es la de la prolongada; la de la ciudad actual queda para contacto/logistica. No preguntar años de residencia (Gildardo).

**RESPUESTA_GILDARDO 2026-08-19 (aprobo el re-port) — cierres y registros.**
- **P-24 CERRADA (gate del fenotipo a 22).** Teniamos razon: el 24 SI se usaba (en el gate del fenotipo, no en un clasificador; su §3 del 18 lo nego). Su argumento de que era un resto: el umbral masculino del mismo gate es 27 = cSMM clavado; un criterio externo diferiria en ambos sexos, no solo en mujeres. Portado a 22 con BARRIDO COMPLETO (su instruccion): el 24 vivia en TRES sitios: protocolo-fenotipo.ts (su §1), engine.dfi `_smmwLow` (2o sitio que NO menciono, alimenta obSarc -> Dominio 2; reportarselo) y el fixture. #2 (texto TCA) ya lo cubria CA-2; #3 (etiqueta display) ya estaba en 22. PROTOCOL -> 2026-08-19b.
- **TCA: matiz aceptado.** Nuestro diagnostico ("no llego a tu archivo") era incorrecto: motorTratNutri ya tenia la correccion del 9-ago, nuestros motores coincidian; lo viejo era SOLO la frase de motorPsico (que CA-2 corrige). Regla nueva registrada: cuando el texto y el motor se contradigan, manda el motor (defecto de seguridad, no de redaccion).
- **cMMEM dormido: Gildardo lo APROBO y pide anotarlo para que nadie lo "arregle".** Cablearlo duplicaria la señal de cASMI (el que corre). NO CABLEAR. (Ya estaba en trazabilidad; reforzado por su §4.)
- **Aprobados sin cambios (§4):** el criterio de porte de la banda cFMI como norma (no preguntar pieza por pieza lo que ya tiene fecha y firma), los siete puntos verificados, la constelacion de versiones + el aviso discreto de seguimiento.
- **DESFASE DE 0,14 (§6, CIENCIA NUESTRA pendiente, NO urge).** Nuestras medianas del contraste por edad (42,65/40,55) vs las suyas (42,79/40,69) estan desplazadas EXACTAMENTE 0,14 en ambos grupos. Un desplazamiento identico no es ruido: es un filtrado ligeramente distinto (algun criterio de exclusion que uno aplica y el otro no; probablemente un filtro de nuestro script Node, alguna fila con dato faltante que descartamos). La DIFERENCIA (2,10) y los 97 casos <35 coinciden exactos, asi que la conclusion no cambia. REGLA MIENTRAS TANTO: en cualquier documento van la DIFERENCIA y el n, NO las medianas sueltas (la diferencia es publicable, las medianas absolutas no hasta explicar el 0,14). Buscar el origen cuando haya hueco.
- **SPEC DEL DFI (§5): existe desde el 20-jul (ATLAS_DFI_y_Metas_Terapeuticas_por_Profesional v1.0). NO llego a la carpeta (entrega incompleta: solo llego la carta; falta el ATLAS_v8.html del 19 Y la spec). Santiago se los pide.** Gildardo aprobo dejar el parrafo del DFI + las metas por profesion para la etapa de Tratamiento ("traerlas ahora las dejaria computadas sin lector, la peor situacion"). Registrado en INVENTARIO_TRATAMIENTO; la spec entra al diseño de esa etapa cuando llegue.

**CORRECCION 2026-08-22 (pieza 1 de Tratamiento, otro "bloqueado" falso): el parrafo del DFI y las metas NO esperan la spec; los COMPUTA `atlas-dfi.js` (en el repo, entrega 2026-07).** `computeDFI` produce `parrafo` (el resumen funcional) y `metas` por profesion (`_metaDe(rol)`, "Meta de ... . Meta a 24 semanas: ..."), derivadas de las RUTAS del DFI, sin dato externo. La spec `ATLAS_DFI_y_Metas_Terapeuticas v1.0` que faltaba era DOCUMENTACION, no la formula. El port de Atlas (`dfi-routes.ts`) tomo solo las rutas; parrafo/metas quedaron SIN exponer, no sin fuente. Es porte-con-golden, no espera de Gildardo. Mismo patron del vacio falso de los 17 nutrientes: dado por bloqueado sin cotejar la fuente. Leccion [[verificar-por-camino-real-no-el-de-prueba]].

**CORRECCION 2026-08-22 (C9 y Q26 CERRADAS; 1b del resumen desbloqueado): la encuesta v5 ya captura todo.** El parrafo de dieta del resumen (`_resumenNutriParrafo`, atlas-resumen-clinico.js) leia campos que se creian pendientes: los 15 grupos de frecuencia (C9) y la hidratacion (`d7_agua`, Q26). Verificado 2026-08-22: la migracion `2026-08-19_survey_v5_otra.sql` captura los 15 grupos (`d1_3_i`..`d1_15_i`), los horarios (`d1f_des_i/noche_i/sal_i`) y `d7_agua`; `FREQ_GROUPS` (15) y `calcPatron` estan portados. Asi que el parrafo de dieta ya NO se porta contra una encuesta que va a cambiar: la encuesta es final. La particion 1a/1b se hizo sobre un supuesto stale; 1b queda desbloqueado.

---

## COLA TRATAMIENTO / PLAN ALIMENTARIO (del mapeo de piezas colgantes, 2026-08-21)

Contexto: cerrada la CADENA CALORICA (tres eslabones: mostrar la cadena; los cinco ajustes GEB/PAL/objetivo/proteina/grasa con recompute en vivo via computeProtocoloEfectivo; y el reparto de macros con cuadre al objetivo). Sobre ella cuelgan cuatro piezas (INVENTARIO_TRATAMIENTO filas 10-13): tiempos de comida, lista de intercambio, validacion de 17 nutrientes, menu 7x5. El mapeo (2026-08-21) confirmo: tiempos e intercambio tienen el DATO listo (entrega 2026-07), es PORTE no construccion a ciegas; los 17 nutrientes son gap de dato real. Dependencia: tiempos e intercambio primero (solo dependen del objetivo, ya cableado); los 17 esperan dato de Gildardo Y el intercambio portado (el % de cubrimiento suma los nutrientes de los alimentos elegidos, INTER_TABLA_A); el menu 7x5 estructurado es el mas acoplado (hoy es texto libre IA, funcional). Estas tres son COLA VIVA, aun NO en un documento de ronda enviado.

**P-25 · Distribucion por tiempos de comida (DISTRIB_TIEMPOS_ANI). Confirmar antes de portar.** El dato existe en el frozen (ATLAS.html:13473: mapa keyed por numero de comidas 3-6 con % por tiempo; 5 comidas = Desayuno 0,30 / Medias onces 0,10 / Almuerzo 0,30 / Algo 0,10 / Cena 0,20; + calcPorcionesANI). Reparte el objetivo calorico efectivo (ya cableado) en el dia. PREGUNTA: (a) es la version final para portar, o cambia con el HTML nuevo? (b) los porcentajes son FIJOS del modelo, o un default que el profesional ajusta? Mientras responde, NO se porta (contenido clinico, misma disciplina que el motor).

**P-26 · Lista de intercambio (atlas-lista-intercambio.js, "U de A - ICBF 2025"). Confirmar antes de portar.** El dato existe COMPLETO en la entrega 2026-07 (12 grupos; INTER_TABLA_A con 27 nutrientes por porcion; INTER_TABLA_B con gramaje y medida casera). NO hay que pedir el dato. PREGUNTA: es el dataset FINAL para portar tal cual, o hay version mas nueva? Desbloquea la validacion de 17 nutrientes (el % de cubrimiento sale de sumar los nutrientes de los alimentos elegidos aqui).

**P-27 · Metas de la tabla de validacion. NO ES GAP DE DATO (corregido 2026-08-21 contra el HTML real; el cotejo visual lo cerro).** La version previa afirmaba que las metas de los ~17 nutrientes eran un vacio de dato que bloqueaba la construccion. FALSO: la columna "Necesidad" del HTML (ATLAS_v8.html, `interNeed` linea 16883, `INTER_NUTS` 16884) se calcula INLINE y determinista, 16 nutrientes: 4 macros del motorProtocolo (paciente-especificos), fibra por formula (14g/1000kcal), y 12 micros por RDA/DRI segun SEXO/EDAD (Ca/Fe/Mg/Zn/K/Na/VitA/VitC/Folato/B12/Fosforo; `_driCa`/`_driFe` 16881-16882). Los valores de la captura cuadran exacto para hombre <=50a. Es PORTE como todo lo demas, no hay que pedir dato. ICN = (aporte_nut/need_nut) / (aporte_kcal/need_kcal); cubrimiento = aporte/need*100 (`interCob` 16888, `interICN` 16889). UNICO matiz menor a confirmar con Gildardo (NO bloquea): los micros son fijos por sexo/edad y NO se ajustan por condicion clinica (un renal sigue mostrando K 3400 en la tabla; las restricciones IRC/HTA alimentan el MENU, no esta columna). Probablemente deliberado (asi es una RDA). Leccion [[verificar-por-camino-real-no-el-de-prueba]]: no afirmar "falta X" sin cotejar el camino real.

**P-28 · Miniblock "Nivel III - Salud celular" en Tratamiento (del cotejo visual, 2026-08-21). Decision de Gildardo.** Atlas muestra en Tratamiento un bloque "Nivel III - Salud celular" (badges: hidratacion celular deficiente -> aumentar agua/electrolitos/reducir sodio; angulo de fase, MCA). PORTADO del vigente (`celBadges`, comentario en treatment-panel.tsx). NO esta en la subpestaña de Tratamiento del HTML v8. Es contenido celular/diagnostico. PREGUNTA: se queda en Tratamiento, se mueve a Diagnostico (donde vive el resto de lo celular), o se retira? Es contenido clinico portado, la decision es suya. Mientras responde se deja donde esta.

**P-30 · ¿Un reparto por tiempos que NO cuadra debe poder GUARDARSE, o debe impedirse? (2026-08-22, decide comportamiento).** *"En la distribucion por tiempos, si un alimento tiene 2 porciones en la lista de intercambio y el profesional las reparte a cero en todos los tiempos, tu archivo lo marca en rojo pero permite guardar. Lo portamos igual. ¿Es deliberado que se pueda guardar un reparto que no cuadra, o deberia impedirse? Lo preguntamos porque en Atlas el plan queda guardado, mientras que en tu prototipo se recalcula al recargar."* No es confirmacion menor: define el comportamiento. Tu HTML marca el descuadre (celda "suma/total ✓/⚠") pero NO bloquea, y como en el prototipo es transitorio (localStorage, se recalcula), permitirlo es inofensivo; en Atlas se PERSISTE, asi que un descuadre queda guardado. No sabemos si permitirlo es criterio (el profesional sabra por que) o descuido. Mientras respondes, Atlas queda fiel a tu archivo: avisa en vivo y permite guardar.

**P-32 · CONTESTADA EL 2026-08-23 Y APLICADA A MEDIAS. Manda `motorTratNutri`.** Su respuesta a la ronda
del 23 ABRE con esto, textual: *"`motorTratNutri` gobierna la prescripcion nutricional. Es el que tiene la
ciencia actualizada, y el sodio lo demuestra: 1.500 mg en hipertension es lo que sostienen OMS, DASH/NHLBI
y AHA/ACC 2025. Los 2.300 del otro motor son el corte viejo. Porten las nueve filas de `motorTratNutri` con
estas tres correcciones."* Las tres: (1) el deficit de -500 en obesidad va como SUGERENCIA EDITABLE, no
impuesta; (2) el gasto basal se calcula sobre el PESO DE REFERENCIA, no sobre `pesoAct`; (3) la proteina en
cancer queda en 1,25 g/kg, y el mismo lo anota como "el unico punto donde el motor que gobierna es el menos
actualizado". Mas una observacion para despues: usa Mifflin siempre y Cunningham aprovecharia la masa que
ya medimos; NO cambiarlo ahora.

**ESTADO REAL AL 2026-08-31: portado y CORREGIDO en el frozen, y SIN CONECTAR.** El archivo
`frozen/atlas-tratamiento-nutri.js` existe con las tres correcciones aplicadas (sodio 1500 con HTA, cancer
1,25, GEB sobre `pesoMeta`), con golden. Pero **NINGUN modulo de la app lo importa**: solo dos tests. La
pantalla sigue mostrando las restricciones de `atlas-protocolo.js`, el motor que NO gobierna, asi que a un
hipertenso le dice **"Sodio < 2300 mg/dia"** cuando el ordeno 1500 hace ocho dias. De los CUATRO motores de
tratamiento, tres llegan a pantalla (medico, ejercicio, psico) y el del nutricionista no.

**POR QUE SE NOS ESCAPO, y esto vale mas que el hallazgo:** esta misma entrada decia *"VERIFICADO contra sus
respuestas (23-08): no esta contestada"*. Esa frase se escribio AL ENVIAR la ronda, ANTES de que llegara la
respuesta, y nadie la volvio a mirar porque decia "verificado". **Una nota que dice "verificado" es mas
peligrosa que una suposicion, porque nadie la vuelve a comprobar.** Regla que queda: fechar toda
verificacion y compararla contra la fecha de su ULTIMA respuesta; si la respuesta es posterior, la
verificacion no vale. Barrido hecho el 31: es el UNICO caso de esa forma en los documentos.

**Texto original del hallazgo (se conserva, describe bien la divergencia):** al cablear las restricciones
del modelo al menu aparecio que `motorProtocolo` (el que Atlas usa) y `motorTratNutri` prescriben cosas
distintas para el MISMO paciente, y el sodio es solo uno de NUEVE puntos: sodio HTA 2300 vs 1500 (y ERC
2000, que el primero no fija); proteina en cancer 1.5-2.0 vs 1.25; el peso sobre el que se multiplica la
proteina; GEB (Cunningham-si-FFM vs Mifflin siempre); factor de actividad; deficit; objetivo en
cancer/desnutricion; grasa en dislipidemia; y QUE define la conducta (fenotipo MCCB vs condicion por dx +
composicion).

**P-33 · Bloque de recomendaciones HUERFANO tras retirar el deficit (2026-08-23, reporte + decision pequeña).** El bloque "Manejo del exceso de grasa corporal" de las recomendaciones por diagnostico se activa con `pr.estrategia.deficit > 0`. El 19-ago Gildardo retiro el deficit (queda 0 para todos los perfiles), asi que la condicion NUNCA se cumple: el bloque no puede aparecer. Y su texto cita justo lo retirado ("deficit N kcal; piso 1.200 M / 1.500 H"). PREGUNTA: se retira, o se conserva con otra condicion (fenotipo F1-F5, u obesidad por composicion)? Ronda 2026-08-23 punto 2.

**P-34 · FFMI 17.92/15.64 sobrevive en la pieza de recomendaciones, sin portar (2026-08-23, confirmacion).** `isSarco_pn` usa la frontera ANTERIOR a la unificacion (vigente: 17 H / 15 M). El barrido de la unificacion no lo alcanzo porque esa pieza aun no esta portada. Mismo marco que el SMM/W 24->22: al cambiar un umbral se buscan todos los sitios, y este vivia fuera del codigo portado. **AMPLIADO al barrer todos los sitios (su propia instruccion):** hay DOS copias del bloque en el archivo vigente y NO coinciden. La de la tarjeta "RECOMENDACIONES" usa `ffmi<17` **sin distinguir sexo** (una mujer con FFMI 16 sale sarcopenica, cuando su frontera es 15); la de la subpestaña usa 17.92/15.64. Un mismo paciente puede recibir el bloque en una pantalla y no en la otra. Pasa de confirmacion a DECISION pequeña. Ronda 2026-08-23 punto 3.

**NOTA DE FUENTE (2026-08-23):** el archivo VIGENTE es `docs/entregas/Gildardo responses/ATLAS_v8.html` (2026-08-19), confirmado por el en su respuesta del 17 ("la vigente NO es la del 13"). La comparacion de los nueve puntos se hizo primero contra la del 13 y se RE-VERIFICO contra la vigente: motorTratNutri, el bloque de recomendaciones, INTER_TABLA_A/B y CICLO_MENU_21 son identicos entre las dos, asi que los hallazgos se sostienen. Leccion [[v8-desactualizado-riesgo-cotejo]]: cotejar siempre contra la entrega confirmada, no contra la carpeta con fecha mas alta.

**P-35 · motorTratNutri: PORTADO el 2026-08-26 (`e7ea626`), CONECTADO el 2026-08-31, y RESPONDIDO el 2026-09-02.** Su §9.6 cierra la pregunta de cual motor manda: "ninguno, manda el equipo" para el gasto basal, y su punto 4 la resuelve para la PROTEINA ("la prescribe el motor"). Aplicado en P-95. Lo que sigue abierto de P-32/P-35 son los otros dos valores (objetivo calorico y porcentaje de grasa), y hoy no divergen porque a su motor le pasamos los efectivos por sus propias entradas `edit.*`.

**P-35 · motorTratNutri: PORTADO el 2026-08-26 (`e7ea626`) y CONECTADO el 2026-08-31.** Ver P-32: entre una fecha y la otra estuvo portado sin consumidor, mostrando la prescripcion del motor equivocado. Se porto por instruccion de Santiago, en archivo propio (`frozen/atlas-tratamiento-nutri.js`) porque los otros tres motores vienen del archivo del 30-jul y este del 26-ago. **La entrada de abajo describe el estado ANTERIOR y se conserva por su razonamiento, que sigue valiendo para P-32.** Y su §13 del 27 lo confirma: "manda motorTratNutri". Texto original: Es el cuarto motor de tratamiento (medico, ejercicio y psico ya estan portados) y es el que prescribe la DIETA del modelo: tipo energetico, proteina g/kg, atributos (hiposodica, DASH, nefroprotectora), sodio maximo, grasa saturada maxima, notas y referencias. Es el mismo patron que las restricciones: tenemos lo que ESCRIBE el profesional (`treatment_diet_guidelines`) y no lo que PRESCRIBE el modelo. **NO se porta hasta que responda P-32:** meter un segundo motor que contradice al que ya prescribe empeoraria la incoherencia en vez de cerrarla. Registrado tambien en PLAN_CADENA_CALORICA §2, que sigue vigente como plan de porte.


**P-29 · Granularidad de la lista de intercambio: por alimento (21) o por grupo (12)? (2026-08-22).** *"Tu tabla de intercambio permite poner porciones en cualquiera de los 21 alimentos y distribuirlas dentro de un grupo (por ejemplo 2 de leche entera y 1 de descremada). Lo portamos asi, fiel. ¿Es deliberado que el profesional pueda distribuir dentro del grupo, o bastaria con que elija un alimento representativo por grupo? Lo preguntamos porque la version por alimento hace la tabla mas larga (21 filas contra 12) y queriamos confirmar que la granularidad es intencional antes de simplificarla."* Atlas porta la version por alimento (fiel); si Gildardo dice que basta con uno, se simplifica despues sabiendo que es su decision.

**OBSERVACION (no pregunta) 2026-08-22 · La lista de intercambio queda por DEBAJO del objetivo calorico, y la brecha crece con el objetivo.** Medido en Atlas (reparto byte-identico al tuyo): la suma de kcal de las porciones enteras del intercambio da -1,7% a 2000 kcal, -5,2% a 3000, **-7% (-224 kcal) a 3200**. La causa dominante NO es el redondeo sino la regla de **verduras fija en 2 porciones** (`nx["Verduras y hortalizas"]=2`): aporta 50 kcal fijas mientras su 6% deberia crecer (192 kcal a 3200), y como no escala, la brecha crece. Atlas lo muestra transparente (el total dice "X kcal (objetivo: Y)" + una linea de causa). Es comportamiento de TU modelo, no una divergencia nuestra; se registra por si te importa que en objetivos altos la lista quede ~200 kcal corta. Tu decides si la regla de verduras debe escalar o queda fija.

**P-31 · Cual gasto energetico manda (RENUMERADA 2026-08-23: era una SEGUNDA P-29; dos preguntas con el mismo numero se prestan a confusion en el documento que recibe Gildardo. La P-29 la conserva la de granularidad, que es la que citan los commits y el handoff): el medido por el equipo o el calculado (del cotejo visual, 2026-08-21). Confirmar, NO bloquea.** Atlas ofrece en el objetivo un atajo "Gasto medido por el Biody: NNNN kcal - Usar" (el GET crudo del equipo, `kcalSugerido`, bis_raw_values), al lado de la cadena que calcula otro GET (Cunningham/Mifflin GEB x PAL). Difieren por metodo, no por paciente. El HTML v8 usa SOLO el calculado (Formula sintetica GEB->GET); no muestra el medido. Atlas alinea la BASE al calculado y deja el medido como REFERENCIA informativa etiquetada. PREGUNTA (confirmacion): OK que la base sea el calculado y el medido quede como referencia, o Gildardo prefiere que el medido entre en algun caso?

---

## COLA NUEVA (a partir del 2026-08-23, ronda enviada)

**La ronda del 2026-08-23 SE ENVIO. No se le agrega nada mas.** Decision de Santiago, con su razon escrita: el punto 1 bloquea el porte de `motorTratNutri`, y cada dia que espera es un dia prescribiendo un sodio que puede estar mal; si la ronda sigue creciendo, el tarda mas en responderla. Y hay trabajo suficiente sin su respuesta (INTER_TABLA_B, y despues el menu semanal).

**Todo hallazgo nuevo que salga desde ahora va DEBAJO de esta linea**, no dentro de aquel documento. Se numera desde P-36.

**P-36 · El v8 tiene DOS CARAS (pantalla e impresion) y no lo habiamos modelado (hallazgo 2026-08-23, NO es pregunta a Gildardo: es nuestro).** Santiago noto que la "LISTA DE INTERCAMBIO U DE A" que portamos no aparece en sus capturas. Verificado trazando el render: su contenedor es `className:"plan-print-only"` y el CSS dice `.plan-print-only{display:none!important}` + `@media print{...display:block!important}`. **Es de IMPRESION, no de pantalla.** Y al barrer aparecio la division completa, que es deliberada:

| Seccion | Pantalla | Impresion |
|---|---|---|
| Resumen clinico · Objetivo · Necesidades · Formula desarrollada · Distribucion · Menu semanal | si | si |
| **Formula sintetica (cadena) · Tabla de intercambio del profesional · Validacion** (`no-print`) | si | **NO** |
| **Lista de intercambio del paciente** (`plan-print-only`) | **NO** | si |

Lo que se IMPRIME excluye lo tecnico (la cadena, la tabla de trabajo, la validacion) y deja lo que el paciente usa. Nosotros no tenemos superficie de impresion/envio del plan, asi que la portamos a pantalla. **Divergencia registrada, NO se revierte ahora** (decision de Santiago: se ve en el cotejo final). Cuando exista el envio del plan (item de BACKLOG), esa lista es su contenido y sale de la pantalla. Barrido hacia atras: **es la UNICA pieza portada en esa situacion**; todas las demas que portamos si estan en su vista de pantalla.

**CERRADA EL 2026-09-03: la lista salio de la pantalla y la divergencia con ella.** Se cumplio la condicion que esta misma entrada declaraba: desde el 1-sep el paciente recibe su plan dentro del reporte, asi que la superficie de entrega existe. Retirados `ListaIntercambioPaciente` y su render en la subpestaña del nutricionista; ahora, como en su archivo, esa lista NO se ve en pantalla.

**El profesional no pierde nada, y conviene decir por que:** los alimentos con su gramaje siguen en la tabla de trabajo, plegados por subgrupo (`AlimentosDelSubgrupo`) y **COMPLETOS**, no recortados a 8. Lo que se retiro era la segunda copia, la del paciente.

**Y NO es el septimo bloque del plan, aunque se le parezca.** La retirada mostraba la lista BASE nacional con un aviso que decia "todavia no esta adaptada a la ciudad del paciente, revisala antes de entregarla"; su §7.1 pide la lista **recortada por region**. O sea que mantenerla no adelantaba el septimo bloque: habria que construirlo igual cuando llegue el mapa (punto 2 de la ronda del 3-sep). Peor: ese aviso en pantalla invitaba a entregar a mano justo lo que su modelo dice que no se entrega asi.

**El recorte a 8 con "entre otros" y el parrafo de "como usarla" son decisiones SUYAS y no se pierden:** siguen en su HTML y se re-portan dentro del septimo bloque, que es donde el las quiere. El commit que las retira conserva el codigo para cotejarlo.

**P-37 · La HISTORIA CLINICA (pestaña Reporte/HC) y la decision del reporte, conectadas (2026-08-23).** El v8 tiene una HC de ONCE secciones numeradas (datos del paciente, motivo de consulta, antecedentes, tabla de Wang, resumen dx + meta + objetivo, rutas activadas, tratamiento, recomendaciones, remisiones y derivaciones, examenes solicitados, proxima cita + firma). Nuestro PDF de reporte trae SEIS (paciente, documento, indicadores, cambio vs anterior, notas, nutraceuticos). Santiago confirma que es una pestaña suya que no tenemos. **Y esto REABRE una decision nuestra:** dijimos que el reporte se quedaba en Tratamiento porque no habia pestaña destino; si se construye la quinta pestaña (Reporte/HC), esa decision se revisa. Va junto con la pregunta ya registrada en BACKLOG de si `reports` son DOS documentos (el del diagnostico y el del tratamiento). No se abre bloque: es material del cotejo final.

**P-38 · Inventario de las SALIDAS AL PACIENTE del v8 (barrido 2026-08-23, alimenta el bloque de envio del plan y la quinta pestaña).** Santiago señalo que su archivo tiene varios sitios de "imprimir" o "enviar al paciente". Barridos: son CUATRO en el ambito de tratamiento/HC, y no envian lo mismo.

| # | Donde | Que hace | Que sale |
|---|---|---|---|
| 1 | `17163` Plan del nutricionista: **"Imprimir plan"** | `window.print()` sobre la vista con el filtro de impresion | El PLAN: objetivo, distribucion, menu y la lista de intercambio del paciente. **Excluye** la cadena calorica, la tabla de trabajo y la validacion (son `no-print`, ver P-36) |
| 2 | `17164` Plan del nutricionista: **correo** | `mailto:` al correo del paciente | **Una sola linea de texto**, sin adjunto: "Plan Nutricional - Nombre · VCT: N kcal \| Prot: Ng \| Grasas: Ng \| CHO: Ng". El plan NO viaja |
| 3 | `14387` **"Enviar informe al paciente"** | envio a una app del paciente | La COMPOSICION CORPORAL en version amigable; el paciente la ve "ingresando su documento y fecha de nacimiento". Es otro documento y otro canal |
| 4 | `16470` / `16590` barra de Tratamiento: **"Imprimir / Guardar PDF"** | `window.print()` de la vista completa | Toda la pestaña de tratamiento con el mismo filtro |

Hay mas `window.print()` fuera de este ambito (encuesta, reportes: `7596`, `9106`, `9360`, `11737`, `14885`, `19290`), no inventariados aqui.

**Lo que esto dice para nuestro bloque de envio:** (a) NO es un solo boton: hay al menos **tres documentos distintos** (el plan, el informe de composicion, la vista completa) con **dos canales** (papel/PDF y app del paciente) y un tercero degradado (el mailto de una linea, que en Atlas ya superamos con Resend + adjunto, divergencia ET13 ya registrada); (b) el filtro `no-print` DEFINE que lleva el plan impreso, asi que P-36 no es cosmetica: es el contenido del envio; (c) el "informe al paciente" (3) es contenido del DIAGNOSTICO, no del tratamiento, y probablemente pertenece a la quinta pestaña junto con la HC (P-37). NO se construye: es material del cotejo final y del bloque de envio.

**P-39 · Las ALERGIAS e INTOLERANCIAS no llegan a ningun motor, y menos al menu (hallazgo 2026-08-23, SEGURIDAD).** Santiago pregunto si la IA del menu detecta alergias. Verificado, y es peor que un hueco del prompt:

1. **En Atlas no llegan a NINGUNA parte.** Las dos preguntas ("¿Alergias alimentarias diagnosticadas?" con Leche/Huevo/Mani/Trigo/Soya/Pescado/Mariscos y "¿Intolerancias alimentarias?" con Lactosa/Gluten/Fructosa) tienen **`field_key = null` en las TRES versiones de encuesta (2, 3 y 5)**. Se capturan, se guardan, y no entran al motor: `buildEngineInput` mapea por field_key.
2. **Y hay un camino cableado en codigo y MUERTO en datos:** `FREE_TEXT_TO_ENGINE` incluye `d6_44` (por RESPUESTA_GILDARDO 2026-08-15 §4) y hay un test que prueba que su texto libre alimenta el motor. Pero **ninguna pregunta lleva ese field_key**: verificado, `select ... where field_key in ('d6_43','d6_44')` devuelve CERO filas, y no existe ningun field_key `d6_*` en ninguna version. El test pasa porque construye el input a mano. Familia de [[verificar-por-camino-real-no-el-de-prueba]] y de [[test-que-existe-no-verifica-que-sea-correcto]].
3. **El v8 SI las lee, pero tampoco las manda al menu.** `enc.d6_43`/`d6_44` se usan en UN solo sitio (L13086): el parrafo clinico "presenta ... alergia a X ... intolerancia a Y". Ese parrafo **no lo hemos portado** (portamos el de dieta, L13013-13057, y el funcional). En el area del menu y del plan (L16600-17200) no hay ni una mencion a alergias. **Es hueco de los dos para el menu**, y de Atlas tambien para el texto.

**Consecuencia:** un paciente que declaro alergia a los mariscos puede recibir un menu generado con mariscos, salvo que el profesional la teclee a mano en el campo de restricciones. Es la misma clase que el fosforo (P-32) pero con consecuencia inmediata.

**ESCALA REAL (2026-08-24, inventario completo de la encuesta v5): 25 de las 64 preguntas NO tienen field_key.** No es el bloque de antecedentes: son CINCO dominios. Alergias y digestion queda ENTERO fuera (10 de 10, incluidos los siete sintomas digestivos); Habitos 4 (tipo de actividad, calidad de sueno, RONCA -tamizaje de apnea-, alcohol); Conductas alimentarias 4 (comidas al dia, desayuna, patron alimentario, suplementos); Antecedentes 3; Hidratacion 4 (cafe, te, jugos, color de orina). **VERIFICACION QUE SALVA EL REPORTE: su archivo TAMPOCO las consume** (aparecen en la declaracion de la encuesta y en countFilled, no en el calculo), asi que no se perdio nada al portar: el instrumento pregunta mas de lo que el modelo consume, y es igual en los dos. **Consumidores en Atlas: TODOS los readers de motor descartan la respuesta si la pregunta no tiene field_key** (build-engine-input, psico-treatment-reader, medico-ejercicio-treatment-reader, patron-view), asi que una pregunta sin field_key no llega a NINGUN motor, no solo al nutricional. De las 25: **5 tienen consumidor** (la historia clinica, desde 2026-08-24) y **20 no tiene ninguno** mas alla de verse en las respuestas crudas. Curiosidad util: la pregunta "¿Sigue algun patron alimentario?" NO alimenta la vista de patron alimentario (esa sale de los 15 grupos de D1 + 3 horarios). Va a Gildardo como 3.1 de la ronda del 24, con la tabla completa y dos preguntas: cuales deben entrar, y si las que no use nadie valen la pena en el instrumento (el paciente les dedica tiempo).

**AMPLIACION (2026-08-24, verificado contra la encuesta v5 por TEXTO, no por field_key): no son dos preguntas, son CUATRO, y el bloque de antecedentes quedo ENTERO fuera del contrato del motor.** Ademas de alergias e intolerancias, tienen field_key NULL: **"¿Toma medicamentos para la presion arterial?"** y **"¿Le han realizado alguna cirugia que afecte la digestion o el metabolismo?"**. Las dos pesan mas que las alergias en algunos pacientes: una cirugia metabolica cambia absorcion, requerimiento proteico y tolerancia (un bypass no es un detalle), y la medicacion antihipertensiva es lo que separa una HTA controlada de una que no lo esta (el motor sabe el diagnostico, d5_36, y no sabe si esta tratada). El patron deja de ser "faltaron dos campos" y pasa a ser "un bloque entero no entro", lo que abre la pregunta de si hay OTRO bloque igual: va a Gildardo como pregunta de fondo (¿revisar el contrato del motor completo, en vez de campo por campo?). CONFIRMADO ADEMAS que su HC muestra las cuatro (capturas 2026-08-24: "Medicacion antihipertensiva", "Alergias alimentarias", "Intolerancias" con su valor), asi que el agravante de abajo aplica a las cuatro.

**AGRAVANTE (2026-08-24, al armar la quinta pestaña):** la historia clinica SI las va a mostrar, porque salen de la encuesta. Entonces el documento clinico que firma el profesional AFIRMA que el paciente es alergico al marisco, en la misma consulta en la que el menu se lo puede servir. El dato no falta: esta a la vista en una hoja y ausente en la otra, que es peor, porque el plan parece verificado contra la historia. Sube la prioridad de (a) y la vuelve requisito de la pieza 4 de la quinta pestaña, no solo del menu.

**Propuesta (no construida):** (a) darles field_key y meterlas en el contrato del prompt como un bloque propio, MAS duro que las restricciones medicas (una alergia no se negocia); (b) portar el parrafo clinico que las nombra. La parte (a) es mejora NUESTRA sobre el v8, no porte, asi que se le reporta a Gildardo en la proxima ronda para que la avale, no para que la decida.

**P-40 · ¿El menu deberia considerar el CONTEXTO del paciente (inseguridad alimentaria, acceso a alimentos)? Criterio clinico, decide Gildardo.** Planteado por Santiago: un paciente con inseguridad alimentaria o acceso limitado no deberia recibir un menu con salmon. **El dato YA existe y ya se usa**: `resumen-dieta.ts` (porte fiel de `_resumenNutriParrafo`) lee inseguridad alimentaria ("no presenta / ocasional / frecuente") y acceso a alimentos frescos, y los escribe en el parrafo del Resumen Clinico. Lo que NO ocurre es que lleguen al prompt del menu. **NO se construye:** que la IA module el menu por contexto socioeconomico es criterio clinico y de diseño del modelo (y toca como se le presenta al paciente), asi que va a Gildardo antes que a codigo. Va en la proxima ronda junto con P-39.

**P-41 · Una comida ACTIVA y VACIA es un descuadre que nadie marca (propuesta, 2026-08-23).** Hallazgo de Santiago. Hoy se puede dejar el desayuno activo y repartirle cero porciones a todos los alimentos: el plan dice dos cosas contradictorias (la casilla dice que desayuna, la tabla dice que no come nada). **Verificado que el v8 tampoco lo detecta:** su fila de distribucion solo compara `sum === tot` POR ALIMENTO (fila); no hay ninguna verificacion por COLUMNA ni total por tiempo. De hecho Atlas ya muestra totales por tiempo que el no tiene, solo que no avisa. Es hueco de los dos. **Caso inverso verificado:** una comida apagada con porciones asignadas SI puede quedar guardada (los overrides de un tiempo inactivo persisten en el jsonb), pero no queda muda: la suma de esa fila deja de cuadrar y el aviso por alimento lo marca. **Propuesta:** avisar en vivo, mismo tratamiento que el descuadre por alimento (no bloquear, DIV-11), con el texto en el lenguaje del modelo mental correcto: las casillas MANDAN, la tabla reparte dentro de lo que ellas definen. Va a Gildardo como PROPUESTA para que la avale.

**P-42 · El menu no usa la distribucion por tiempos: son dos caminos paralelos (propuesta, 2026-08-23).** Pregunta de Santiago. **Verificado en el v8: `interDist` (la distribucion) lo leen SOLO la tabla de distribucion y su auto-llenado; ningun codigo del menu lo toca.** El menu se arma del ciclo fijo y, en el v8, se adapta por restricciones. Asi que el menu del desayuno no refleja las porciones asignadas al desayuno, ni alli ni aqui: hueco de los dos, y probablemente no pensado. **Propuesta:** que el prompt del menu lleve, por tiempo de comida, las porciones y kcal que la distribucion le asigno, para que el desayuno propuesto se parezca a lo que el plan dice que debe aportar. Es la conexion que cierra la cadena objetivo -> intercambio -> distribucion -> menu; hoy la cadena se corta en el ultimo eslabon.

**P-43 · PREGUNTA ABIERTA: ¿que MAS deberia alimentar al menu? (planteada por Santiago, 2026-08-23).** Encontramos cuatro cosas que el menu deberia considerar y no considera (restricciones del modelo -ya cableada, P-32-; alergias e intolerancias -P-39-; contexto de acceso e inseguridad alimentaria -P-40-; y la distribucion por tiempos -P-42-). Que aparecieran cuatro buscando otra cosa sugiere que hay mas. Se le pregunta directamente a Gildardo, con la lista de lo que HOY viaja (objetivo calorico, proteina objetivo, restricciones del modelo y del profesional, fenotipo estructural, sector funcional y rutas) para que diga que falta.

**P-50 · El paciente recibe HOY el documento CLINICO, no uno para el (hallazgo del smoke 2026-08-24, va a la ronda como 7.1).** El PDF que Atlas envia lleva IFC, IRC, PABU, ICA-BIS, ISCM, IEHH, el codigo N_N_N_A y "Sector funcional (FyR)". **Y el informe amigable YA EXISTE en su archivo, completo**: `enviarInformePaciente` (v8 L13394) arma `informePaciente` con peso, talla, IMC+categoria, ICT+categoria, cintura, masa grasa kg y %, masa magra, masa muscular, agua total, angulo de fase+categoria, el DFI REESCRITO y el resumen. El DFI reescrito es decision clinica suya, no simplificacion: BAJO/MEDIO/ALTO/CRITICO pasan a Optimo/A mejorar/Requiere atencion/Prioritario; las severidades por dominio a En equilibrio/A vigilar/A trabajar/Prioritario; el dominio conductual con sev>=2 se reemplaza por una frase de acompanamiento que NO menciona TCA; y el veto se reformula como acompanamiento. Su comentario: "sin CRITICO alarmante, sin mencionar TCA". NO lleva NINGUN indice del modelo. Diferencia de canal: el suyo va a la app del paciente (documento + fecha de nacimiento), el nuestro por correo. **RESPONDIDA el 2026-08-26 (§7.1) y APLICADA A MEDIAS el 2026-09-01.**

**Y el congelamiento se quedo puesto seis dias despues de que respondiera, que es el defecto de proceso mas caro de esta entrada.** Decia "CONGELADO el envio al paciente hasta que responda", el respondio, y nadie volvio a esta linea: el PDF siguio saliendo con los seis indices que el nombro. Es la TERCERA vez con la misma forma (P-32 con su nota "VERIFICADO", P-50 con este congelamiento): **una nota de la cola cuya validez depende de una respuesta pendiente, que nadie revisa cuando la respuesta llega.** La regla practica esta en la leccion de las notas de verificacion y hay que extenderla: al recibir una respuesta suya, barrer TODAS las entradas que dicen "congelado", "bloqueado" o "en pausa", no solo las que dicen "verificado". El barrido del 2026-09-01 sobre las 115 entradas encontro esta como la unica vencida (P-35 ya estaba actualizada).

**LO APLICADO (commit del 2026-09-01):** retirados del PDF del paciente los cuatro bloques del modelo (indicadores, EFR con su codigo y el sector FyR, DFI con riesgo/score/severidades, y la rama de "diagnostico incompleto"). El documento no DESESTRUCTURA ya esos campos del snapshot: lo que no tiene no puede filtrarlo. Candado reescrito sobre el DOCUMENTO y no sobre la lista, porque el anterior miraba `INDICATOR_LABELS` y NO se puso rojo al retirar el bloque entero.

**LO QUE FALTA, y no es nuestro:** el DFI en lenguaje de paciente. Su archivo YA tiene el mapa (arriba), pero portarlo es contenido clinico suyo y va preguntado en la ronda (P1). Hasta que responda, el bloque no va: preferimos un documento corto a uno que le diga "CRITICO" a una persona sin nadie que se lo explique.

**Y el PLAN COMPLETO de su §7.1** (diagnostico, meta, plan dietetico, menu, distribucion, recomendaciones y la lista recortada por region) es una pieza aparte, con su orden en BACKLOG. Este PDF no es ese plan.

**P-51 · El BLOQUEO de aprobar sin agendar es NUESTRO, no de D-010 (verificado 2026-08-24, va a la ronda como 7.2).** D-010 (2026-08-03, origen Q25 §7) dice que un "empeoro" solo se comunica con confirmacion + cita agendada, y que **sin eso el reporte sale SIN esa seccion**: degrada. Lo que construimos el 24 IMPIDE aprobar y enviar. Es mas restrictivo que lo decidido y es una restriccion sobre un acto clinico, asi que se le pide que la apruebe o la corrija. Sigue abierta ademas su consulta de entonces: si "cita agendada" se cumple con el campo de fecha lleno.

**P-52 · Su filtro de la tabla de la HC muestra "Normal" y "Optimo" como alterados (verificado con valores reales, 2026-08-24).** Su regla es `RISK = ambar || rojo || AZUL`. Con el paciente de la captura: **SMM/W 41,2 "Optimo"** pasa porque `cSMM` usa el azul para Optimo, y **AF 6,7 "Normal"** pasa porque `cAF` devuelve la etiqueta "Normal" con color AMBAR en el rango 6,5-7,0 (H). Es el mismo azul ambiguo de P-49/Parte 6, en la direccion contraria: a nosotros nos pintaba un desnutrido de verde, a el le mete lo optimo en la lista de alterados. **NO se copian los dos artefactos**: nuestra tabla oculta lo que nuestras etiquetas llaman optimo o normal. Va como reporte.

**P-53 · PATRON de su prototipo: el motor propone y nadie recoge la propuesta (tres casos, barrido 2026-08-25; va a la ronda como 8.5).** No es un hallazgo suelto sino la misma forma tres veces: (1) su motor de ejercicio calcula el FITT completo y su pantalla lo muestra, pero el campo de notas de al lado ("Intensidad y frecuencia", "Programa de ejercicio") EMPIEZA VACIO, asi que el deportologo teclea otra vez lo que el modelo calculo; (2) las restricciones medicas del modelo se calculan y se muestran, pero NO viajaban al prompt del menu (P-32, ya cableado por nosotros); (3) las alergias e intolerancias se capturan y se muestran en su HC, pero no entran a ningun motor ni al menu (P-39). **Verificacion del lado nuestro ANTES de preguntarle: en Atlas cada salida de los tres motores portados llega hoy a una pantalla** (`fitt`, `faRec`, `clearance`, `metas`, `monitoreo`, `medNotas`, `salvaguarda`, `enfoque`, `temas`, `tamizaje`, todos en profession-treatment-section). El hueco no es de CONSUMO, es de que la propuesta no se pueda TOMAR. **Criterio propuesto:** donde el modelo propone, la pantalla precarga y el profesional ajusta, con marca de lo que cambio (lo que ya hace la cadena calorica). La pregunta a Gildardo deja de ser "¿deberia precargarse esto?" y pasa a ser "¿que otras salidas del modelo sabes que no llegan a donde deberian?".

**P-54 · CORRECCION a P-53 y al 8.2: el `resumenClinico` del motor SI se recoge, y aterriza en las guias dietarias (verificado 2026-08-25).** `pipeline-writer.ts:183` siembra `output.resumenClinico` como PRIMERA fila de `treatment_diet_guidelines` al crear el tratamiento. Asi que las guias dietarias NO son una caja vacia inventada por nosotros: son el unico sitio donde ese texto llega a una pantalla, y encima queda editable. Corrige lo que ibamos a decirle ("no responde a nada tuyo"). La pregunta del 8.2 cambia: ¿le parece bien que su resumen aterrice ahi EDITABLE, o deberia mostrarse como salida del modelo en solo lectura y dejar la caja para lo que escribe el profesional?

**MARCO PARA LA PROXIMA RONDA (Santiago, 2026-08-23):** Gildardo no es programador y armo el prototipo con ayuda, asi que es probable que estas conexiones no las pensara, no que las descartara. P-39, P-41, P-42 y P-43 se le redactan como PROPUESTA nuestra que el avala o corrige, NO como reporte de defecto de su archivo. La diferencia no es cortesia: un reporte de error invita a defender lo hecho, una propuesta invita a decidir.

---

## RESPUESTA DE GILDARDO 2026-08-23: lo que hay que verificar ANTES de aplicar

**P-44 · P-29 quedo AMBIGUO y bloquea: "por grupo" puede significar dos cosas, y su archivo dice una de ellas.** Responde "se prescribe por grupo; los alimentos aparecen dentro de cada grupo para que el nutricionista los despliegue, no para que reparta porciones entre ellos". Pero su tabla tiene **TRES niveles**, no dos (verificado en la entrega vigente, `interRows` ~L16899-16918):

| Nivel | Que es | Cuantos | ¿Lleva input de porciones? |
|---|---|---|---|
| 1 | GRUPO (`INTER_GRUPOS`) | 12 | NO, es fila de encabezado |
| 2 | SUBGRUPO (`INTER_TABLA_A.sub`) | 21 | **SI**, un input por subgrupo |
| 3 | ALIMENTOS (`INTER_TABLA_B`) | 350 | NO, se despliegan en un `<details>` |

La segunda mitad de su frase ("los alimentos se despliegan para verlos") describe el nivel 3 EXACTAMENTE. La primera ("por grupo") leida literal es el nivel 1. **Si "grupo" = subgrupo (21), lo que construimos es fiel y NO hay nada que revertir. Si "grupo" = 12, hay que revertir Y su propio archivo estaria en desacuerdo con su respuesta.** Nuestra pregunta original decia "21 alimentos", asi que es probable que el desacuerdo sea de VOCABULARIO (el llama "alimentos" al nivel 3; nosotros llamamos "alimentos" al nivel 2). **NO se revierte hasta aclarar:** revertir es un cambio de forma del jsonb con data-migration, y hacerlo por una ambiguedad de terminologia seria caro y posiblemente al reves.

**P-45 · El deficit se contaria DOS VECES si se aplican 1.1 y 1.2 juntos (mal razonado, reportar).** Pide (1.2) que el gasto se calcule sobre el **peso de referencia** (meta) y (1.1) que el **deficit de 500** se conserve como sugerencia editable. Pero el GET sobre el peso META **ya es** el gasto de la persona en su peso objetivo: es, por definicion, la ingesta que lleva a ese peso. Restarle ademas 500 es un deficit sobre un deficit. Con un paciente obeso el objetivo puede caer al piso (1.500 H / 1.200 M) por dos vias sumadas. No decimos que este mal: decimos que las dos correcciones juntas cambian el significado del deficit y hay que preguntarle si es lo que quiere.

**P-46 · 1.3 no afecta solo al cancer: la MISMA rama cubre la DESNUTRICION.** En `motorTratNutri` la linea es `if(hasCancer || desnutricion){ protKg = 1.25 }`. Al mandar ese motor, la proteina baja de 1,5-2,0 a 1,25 **tambien para los desnutridos** (IMC < 18,5), que son los fenotipos F7/F10 y el perfil del paciente con riesgo de realimentacion. El lo anoto como "la fila de cancer". Conviene insistir con ese dato: no es una fila, son **dos poblaciones**, y la segunda es la mas fragil de las dos.

**P-47 · P-27 (micros por patologia) deja una parte sin decir.** Confirma que las necesidades se ajustan por patologia y da dos ejemplos (hipertenso 1.500 de sodio; renal 2.000 y proteina controlada). No dice que pasa con **potasio y fosforo en el renal**, que hoy son RDA fijas (3.400 y 700) mientras la restriccion del modelo dice < 2.000 y < 800. Lo logico es que la restriccion pase a ser la necesidad; se asume asi y se le reporta, no se le vuelve a preguntar.

**P-48 · Regla del sexo aplicada como barrido (su instruccion: corregir y reportar, no consultar). Resultado: UN candidato, y no lo podemos corregir solos.** Se barrieron todos los umbrales de composicion del motor y de los modulos derivados. Estratifican por sexo: FMI (3/6 H, 5/9 M), FFMI (17/21,59 H, 15/19,34 M), ASMI (7,0/5,5), SMM/W (27/22), cFMI, cSMM, cASMI, cAF, el `_fmiElev` y el `_smmwLow` del DFI, y las tres copias de sarcopenia. **NO estratifican dos:**
- **`ECM_BCM > 1.4`** (badge de salud celular). Es un umbral de composicion y no distingue sexo. **No lo corregimos porque no tenemos el par de valores**: corregirlo aqui seria inventar un umbral clinico, que es justo lo que nunca hacemos. Se le pide el par (H/M).
- **`MCA_dif < -1`**: no distingue, pero es un RESIDUO contra `MCA_ref`, que el Biody entrega por sexo y edad. La estratificacion ya esta dentro de la referencia. **No es defecto**; se deja como esta y se dice por que.

**P-49 · P-26 tiene una consecuencia que el no menciona: lo que mostramos HOY es una lista base, y la pantalla no lo dice.** Si los alimentos concretos los escoge la IA segun la ciudad, y eso no se puede construir (proxy caido, modelos que la cuenta no tiene), entonces `INTER_TABLA_B` tal como la portamos es un **fallback**, no la lista del paciente. Un profesional que la lea hoy creera que es la lista definitiva para ESE paciente. Es nuestro y es chico: rotularla.

**RESPUESTA A SU PREGUNTA (P-28, "¿de donde sacaron salud celular en Tratamiento?"): de su propio archivo, y no por interpretacion.** `celBadges` esta en la entrega VIGENTE (2026-08-19) en la **linea 17126**, y esa linea cae **dentro de la subpestaña del nutricionista de Tratamiento** (`tabTrat === "plan_nutricional"` abre en 16595 y la del medico en 17184). Nuestro comentario de porte cita `ATLAS_v7.html:15702-15706`, el mismo bloque en la entrega anterior. Lo portamos de donde estaba, no lo movimos. **Y eso contesta su preocupacion de fondo: no hay mas piezas movidas por ese camino, porque esta no se movio.** Si va a Diagnostico, es un cambio suyo, y lo hacemos.

---

## COLA NUEVA (ronda del 2026-08-26, enviada)

Documento: `docs/entregas/RONDA_GILDARDO_2026-08-26.md`. Estas entradas son la cola INTERNA; lo que
Gildardo recibe es el documento. No confundir (leccion "cola viva vs documento enviado").

**P-55 · Los dominios Alimentacion e Hidratacion del DFI estan clavados en 30 y 20 para TODOS.**
`calcLE8` lee `d1_9`, `d1_10` y `d1_16`, que no existen en la encuesta (solo en el objeto demo). El
mapeo correcto (`calcPatron(enc).score` y `enc.d7_agua`) esta escrito y desactivado tras
`LE8_MAPEO_CORREGIDO`, porque encenderlo cambia el diagnostico de todo lo ya evaluado. Preguntado como
punto 1 de la ronda, con la sub-pregunta de que hacer con las evaluaciones existentes.

**P-56 · Inventario del 3.1 rehecho: la columna que decide es "llega el dato en Atlas", y son 0 de 25.**
Su medida (consumidores en SU archivo: 19 de 25 verificadas, su cifra de 22 compatible) y la nuestra
(consumidores en lo PORTADO: 1 de 25, y muerta) median cosas distintas y ninguna era la que decide.
Ninguna de las 25 tiene `field_key`. Dominios `d4` (Conductas alimentarias) y `d6` (Alergias y
digestion) no tienen NI UN `field_key`: nada de esos dos dominios llega a ningun motor. No requiere
decision suya, es trabajo nuestro.

**P-57 · Su numeracion y la nuestra se separaron: un mismo codigo nombra preguntas distintas.**
Nuestra encuesta tiene dos preguntas que su numeracion no contempla (cirugia digestiva = `d6_qx`, que el
muestra como num 63, y agua = `d7_agua`). Desde P45 el desfase es -1 y desde P58 es -2. `d6_45` es
Hinchazon para el y Cirugia para nosotros. **Regla: citar siempre SU CODIGO, nunca el numero de
pantalla.** Familia de la leccion "los recorridos de smoke se escriben en el lenguaje de la pantalla".

**P-58 · Con el deficit en cero, el piso de 1.500/1.200 dejo de activarse.** El piso esta guardado tras
`if(deficit>0)`. Con `deficit=0` (su decision 1.2) no se activa "casi nunca": no se activa NUNCA. Caso
reproducible: mujer 60 anos, 150 cm, 60 kg, sedentaria -> GET 1.172 kcal, piso 1.200, sin correccion.
Es el 1.2 llegando por el otro lado: no dos descuentos sumados, sino una red colgada de la condicion
equivocada. Preguntado como punto 4.

**P-59 · El tamizaje de apnea. CERRADA el 2026-08-27: NO SE CONSTRUYE, y la retiro el.** Su respuesta,
textual: *"No la construyan. Retiren la tarea. El tamizaje de apnea no esta en el cuestionario, y no esta
porque yo no lo puse. No hay instrumento que darles porque nunca hubo instrumento."* Y lo asumio entero:
*"esa propuesta salio de mi lado, no del suyo"*, de un analisis que aprobo en bloque sin ver que inventaba
un instrumento que el archivo no tiene. Es el caso que origina su regla 0 (ver CLAUDE.md).

**Y la instruccion general que sale de ahi:** antes de construir cualquier contenido diagnostico por
profesion, verificar que **el dato ya este en la encuesta Y el criterio ya este en el archivo**. Lo que no
cumpla las dos, se le devuelve. Aplicado a su lista aprobada del 26: los diez items restantes YA estan en
su archivo, en el bloque `=== DATOS CRUDOS DEL PACIENTE ===` que alimenta el diagnostico (L13785-13830).
No hay que construirlos: hay que portar ese bloque. La apnea era el unico que exigia CRUZAR datos en una
conclusion nueva, y es el unico ausente de su archivo.

**P-60 · El rango proteico 1,5-2,0 se resolvio contra el archivo: portamos 1,5.** Su documento da un
rango y `protKg` es escalar; su archivo nuevo implementa `protKg = desnutricion ? 1.5 : 1.25`. Manda el
archivo. Queda preguntado si el 2,0 es techo de referencia. **No bloquea el porte de `motorTratNutri`.**

**P-61 · Suplementos (`d4_35`) y medicacion (`d5_37`) son texto libre.** Para no duplicar vitamina D o
saber si la HTA esta tratada habria que interpretar texto libre. Preguntado: mostrar literal al
profesional, u opciones cerradas (toca contenido congelado, es suyo).

**P-62 · Separacion declarada: la alergia se filtra en CODIGO, el patron alimentario va por prompt.**
La seguridad no puede depender de que el modelo obedezca. Declarado en la ronda para que lo objete si no
esta de acuerdo.

**Sin responder de la ronda anterior, remandados CON NUMERO** (iban sin numerar, probable causa de que
se pasaran): 7.1 (era 8.7, carnes rojas / orden de `FREQ_GROUPS`, **bloquea el rediseno del formulario**),
7.2 (era 7.3), 7.3 (era 9.2), y 7.4/7.5/7.6 (los tres del porte de la HC; **el de la fecha de la firma es
probatorio**).

**Diferidos por el:** 3.4 (acceso a alimentos e inseguridad alimentaria, "sigan sin tocarlo").
**Bloqueados por falta de vision del software:** 8.5 y 3.5. Se resuelven con el DOCUMENTO DEL MAPA
(inventario de tres columnas + que consume cada pantalla), no con acceso: ya tiene cuenta.

**P-57b · Verificacion hacia atras del desfase (P-57): CERO instrucciones mal aplicadas.** Se reviso
cada codigo que Gildardo nos ha citado en toda la correspondencia (`d5_39`, `d5_38`, `d6_43`, `d6_44`,
`d5_36`, `d4_34`, `d4_35`, `d3_31`, `d2_21`, `d8_59`, `d7_57`, `d5_42`) contra la pregunta que ese
codigo tiene en Atlas: **coinciden todas**. Tambien se coteja el tramo de hidratacion, que es el mas
desfasado: `d7_55` (Gaseosas), `d7_agua` (Agua) y `d7_56` (Bebidas energeticas) son **sus** codigos, no
nuestros, y coinciden. La razon de fondo: **el cableado se hizo por SU CODIGO, no por posicion**, asi
que el desfase de numeracion nunca entro. El hazard es prospectivo, no retrospectivo, y asi queda dicho
en la ronda. Ademas, el nunca cita por numero: siempre por codigo.

**P-56b · `d3_31` (alcohol) es HOY inerte, y dejara de serlo al portar su constructor de texto
clinico.** El DFI lo lee en `engine.dfi.js:76` y en su copia autorizada (`const alcohol = enc.d3_31 ||
""`) y **ningun calculo lo consume**: lectura muerta, probado por el candado de inercia
(`src/tests/field-key-inertness.test.ts`). Por eso darle `field_key` no mueve nada hoy. **Pero su
constructor de texto clinico (su L13172) SI lo consume**, y esa pieza no esta portada. **Al portarla,
`alcohol` pasara de `""` a un valor real y el texto clinico cambiara para todos los pacientes.** No es
un defecto: es el efecto buscado. Queda anotado aqui para que quien porte esa pieza no lo lea como
regresion, y para que el candado de inercia se actualice en ese momento (dejara de aplicar a `d3_31`).

**P-63 · Las 25 field_key: CONSTRUIDO y aplicado (migration 0085, 2026-08-26).** Las tres versiones
(v2, v3, v5) quedan con CERO preguntas sin `field_key`. Dos piezas: el flag `treatmentEngine` en
`supabase/seed.ts` (para bases nuevas) y la data-migration por `question_text` sin filtro de version
(para las sembradas). Efecto sobre el calculo: NINGUNO, probado por `field-key-inertness.test.ts` con
control negativo. Completitud: de 32 encuestas, 13 ya incompletas, 19 completas que siguen completas,
CERO volteos.

**P-64 · `FREE_TEXT_TO_ENGINE` de 3 a 10 campos. El marco, corregido dos veces antes de acertar.**
No fue descuido nuestro ni exclusion de Gildardo. Su §4 del 15-ago nombro las nueve preguntas con
"Otra" y describio cuales alimentaban el motor ENTONCES (`d5_38`, `d6_44`), cuando `d6_43` ni siquiera
tenia `field_key`. Nuestro codigo congelo esa DESCRIPCION como lista de exclusion permanente, que es
justo la "excepcion por pregunta" que el rechazo al pedir **"una sola regla para todo el instrumento"**.
Criterio ahora explicito: el texto libre alimenta al motor cuando el motor ACTUA sobre su contenido.
Va como pregunta 9 de la ronda.

**P-65 · Reporte (no pregunta): `d2_21` y `d5_40` YA perdian su texto libre, con el motor portado.**
Tienen `field_key` desde siempre, asi que un `"Otra: me provoco vomito"` NO encendia la deteccion de
metodos (`engine.dfi.js:264`, `atlas-tratamiento.js:88`). Agravante: la historia clinica lee CRUDO
(`survey-answers-reader`, sin la glue), asi que el documento mostraba lo que el motor no habia visto.
**Verificado contra la base: CERO respuestas reales con texto libre en esos campos**, asi que ninguna
evaluacion se emitio sin el dato. Corregido por P-64. Va como 9.3 de la ronda, como reporte.

---

## ESTADO DE LA RONDA DEL 2026-08-26

**ENVIADA el 2026-08-27 por Santiago.** `docs/entregas/RONDA_GILDARDO_2026-08-26.md`: doce preguntas
numeradas mas la 5.3b, seis puntos remandados, y el mapa de Atlas como anexo.

Consecuencias, ahora que salio:

- **Ya NO se le agrega nada.** Mientras estuvo escrita sin enviar se le podian sumar hallazgos; desde el
  27 no. Lo nuevo abre una ronda siguiente (`RONDA_GILDARDO_2026-08-28.md`).
- **Gildardo aun no ha respondido.** No dar por contestado nada de lo que pregunta.
- **P-55 a P-65** son su cola interna; la ronda es lo que el recibe. No confundirlas.

**Lo que quedo esperando su respuesta y NO se construye mientras tanto:** el tamizaje de apnea (sin
instrumento ni puntos de corte, pregunta 4), el agrupamiento de Alimentacion del formulario (7.1,
carnes rojas), y el flip de `LE8_MAPEO_CORREGIDO` (pregunta 2, cambia diagnosticos ya emitidos).

---

## RONDA NUEVA 2026-08-28 (abierta)

`docs/entregas/RONDA_GILDARDO_2026-08-28.md`. **Abierta porque la del 26 ya salio** (27-ago) y a un
documento entregado no se le agrega.

**P-66 · El asesor legal CONTRADICE su instruccion del alergeno, y hay que decirselo asi.** El dijo "el
alergeno se avisa pero no se cruza"; el legal dice que mostrarlo NO basta porque el sistema ya tiene el
dato ("un sistema que tenia el dato y no lo uso es mucho mas dificil de defender que uno que nunca lo
tuvo") y recomienda bloqueo activo con confirmacion afirmativa y registro.

**No es que dudemos de su instruccion: cambio la premisa.** Cuando la dio, las alergias NI SIQUIERA
llegaban al motor (dos de las 25 sin field_key). Hoy el cruce existe, construido para el menu y con su
patron ya aprobado por el: aviso arriba, confirmacion con motivo obligatorio, registro en auditoria, y
el aviso NO se borra al descartarlo.

Se le pregunta a EL y no se aplica el criterio legal directamente, porque el legal opina sobre
exposicion y no sobre practica: un bloqueo que estorba en cada consulta se vuelve un clic automatico y
deja de proteger. Eso es criterio clinico.

**LUVIA no esta construida**, asi que no hay nada que deshacer: entra con el criterio que el diga.

**P-67 · "Meta kg": divergencia visible con su archivo, y NO se porta.** Su tabla de composicion tiene
un campo editable "Meta kg" en la fila de Peso; Atlas deja esa celda vacia. La razon: en Atlas el peso
meta YA tiene fuente unica (lo calcula su propio `motorProtocolo` y el nutricionista lo sobrescribe con
`adj_peso_meta`, que entra a toda la cadena). Un campo editable en la ENTRADA seria una SEGUNDA fuente
del mismo concepto, o sea el problema de los dos objetivos caloricos que el mismo hizo colapsar. Y hay
obstaculo practico: `adj_peso_meta` vive en `treatments`, que no existe antes del diagnostico.

**Su archivo lo tiene porque alli todo el bloque es editable y no hay motor que lo calcule. Nosotros si
lo tenemos.** Esa es la diferencia y es la que decide. Va como pregunta 2 de la ronda del 28, por ser
divergencia VISIBLE (si la ve en una captura, va a preguntar).

**P-68 · Portado el bloque de medidas editables de su archivo, con tres diferencias deliberadas.**
Peso, estatura, cintura y cadera corregibles ANTES del diagnostico (despues el camino es el flujo de
correccion, que versiona). SIN fuerza prensil, que ya se captura en condiciones BIS. Y mostrando cual
valor es el del equipo y cual el corregido. Se le cuenta en la ronda del 28 como aviso, no como
pregunta: es su pieza y quedo distinta.

---

## Cerradas por su respuesta del 2026-08-27

**P-62 · La casilla de porciones se queda en el SUBGRUPO. Retira su instruccion del 26.** Textual: *"se
queda en el subgrupo, como esta en mi archivo. Con eso desaparece el problema del cuadre calorico: no
hacen falta alimentos representantes, ni rangos, ni tocar la validacion de nutrientes."* **Con esto se cae
entera la Pregunta 11 de la ronda del 26** (cual de las cuatro opciones, y cual es el alimento
representante de cada grupo): no hay que elegir ninguna, porque no hay que mover nada. Codigo actual
(casilla en el subgrupo) = archivo. Nada que construir ni que retirar.

**P-63 · Ninguna cifra de la prescripcion nutricional lleva techo, piso, validacion ni advertencia.**
Textual: *"El software propone y quien decide la cantidad es el profesional. No existe techo y no existe
piso. Existe una recomendacion, y punto... No me la vuelvan a preguntar indicador por indicador: vale para
toda la prescripcion nutricional."* Aplicado: `saveAdjustmentsSchema` tenia SEIS limites clinicos
(proteina 0-4 g/kg, factor de actividad 1-2,5, GEB 500-4000, objetivo 500-6000, peso meta 20-400). Se
retiraron. Queda solo lo ESTRUCTURAL (numero finito y no negativo), que no limita su criterio: evita que
un dedo pegado escriba 40.000 y que la cadena calcule sobre basura. `adjFatPct` conserva 0-100 porque es
el dominio del porcentaje, no un juicio clinico.

**P-64 · Las tablas de alergenos y de patron: RETIRADAS enteras.** Textual: *"Nada de tablas de alergenos,
ni de equivalencias, ni de filtros. Retiren las dos tablas."* Y el motivo, con nuestras propias palabras
citadas por el: *"si marcamos de mas, el nutricionista ve avisos falsos, y a la tercera vez aprende a
ignorarlos"*. Lo retirado: `services/alergenos.ts` (SINONIMOS y PATRON_EXCLUYE), el cruce en el generador,
los dos avisos del panel, el bloqueo del menu, el descarte con motivo (tabla `menu_allergen_dismissals`),
las columnas `alergenos_detectados` y `patron_conflictos`, y el bloque de alergias del prompt. Migracion
`0091`.

**Lo que QUEDA, que es lo que el pide:** que aparezca que el paciente tiene alergias, tal como la encuesta
las capturo. Su `field_key` sigue cableado y su texto libre sigue alimentando el motor (su 3.1: todas las
preguntas entran). El PATRON alimentario sigue llegando al generador porque el lo pidio explicitamente en
su 3.2b, pero como dato declarado, sin tabla de exclusiones (`services/patron-declarado.ts`).

**Y lo que la pantalla no puede decir:** que el menu fue verificado contra las alergias. Verificado: no lo
decia antes (barrido del copy) y ahora no hay nada que lo insinue, porque no se emite ningun aviso.

---

## Cola de la ronda del 2026-08-29

**Enviadas en `docs/entregas/RONDA_GILDARDO_2026-08-29.md`.** La cola es interna; la ronda es lo que el
recibe. Cotejadas una por una antes de cerrar: las de abajo estan todas en el documento. P-69 se CERRO al redactarla: ya estaba contestada.

**P-69 · CERRADA POR EL, Y ANTES DE PREGUNTARLA. Los campos de sus alertas: `d1_13_i` y `d7_agua`.** La
habia redactado como pregunta abierta, con un argumento que sonaba bien (corregir haria discrepar Atlas de
su archivo, y el reportaria nuestra mejora como defecto). El argumento era correcto y la conclusion
equivocada, porque **el ya habia decidido esa disyuntiva** el 28, punto 11b: *"Las dos leen el grupo
equivocado y las dos deben leer d1_13... Portenla YA CON LA CORRECCION; no la porten literal para que yo
la arregle despues"*. Y el agua sale de su mapeo del 28-jul (*"d7_agua, vasos de 200 ml, la misma unidad
que esperaba d1_16"*). **Aplicado en el adaptador**, no en el frozen, para que la transcripcion siga
byte a byte. Corren CINCO reglas.

Enesima vez que doy por abierto algo ya contestado, y esta vez con la instruccion explicita de no volver a
preguntarlo. La forma de no repetirlo: antes de escribir una pregunta en la ronda, grepear SUS terminos en
las respuestas anteriores, no los nuestros.

**P-69b · Declarado (no pregunta): la escala de sus umbrales.** Sus condiciones de azucares son `>= 2` y
en su objeto demo esos campos valen 1 y 2, asi que se leen como el INDICE 0-4 de `FREQ_OPC`. El agua no es
indice: son vasos, porque sus cortes son `<= 3` y `>= 8`. Declarado por si lo lee distinto.

**P-69c · Decision NUESTRA sobre una regla suya, declarada: sin el dato del agua, la regla no se evalua.**
`agua <= 3` con el dato ausente es verdadero SIEMPRE, asi que "Deshidratacion probable" se disparaba por
la orina oscura sola y afirmaba "Agua: 0 vasos" sobre una pregunta sin responder. Resuelto como el
resolvio el ISCM en su punto 4 y calcLE8 en CA-3: sin insumo, no se emite. Un 0 RESPONDIDO si alerta.
**P-70 · El puente de frecuencia a porciones.** Bloquea las diez reglas de consumo. Es chico: la tabla de
nutrientes (`INTER_TABLA_A`) y la aritmetica (`validacion.ts`) ya existen; falta solo la equivalencia
frecuencia -> porciones/dia. El omega-3 NO esta en la tabla: preguntado si se agrega o si esa regla se
retira.

**P-71 · El ICEC y el interruptor `LE8_MAPEO_CORREGIDO`.** Su respuesta del 27 dice "enciendan el mapeo",
pero su propio archivo advierte que encenderlo baja la EB-BIS de TODOS los pacientes entre 1 y 8 anos, y
que antes hay que establecer de donde salen la media 58,578 y la desviacion 13,332. Las dos cosas
comparten interruptor. NO SE HA ENCENDIDO. Preguntado si la media y la desviacion se conservan, si hay
que partir el interruptor, y si la conducta de recalcular-y-anotar que dio para el DFI aplica igual a la
EB-BIS.

**P-72 · Un dominio sin dato sigue puntuando severidad 1.** Aplicado su punto 4 (el ISCM ausente ya no se
clasifica), la severidad del dominio 2 la fija su `?? 1`, escrito para una clasificacion fuera del mapa.
NO SE TOCA: es su decision y es para este caso exacto. Pero deja el radar dibujando "susceptibilidad
leve" sobre un dominio que no se midio, que es la misma lectura favorable que el senalo. Preguntado.

**P-73 · Las tres reglas "positivo" en la misma lista que las criticas.** Forma, no ciencia.

**P-74 · CERRADA COMO PREGUNTA: su punto 3 SI estaba dimensionado, y es TRABAJO NUESTRO.** Lo habia
escrito como "quedo enunciado pero sin alcance" y le iba a preguntar que esperaba que construyeramos. Lo
vio Santiago: es concreto. Mismo error que con la cadena calorica y las carnes rojas, tercera vez.

Son TRES piezas y solo la tercera tiene pregunta:

**a) La fuerza prensil vuelve a mod antropometria.** Textual: "Nunca la puse en las condiciones del BIS...
Devuelvanla a mod antropometria". Verificado: hoy vive exactamente donde el dice que no va
(`bis-conditions-capture`, campo `gripStrengthKg`). Mover el campo. CHICO.

**b) Y lo que el no señalo porque desde fuera no se ve: LA PRENSIL NO LLEGA AL MOTOR.** `dxSarcopenia`
esta portado entero con sus cortes (H <27 / M <16 Kgf, ASMI, AF), pero el motor recibe SIEMPRE fuerza = 0
(brecha declarada en `protocolo-fenotipo.ts`), asi que corta en su primer guard y devuelve "ingrese la
fuerza prensil" AUNQUE el profesional la haya registrado. La rama que emite probable/confirmada/severa
NUNCA se ejecuta en produccion. O sea: pasaba lo que el describe para el dato ausente, pero pasaba
siempre. MEDIO: meterla al input del motor y verificar la constelacion de versiones (regla 7).

**c) "Se cae el sellado": LA MITAD YA ESTA.** El flujo de correccion versionada ya hace literalmente lo
que el pide ("si eso obliga a versionar el documento, se versiona"): no edita nada, crea una version
nueva con el insumo corregido, recalcula y encadena la anterior. Lo unico que sigue sellado es la
PRESCRIPCION APROBADA, por trigger de BD.

**Y ahi si hay pregunta, formulada sobre la CONSECUENCIA y no sobre el alcance:** si una prescripcion
aprobada se puede reabrir, el reporte que el paciente YA TIENE deja de coincidir con el del sistema.
Nuestra lectura, que va declarada: se reabre, y eso dispara la regla de reemision de su 12b. Asi el
sellado deja de ser un candado y pasa a ser una consecuencia registrada.
**P-75 · Declaracion (no pregunta): el orden de la matriz era NUESTRO error y esta corregido.** Su
`FREQ_GROUPS` va por categoria y las carnes rojas ocupan la 11 (neutro); nuestra encuesta ordenaba por el
NUMERO DEL CAMPO y las sacaba las ultimas, entre las de riesgo. Con su regla *"el orden es el mensaje"*,
le deciamos al paciente que son alimento de riesgo. Corregido sin bump de version (ninguna pregunta cambia
de enunciado, opciones ni campo; las respuestas apuntan al identificador, no a la posicion), migracion
`0092`, mas los tres encabezados de grupo. **Por que no lo vimos: nuestro orden era coherente CONSIGO
MISMO.** Lo encontro Santiago respondiendo la encuesta con su archivo al lado.

**P-76 · Las tres notas por profesion del panel de tratamiento.** No encontramos en su archivo la regla de
que va en cada una ni si son tres campos o uno compartido. Citadas donde las vimos.

**Y una que NO va a la ronda porque es nuestra:** `SECONDARY_REQUIRED` en `biody-columns.ts` esta
declarada y no la consume nadie. No es defecto vivo (el ISCM ya sale null por `SECONDARY_FIELDS` en
`analysis.ts`, que si se usa), pero es una constante que aparenta gobernar algo y no gobierna nada.

**P-77 · Reporte (no pregunta): DOS defectos suyos vivos en pantalla, por candados anclados a una entrega
vieja.** `cAF` devolvia "Normal" con el color AMBAR, asi que un angulo de fase NORMAL se pintaba con
color de alerta: la etiqueta decia una cosa y el color la contraria sobre el mismo numero. Y la
salvaguarda de TCA seguia mostrando NUESTRA parafrasis diez dias despues de que el la corrigiera en su
archivo (19-ago) con sus palabras: decian lo mismo, pero sobre lo clinico manda su archivo.

**La causa de los dos es la misma y es nuestra:** los candados de paridad comparaban contra la entrega
desde la que se porto cada trozo, y esa entrega se quedo atras. Un candado anclado a una entrega superada
no compara mal, compara BIEN contra el archivo de hace dias. Cerrado con
`frozen-deriva-vigente.test.ts`, que compara todo el frozen y las siete copias de fixtures contra la
entrega de HOY. Los dos van a la ronda como reporte.

**P-78 · CA-2 RETIRADA: el absorbio la correccion.** El manifiesto exige revisar VIGENCIA al portar un
motor nuevo ("sigue haciendo falta" o "Gildardo ya la absorbio, se retira"). Absorbida el 19-ago y no lo
vimos hasta el 29. El original se re-porto con su texto y el `.authorized.js` se elimino: sin
modificaciones que aplicar no hay nada que generar, y dejarlo habria mantenido un archivo stale que dos
readers importaban.

**P-79 · Aplicada su §13 (un solo menu). Y tres decisiones NUESTRAS que van declaradas.** La IA dejo de
componer y pasa a ADAPTAR el ciclo. Sobre eso decidimos tres cosas que el no especifico, y por eso se le
cuentan:

1. **Devuelve SOLO LOS CAMBIOS, no el menu adaptado.** Si devolviera el menu entero no sabriamos que toco,
   y le estariamos confiando el 90% que no debia tocar. Ademas hace posible aceptar cambio por cambio.
2. **Cada cambio cita la restriccion que atiende, y esa cita se coteja** contra las que se enviaron. NO
   BLOQUEA (juzgar si una preparacion incumple una restriccion es clinico, y es del profesional), pero el
   que cita algo que nadie pidio queda marcado.
3. **Se acepta cambio por cambio**, no en bloque: una sustitucion puede ser buena y la de al lado no.

**Y una nota de forma que puede importarle:** el texto de sistema tiene CLAVE NUEVA (`menu.adapt`). Con la
vieja, un texto editado por el admin para la tarea ANTERIOR seguiria mandando sobre el contrato nuevo: el
sistema diria componer y el usuario sustituir. Con clave propia es imposible por construccion.

**P-80 · Reporte: la merienda sigue vacia y NO se inventa.** Su ciclo de 21 dias trae cinco tiempos y
Atlas maneja seis. La columna queda vacia, la pantalla dice por que, y el prompt de adaptacion NO manda
las celdas vacias: mandarlas invitaria al modelo a inventarlas, y eso seria contenido clinico nuestro
(regla 0). Si algun dia el la agrega al ciclo, la columna se llena sola.

---

## RESPUESTA DE GILDARDO 2026-08-30: lo que cierra y lo que abre

**Cierra cinco de la cola del 29 y reasigna una.** Cotejado uno por uno contra el documento enviado.

**P-70 · CERRADA, Y LA PREGUNTA ERA EL ERROR. No hay puente que construir.** Su punto 0: el patron usual de
consumo de la encuesta (`FREQ_GROUPS`, 15 grupos, frecuencia semanal), la tabla de composicion (`TCAC`, 18
grupos, nutrientes por porcion) y la lista de intercambio (`INTER_TABLA_A/B`, porciones del plan) son TRES
INSTRUMENTOS DISTINTOS. "Ninguno es la traduccion de otro. La numeracion es un identificador interno de
cada tabla, no una clave comun." La frecuencia NO se convierte en porciones porque es un patron, no una
cuantificacion. Y el omega-3 SI esta: en la TCAC, con su valor por grupo; lo buscamos en la lista de
intercambio, que es el instrumento equivocado. **Su leccion, registrada como regla de trabajo:** "cuando una
pieza del archivo no coincide con otra, la primera pregunta no es cual corregir, sino si estan mirando dos
instrumentos distintos". Barrido hecho: el unico cruce era ese.

**P-71 · REASIGNADA A EL, no cerrada.** El interruptor del ICEC se queda en `false`. mu = 58,578 y sigma =
13,332 "no estan establecidas" y la recalibracion "va por mi lado y llega con el dato, no con una
instruccion". Hicimos bien en no encenderlo. Y confirma que la conducta de reemision del 12b aplica igual a
la EB-BIS cuando llegue. NO SE TOCA hasta que el mande el dato.

**P-72 · CERRADA: un dominio sin dato NO puntua.** Aplicada como CA-6 (y CA-7). Ver P-81.

**P-73 · CERRADA: las tres positivas en bloque aparte.** "Una hidratacion adecuada y un TCA activo no pueden
compartir lista ni peso visual." Aplicado: dos listas, la segunda con menos peso visual y sin mostrarse
vacia. La particion es por `niv === "positivo"` (su campo), no por una lista nuestra de titulos.

**P-74 (6c) · CERRADA: el sellado se reabre.** "La prescripcion aprobada se puede reabrir, y reabrirla
dispara la regla de reemision del 12b. El sellado no es un candado: es una consecuencia registrada." Y su
razon del 6b, que no habiamos visto: los tres criterios de sarcopenia (prensil, ASMI, angulo) SON UN
DIAGNOSTICO, y "un criterio que se captura lejos del calculo termina no llegando a el".

**P-76 · CERRADA: una nota por profesion, tres campos distintos.** "Cada rol escribe lo suyo y no se pisan:
el nutricionista no edita la nota del medico."

**P-69c · CONFIRMADA, y ampliada a conducta general.** "Un dato que falta no puede entrar al calculo como si
fuera una respuesta, y menos como una respuesta favorable. No me lo pregunten regla por regla: es la
conducta general del sistema." Permiso explicito para aplicarla sin preguntar caso por caso.

---

## Cola de la ronda del 2026-08-31

**Enviadas en `docs/entregas/RONDA_GILDARDO_2026-09-01.md`** (se abrio el 31 de agosto y se renombro al cerrarla, para que la fecha del documento sea la de su envio y no la de su primera linea). Cotejadas una por una: las cinco estan en el
documento. P-84 se MOVIO desde la ronda del 29, donde se escribio DESPUES de que el la contestara.

**P-81 · Declaracion: su punto 4 tenia CUATRO sitios, y describimos mal uno.** Senalo el `?? 1` del dominio
2; los dominios 1, 3 y 5 tenian la misma forma. Aplicado en los cuatro (CA-6), conservando su `?? 1` para lo
que lo escribio (clasificacion fuera del mapa CON dato). **Y la correccion de nuestro relato, que vale mas
que el arreglo:** reportamos que el dominio 3 sin dato AFIRMABA PATOLOGIA (severidad 2, "envejecimiento
acelerado"). Esa rama existe en `computeDFI` pero NO se alcanzaba: el adaptador fabricaba un IAE de 0 y lo
clasificaba "Concordante", asi que lo vivo era la lectura FAVORABLE (dominio en verde, "ritmo acorde con su
edad cronologica"). Razonamos sobre la funcion suelta en vez de ejecutar el pipeline. CA-7 cierra el
adaptador; CA-6 corta las dos ramas. **Consecuencia clinica que va declarada:** ese dominio inventado
activaba la Ruta 4 y ponia a las cuatro profesiones un objetivo de envejecimiento con meta medible a 24
semanas ("reduccion del IAE de al menos 2 años") sobre un IAE inexistente.

**P-82 · Decision NUESTRA declarada: el riesgo integrado se RENORMALIZA sobre los dominios medidos.** Dejar
el termino ausente sumando cero (que es lo que hacia solo, porque `null/3` es 0) BAJA el riesgo por no haber
medido. La pantalla dice sobre cuantos dominios se calculo. Si el prefiere otra conducta, se cambia.

**P-83 · Donde se capturan las porciones por grupo de la TCAC.** ES LA UNICA QUE BLOQUEA: `calcConsumo` lee
`d1_1`..`d1_18` (porciones/dia) y esos campos NO los captura ninguna encuesta, ni la suya ni la nuestra;
viven solo en su objeto demo (`// Consumo D1`). El argumento que se le lleva es SUYO: escribio esa misma
nota, tres campos mas alla, para `calcLE8`. Va con la sub-pregunta del umbral `>= 2` de las dos reglas de
azucares (indice de frecuencia vs porciones), que es la misma decision del otro lado. **El porte de la TCAC
va CON LAS REGLAS APAGADAS**: con porciones en cero, "Fibra muy baja" se disparia en todos los pacientes.

**P-84 · Los encabezados de categoria de la matriz: los retiramos de la encuesta del paciente.** MOVIDA
desde la ronda del 29 (se escribio ahi el 31, despues de su respuesta del 30: nunca la habria visto).
Divergencia declarada por sesgo de deseabilidad; el orden no se toco. Candado en
`encabezados-frecuencia.test.tsx`, con el mensaje que dice como invertirlo si el responde que vuelven.

**P-85 · La fecha de consulta: su archivo la CAPTURA y es la unica que tiene; Atlas la deduce.** Su campo
"Fecha de consulta" (`fechaConsulta`, input `type=date`) viaja de la encuesta al reporte, y la fecha de
medicion del equipo no aparece nunca en su archivo. Atlas la deduce de `evaluations.created_at`, que en una
inicial es CUANDO EL PACIENTE FIRMA. Hoy coincide (el BIS se toma en consulta); en el modelo a mediano plazo
(tamizaje antes, incluso en casa) deja de coincidir, y quien se equivoca es la HISTORIA CLINICA. Va con la
declaracion de que nuestra HC y nuestro reporte dicen "Fecha" con fechas distintas, que en su archivo no
puede pasar porque solo hay una.

**P-86 · Las notas por profesion: aplicado su principio, y LE PREGUNTAMOS MAL.** Su §8 del 30 ("una por
profesion, tres campos distintos; cada rol escribe lo suyo y no se pisan") esta aplicado: `treatment_notes`
lleva ahora la PROFESION, sellada en el acto y leida del PERFIL del actor, nunca del formulario (si viajara
en el FormData, un profesional podria firmar con el rol de otro). Nullable para las notas anteriores a la
separacion: ponerles una profesion seria fabricar autoria clinica.

**Y la correccion, que es lo que importa:** nuestra pregunta (ronda del 29, punto 8) decia que su archivo
tiene "tres campos de nota, uno por profesion". Verificado al aplicar su respuesta: NO ES ASI. Su archivo
tiene `trat.porProfesional`, un sub-almacen por profesion con CUATRO roles (su propio `PROF_LABELS`:
nutricionista, medico, entrenador, psicologo), y sus campos de texto libre son `diagProf` y `tratSugerido`.
No hay unas "notas". EL CONTESTO SOBRE NUESTRA PREMISA. El principio vale igual; la correspondencia queda
preguntada en la ronda del 31, punto 6: nuestras "Notas del tratamiento" son su `diagProf`, su
`tratSugerido`, o una tercera cosa. Ninguno de los dos esta portado, asi que si nuestra nota ES uno de
ellos, lo que toca es portarlo con su nombre y no mantener un campo paralelo.

**Es la leccion de buscar SUS terminos, al reves:** no fallamos verificando si habia contestado, fallamos
describiendo su archivo en la pregunta. Antes de preguntar por una pieza suya, hay que citarla por su
identificador, no por lo que parece que es.

## ENTREGA DE GILDARDO 2026-09-01: lo aplicado y lo que hay que decirle

**P-87 · Su §5c le pone Delta al IAE, y eso RETIRA su propia §2 del 18 de agosto. Aplicado y declarado.**
Su entrega del 1 de septiembre define el Delta del IAE: *"la distancia al limite del rango que se cruzo, y
cero mientras este dentro de -5 a +5"*. Portado tal cual (`indicator-ranges.ts`, case "IAE"): un IAE de
-17,6 muestra -12,6; uno de +8,2 muestra 3,2; cualquiera entre -5 y +5 muestra 0,0.

**Lo que retira:** hasta ahora esa celda mostraba un guion. La razon era su §2 del 18 de agosto ("el dato
que manda es el valor, no el Delta"), que Santiago tradujo el 19 a dejar el Delta en blanco porque el IAE ya
es una diferencia y el Delta seria la distancia de una distancia. **No fue un descuido nuestro: el cambio de
criterio es suyo, y el nuevo es posterior y explicito donde el anterior era inferido.** El candado
`indicator-ranges.test.ts` cambio de asercion por eso, con el motivo escrito dentro.

**DECLARADO EN LA RONDA, punto 11.5.** La ronda del 1 de septiembre no habia salido todavia, asi que la
declaracion entra en el mismo documento en vez de quedar para la siguiente. Dice que se retira, por que se
retira, y que si el guion era deliberado lo devolvemos. Un cambio que retira una decision suya anterior no
puede consolidarse por silencio.

**P-88 · Su §7c (el reintento ante el tope por minuto): construido, y no necesita respuesta.** "No es un
fallo, es una cola." Groq responde 429 con los segundos de espera en la prosa del error; ahora se esperan y
se reintenta UNA vez, **dentro de la llamada a Groq y antes del fallback**. Lo que haciamos era peor:
cualquier fallo nos cambiaba de proveedor, asi que una cola de dos segundos hacia que el texto clinico
saliera de otro modelo sin que nadie lo pidiera. Declarado en la ronda (punto 11.4).

**P-89 · Su §8 (el filtro de marcadores): construido por los dos lados, como el dijo.** Bloque de FORMATO
DE SALIDA en el prompt (version 2 de `criterion.system`) y filtro a la salida, *"por si el modelo
desobedece, que es lo que hacen"*. **La sugerencia guarda el texto CRUDO**, no el limpio: si algun dia el
filtro se comiera algo, el original tiene que estar. Y se mide cuanto desobedece (`traia_marcadores` en el
`rawResponse`), que es lo unico que dira si el bloque del prompt sirve.

## Cola de la ronda del 2026-09-03 (abierta)

**P-90 · Un tratamiento reemitido IDENTICO: ¿el aviso al paciente cuelga del acto o del efecto?** Caso que
aparecio al cablear el boton de aprobar: reabrir y volver a aprobar sin cambiar nada deja un tratamiento
reemitido con prescripcion identica. Ahi sus dos frases de la §12c apuntan a lados distintos: "un
tratamiento reemitido se avisa SIEMPRE" (mira el ACTO) contra "no se alarma a nadie por un decimal" (mira
el EFECTO). Ninguna contempla el caso identico.

**Hoy Atlas avisa siempre**, porque la condicion que usa es el acto (`aprobacionesPrevias > 0`).
**Propuesta que va en la ronda:** derivar si la prescripcion cambio (kcal, proteina, restricciones,
porciones) y avisar solo entonces; el registro en la historia se conserva SIEMPRE, cambien o no las cifras,
que es su formulacion del sellado como "consecuencia registrada". **No se toca nada mientras responde:**
seguir avisando siempre es el lado conservador. Ronda del 2026-09-03, punto **4** (nacio como punto 1 y se
corrio cuando la ronda gano los tres puntos de su entrega del 2; el numero se actualiza porque un puntero
al punto equivocado es peor que no tenerlo).

**P-91 · ¿Un campo de la cadena calorica puede quedar VACIO? (ronda del 2026-09-03, punto 5; nacio como el 2.)** Caso real
del smoke: una prescripcion de 2.000 kcal con 427 g de carbohidratos y 7 g de grasa. Las cuatro cifras son
CORRECTAS y se reprodujeron exactas: salen de que el porcentaje de grasa quedo en 3 %. Se barrieron los 50
tratamientos de la base y ninguno lo produce solo, asi que el 3 % se escribio.

**NO se pide validar la cifra**, que su §5 del 27-ago prohibe expresamente ("ninguna cifra de la
prescripcion lleva techo, piso, validacion ni advertencia", y dijo que vale para TODA la prescripcion). Lo
que se pregunta es otra cosa: si los campos deben tener un valor por defecto que NO SE PUEDA DEJAR VACIO,
de modo que borrarlo devuelva el del modelo en vez de dejar un numero suelto. Un valor escrito a mano y un
campo mal borrado se ven identicos desde el motor.

**Mientras responde no se toca nada.** Si dice que tampoco corresponde, se queda como esta.

---

**P-92 · `LE8_MAPEO_CORREGIDO` encendido en su entrega del 2-sep, sin la recalibracion que su propio archivo exige. BLOQUEA portar `engine.dfi`.** (Ronda del 2026-09-03, punto 1.) Entre el 1 y el 2 de septiembre el interruptor paso de `false` a `true`. Su comentario, INTACTO en la misma entrega, exige las dos cosas a la vez ("se recalibran en el MISMO acto, nunca por separado") y cierra: "mientras no exista, esta bandera se queda en `false`". El 30 de agosto nos lo habia escrito con las mismas palabras. **Los dos numeros no se movieron:** `_zBis(_icecVal, 58.578, 13.332)` sigue byte por byte igual. Por su propia cifra, encenderlo solo baja la edad bioelectrica de TODOS los pacientes entre 1 y 8 anos.

**Atlas NO lo porta**, y esto no es corregirle la ciencia: es no aplicar un cambio que su archivo declara incompleto sin el otro medio. Fijado en `le8-interruptor-pendiente.test.ts`, que se pone ROJO el dia que recalibre o vuelva atras. **Y el hallazgo de proceso que vino con esto:** ninguno de los dos candados lo vio. El diff byte-a-byte porque mira la entrega de la que se porto; el de deriva porque descartaba las lineas de 45 caracteres o menos y `const LE8_MAPEO_CORREGIDO = false;` mide 34. El criterio del filtro paso de TAMANO a FORMA (es una asignacion): +121 lineas vigiladas, 2 rojos.

**P-93 · El bloque de codigo del mapa de regiones no llego con la entrega.** (Ronda del 2026-09-03, punto 2.) Su §10.4 afirma que "el bloque de codigo va en la entrega, con las diez zonas, las ciudades, el nucleo y la funcion que resuelve la lista a partir de la ciudad", y detalla que esta probado. **No esta en el `ATLAS_v8.html` del 2-sep:** cero ocurrencias de las diez zonas, del nucleo nacional y del resolvedor; "Barranquilla" aparece una vez y es la lista de ciudades del formulario, igual que en la entrega anterior. El CRITERIO si llego completo y es utilizable. Es lo unico de la ronda donde no hay nada que podamos hacer mientras responde: reconstruir la asignacion alimento-zona a mano seria inventar contenido clinico.

**P-94 · Los 18 grupos de la encuesta contra los 21 subgrupos de la lista de intercambio: la correspondencia no es uno a uno.** (Ronda del 2026-09-03, punto 3.) Su punto 0 pide estimar el consumo actual desde la lista de intercambio en vez de convertir frecuencias. **La lista SI tiene las porciones**; lo que falta es el mapa. Calzan directo 6 de 18 (leguminosas, cereales, tuberculos, frutas, grasas saturadas, alcohol). No calzan: carnes rojas / pollo / pescado son TRES grupos contra un corte por contenido graso (magras vs altas en lipidos); huevos va dentro de "sustitutos"; verduras crudas y cocidas son dos grupos y un subgrupo; grasas saludables se reparte en cuatro; y agua y cafe/te no tienen subgrupo (el agua ademas se captura aparte en `d7_agua`). **Ademas `calcConsumo` esta como stub vacio en su entrega vigente**, con su nota de mantenerlo asi para no romper referencias. Se le pide el MAPA, no el dato: repartir "carnes rojas" entre magras y altas en lipidos es decision clinica.

**P-95 · La proteina la prescribe el motor (su §9.6 punto 4): APLICADO el 2026-09-03, y cierra P-32/P-35 en su parte de proteina.** Textual suyo: "la proteina la prescribe el motor, 1 g/kg, no el minimo poblacional de 0,8, sobre el peso meta que fije el nutricionista". Es su respuesta a la divergencia que le reportamos, y se veia en pantalla: el bloque de prescripcion decia 1 g/kg y la cadena calculaba con 0,8, para el mismo paciente. La diferencia no era de cifra sino de NATURALEZA (`protMin` de motorProtocolo es un MINIMO poblacional; `protKg` de motorTratNutri es una PRESCRIPCION).

**Se sella `protocol_suggested.mtn.protKg`, y solo eso.** Los otros tres valores que su cadena lee del motor (objetivo, grasa, PAL) NO se sellan: ya estan alineados porque a su motor le pasamos los efectivos por sus propias entradas `edit.*`, y sellarlos moveria cifras que el no mando mover. Los snapshots anteriores no se pueden rellenar (write-once incluso en draft, trigger 0026), asi que la resuelve una cascada con la fuente declarada (`protFuente`: profesional, sellado, motor, protMin). **Medido antes de aplicarlo:** 60 tratamientos, 56 con protMin 0,8, CERO aprobados, cero con proteina escrita a mano; ninguna prescripcion sellada se mueve. Los dos perfiles de riesgo verificados: desnutricion F10 (IMC 18,2) da 1,5 por las dos vias y NO se mueve; ERC pasa de 0,6 a 0,7, que es el punto medio del rango que su propio motor declara. Version `anibise-protocolo-2026-09-03`.

**P-96 · P24 (`d3_24`) no tiene opcion para "no hago ejercicio". Observacion de Valentina, ronda del 2026-09-03 punto 6.** La P23 (`d3_23`) permite 0 dias; la P24 arranca en "Menos de 15" minutos. **Verificado que pasa hoy:** la encuesta NO tiene saltos condicionales (todas las preguntas se renderizan siempre), asi que la P24 aparece aunque conteste 0 dias; y dejarla en blanco **impide diagnosticar**, porque `run-pipeline` exige la encuesta completa. O sea que el paciente sedentario tiene que marcar una duracion que no hace. **El dato del modelo NO se corrompe:** el LE8 hace `metMin = dias * mins` y con 0 dias el producto es 0 sea cual sea la duracion. Es defecto de instrumento y de lo que queda escrito en la historia, no de calculo. Se le pide a el la opcion (o el salto condicional, que seria el primero de la encuesta). No se toca nada mientras responde.

**P-97 · P43 y P44 hablan idiomas distintos, y el paciente no distingue alergia de intolerancia. Observacion de Valentina (P44) mas lo que aparecio al mirarlo. Ronda del 2026-09-03 punto 7.** Textual de hoy: **P43** (`d6_43`, "¿Alergias alimentarias diagnosticadas?") ofrece Ninguna / **Leche, Huevo, Mani, Trigo, Soya, Pescado, Mariscos** / Otra; **P44** (`d6_44`, "¿Intolerancias alimentarias?") ofrece Ninguna / **Lactosa, Gluten, Fructosa** / Otra. **La 43 habla en ALIMENTOS y la 44 en SUSTANCIAS**, y van seguidas: quien tiene intolerancia a la lactosa encuentra "leche" en la pregunta de ALERGIAS, que es la que no le corresponde. Valentina reporta que los pacientes no saben que es fructosa o gluten y contestan con alimentos, usando "Otra" para lo que deberia estar en la lista. **La mitad de fondo (Santiago):** son cosas distintas clinicamente (inmune vs digestiva) pero preguntarlas por separado supone que el paciente sabe cual tiene. Se le piden las dos mitades: el lenguaje de las opciones de la P44, y si la distincion es del paciente o del profesional.

**P-98 · Desnutricion y ERC a la vez: dos de sus atributos se leen como contradiccion. Ronda del 2026-09-03 punto 8.** Aparecio en el smoke del 3-sep sobre el paciente F10 con IMC 18,2 e insuficiencia renal. **Su motor hace lo correcto:** entra la rama de desnutricion (protKg 1,5) y despues la renal, que la corrige a 0,7; su propia nota lo dice ("ERC: proteina baja bajo guia de nefrologia, precede a la proteina alta"). **El numero manda bien y el orden de los chips tambien** (la correccion va despues de lo que corrige). Lo unico es que el segundo chip dice "Densidad energetica y proteica ALTA, fraccionada" y el cuarto "Proteina CONTROLADA 0,6-0,8 g/kg": quien mira solo los chips ve las dos frases juntas sin la nota que las ordena. **No se toca nada.** Se le pregunta UNA cosa: si el atributo de proteina alta debe suprimirse cuando aplica la rama renal. No se le propone reescribir el texto del atributo, que es suyo y cuya mitad de densidad energetica sigue siendo correcta para un desnutrido.

**P-99 · Su entrega del 3-sep RETIRA de `motorTratNutri` la prescripcion de proteina y el gasto basal, dos dias despues de mandarnos portarlos. Ronda del 2026-09-04 punto 3.** El 1 de septiembre (§9.6 punto 4) nos mando prescribir la proteina desde el motor y no desde el minimo poblacional; lo portamos el 3 con su cadena de sellado y su tolerancia para los tratamientos anteriores. Su entrega del MISMO 3 retira toda esa prescripcion del motor, y tambien el gasto basal. **NO se porta la retirada.** La asimetria manda: si es deliberada, portarla tarde cuesta un dia; si es un descuido de edicion, portarla deja a Atlas sin la cifra que el acababa de mandar prescribir. La divergencia esta DECLARADA modulo por modulo en `frozen-deriva-vigente` (cuatro toleradas que son UNA decision) y el oraculo de GOLDEN 1 quedo anclado, con fecha y razon, a la entrega del 2. Se le pide una frase.

**P-100 · Tumaco y Cartago estan cada uno en DOS regiones de su mapa. Ronda del 2026-09-04 punto 6.** Al ejecutar su bloque completo: 224 municipios, 222 distintos. "Tumaco" en `pacifica` y `andina_narino`; "Cartago" en `andina_antioquia` y `andina_valle`. `regionDe` recorre el objeto y devuelve el primero que coincide, asi que **la region de esos dos pacientes la decide el ORDEN DE LAS CLAVES**, no un criterio clinico: reordenar el objeto por cualquier motivo les cambia la lista de alimentos sin que nadie toque el mapa. Las dos asignaciones de hoy pueden ser deliberadas (Cartago con el Eje por cercania, Tumaco por costa pacifica). **No se tocan:** asignar un municipio a una region es contenido suyo (Regla 0). El candado `intercambio-region.test.ts` fija el comportamiento REAL de hoy, no el deseado, y cita esta pregunta.

**P-101 · Entre seis y ocho subgrupos por region quedan SIN alimento, y su lista impresa saca el rotulo con nada detras. Ronda del 2026-09-04 punto 7.** Su verificacion ("las diez regiones tienen alimentos en los nueve grupos que la prescripcion necesita") es cierta; el hueco esta un nivel mas abajo, en el SUBGRUPO, que es lo que imprime la lista del paciente. Su render no filtra el subgrupo vacio. Medido: Bogota 8, Barranquilla 6, Leticia 7. **Tres se repiten en las diez** (azucares, mecato, bebidas alcoholicas) y se leen como decision suya; los otros no (lacteos descremados vacio en las diez, nueces y semillas en casi todas). La lista COMPLETA no tiene el hueco, asi que viene del recorte y no de INTER_TABLA_B. **Se porta fiel con los rotulos vacios**, porque suprimirlos seria un arreglo de FORMA que taparia un hueco de CONTENIDO. Tres salidas propuestas: salen vacios, se ocultan, o los no discrecionales entran al nucleo.

**P-102 · Los 21 estados EFR con raya: su propio `efrCompose` ya escribe esos textos y `getDX` no llega a el. Ronda del 2026-09-04 punto 5.** Verificado ejecutando su motor sobre su entrega de hoy: la raya esta EN SU ARCHIVO, no se perdio al portar (cero diferencias en los 405 campos). **No es un hueco de redaccion, es una caida que no llega:** `getDX` compone solo cuando falta la CLAVE ENTERA (`DX[key] ? {...DX[key]} : efrCompose(...)`) y las 21 claves existen con "—" dentro. Su `efrCompose` los llena los 21 (el estado 21 devuelve "Homeostasis celular y metabolica conservada." y "Biomarcadores dentro del rango esperado."). Y **su otro visor del mismo archivo ya cae CAMPO POR CAMPO** (`{m: base.m||comp.m, ...}`), asi que el mismo paciente ve texto en una pantalla suya y raya en la otra. La pregunta es cual de sus dos caidas manda. Alcance medido: los 81 conservan diagnostico, riesgo y nutraceuticos completos; falta solo lo explicativo. Candado: `efr-81-estados.test.ts`.

**P-103 · Los rotulos de los nueve sectores IFC x IRC dicen lo contrario de sus bandas en tres casos, y dos estan INTERCAMBIADOS entre si. Ronda del 2026-09-04 punto 1.** Su archivo nombra los nueve sectores en DOS sitios y no dicen lo mismo: `FYR_LABELS` (app principal, el que portamos y el que Atlas muestra) y el campo `cn` de `SEC` (su visor de los 81). **Pareados POR CLAVE, no por posicion** (los dos objetos van en orden distinto; parearlos por posicion da un resultado falso, nos paso al primer intento): `3_3` (IFC Alto / IRC Alto) dice "Disfuncion sin riesgo" y `1_1` (IFC Bajo / IRC Bajo) dice "Alto desempeño, riesgo oculto". **Cada uno lleva la descripcion exacta del otro.** Y `1_2` (IFC Bajo / IRC Normal) dice "Funcion estable", que no forma pareja con ninguno. En los nueve casos el `cn` de su visor SI concuerda con las bandas. **Es texto clinico que el profesional lee hoy**, en la linea "Estado funcional bioelectrico (IFC x IRC)" de la tarjeta de resultados y como nombre del anillo en el desglose de la Diana, y **los dos errores empujan hacia el lado tranquilizador**: quien tiene inflamacion alta lee "sin riesgo" y quien tiene funcion celular baja lee "Funcion estable". **No se toca nada** (Regla 0). Se le piden dos cosas: confirmar el intercambio de 3_3 y 1_1, y decir que texto va en 1_2. Recomendacion nuestra: portar entero el juego `cn`, porque un dato con dos versiones acaba divergiendo siempre.

**P-104 · `generarAlertas` esta "marcada para borrarse" en su archivo y VIVA en Atlas. Ronda del 2026-09-04 punto 4.** Su punto 3 del 3-sep declara `calcConsumo`, `generarAlertas` y `TCAC` piezas muertas que "quedan marcadas para borrarse, no para conectarse". **Sobre `calcConsumo` y `TCAC` no hay nada que decir: en Atlas tampoco las invoca nadie.** `generarAlertas` es otra cosa: sus quince reglas se muestran en DOS sitios de la pantalla de evaluacion, a traves del adaptador `alertas-disponibles` que traduce los campos de la encuesta a los que ella lee. Su premisa ("nadie la invoca") es cierta de su archivo y falsa del nuestro, asi que la conclusion no se traslada sola. **No se le pide mantenerla por nosotros:** o no la borra (si las quince reglas siguen siendo validas y lo muerto era el cableado), o dice con que se reemplazan (quitarlas sin reemplazo le retira al profesional quince avisos clinicos que hoy ve). Importa avisarlo antes: si desaparece en la siguiente entrega, el candado de deriva se pone rojo sin poder distinguir "la retiro a proposito" de "quedo fuera".
