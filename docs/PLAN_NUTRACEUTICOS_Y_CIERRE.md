# Plan · El flujo de nutracéuticos, el cobro, y el cierre de la consulta

**Preparado el 2026-08-24, sin construir.** Sale del cotejo de Rutas (punto 2.2 de Santiago) y creció al verificarlo: toca inventario, dinero y el final de la consulta.

**Lo que ya está hecho y no entra aquí:** el catálogo dice la verdad sobre qué se puede conseguir (los seis inexistentes a `no disponible`, el admin puede cambiarlo, el estado se ve al prescribir).

---

# Parte A · El problema, en una frase

Hoy el bloque de entrega **asume que el paciente compra**. No pregunta si puede tomarlos, no pregunta si quiere, no cobra, y descuenta inventario de un producto que es de CNV.

Y hay dos cosas que el sistema **no distingue** y debería:

| | Qué es | Hoy |
|---|---|---|
| **Saldo físico** | cuántos frascos tiene el profesional en la vitrina | se lleva |
| **Saldo cobrado** | cuántos de los que salieron están pagados | **no existe** |

Todo lo demás sale de ahí.

---

# Parte B · Las cuatro decisiones de diseño, ya tomadas

Están discutidas y acordadas; se registran para no relitigarlas.

### B1 · El descuento va al ENTREGAR, no al cobrar

Se evaluó descontar contra el cobro confirmado y **se descartó por un caso que no es la excepción sino la norma**: el paciente recibe el frasco en la consulta y el pago digital tarda o no llega. Si el descuento espera, **durante ese hueco el inventario miente al revés**: dice que el profesional tiene un producto que ya entregó, y un conteo en ese momento arroja un sobrante que no existe.

**El movimiento de inventario ocurre cuando el producto sale de la vitrina.** Lo que se añade es el **estado de cobro** al lado: `entregado, pago pendiente` → `pagado` · `no pagado`.

### B2 · Una entrega sin pago es un FALTANTE con causa conocida

No se inventa una categoría nueva. El módulo de faltantes ya hace exactamente esto: un caso, una clasificación, un responsable, una resolución. Una entrega que vence sin pago **cae ahí**, con su causa escrita.

Eso respeta la regla de fondo (**el producto es de CNV en consignación**, nadie regala inventario sin que se note) sin romper la verdad física del saldo.

### B3 · Una sola pregunta, con la decisión clínica dentro

*"¿El paciente adquirió los nutracéuticos?"* → **sí** · **no** · **pendiente**, con lista de razones y "otra" con texto obligatorio.

Una de las razones es **"como profesional no se lo recomendé"**, con motivo obligatorio. Eso resuelve el orden de las dos decisiones (primero si PUEDE, después si QUIERE) **sin dos pantallas**: el profesional que descartó no llega a preguntarle al paciente, marca esa razón.

### B4 · El "pendiente" lleva fecha, y NO vence solo

"Pendiente" sin fecha se lee igual el día uno que a los seis meses, y es la diferencia entre *lo está pensando* y *no volvió*.

**Y no se cierra automáticamente.** Un "no compró" que nadie dijo entra en las métricas de dirección como si el paciente lo hubiera dicho. Mejor que envejezca visible.

---

# Parte C · El dato clínico, separado

Si la razón del descarte es **clínica** (alergia a un componente, interacción, contraindicación), ese dato **no puede vivir solo en una lista comercial**, por tres razones:

1. **Persiste entre consultas.** Una contraindicación no es de esta venta: vale la próxima vez y con otro profesional.
2. **Debería alimentar el motor.** Es la misma familia que P-39 (las alergias que no llegan al menú).
3. **El destinatario es otro.** La razón comercial la lee dirección; la clínica la lee el siguiente profesional.

**Una sola pregunta en pantalla**, pero cuando la razón es clínica se pide el motivo y **se guarda también como dato clínico del paciente**.

## La pregunta que abre, y su respuesta

**¿Un descarte por alergia debería IMPEDIR prescribir ese producto la próxima vez?**

**Lectura: es pieza aparte, y hay que decir por qué.** Registrar la contraindicación es de este bloque. **Bloquear la prescripción es un gate clínico**, y eso tiene tres consecuencias que no se resuelven aquí:

- **Quién puede levantarlo.** Una alergia declarada mal, o superada, necesita una vía de corrección. Un gate sin vía de salida es una trampa (el mismo patrón del gate `diagnosisConfirmed`, ya registrado en BACKLOG).
- **Qué alcance tiene.** ¿Bloquea ese producto, o todos los que comparten el componente? Lo segundo exige un modelo de **componentes**, que el catálogo no tiene (hoy `composition` es texto libre).
- **Y quién lo decide.** Que el sistema impida un acto clínico es decisión de dirección científica, no nuestra.

**Propuesta:** en este bloque se **registra y se muestra** (al prescribir, junto al producto: "descartado antes por alergia al calostro, 2026-08-24"). **El bloqueo se separa** y se le pregunta a Gildardo, con el modelo de componentes dimensionado aparte.

---

# Parte D · El cobro dentro de Tratamiento

Santiago quiere que el cobro viva aquí y no en otra pestaña. **Tiene razón en el flujo**: el profesional está con el paciente delante, y mandarlo a `/pagos` corta la consulta.

## Lo que ya existe (verificado)

- `createCheckout` (Wompi) y `registerCashSale` (efectivo) **existen como servicios**.
- `transactions` tiene paciente, profesional y los ítems vendidos.
- **El modelo YA anticipó el pago mixto**: el schema dice, textual, *"Un pago mixto = dos transacciones, una por medio"*.

## Lo que falta

1. **El vínculo.** `nutraceutical_stock_movements` tiene `treatment_id` pero **ninguna referencia a `transactions`**. Hoy se puede entregar sin cobrar y cobrar sin entregar, **y nada lo detecta**. Es el hueco central, no el cobro.
2. **La superficie mixta.** El modelo la soporta; falta la pantalla que cree las dos transacciones (una parte digital, otra en efectivo).
3. **El cobro en Tratamiento.** Reusar los servicios existentes desde el panel, no duplicarlos.

**Dimensión: MEDIA-ALTA, y es superficie de dinero.** Lo grande no es llamar a `createCheckout`: es que a partir de aquí **entrega y cobro dejan de ser dos registros que no se conocen**, y eso hay que hacerlo bien una vez.

**Orden recomendado:** primero el vínculo y los estados de cobro (B1/B2), después el mixto, y el cobro en Tratamiento al final, cuando ya haya qué mostrar.

---

# Parte E · El cierre de la consulta

## Lo que hay hoy, medido

| Estado de `evaluations` | Quién lo pone |
|---|---|
| `awaiting_survey` | el intake, al firmar sin responder |
| `draft` | el paciente, al completar la encuesta |
| `in_progress` | el profesional, al confirmar la identidad |
| `completed` | **nadie** |
| `abandoned` | **nadie** (el enum lo dice: "por ahora el estado solo EXISTE") |

**En la base: 38 en progreso, cero cerradas.** No hay cierre: una evaluación entra en "en progreso" y se queda ahí para siempre.

## La reformulación que reemplaza al bloqueo

No *"no puedes ver el reporte hasta que decidas"*, que retiene un documento clínico por una razón comercial. Sí:

> **"No puedes cerrar la consulta con cosas sin decidir"**, con la lista de cuáles son y la opción de cerrarla igual marcando cada una como pendiente.

Da la métrica sin retener nada, y el profesional **ve** qué quedó abierto en vez de descubrirlo después.

## Qué más debería aparecer en esa lista (medido en la base)

Los números son de una base de pruebas, así que valen como **señal del patrón, no como estadística**. Y el patrón es claro: **casi todo queda a medias y nada lo dice.**

| Acto | Estado real | ¿Alguien lo nota hoy? |
|---|---|---|
| Diagnóstico generado | **5 de 38** evaluaciones sin diagnóstico | no |
| Diagnóstico **confirmado** | **26 de 33 sin confirmar** | no |
| Protocolo **aprobado** | **33 de 33 sin aprobar** | no |
| Reporte **enviado** | **31 de 33 sin enviar** | no |
| Remisión con **retorno** | **4 de 5 sin retorno** | no |
| Próxima cita | **1 de 33** fijada | no |
| Nutracéutico decidido | no existe | no |

**Dos lecturas que salen de esto:**

- **El reporte sin enviar es el más grave**, y es el que la reformulación arregla mejor: un reporte aprobado y no enviado significa que **el paciente no recibió nada**, y hoy nadie se entera.
- **El 100 % de protocolos sin aprobar tiene causa conocida**: es el gate `diagnosisConfirmed`, ya registrado en BACKLOG como precondición (el profesional puede aprobar lo del modelo pero no puede cambiarle un valor antes de aprobarlo). El cierre lo haría **visible**, que es justo lo que hace falta para que se resuelva.

## Qué hacer con las 38 abiertas

**Nada, y el cierre aplica de aquí en adelante.** Tres razones:

1. **Son de prueba.** Cerrarlas a mano fabricaría 38 cierres que nadie hizo, en un campo que después se lee como métrica.
2. **Es la misma regla que ya aplicamos** con `structural_mccb`: *"de aquí en adelante; no se rellena hacia atrás"*.
3. **Y en la nube conviene mirarlas antes**: si alguna es de un integrante real, el criterio es distinto y lo decide Santiago con la lista delante.

Lo único que sí conviene: que la lista de evaluaciones **distinga visualmente** una sin cerrar de una cerrada, para que el estado nuevo se note desde el primer día.

---

# Parte F · Orden y dimensión

| # | Pieza | Dimensión | Depende de |
|---|---|---|---|
| 1 | La pregunta única (sí/no/pendiente + razones + fecha) | **chica** | nada |
| 2 | El dato clínico separado cuando la razón lo es | chica | 1 |
| 3 | El bloque de entrega condicionado a "sí" | chica | 1 |
| 4 | Estado de cobro en el movimiento + vínculo con `transactions` | **media** | nada |
| 5 | Vencimiento de entrega sin pago hacia faltantes | media | 4 |
| 6 | El cierre de la consulta con su lista de pendientes | **media** | 1, y la quinta pestaña |
| 7 | Pago mixto | media | 4 |
| 8 | El cobro dentro de Tratamiento | media | 4, 7 |
| — | Bloquear la prescripción por alergia registrada | **aparte** | Gildardo + modelo de componentes |

**Las tres primeras se pueden hacer ya** y resuelven el problema que Santiago vio. El resto es la superficie de dinero, y va después, en ese orden.
