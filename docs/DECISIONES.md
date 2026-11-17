# Decisiones

**Una línea por decisión: fecha, quién decidió, qué.** Para que una sesión nueva sepa qué está decidido
y por quién, sin reabrirlo.

> **Esto no es el porqué.** El argumento completo de cada decisión vive donde se tomó: en el comentario
> del código que la aplica, en `PENDIENTES_CIENTIFICOS.md` (lo clínico abierto y lo ya cerrado con
> Gildardo), en `DECISIONES_LEGALES.md` y en `DECISIONES_ANIBISE.md`. Aquí no se duplica: se enlaza.
>
> **Cómo se mantiene:** cada decisión nueva, una línea aquí, en el mismo turno. Está en `CLAUDE.md`.

---

## Lo clínico (decide Gildardo)

- **2026-08-27 · Gildardo ·** Regla 0: Atlas es el software que **aplica** el modelo ANI-BIS-E, y
  representa su archivo literalmente, sin más y sin menos. Lo que no esté en su archivo se le devuelve
  como pregunta, no se construye. (`CLAUDE.md`, Regla 0.)
- **2026-08-27 §5 · Gildardo ·** Ninguna cifra de la prescripción lleva techo, piso, validación ni
  advertencia: el motor propone y el profesional dispone.
- **2026-08-27 §10 · Gildardo ·** Se retiran las tablas de alérgenos y de patrones que habíamos
  propuesto: su archivo no las tiene.
- **2026-08-30 §6 · Gildardo ·** La dinamometría entra al motor (motor 1.2.0).
- **2026-09-05 · Gildardo ·** Se enciende el LE8 con el mapeo corregido (motor 1.3.0).
- **2026-09-06 · Gildardo ·** Se corrige el componente de Alimentación del ICEC.
- **2026-09-07 · Gildardo ·** La fila PABU se queda como está: *"Ya revisé ATLAS y está bien como lo
  tienen"*. Hoy lleva candado, porque un barrido de rótulos nuestro la cambió el 9 sin instrucción suya.
- **2026-11-06 · Gildardo (v15 §1.4) ·** El DFI, el riesgo integrado y las rutas leen la EB-BIS de la v7
  (motor 3.0.0); antes convivían dos edades biológicas en la misma consulta.
- **2026-11-11 · Gildardo (v17 §4) ·** El ICA-BIS es `PABU − φ` **con signo**, y su referencia son los
  percentiles por sexo de su Tabla 7.3; `dICA` desaparece (motor 3.3.0).
- **2026-11-12 · Gildardo (v17 §2.3 y §2.4) ·** La Diana se mueve: sus cortes MCCB y el sector (motor
  4.0.0).

Lo que sigue abierto con él, pregunta por pregunta, está en **`PENDIENTES_CIENTIFICOS.md`** (50 preguntas
al 16 de noviembre), con la lista de lo ya cerrado al final de ese mismo documento.

## El producto y los datos (decide Santiago)

- **2026-08-28 · Santiago ·** Una referencia visual suya es un punto de partida, no una plantilla: *"no
  comerse entero lo que manda, sino pensamiento crítico buscando la mejor alternativa."* Su archivo manda
  en lo clínico; una referencia de interfaz no manda en nada.
- **2026-10-02 · Santiago ·** Ningún umbral que decida sobre un dato clínico se escribe sin su fuente al
  lado, y si hace falta un cinturón sin fuente, se pone tan ancho que solo atrape lo imposible.
- **2026-10-10 · Santiago ·** "No prescribo nutracéuticos" **con su motivo** es el criterio del
  profesional, y es un hecho distinto de si el paciente adquiere, que lo responden las ventas. El campo
  viejo se congela, no se reinterpreta (migración 0214).
- **2026-11-03 · Santiago ·** Las indicaciones **condicionales** de las remisiones no se imprimen en la
  historia clínica, el SOAP ni el PDF: el bloque afirma lo que el modelo exigió para ESE paciente, y
  estaba listando el catálogo. (Lo que falta de esto es la pregunta **56** de `PENDIENTES`.)
- **2026-11-05 · Santiago ·** Las **rutas no van al informe del paciente**, y con ellas salen los
  suplementos y las remisiones: el informe no puede recomendar algo que la profesional no recomendó.
  Siguen en la historia clínica y en la hoja del plan.
- **2026-11-05 · Santiago ·** **ICC e ICT:** si el profesional teclea cintura o cadera, Atlas los
  recalcula con lo tecleado, como el HTML; si no, manda el del equipo.
- **2026-11-16 · Santiago ·** **Reemitir el histórico con la v17 sin esperar el visto bueno de Gildardo**,
  con la simulación delante y una sola vez: 481 consultas a 4.x, 71 con su motivo. Nada de lo prescrito se
  tocó.
- **2026-11-16 · Santiago ·** **Activar la Encuesta CNV-S para pacientes reales** (`CNVS_ACTIVA = true`),
  sin esperar su visto bueno; si su respuesta a la **39** pide una versión nueva del instrumento, lo ya
  aplicado queda sellado con la 1.0 y la nueva rige hacia adelante.
- **2026-11-16 · Santiago ·** El pendiente de nutracéuticos del cierre lo cierra **la prescripción** o
  **"No prescribo" con su motivo**, no la venta: que el paciente se los lleve es comercial y queda en la
  venta.
- **2026-11-16 · Santiago ·** Un **producto de tercero** (LUVIA) no cuenta como nutracéutico de CNV en
  ninguna superficie; la regla vive en un solo módulo (`treatment/producto-de-tercero`).
- **2026-11-16 · Santiago ·** La **columna de referencia de la historia clínica** sale de un solo sitio y
  es **la de su v17**: donde su texto y el nuestro discrepaban, manda el suyo (Regla 0).
- **2026-11-16 · Santiago ·** El bloque de **Recomendaciones vacío no se imprime**, ni en la pantalla ni
  en el PDF: la ausencia de un contenido condicional de su archivo no es un hecho de la consulta, a
  diferencia de los datos del paciente, que sí se imprimen vacíos.
- **2026-11-17 · Santiago ·** Se puede **arrepentirse de una prescripción**: los tres estados (sin
  decidir, prescrito, no prescribo) van de cualquiera a cualquiera. Y cuando hay nutracéuticos
  prescritos, la pantalla **pide quitarlos primero** en vez de borrarlos con una confirmación, porque
  borrar una prescripción guardada es un acto propio con su firma de concurrencia.

## Lo legal y lo comercial

- **2026-08 · El asesor legal (rectificando su propia recomendación) ·** Atlas **no bloquea** sobre una
  inferencia clínica de alergias: confundir usar el dato con bloquear con el dato contradice el
  consentimiento ya firmado. Lo único que se construye es poner las dos declaraciones juntas en pantalla.
- **2026-08-11 · Revisión legal ·** El consentimiento v1.1: `internacional_ia` deja de ser autorización y
  se absorbe en `servicio`; el cuarto punto del numeral 4 pasa de comercializar estadística a
  **anonimizar**. El detalle en `CONSENT_ATLAS.md` y `DECISIONES_LEGALES.md`.
- **2026-09-18 · Santiago ·** Lo comercial queda **en pausa** mientras se cierra lo científico; se retoma
  con el smoke comercial y las llaves de producción (ver `ESTADO.md`).
- **Santiago ·** Lo clínico y la venta **no se bloquean por lo fiscal**: un integrante puede entrar,
  operar y vender antes de que la contadora defina la tarifa de retención; lo que no se puede es
  liquidarle el pago.

## Cómo trabajamos (decide Santiago)

- **Santiago ·** **Nunca `git push`** sin permiso explícito, y en `git add` **siempre rutas explícitas**,
  nunca `-A`: con `-A` se publicó once veces material de paciente que él había dejado para revisar.
- **Santiago ·** Los commits **no llevan** línea de coautoría ni de sesión.
- **2026-11-12 · Santiago ·** Durante el trabajo, solo líneas cortas de progreso; al final de cada turno,
  **un informe completo y autocontenido**, porque lo que se intercala entre ediciones se pierde en la
  terminal.
- **Santiago ·** Los documentos con datos de paciente (exports del Biody, PDF, HTML de informes, los
  `.docx` de entregas) **no entran a git**; `docs/entregas/` tiene una lista de lo que SÍ puede entrar
  (`scripts/check-entregas.mjs`), no de lo prohibido.
