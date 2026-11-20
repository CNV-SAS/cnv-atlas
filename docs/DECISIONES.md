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
- **2026-11-18 · Contabilidad (C1) ·** La factura de un **paciente MENOR** va a nombre del **representante
  legal**, que es quien compra y quien paga, con su cédula y su correo. **Nunca los datos del menor en un
  documento tributario**, y **nada de "consumidor final" por defecto**. Sin representante, la venta se
  registra, queda **pendiente de facturar** y no se emite en Alegra.
- **2026-11-19 · Santiago ·** C1 se construye **COMPLETO el mismo día**, no solo el freno, y se prueba
  dentro del smoke comercial. La factura de un paciente menor sale **a nombre de su representante legal**,
  con su tipo y número de documento y su correo.
- **2026-11-19 · Claude, con el argumento delante ·** El tipo de documento del representante admite **solo
  CC, CE y PA** (CHECK de la 0247). 'TI' es el documento de un menor (un menor no representa a otro) y
  'NIT' es de persona jurídica; los dos producirían un documento fiscal **válido y equivocado**, que es la
  clase de error que se frena antes y no después.
- **2026-11-19 · Claude, con el argumento delante ·** El representante **se completa o se corrige desde la
  ficha del paciente**, con su policy y su auditoría del valor anterior. Sin esa puerta, los menores que ya
  firmaron sin representante (y todos los que lo tienen sin tipo, porque la columna nació hoy) no se
  podrían facturar nunca: la única salida sería volver a firmar el consentimiento entero. **Un freno sin
  salida no es un guard: detiene a una persona.** La ficha sigue sin dejar corregir el nombre, el documento
  ni la fecha de nacimiento DEL PACIENTE, que es otra cosa: eso toca la resolución de identidad.
- **2026-11-19 · Claude, con el argumento delante ·** El contacto del representante en Alegra **NO se
  cachea** en `patients.alegra_contact_id`: se resuelve por documento en cada factura. Cacheado, el día que
  ese menor cumpla 18 su factura seguiría saliendo a nombre del representante, porque el id guardado se
  devuelve antes de mirar la edad. Cuesta una llamada más y es la única versión que no se queda vieja.
- **2026-11-19 · Claude, con el argumento delante ·** El nombre del representante **no se parte** en nombres
  y apellidos: se captura en un campo y partir "Ana María López Gómez" de vuelta es imposible de hacer bien.
  El nombre entero va en `firstName` y en `lastName` va su documento, que es verdadero y lo identifica. Es
  la misma regla que ya estaba escrita para el paciente.
- **2026-11-19 · Claude, con el argumento delante ·** Un paciente **sin fecha de nacimiento NO se frena**:
  no se sabe que sea menor, y frenar a todos congelaría la facturación de adultos reales el día del
  arranque. Un freno sin salida detiene a una persona, y aquí sería alguien de quien no sabemos nada malo.
- **2026-11-18 · Contabilidad (C2) ·** La **tabla del art. 383** es la alternativa al 10 % para persona
  natural que lo declare en su cuenta de cobro, sobre la **base depurada del MES** (todos los pagos de CNV
  de ese mes calendario). Depuración en orden: aportes obligatorios, deducciones certificadas, renta exenta
  del 25 % (tope 790 UVT al año), y tope global del 40 % del ingreso o 1.340 UVT al año. El cambio de
  método rige **desde el pago siguiente** a la nueva declaración. La contadora la valida antes del primer
  pago.
- **2026-11-18 · Contabilidad (C3) ·** **UVT 2026 = 52.374**, confirmada. Y la retención del **2,5 % por
  compras que Katherine le practica a CNV la calcula ELLA, no Atlas**: Atlas pasa a **REGISTRAR** el valor
  que efectivamente retuvo, con su soporte, para que la cuenta por cobrar cuadre. La base mínima (10 o 27
  UVT) sigue pendiente de la contadora, y **deja de bloquear** porque ya no se calcula.
- **2026-11-19 · Claude, con el argumento delante ·** Mientras eso no esté, **`tax_is_withholding_agent` de
  Katherine se queda en NULO**: en nulo Atlas no anticipa nada y su cuenta sale por el bruto, que es lo que
  contabilidad quiere ver. Marcarlo hoy haría que el sistema calculara una retención que no le corresponde
  calcular. (Además no tiene escritor en la app: hoy solo se podría poner por SQL.)
- **2026-11-19 · Claude, con el argumento delante ·** El caso *"menor SIN representante"* **sale del
  smoke**: desde hoy el consentimiento de un menor exige el representante con su tipo, así que no se puede
  fabricar por el camino normal, y donde existe es en datos viejos (los 6 menores), que son pacientes
  REALES y no se facturan en una prueba. El B4b queda en tres casos, y el del **tipo que falta** se
  fabrica por el **pase presencial**, que es el camino que todavía captura el representante sin tipo: o
  sea que la prueba usa el hueco real en vez de simularlo.
- **2026-11-19 · Santiago, ajustado por Claude web ·** Lo de Katherine **no es urgente**: va antes de su
  primer PAGO, que es después del 30 de noviembre. Su cuenta muestra lo que le toca pagar **en bruto**, con
  un aviso del tipo *"Integrante agente de retención: al pagar puede retener; revisar con la contadora"*, y
  al registrar su pago se captura el **valor retenido** con su **soporte**, para que la cuenta por cobrar
  cuadre con pagado + retenido. **Atlas no calcula nada.**
- **2026-11-18 · Contabilidad (C4) ·** El **20** se marcan como prueba `Profesional Prueba` y
  `Profesional demo 2` desde /admin. La **anulación formal** de los cinco documentos, con estado
  **"anulada - prueba"** y motivo, **sin borrar**, va **antes del cierre de noviembre**, no antes del
  arranque.
- **2026-11-18 · Contabilidad (C5) ·** **Conciliación de inventario** antes del cierre de noviembre y a más
  tardar el **5.º día hábil de diciembre**, en este orden: cargar el xlsx, **conteo físico de la bodega y
  del stock de cada Integrante confirmado con ella**, comparar los **tres** saldos (Atlas, conteo, Alegra),
  y ajustar los **dos** sistemas al conteo con cada diferencia explicada. **Desde diciembre, en cada cierre
  mensual el total por producto de Atlas tiene que ser igual al de Alegra.**
- **2026-11-19 · Santiago ·** **No se poda ningún documento, tampoco después del arranque.** Lo comercial
  pendiente vive en `SMOKE_COMERCIAL_FINAL.md`; lo que va después del arranque (ventas históricas y
  conciliación), en `PLAN_VENTAS_HISTORICAS_XLSX.md`.
- **2026-11-19 · Santiago ·** Los ids de Alegra **no se copian del sandbox**: los tres de cuenta puente
  anotados para producción coinciden exactamente con los del sandbox, y puede ser casualidad o un copiado.
  `config-alegra-produccion.sql` **aborta** si algún valor repite el del sandbox mientras no se confirme
  que se leyeron en producción **por su NOMBRE** con `leer-alegra.mjs`.

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
