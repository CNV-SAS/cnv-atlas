# Plan: flujo de corrección post-diagnóstico (planning-first, 2026-08-02)

**Por qué el diseño importa más que el código.** Toca la regla más dura del proyecto: los registros clínicos NO se reescriben (triggers de inmutabilidad en `reports`, `diagnoses` confirmado, `treatments.protocol_suggested`). Un flujo de corrección mal diseñado es una puerta trasera para editar lo inmutable. El principio rector: **una corrección NUNCA edita ni borra; siempre EMITE UNA VERSIÓN NUEVA y conserva la anterior** (regla de Gildardo para su caso, generalizada). Este documento es el plan para revisión de Santiago ANTES de construir.

## (a) Qué se corrige y qué NO — enumeración

Errores que pueden ocurrir aguas arriba del diagnóstico:
1. **Encuesta mal digitada** (caso principal, ya definido).
2. **Dato antropométrico mal tecleado** (peso, talla, cintura/cadera — en las condiciones de la toma).
3. **Condiciones de la toma BIS** (marcapasos, embarazo).
4. **Medición BIS re-importada** (el archivo del Biody se puede reimportar, ya verificado).
5. **Sexo del paciente.**
6. **Medición BIS del paciente EQUIVOCADO** (se importó el Biody de otra persona).

**Qué cubre este bloque:** 1-4 son **datos a nivel de EVALUACIÓN aguas arriba del diagnóstico** → el MISMO flujo unificado (versionar la evaluación → re-emitir diagnóstico/tratamiento/reporte). Es lo que dijo el BACKLOG: un solo mecanismo cubre encuesta + condiciones + medición BIS, no uno por cada uno.

**Casos que NO son el mismo flujo (se separan, se flaggean):**
- **(5) Sexo:** vive en `patient_profiles` (nivel PACIENTE, no evaluación). Corregirlo afecta a TODAS las evaluaciones del paciente, no solo una. Es otro alcance; no entra en el flujo por-evaluación. Se registra aparte.
- **(6) Biody del paciente equivocado:** no es "reimportar mi medición", es "esta medición es de OTRA persona" (contaminación cruzada de PHI). Es un problema de integridad más serio (¿se borra la medición mal asignada? ¿a dónde va?), con implicaciones de gobernanza de datos. Se separa; no se resuelve con el mismo versionado.

## (b) Qué pasa con lo emitido

Regla de Gildardo, aplicada: **no se reescribe lo emitido, se emite una versión nueva.**
- El diagnóstico viejo **queda visible**, marcado **reemplazado**; el nuevo es el vigente.
- **Quién ve cuál:** el profesional ve el vigente por defecto + puede ver el reemplazado (con su motivo). El audit registra la sucesión.
- **CASO SERIO — si el reporte YA SE ENVIÓ al paciente. Resuelto en la Parte 1 (la construcción del ENVÍO de la corrección es Parte 2, pero el "mientras tanto" NO queda difuso):**
  - Sí se puede corregir una evaluación cuyo reporte ya se envió, PERO el sistema **advierte con claridad ANTES**: "este reporte ya se envió al paciente; la corrección genera uno nuevo y el paciente tiene el anterior", y lo **registra en el audit**. La evaluación superseded + el reporte viejo quedan marcados; el reporte nuevo nace en `draft` (NO se auto-envía).
  - **Lo que NO puede pasar:** que se corrija en silencio y quede un documento incorrecto circulando sin que nadie lo sepa. El audit + el flag lo impiden.
  - **Quién decide enviar la corrección: el PROFESIONAL, con el sistema avisando.** Justificación (no preferencia): enviar automáticamente una corrección de datos de salud sin que un clínico decida cómo comunicarla es exactamente lo que Gildardo ha protegido en cada decisión de comunicación al paciente (la banda de "empeoró", la cifra de Edad Bioeléctrica). El acto de comunicar una corrección clínica es clínico, no automático.
  - El ENVÍO propiamente (el reporte de corrección + su aviso al paciente) se construye en la Parte 2; la Parte 1 deja el estado correcto y auditado para que exista.

## (c) Quién puede corregir

Es acto clínico. **Mismo criterio que `confirmDiagnosis`/`approveProtocol`: el profesional ASIGNADO, chequeo explícito de asignación, admin NO.** Confirmado (no es operación administrativa). Se adopta.

## (d) Qué queda registrado

Una corrección sin motivo escrito es indistinguible de un error. **Se EXIGE que el profesional escriba POR QUÉ corrige** (campo de motivo obligatorio), sellado en el `clinical_audit_log` (inline, regla 8) y en el registro de sucesión. Sin motivo, no se puede corregir. Se adopta.

## (e) El mecanismo de sucesión — DECIDIDO con el esquema enfrente

**Hallazgo del esquema que reforma el diseño (verificado 2026-08-02):** TODO cuelga de la EVALUACIÓN.
- `diagnoses.evaluation_id` → evaluations; `reports.evaluation_id` → evaluations (el reporte NO tiene `diagnosis_id`, cuelga de la evaluación); `survey_responses.evaluation_id` → evaluations; `bis_measurements.evaluation_id` → evaluations. Solo `treatments.diagnosis_id` → diagnoses (un salto más).
- Nada obliga a "un diagnóstico por evaluación": los readers toman el más reciente por `created_at`.

**Consecuencia 1 — el nivel de versionado: la EVALUACIÓN.** Como el reporte cuelga de la evaluación (no del diagnóstico), versionar a nivel de diagnóstico dejaría el reporte sin a cuál emisión pertenece (habría que agregarle `diagnosis_id`). Versionar a nivel de EVALUACIÓN es lo natural: una corrección crea una **evaluación nueva** y toda la cadena (survey_response corregido, diagnóstico, tratamiento, reporte) cuelga de ella; la anterior queda intacta. Cada evaluación es un registro de inputs autocontenido. El único input a copiar es la medición BIS (`bis_measurements` cuelga de UNA evaluación): en el caso principal (encuesta mal digitada, BIS bien) se copia la medición + `bis_raw_values` a la evaluación nueva (copia fiel de dato inmutable, ~30 filas; mantiene cada evaluación completa). Esto EVITA tocar la linkage de reports y evita versionar `survey_responses` por separado.

**Consecuencia 2 — la sucesión NO se guarda cuatro veces. DECISIÓN (delegada por Santiago, argumentada):**
- **La RELACIÓN vive UNA sola vez en `clinical_corrections`:** `{id, old_evaluation_id, new_evaluation_id, corrected_by, reason (d), trigger_type (g), created_at}`. Es lista enlazada (v1→v2→v3). NINGÚN `supersedes_id` en las entidades: eso duplicaría la relación (justo lo que no aceptas).
- **Un único FLAG de vigencia, `superseded_at`, SOLO en `evaluations`** (timestamp nullable; NO toco el enum de status). No es la relación (no dice cuál la reemplaza, eso está en clinical_corrections); es una proyección denormalizada para filtrar barato. Se escribe en la MISMA transacción que el insert de clinical_corrections, y un trigger de coherencia lo bloquea (`superseded_at` puesto ⟺ la fila es `old_evaluation_id` en clinical_corrections).
- **Diagnoses / treatments / reports: NADA.** Heredan vigencia de su evaluación vía el FK.

**Responde tus tres preguntas:**
- **(a)** "diagnóstico vigente del paciente": se resuelve desde la evaluación. `patient → evaluations WHERE superseded_at IS NULL → su diagnóstico`. NO hace falta puntero en `diagnoses`.
- **(b)** "¿cómo sabe una consulta que un diagnóstico viejo no es vigente?": porque su evaluación tiene `superseded_at`. Tu intuición era correcta: hace falta un ESTADO, pero **solo en la evaluación** (el hub), no un puntero por entidad ni un estado en las cuatro.
- **(c)** No hay cuatro punteros, así que no hay cuatro fuentes que desincronizar. La única denormalización (`superseded_at`) queda amarrada a `clinical_corrections` por el trigger de coherencia + la escritura en la misma transacción.

**Migración (forward-only, con gate):** la tabla `clinical_corrections` + `evaluations.superseded_at` (nullable) + el trigger de coherencia. NO toca los enums de status. Mucho más liviana que las 4 columnas + enum de la propuesta anterior.

## (f) Hasta dónde propaga

La cadena es: corregir encuesta → cambia el diagnóstico → cambia el protocolo → cambia el reporte. **Se rehace TODA la cascada** (es el pipeline): una corrección crea una **VERSIÓN NUEVA de la evaluación** y re-corre `runClinicalPipeline` → diagnóstico/tratamiento/reporte nuevos (en `draft`, SIN aprobar), y los viejos se marcan reemplazados. **Punto de corte:** no hay corte parcial; la cascada entera se re-emite (un diagnóstico a medias sería peor). **La aprobación previa se INVALIDA:** el reporte nuevo necesita aprobación nueva; el reporte viejo aprobado/enviado queda reemplazado. La aprobación NO se hereda (es una firma sobre un contenido que cambió).

**El matiz de la invalidación (tu #2) — VERIFICADO, ocurre; reporto, no decido solo.**
- **¿Puede una corrección NO mover el protocolo?** SÍ. Evidencia concreta: la encuesta tiene 62 preguntas pero solo ~14 llevan `field_key` (las que alimentan el motor); las otras se capturan para el registro clínico pero el motor NO las consume. Corregir una de esas NO cambia ninguna salida. Además hay un `field_key` INERTE conocido (Q7, path muerto d5_42/d3_29) y correcciones que redondean al mismo bucket. El caso salida-idéntica es real.
- **¿Se puede detectar?** Sí, barato: comparar el contenido clínico del snapshot nuevo contra el aprobado.
- **Recomendación (a validar):** si la salida es demostrablemente idéntica, conservar la aprobación marcando en el audit "corrección verificada sin cambio de salida"; si difiere en algo, invalidar. **Por defecto, ante cualquier duda, INVALIDAR** (el lado seguro, como pediste). Firmar de nuevo algo idéntico enseña a firmar sin leer; pero la comparación tiene que ser exacta sobre el contenido clínico, no "parece igual".

## Parte 1 al detalle

**Migración (con gate, forward-only):**
1. Tabla `clinical_corrections`: `id`, `old_evaluation_id` (FK evaluations RESTRICT), `new_evaluation_id` (FK evaluations RESTRICT), `corrected_by` (FK profiles), `reason` (text NOT NULL, motivo obligatorio (d)), `trigger_type` (enum `correccion_profesional` | `recalibracion_ciencia`, extensible (g)), `created_at`. Índice en `old_evaluation_id` (para el filtro de vigencia).
2. `evaluations.superseded_at` (timestamptz nullable).
3. Trigger de coherencia: `superseded_at` de una evaluación está puesto ⟺ existe una fila en `clinical_corrections` con ese `old_evaluation_id`. Y un guard: no se puede corregir una evaluación que ya tiene `superseded_at` (solo se corrige la VIGENTE, la cabeza de la cadena — ver (c) del cierre).
4. RLS de `clinical_corrections`: por el profesional asignado a la evaluación (regla 3, misma vía que el resto).

**El servicio `correctEvaluation` (todo en UNA `db.transaction`, como el pipeline):**
1. Policy: profesional asignado, chequeo explícito, admin no (c). Gate: la evaluación es la vigente (no superseded).
2. Exige `reason` no vacío (d). Si el reporte vigente está `sent`, exige el reconocimiento de la advertencia (b) y lo audita.
3. Crea la evaluación nueva (mismo paciente/profesional/org/type), copia la medición BIS + `bis_raw_values`, escribe el `survey_response` corregido.
4. Corre `runClinicalPipeline` sobre la evaluación nueva → diagnóstico/tratamiento/reporte en `draft`.
5. Marca la evaluación vieja `superseded_at = now()` (dentro de la tx).
6. Inserta `clinical_corrections` (old→new, reason, trigger, actor).
7. `clinical_audit_log` inline (regla 8): `evaluation.corrected`, con el motivo y el trigger.
8. (Opcional, #2) compara snapshots; si idénticos, conserva la aprobación con nota de audit; si no, el reporte nuevo queda `draft` sin aprobar.

**Compromisos del servicio (condiciones de Santiago 2026-08-03, obligatorias en `correctEvaluation`):**
- **Condición 1 — la copia de la medición BIS es verificablemente EXACTA (familia del bug de cintura, a escala de tabla).** Después de copiar `bis_measurements` + `bis_raw_values` a la evaluación nueva, VERIFICAR en tiempo de ejecución, dentro de la misma transacción, que la copia es idéntica al origen, y **abortar (rollback) si no lo es**. No un test: una verificación runtime que falla en voz alta. **Mecanismo propuesto (barato):** un hash del conjunto de filas de cada lado y comparación. Para `bis_raw_values`: `md5(string_agg(variable_name || '=' || value, ',' ORDER BY variable_name))` de origen vs copia; y comparación campo a campo de las columnas de `bis_measurements` (incluida `measurement_date`). Si difieren en un solo carácter, RAISE y rollback. El hash ordenado atrapa cualquier campo perdido o transformado.
- **Condición 2 — la fecha de MEDICIÓN no se pierde ni se confunde con la de creación.** `bis_measurements.measurement_date` se PRESERVA en la copia (se midió un día concreto); el `created_at`/`id` de la copia son NUEVOS (la evaluación nueva se crea hoy). Tratarlas distinto explícitamente en el INSERT de la copia. Importa: `measurement_date` alimenta el gate de 12 semanas del seguimiento y ya se sella en `protocol_approved` por trazabilidad; si la copia heredara `created_at`, un paciente medido hace un mes parecería medido hoy. La verificación de la Condición 1 incluye `measurement_date` en la comparación exacta.
- **Invalidación NO silenciosa (precisión de Santiago sobre el #2).** Si la salida es idéntica y se CONSERVA la aprobación, el profesional debe PODER VER que hubo una corrección y que su aprobación sigue valiendo porque nada cambió. Si no lo ve, el sistema decidió por él sin decírselo. La nota de audit "corrección verificada sin cambio de salida" tiene que tener una superficie visible en la vista del profesional, no quedar solo en el log.

**Cierre de tu #4:**
- **(a) Qué ve el profesional:** una superficie de confirmación, mismo trato que confirmar el diagnóstico (acto irreversible). Dice qué va a pasar (se rehace diagnóstico + tratamiento + reporte; el anterior queda registrado como reemplazado; si el reporte se envió, la advertencia (b)), exige el motivo, y confirma. No un botón suelto.
- **(b) Falla a mitad:** todo va en UNA `db.transaction`; si revienta en cualquier paso (copiar BIS, re-correr el pipeline, marcar superseded, insertar corrección), la transacción hace rollback y NO queda estado a medias. La evaluación nueva solo "existe" (pasa a vigente) al commit; hasta entonces la vieja sigue siendo la única vigente.
- **(c) El límite:** sí se puede corregir una corrección; la cadena crece (v1→v2→v3) y está bien. `clinical_corrections` es lista enlazada; la vigente es la cabeza sin sucesor. **Regla que el diseño contempla explícitamente:** solo se corrige la evaluación VIGENTE (el trigger/guard rechaza corregir una ya superseded), para que la cadena no se bifurque. Sin tope artificial de longitud.

## (g) El caso de la calibración (encaja en el mismo mecanismo)

Gildardo dijo: cuando exista la calibración poblacional, los registros SE REEMITEN. **Es el MISMO mecanismo de sucesión, con un TRIGGER distinto** (cambio de ciencia, no error del profesional). El diseño lo soporta si el `trigger_type` de la tabla central es un parámetro: `correccion_profesional` | `recalibracion_ciencia` (y a futuro `cambio_encuesta`, etc.). **Es la única reemisión ya prevista** (`emission-versions.ts` la vincula a este flujo), así que conviene que quepa desde el diseño. Restricción de diseño adoptada: el mecanismo es agnóstico al disparador; la corrección del profesional es un caso, la recalibración otro, misma maquinaria.

## (h) Qué NO debe existir (restricción dura, con test)

Explícito: **NO hay "editar el diagnóstico", NO hay "reiniciar la consulta", NO hay borrar.** La corrección SIEMPRE versiona (nueva versión, la anterior se conserva). Los triggers de inmutabilidad (BEFORE UPDATE/DELETE en los registros sellados) se CONSERVAN: el flujo de corrección va POR el versionado, NO alrededor de los triggers. Si algún camino lateral permitiera editar o borrar lo inmutable, es un defecto. **Test:** un caso que intente UPDATE/DELETE sobre un registro sellado sigue fallando por el trigger; la corrección solo puede crear versiones nuevas.

## Tamaño: es MÁS grande que un bloque — se parte

Recomendación de partición (mejor que un flujo a medias sobre registros inmutables):
- **Parte 1 (el mecanismo + caso principal):** el modelo de sucesión (e) + la re-emisión en cascada (f) para la corrección de ENCUESTA (caso principal) + la invalidación de la aprobación + el motivo obligatorio (d) + el criterio de quién corrige (c) + la restricción (h) con su test. Es el núcleo y es autocontenido.
- **Parte 2 (bordes que necesitan decisión):** la corrección de un reporte YA ENVIADO al paciente (b, clínica/legal), el sexo a nivel paciente (a5), y el Biody del paciente equivocado (a6). Cada uno necesita una decisión antes de construir.
- **La recalibración (g)** NO es una parte aparte: es la Parte 1 con otro `trigger_type`; se construye con el mecanismo.

**Decisiones abiertas para Santiago antes de construir la Parte 1:** (1) el diseño de sucesión (puntero por-entidad + tabla central, ¿lo aprobás?); (2) confirmar que la aprobación previa se invalida (f); (3) que las Partes 2 se separan. Con eso, la Parte 1 se puede planear en detalle (migración, el re-run del pipeline versionado, la UI de "corregir").
