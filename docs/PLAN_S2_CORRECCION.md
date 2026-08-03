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

## Alcance de S2 y decisiones para vos
- **S2 = el flujo (edición de encuesta + confirmación con la lista de pérdidas + resultado) + la vista de la cadena + los avisos.** El motor no se toca (hecho).
- **Decisión 1:** ¿el punto de entrada en Diagnóstico + Tratamiento + Evaluación (mi recomendación), o solo en uno?
- **Decisión 2:** ¿se pierden los ajustes con aviso (mi recomendación, el lado seguro), o hay que intentar arrastrarlos? Arrastrar es riesgoso (se hicieron sobre otro diagnóstico); recomiendo perderlos y avisarlo fuerte.
- Con esas dos, construyo S2 con checkpoints (el diff del flujo, el de la confirmación, el de la cadena).
