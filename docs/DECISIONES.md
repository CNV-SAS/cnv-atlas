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
- **2026-11-17 · Santiago ·** **La fecha límite de lo comercial es el miércoles 18 de noviembre de
  2026**: ese día quedan las credenciales reales de Wompi y Alegra. El orden: barrido y una sola lista de
  smoke, smoke desde cero en sandbox, video para los Integrantes, y arranque con credenciales reales.
- **2026-11-17 · Santiago ·** **El arranque tiene tres estados, no dos.** Mientras no se haya arrancado
  (sin fecha, o con una fecha futura), las pantallas de cifras lo DICEN y **no cuentan nada**. Antes,
  "sin fecha" significaba "cuenta todo", así que no había forma de decir "todavía no" sin presentar las
  pruebas como operación. Ver `ESTADO.md`, interruptores.
- **2026-11-17 · Santiago ·** El inventario de cada Integrante **se carga con todo lo que recibió**, sin
  descontar las ventas anteriores al arranque (que están marcadas de prueba en Atlas y facturadas a mano
  en Alegra, y que entrarán después desde un xlsx como ventas atrasadas). **El sistema muestra más que el
  físico, a propósito y temporalmente.**
- **2026-11-17 · Santiago ·** Las **3 unidades que vendió la Integrante inactiva** se le cargan a su
  nombre, salidas de bodega, para que el xlsx de ventas atrasadas pueda descontarlas y dejarla en cero.
  Y lo que el sistema tenga hoy a nombre de los **dos Integrantes inactivos queda en cero**, con
  auditoría y motivo: siguen inactivos y pueden reactivarse, pero la custodia describe dónde está el
  producto físico, y con ellos ya no está.
- **2026-11-17 · Claude, con el argumento delante ·** La carga inicial **FIJA el saldo por conciliación,
  no suma ni usa una remesa.** Las ventas de prueba ya descontaron 56 unidades y la marca no las
  devuelve, así que sumar encima da otra cifra equivocada; y una remesa más su aceptación serían el
  Integrante declarando que recibió hoy algo que recibió en agosto, y se contaría dos veces. La remesa
  sigue siendo el camino de toda entrega NUEVA.
- **2026-11-17 · Santiago ·** El Integrante llega a **sus pagos desde la barra lateral** ("Mis pagos",
  a /comercial). La pantalla ya le servía; lo que no había era cómo llegar sin teclear la URL.
- **2026-11-18 · Santiago ·** **El arranque comercial es el VIERNES 20 de noviembre de 2026**, y no pasa de
  ese día. Smoke el 18 y el 19, video el 19, arranque el 20.
- **2026-11-18 · Santiago ·** **Son DOS fechas, no una.** El **corte de pruebas** es el arranque (el 20) y
  se expresa con `cuenta_como_de_prueba`; el **inicio de la operación para las cifras** es el **2026-08-08**,
  la primera venta real (la hizo CNV, la vendió Gildardo, sin comisión y con descuento), y es lo que guarda
  `commercial_config.fecha_de_arranque`. Sin separarlas, las ventas atrasadas del xlsx (de agosto a
  noviembre) no contarían ninguna. **No hizo falta migración:** los dos mecanismos ya estaban separados en
  el sistema, lo confundido era el nombre de la columna.
- **2026-11-18 · Santiago ·** Un paciente **de prueba SÍ se factura en el sandbox** (es prueba); un paciente
  **real NUNCA** se manda al sandbox. El código ya lo cumplía y es simétrico; **lo que estaba mal era el
  documento**, y se corrigió el documento.
- **2026-11-18 · Santiago ·** **NO se poda ni se borra ningún documento**, ni después del arranque. La poda
  propuesta el 17 queda sin efecto. Todo lo comercial pendiente vive en `docs/SMOKE_COMERCIAL_FINAL.md`.
- **2026-11-18 · Santiago ·** **Katherine** pasa a **Distribución** (persona jurídica, agente de retención
  07) y **Zoraida se queda en Comisión**. Katherine es hoy la única en Distribución.
- **2026-11-18 · Contabilidad ·** La **retención sobre comisiones es por integrante y vive en su perfil**:
  natural 10 % (o la tabla del art. 383 si lo declara, que casi siempre da 0), **jurídica 11 %**. El 10 % no
  se escribe a fuego. En Distribución no hay retención sobre comisión; lo que hay es el **2,5 % por compras**
  que el Integrante agente retenedor le practica a CNV, ya construido, con base mínima de 27 UVT.
- **2026-11-18 · Contabilidad ·** La cuenta de Distribución de prueba (171.360, pagada) y las cuatro
  liquidaciones de prueba **se anulan con estado "anulada - prueba" y motivo, sin borrar**. Verificado: no
  hay factura ni documento soporte en el Alegra real. **Necesita una migración**, porque un trigger prohíbe
  retirar una cuenta pagada y las liquidaciones no tienen ningún mecanismo de anulación.
- **2026-11-18 · Contabilidad ·** El **inventario inflado se acepta hasta el 30 de noviembre**, con la
  condición de que la pantalla lo diga. De ahí el aviso "Pendiente carga de ventas históricas" y el
  interruptor `VENTAS_HISTORICAS_CARGADAS`.
- **2026-11-18 · Santiago ·** **Víctor Cano y María Teresa Aragón Herrera** faltaban en el inventario
  recibido: 15 unidades de cada uno de los cuatro nutracéuticos, sin LUVIA. La bodega esperada pasa a
  **345 / 344 / 271 / 153 / 33**, verificado contra la lista.
- **2026-11-18 · Claude, con el argumento delante ·** El script del arranque **marca** las ventas que se
  escapen, no solo las lista, **y las lista antes**. La asimetría decide: una venta que siga contando como
  real puede facturarse en el Alegra de producción y eso va a la DIAN; una marca puesta de más se quita
  desde /pagos.
- **2026-11-18 · Claude, con el argumento delante ·** El script de carga **calcula** el neto esperado en vez
  de llevarlo escrito, y dice CUADRA o NO CUADRA contra la primera tanda. La cifra escrita a mano (+12 y +8)
  envejeció en cuanto el smoke movió unidades, y una cifra que envejece engaña más que ninguna.
- **2026-11-18 · Claude, con el argumento delante ·** Las vitrinas de las **cuentas de smoke vuelven a cero**
  en la carga de inventario: el smoke corre en sandbox pero mueve inventario REAL, y esas unidades nunca
  salieron físicamente de la bodega.
- **2026-11-18 · Santiago ·** La venta sin paciente del xlsx es `patient_id` **nulo con motivo obligatorio**,
  **no** un "paciente genérico": uno inventado contaminaría la lista de pacientes, las cifras clínicas y la
  cohorte, y se vería igual que uno bueno.
- **2026-11-18 · Santiago ·** El **descuento comercial** y la **venta de CNV sin Integrante** pasan de
  "dimensionados" a **requisito de la carga del xlsx**, antes del 30 de noviembre: la venta del 8 de agosto
  es las dos cosas a la vez.

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
