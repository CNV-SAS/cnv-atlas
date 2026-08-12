# Plan S2: la superficie del flujo de corrección (planning-first, 2026-08-03)

Carril lento (acto clínico irreversible). El motor (`correctEvaluation`) está hecho y verificado por ejecución (5/5: camino feliz, gates, rollback). S2 es que un profesional pueda usarlo. Es gate del Hito 1.

## Lo ya escrito para esta superficie (compromisos previos)
- El botón dice **"Corregir (genera una versión nueva)"**, NO "Editar" (editar promete cambio en su lugar; acá se versiona).
- **Confirmación explícita** con **motivo obligatorio** (sin motivo no se corrige; el motivo se sella en la corrección + el audit).
- **Vista de la cadena v1→v2→v3** con su motivo (quién, cuándo, por qué).
- **Avisos:** el condicional de versión (si el modelo cambió entremedio, las clasificaciones pueden diferir) y la invalidación no silenciosa (si la salida es idéntica y se conserva la aprobación, el profesional lo VE).

## (a) Dónde vive el botón

La corrección nace de la EVALUACIÓN (edita la encuesta), pero el profesional DESCUBRE el error mirando el **diagnóstico** (ve un resultado que no cuadra con el paciente) o el **tratamiento**. Forzarlo a volver a Evaluación a buscar el botón es fricción justo cuando ya notó el error.
- **Recomendación: el punto de entrada "Corregir" vive donde se NOTA el error: en la vista de Diagnóstico (principal) y en la de Tratamiento**, además de en Evaluación. Los tres apuntan al mismo flujo.
- Al pulsarlo se abre el flujo de corrección, que muestra las RESPUESTAS DE ENCUESTA editables (el insumo que se corrige), no el diagnóstico (que es derivado y no se edita).
- Argumento: el error se descubre en el resultado, no en el formulario; la corrección debe ser alcanzable desde el resultado. Y como lo que se edita es la ENTRADA (encuesta), el flujo lleva de "vi el resultado raro" a "corrijo el dato de entrada" a "se regenera el resultado".

## (b) Qué pasa con lo que estaba en curso — VERIFICADO: se pierde, y hay que decirlo

Verificado en `correctEvaluation`: la cascada crea un tratamiento FRESCO (vía `writePipeline`); **NO copia nada del tratamiento actual.** Así que al corregir se PIERDEN, del tratamiento en curso:
- Los ajustes del profesional (`adj_geb/pal/kcal_obj/prot_gkg/fat_pct/peso_meta`).
- Las notas (`treatment_notes`), las guías (`treatment_diet_guidelines`), los nutracéuticos que agregó (`treatment_nutraceuticals`), el texto de micronutrientes, la próxima cita.
- Si el tratamiento estaba APROBADO, la aprobación se invalida (el reporte nuevo nace en draft).

**Por qué se pierden y por qué está bien:** esos ajustes se hicieron sobre un diagnóstico que la corrección cambia; arrastrarlos a un diagnóstico distinto sería arrastrar decisiones tomadas sobre otra base. El lado seguro es regenerar limpio.

**Consecuencia para la UI (lo que más puede molestar):** la confirmación DEBE decirlo explícito, no como letra chica: **"Vas a perder los ajustes, las notas y las guías que hiciste en el tratamiento actual. El tratamiento se genera de nuevo con el diagnóstico corregido."** Si el reporte se envió, se suma la advertencia (b) ya escrita; si el tratamiento estaba aprobado, se dice que la aprobación se invalida. La confirmación es una lista honesta de lo que se pierde, no un "¿confirmas?" a secas.

## El flujo, de punta a punta

1. El profesional, en Diagnóstico (o Tratamiento), ve un resultado que no cuadra y pulsa **"Corregir (genera una versión nueva)"**.
2. Se abre el flujo: muestra las respuestas de encuesta de la evaluación, editables. El profesional cambia la(s) equivocada(s).
3. Escribe el **motivo** (obligatorio).
4. **Confirmación** = la lista honesta: se rehace diagnóstico + tratamiento + reporte; el anterior queda registrado como reemplazado; **se pierden los ajustes/notas/guías del tratamiento actual**; si el reporte se envió, el paciente tiene el anterior; si estaba aprobado, se invalida la aprobación. El profesional confirma entendiendo.
5. Se llama a `correctEvaluation` (motor ya hecho). Todo en una transacción; si falla, nada cambia.
6. Se muestra la versión nueva (diagnóstico/tratamiento en draft).

## La vista de la cadena
En la evaluación/diagnóstico: si hubo correcciones, un aviso ("esta evaluación reemplazó N versiones anteriores") con acceso a expandir v1→v2→v3, y por cada salto el **motivo** (de `clinical_corrections.reason`), quién y cuándo. Ahí se ve por qué se corrigió.

## Gate de versión de encuesta (ya en el motor)
Si la evaluación es de una versión de encuesta anterior a la vigente, el motor bloquea (mensaje claro). La UI debe mostrar ese caso como un estado, no un error genérico.

## El error que NO está en la encuesta (verificado 2026-08-03)

El inventario enumeraba cuatro casos (encuesta, antropometría, condiciones BIS, medición re-importada). **Verificado: el servicio `correctEvaluation` cubre HOY solo la ENCUESTA** (acepta `correctedAnswers`, nada más). La antropometría (talla/peso, en `bis_raw_values`) y las condiciones BIS se copian VERBATIM, y la **Condición 1 (verificación de copia exacta) RECHAZA cualquier cambio** a la medición copiada (falla en voz alta si la copia difiere del origen).
- **(a)** Antropometría y condiciones viven en la evaluación y la cascada las VERSIONA (las copia), pero NO las deja EDITAR: el servicio no acepta su delta y la Condición 1 lo bloquearía.
- **(b) NO es barato** ("el mismo flujo con otro formulario" no alcanza): (1) el servicio debe aceptar el delta de medición/condiciones; (2) la Condición 1 debe relajarse para permitir el cambio INTENCIONAL verificando que TODO LO DEMÁS sí es idéntico (una verificación más fina, sobre datos sellados); (3) corregir talla/peso CAMBIA el diagnóstico (son insumos del motor), no es como los campos de tratamiento. Es una EXTENSIÓN del servicio (carril lento, toca el cálculo y la verificación de seguridad), no solo UI.
- **(c) Por eso S2 cubre solo la ENCUESTA, y la pantalla LO DICE:** hoy se corrige la encuesta; para antropometría, condiciones o re-importar la medición no hay vía todavía. Sin ese mensaje, el profesional busca, no encuentra, y concluye que el sistema no lo permite cuando en realidad no está construido. La corrección de antropometría/condiciones va como bloque aparte (extiende el servicio).

## Tres cosas al construir (2026-08-03)

**a) El aviso de pérdida es ESPECÍFICO, no genérico.** La confirmación lee lo que ESE tratamiento tiene y lista solo eso: "vas a perder los 3 ajustes de objetivos y las 2 notas que escribiste". Si el tratamiento no tiene ajustes ni notas, NO se muestra el aviso (no hay nada que perder; asustar de más es un defecto). Se lee de las tablas reales (`adj_*` no nulos, `treatment_notes`, `treatment_diet_guidelines`, `treatment_nutraceuticals`, `micronutrientes_texto`, `proxima_cita`).

**b) La cadena se ve DESDE DONDE ESTÁ el profesional.** En la vista de Diagnóstico/Tratamiento, si hubo correcciones, se ve ahí mismo (no hay que ir a otro lado): un aviso "esta evaluación reemplazó N versiones" que expande v1→v2→v3, y el MOTIVO de cada salto (lo único que explica por qué hay tres), con quién y cuándo (de `clinical_corrections`).

**c) El gate de versión de encuesta es ESTADO, no error.** Si la evaluación es de una versión anterior de la encuesta, el botón "Corregir" se ve DESHABILITADO con la razón visible ("esta evaluación se hizo con una versión anterior del cuestionario; no puede recalcularse con el modelo actual"), NO un fallo al pulsarlo.

## La confirmación, en palabras (lo que ve el profesional antes del acto irreversible)

**Título:** "Corregir la evaluación (genera una versión nueva)".
**Cuerpo (lista honesta, en este orden):**
1. "Vas a corregir: [las respuestas que cambiaste]" y "Motivo: [el que escribiste]".
2. "Se rehace el diagnóstico, el tratamiento y el reporte con los datos corregidos. La versión actual NO se borra: queda registrada como reemplazada."
3. **Pérdidas específicas (solo si las hay):** "Vas a perder los [N] ajustes de objetivos, las [M] notas y las [K] guías que hiciste en el tratamiento actual." (Omitido si el tratamiento no tiene nada.)
4. **Si el protocolo estaba aprobado:** "La aprobación del protocolo se invalida; habrá que aprobar el nuevo."
5. **Si el reporte se envió:** "El reporte ya se le envió al paciente; tiene el anterior. La corrección genera uno nuevo."
6. **Si el modelo cambió entremedio:** "El diagnóstico se recalcula con la versión vigente del modelo; además del dato que corregiste, algunas clasificaciones pueden diferir."
**Acciones:** "Corregir" (confirma, dispara el motor) / "Cancelar".

## Construcción (checkpoints)
S2 = el flujo (edición de encuesta + la confirmación de arriba + resultado) + la vista de la cadena + el mensaje de "otros datos, todavía no". Checkpoints con diff: (1) el flujo + la confirmación, (2) la vista de la cadena, (3) el gate como estado + el mensaje de alcance.

**Estado (2026-08-11): CP1, CP2 y CP3 HECHOS, pendiente smoke de Santiago.**
- **CP1** (el flujo + la confirmación): módulo `corrections/` (servicio, form de 8 dominios, entry en las 3 pestañas, warnings). Test: `correct-evaluation.test.ts` (7 casos).
- **CP2** (la vista de la cadena hacia atrás con motivo/quién/cuándo): `correction-chain.ts` (puro) + `correction-history-reader.ts` + `correction-history.tsx`, montado arriba de las pestañas (se ve desde la vigente y desde las viejas). Test: `correction-chain.test.ts` (6 casos).
- **CP3** (gate de versión como estado + mensaje de alcance): `correction-availability-reader.ts` deshabilita "Corregir" con la razón cuando la evaluación es de una versión anterior de la encuesta (no-op en el MVP de una sola versión); mensaje de alcance honesto en el entry y el form.
- **Alcance = SOLO ENCUESTA (decisión 2026-08-11).** La medición BIS y la identidad no se corrigen aquí. El caso "Biody del paciente equivocado" NO se resuelve corrigiendo la medición: se resuelve CERRANDO la evaluación y rehaciéndola, y ese cierre (de una evaluación CON diagnóstico) NO existe hoy (ver `BACKLOG.md` "Cerrar una evaluación CON diagnóstico"). El mensaje de alcance dice que va por soporte mientras no exista.
