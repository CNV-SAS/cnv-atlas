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

### B1 · El descuento ocurre al CONFIRMAR EL PAGO (corregido 2026-08-24)

**Se invierte el orden. No es "entrego y espero el pago": es "espero el pago y entrego".**

La primera versión de este plan descontaba al entregar, por miedo a que el inventario mintiera durante el hueco entre la entrega física y la confirmación. **Ese miedo estaba mal planteado**, y el argumento que lo desmonta es de Santiago: entregar un producto de CNV sin pago confirmado **no es un caso de borde, es entregar mercancía ajena a crédito**, y quien responde por ella es el profesional que la tiene en consignación.

**Y el hueco desaparece con el orden invertido**: el paciente está delante, el enlace se paga en minutos, y el profesional entrega **cuando ve la confirmación en pantalla**. No hay ventana en la que el inventario mienta, porque el producto no sale antes.

**Lo que esto exige, y por eso B1 depende de ello:** que el profesional **VEA el pago confirmado sin recargar**. Ver la Parte D.

### B2 · Sin entrega sin pago, no hay faltante por esa vía

Con B1 invertido, **la categoría casi desaparece**: si el producto no sale hasta que el pago está confirmado, no existe la entrega impaga que había que perseguir.

**Queda un solo caso residual, y hay que decidirlo a propósito:** el profesional entrega igual, saltándose el flujo (porque conoce al paciente, porque el enlace no cargó, porque decidió confiar). Eso no lo impide el software: lo que hace el software es **no tener un botón que lo facilite**. Si ocurre, aparece como diferencia en el conteo y **cae en el mecanismo de faltantes que ya existe**, sin categoría nueva y sin que hayamos diseñado una vía para ello.

### B3 · Una sola pregunta, con la decisión clínica dentro

*"¿El paciente adquirió los nutracéuticos?"* → **sí** · **no** · **pendiente**, con lista de razones y "otra" con texto obligatorio.

Y **dos entradas separadas** para el descarte del profesional (propuesta de Santiago, adoptada):

- *"Como profesional no lo recomiendo por razones **clínicas**"*
- *"Como profesional no lo recomiendo por razones **no clínicas**"*

Las dos con texto obligatorio. **Es más limpio que meter la distinción dentro de una lista de razones:** clasifica el propio profesional, y el sistema no tiene que adivinar si "alergia al calostro" es clínico mientras "no le gusta el sabor" no lo es. Esa adivinanza no la puede hacer un `switch`, y equivocarla mandaría un dato comercial a la historia clínica o al revés.

Y resuelve el orden de las dos decisiones (primero si PUEDE, después si QUIERE) **sin dos pantallas**: el profesional que descartó no llega a preguntarle al paciente, marca su razón.

### B4 · El "pendiente" lleva fecha, y NO vence solo

"Pendiente" sin fecha se lee igual el día uno que a los seis meses, y es la diferencia entre *lo está pensando* y *no volvió*.

**Y no se cierra automáticamente.** Un "no compró" que nadie dijo entra en las métricas de dirección como si el paciente lo hubiera dicho. Mejor que envejezca visible.

---

# Parte C · El dato clínico, separado

Si la razón del descarte es **clínica** (alergia a un componente, interacción, contraindicación), ese dato **no puede vivir solo en una lista comercial**, por tres razones:

1. **Persiste entre consultas.** Una contraindicación no es de esta venta: vale la próxima vez y con otro profesional.
2. **Debería alimentar el motor.** Es la misma familia que P-39 (las alergias que no llegan al menú).
3. **El destinatario es otro.** La razón comercial la lee dirección; la clínica la lee el siguiente profesional.

**Una sola pregunta en pantalla**, y cuando el profesional marca la opción **clínica**, ese motivo se guarda **también** como dato clínico del paciente.

## Dónde vive ese dato

**Criterios:** tiene que verse en la próxima consulta, incluso con otro profesional; y verse al prescribir, junto al producto descartado.

**Los tres sitios que ya existen, y por qué ninguno sirve:**

| Sitio | Qué guarda | Por qué no |
|---|---|---|
| **Condiciones de la toma** (`bis_conditions`) | el estado del paciente el día de la medición (ayuno, hidratación) | son **de esa medición**; no persisten |
| **Antecedentes de la encuesta** (d5_39, d6_43...) | lo que el **paciente declara** | los declara él, no el profesional, y **se rehacen cada evaluación** |
| **Notas** (`treatment_notes`) | bitácora del profesional | texto libre **de esa consulta**; no es consultable ni se puede mostrar junto a un producto |

**Lectura: hace falta un sitio nuevo, y va en el PACIENTE, no en la evaluación.** Coincide con la lectura preliminar de Santiago, y la razón es la que él da: **una contraindicación es de la persona, no de esa consulta.** Una alergia al calostro vale con cualquier profesional y en cualquier evaluación futura.

**Forma mínima:** contraindicaciones del paciente, cada una con el producto o componente, el motivo, quién la registró y cuándo. Es una tabla nueva, chica, colgada de `patients`.

**Y no es solo para nutracéuticos:** el mismo sitio sirve para cualquier contraindicación que el profesional observe. Nace acotado a esto, pero no se diseña como si fuera exclusivo.

## La pregunta que abre, y su respuesta

**¿Un descarte por alergia debería IMPEDIR prescribir ese producto la próxima vez?**

**Lectura: es pieza aparte, y hay que decir por qué.** Registrar la contraindicación es de este bloque. **Bloquear la prescripción es un gate clínico**, y eso tiene tres consecuencias que no se resuelven aquí:

- **Quién puede levantarlo.** Una alergia declarada mal, o superada, necesita una vía de corrección. Un gate sin vía de salida es una trampa (el mismo patrón del gate `diagnosisConfirmed`, ya registrado en BACKLOG).
- **Qué alcance tiene.** ¿Bloquea ese producto, o todos los que comparten el componente? Lo segundo exige un modelo de **componentes**, que el catálogo no tiene (hoy `composition` es texto libre).
- **Y quién lo decide.** Que el sistema impida un acto clínico es decisión de dirección científica, no nuestra.

**Propuesta:** en este bloque se **registra y se muestra** (al prescribir, junto al producto: "descartado antes por alergia al calostro, 2026-08-24"). **El bloqueo se separa** y se le pregunta a Gildardo, con el modelo de componentes dimensionado aparte.

---

# Parte D · El cobro dentro de Tratamiento (ahora es requisito de B1)

Santiago quiere que el cobro viva aquí y no en otra pestaña. **Tiene razón en el flujo**, y con B1 invertido **ya no es una comodidad: es la condición para que el flujo funcione.** El profesional necesita ver el pago confirmado sin salir de la consulta.

## Lo que ya existe (verificado)

- `createCheckout` (Wompi) y `registerCashSale` (efectivo) existen como servicios.
- **El webhook de Wompi existe y funciona**: `/api/webhooks/wompi` recibe la notificación, mapea el estado y **sella el pago** (comisión, ingreso, y factura en Alegra best-effort). Es idempotente, con control de eventos duplicados.
- **El efectivo sella de inmediato y en sincronía**: `registerCashSale` crea la transacción **ya pagada**. Ahí la confirmación es del profesional, y el descuento puede dispararse en el mismo acto.
- **El modelo ya anticipó el pago mixto**: el schema dice, textual, *"Un pago mixto = dos transacciones, una por medio"*.

## Lo que falta

1. **El vínculo.** `nutraceutical_stock_movements` tiene `treatment_id` pero **ninguna referencia a `transactions`**. Hoy se puede entregar sin cobrar y cobrar sin entregar, **y nada lo detecta**. Es el hueco central.
2. **Que el pago confirmado se VEA sin recargar.** El webhook sella en el servidor, pero **el panel no se entera solo**: hoy no hay nada que refresque esa vista. Sin esto, B1 obliga al profesional a recargar a ciegas hasta que aparezca, que es peor que el flujo de hoy. **Es la pieza que hace viable todo lo demás.** Un sondeo acotado mientras el pago esté pendiente es suficiente y es lo más barato; no hace falta tiempo real.
3. **La superficie mixta.** El modelo la soporta; falta la pantalla que cree las dos transacciones.
4. **El cobro en Tratamiento.** Reusar los servicios existentes desde el panel, no duplicarlos.

## Si Wompi no responde

**El principio se mantiene: sin confirmación no sale el producto.** Las salidas, de menor a mayor costo:

- **El efectivo ya es la vía alterna**, y es inmediata: lo confirma el profesional y sella en el acto. Hoy ya funciona.
- **Una llave BRE-B (transferencia directa)** es la propuesta de Santiago. **No existe hoy** y es una integración nueva: hay que verificar si el proveedor notifica el pago o si el profesional confirma a mano. Si es lo segundo, **es equivalente al efectivo** y su costo baja mucho: no es una pasarela, es un medio de pago más con confirmación del profesional.
- **Lo que NO conviene:** un "confirmar a mano" genérico para cualquier medio. Eso reabre por la puerta de atrás lo que B1 cierra.

**Dimensión: MEDIA-ALTA, y es superficie de dinero.** Lo grande no es llamar a `createCheckout`: es que a partir de aquí **entrega y cobro dejan de ser dos registros que no se conocen**.

**Orden recomendado:** el vínculo y la visibilidad del pago primero (sin eso B1 no se puede construir), después el mixto, y BRE-B al final, cuando se sepa si notifica.

# Parte E · El cierre de la consulta

## Lo que hay hoy, medido

| Estado de `evaluations` | Quién lo pone |
|---|---|
| `awaiting_survey` | el intake, al firmar sin responder |
| `draft` | el paciente, al completar la encuesta |
| `in_progress` | el profesional, al confirmar la identidad |
| `completed` | **nadie** |
| `abandoned` | **sí**: el profesional lo aplica a mano desde la ficha (`abandonEvaluation`). *(El comentario del enum decía que "solo EXISTE"; era falso y se corrigió. Lo que no existe es el proceso automático por ventana temporal.)* |

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
| Protocolo **aprobado** | **33 de 33 sin aprobar** (ver abajo: son TRES casos distintos) | no |
| Reporte **enviado** | **31 de 33 sin enviar** | no |
| Remisión con **retorno** | **4 de 5 sin retorno** | no |
| Próxima cita | **1 de 33** fijada | no |
| Nutracéutico decidido | no existe | no |

**Dos lecturas que salen de esto:**

- **El reporte sin enviar es el más grave**, y es el que la reformulación arregla mejor: un reporte aprobado y no enviado significa que **el paciente no recibió nada**, y hoy nadie se entera.
- **"Protocolo sin aprobar" NO es una sola cosa, y el gate no lo explica entero.** Al mirar los 33 uno por uno salen **tres casos**, y la lista del cierre tiene que distinguirlos o mostraría 33 pendientes cuando 28 no son accionables hoy:

| Caso | Cuántos | Qué significa |
|---|---|---|
| Diagnóstico sin confirmar | **26** | no se puede aprobar todavía. Es el gate `diagnosisConfirmed`, ya registrado en BACKLOG |
| **Sin `protocol_suggested`** | **2** | **no se puede aprobar nunca por esta vía**: son tratamientos anteriores al sellado del protocolo, y `approveProtocol` los rechaza a propósito ("no se aprueba lo que nunca se computó") |
| Se puede aprobar y nadie lo hizo | **5** | el caso que el cierre debería sacar a la luz |

Y un dato que los cruza: **ninguno de los 7 con diagnóstico confirmado tiene un solo ajuste** (`adj_*` todos nulos). Nadie entró a trabajar esos protocolos. Es coherente con el gate (si no puedes cambiar nada antes de aprobar, no hay razón para entrar), pero también significa que el "se puede aprobar y nadie lo hizo" es real, no un artefacto.

## Qué hacer con las 38 abiertas

**Nada, y el cierre aplica de aquí en adelante.** Tres razones:

1. **Son de prueba.** Cerrarlas a mano fabricaría 38 cierres que nadie hizo, en un campo que después se lee como métrica.
2. **Es la misma regla que ya aplicamos** con `structural_mccb`: *"de aquí en adelante; no se rellena hacia atrás"*.
3. **Y en la nube conviene mirarlas antes**: si alguna es de un integrante real, el criterio es distinto y lo decide Santiago con la lista delante.

Lo único que sí conviene: que la lista **distinga** una sin cerrar de una cerrada, **y que entre con el cierre, no después**: un estado nuevo que no se ve no cambia nada.

**Y el estado YA SE MUESTRA, en el sitio correcto** (verificado el 2026-08-24, corrigiendo una conclusión anterior mía que era falsa):

En `/pacientes/[patientId]`, la tabla **Evaluaciones** tiene una columna **Estado** que pinta `evaluations.status` con `estadoEvaluacionLabel`. **Una sola fuente, sin mezcla.** Su mapa de etiquetas ya está completo:

| Valor | Etiqueta | ¿Alguien lo pone? |
|---|---|---|
| `awaiting_survey` | "Firmada, esperando la encuesta" | sí |
| `draft` | "Borrador" | sí |
| `in_progress` | "En progreso" | sí |
| `completed` | **"Completada"** | **no** |
| `abandoned` | "Abandonada" | no |

Los "Borrador" y "En progreso" que vio Santiago son exactamente eso: `draft` (encuesta completada, identidad sin confirmar) e `in_progress` (identidad confirmada).

**Lo que esto cambia en el trabajo:** el cierre **NO necesita columna nueva ni etiquetas nuevas**. La columna existe, la etiqueta "Completada" está escrita, y la pantalla ya sabe pintarla. **Solo falta que alguien ponga el valor.** La pieza baja de "añadir columna + etiquetas + estado" a "poner el estado y la superficie que lo pone".

*(Mi conclusión anterior decía que el estado de la evaluación no se mostraba en ninguna parte. Salía de mirar `/evaluaciones`, que lista REPORTES pendientes con `reports.status`, y de generalizar desde ahí sin buscar los demás sitios.)*

# Parte F · Orden y dimensión

| # | Pieza | Dimensión | Depende de |
|---|---|---|---|
| 1 | La pregunta única (sí/no/pendiente + razones + fecha) | **chica** | nada |
| 2 | El dato clínico separado cuando la razón lo es | chica | 1 |
| 3 | El bloque de entrega condicionado a "sí" | chica | 1 |
| 4 | Estado de cobro en el movimiento + vínculo con `transactions` | **media** | nada |
| 5 | Vencimiento de entrega sin pago hacia faltantes | media | 4 |
| 6 | El cierre de la consulta con su lista de pendientes | **media**, y menos de lo estimado: la columna y la etiqueta "Completada" ya existen | 1, y la quinta pestaña |
| 7 | Pago mixto | media | 4 |
| 8 | El cobro dentro de Tratamiento | media | 4, 7 |
| · | Bloquear la prescripción por alergia registrada | **aparte** | Gildardo + modelo de componentes |

**Las tres primeras se pueden hacer ya** y resuelven el problema que Santiago vio. El resto es la superficie de dinero, y va después, en ese orden.
