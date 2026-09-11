# Inventario y ventas en Atlas: decisiones y plan de trabajo

**Para:** el equipo de Atlas.
**Base:** el diagnóstico de estado actual, y el documento `MODELO_COMERCIAL_NUTRACEUTICOS_ATLAS` en su versión vigente, que es la fuente de las reglas de negocio y ya pasó revisión contable y legal.

---

## 0. Corrección de premisa: los datos actuales de Atlas son de prueba

**Los 23 registros de transacciones, las 5 recepciones de inventario, las 4 entregas y los 11 checkouts que aparecen en el diagnóstico no corresponden a operación real.** Son datos de prueba cargados durante el desarrollo.

Esto cambia el orden de prioridades y elimina varias líneas de trabajo que el diagnóstico plantea como urgentes:

| Hallazgo del diagnóstico | Lectura corregida |
|---|---|
| 92% de lo cobrado sin factura | **No hay exposición fiscal.** No son ventas reales y no hay deber de facturar incumplido |
| Saldo de −1 unidad | Ruido de pruebas, no mercancía extraviada. No requiere investigación |
| 4 entregas sin `treatment_id` | Muy probablemente residuo de pruebas. No amerita arqueología de migraciones |
| 10 checkouts abandonados de 11 | No es evidencia de comportamiento real de pacientes |

**Lo que sí se conserva del diagnóstico, porque es estructural y no depende de los datos:**

- Vender y entregar no se hablan. Sigue siendo la raíz y sigue habiendo que resolverla.
- El inventario no se descuenta al vender. Sigue siendo el error de diseño de fondo.
- `/comercial` es un placeholder y no hay superficie de comisiones ni liquidación.
- No existe el concepto de liquidación.
- Inventario por lote se captura pero no gobierna el saldo.

**La consecuencia práctica: antes de producción hay que purgar y arrancar limpio.** Esa es una decisión única que reemplaza cuatro investigaciones, y además habilita lo que la operación real necesita: un inventario inicial que cuadre con lo que existe físicamente.

---

## 1. El diagnóstico es correcto, y la raíz está bien identificada

"Vender y entregar no se hablan" es el diagnóstico acertado. De ahí salen el saldo en menos uno, las entregas que no se pueden rastrear y la imposibilidad de conciliar.

Pero hay algo más de fondo que conviene nombrar, porque es lo que da urgencia al resto: **la figura de consignación se sostiene en que el inventario refleje la realidad.** Todo el modelo comercial descansa en poder afirmar que un producto determinado es de CNV y está en un lugar determinado. Si el inventario es ficción, esa afirmación se debilita, y con ella la base contractual, contable y fiscal de toda la operación.

Un saldo negativo no es un detalle de datos. Es la prueba de que el sistema no sabe dónde está la mercancía de CNV.

---

## 2. Tres hallazgos del diagnóstico, releídos

### 2.1. La regla de facturación en efectivo ya está definida y hay que cablearla antes de producción

El reporte lo presenta como "falta la pieza, y es deliberado: espera la regla contable". **La regla ya existe** y está en el documento del modelo: CNV factura al paciente **al registrar la venta**, no cuando el Integrante consigna el efectivo. El hecho económico es la entrega del producto contra el pago, no el movimiento de dinero posterior entre el Integrante y CNV.

**El medio de pago no cambia la obligación de facturar.** CNV es responsable de IVA y facturador electrónico habilitado. Que el paciente pague en efectivo no exime de emitir factura.

Como los datos actuales son de prueba, no hay nada que regularizar hacia atrás. Pero esta pieza **es bloqueante para salir a producción**: el día que entre la primera venta real en efectivo sin factura, ahí sí empieza a correr una omisión.

### 2.2. Las cuatro entregas sin `treatment_id` rompen la trazabilidad de retiro

El reporte lo trata como una anomalía de datos interesante. Es más que eso: **ese campo es lo que permite saber qué paciente recibió qué producto y de qué lote.**

Ahora mismo hay producto de tercero en el portafolio (LUVIA) que **contiene avena y por tanto gluten**. Si mañana el fabricante emite una alerta sanitaria sobre un lote, CNV debe poder identificar exactamente a qué pacientes les llegó. Sin `treatment_id`, esas entregas son un hueco negro.

Además, esa trazabilidad es una obligación que ya asumimos por escrito: en el contrato de suministro con el proveedor externo, CNV se compromete a trazar y notificar a los pacientes de un lote afectado. Es una capacidad que estamos afirmando tener.

**No investigar las cuatro filas actuales.** Son datos de prueba y se purgan. Lo que sí hay que garantizar es que **en producción el campo no pueda quedar nulo**: si es el vínculo con el paciente, debe ser obligatorio a nivel de base de datos, no solo por convención del código. Una restricción `NOT NULL` cierra el problema de raíz y hace innecesario el diagnóstico.

Si existe un segundo camino de escritura fuera del flujo clínico (una pantalla administrativa, `/mi-inventario`) donde no hay contexto de tratamiento, ese camino debe cerrarse o exigir la selección explícita del paciente.

### 2.3. Los diez checkouts abandonados no son falta de uso

Los datos son de prueba, de modo que los diez abandonos no son evidencia de comportamiento real. **Pero el riesgo de diseño que señalan sigue siendo válido y conviene corregirlo antes de producción, no después de comprobarlo con pacientes reales.**

El riesgo: el enlace se genera y el paciente lo paga después, ya fuera de la consulta, cuando el momento de decisión pasó. **La compra de un nutracéutico es una decisión de impulso en el punto de atención.** Si el paciente sale del consultorio sin pagar, en la mayoría de los casos no vuelve.

La corrección no es técnica sino de flujo: que el pago ocurra **dentro de la consulta**, con el enlace mostrado como código QR en la pantalla del profesional para que el paciente lo escanee y pague ahí mismo. Cualquier URL se puede renderizar como QR sin dependencia externa, así que no hay que integrar nada nuevo.

---

## 3. Las tres decisiones que pidieron

### Decisión 1: la venta descuenta inventario. La entrega deja de ser un movimiento independiente

Esta es la decisión estructural y resuelve casi todo lo demás.

**Fundamento:** en el modelo de consignación, el producto es de CNV hasta el momento de la venta. Es en la venta cuando la propiedad se transfiere y el bien sale del patrimonio de CNV. Que el producto cambie de manos físicamente antes o después es un hecho logístico, no el hecho económico.

**En consecuencia:**

- La **venta** descuenta inventario, de la ubicación que corresponda (bodega del Integrante si la entrega es en consulta, bodega central si es a domicilio).
- La **entrega** pasa a ser un **estado de cumplimiento de la venta**, no un movimiento de inventario: pendiente, entregado en consulta, despachado, entregado a domicilio.
- **No debe existir entrega sin venta.** Si hoy es posible, hay que cerrarlo.

**La excepción que sí hay que modelar:** la entrega de muestras o cortesías, que es salida de inventario sin venta. Si existe esa práctica, debe ser un concepto propio, autorizado y registrado, no un efecto colateral de que entregar y vender estén desconectados. Si no existe, mejor: no se construye.

**Lo que esto resuelve:** el saldo en menos uno deja de ser posible, las entregas quedan atadas a un paciente por construcción, y el conteo físico pasa a comparar contra un saldo que significa algo.

### Decisión 2: sí se factura el efectivo, al registrar la venta

Ya explicado en 2.1. La regla contable está definida en el documento del modelo y no depende de ninguna decisión pendiente.

Un punto operativo: si la facturación electrónica falla en el momento (caída de Alegra, error de datos), la venta **no debe bloquearse**, pero debe quedar en una cola de reintento visible, con alerta. Lo que no puede pasar es que una factura fallida desaparezca silenciosamente, que es exactamente como se llega a doce ventas sin facturar.

### Decisión 3: la entrega sí es acto auditable

Vincular un producto a un paciente revela información sobre su tratamiento, y por tanto es dato clínico. Debe quedar en `clinical_audit_log`.

Hay además una razón práctica que pesa igual: el registro de auditoría es lo que permite reconstruir quién dispensó qué a quién y cuándo, que es precisamente lo que hace falta ante un retiro de producto o un reclamo de calidad.

---

## 4. El flujo objetivo

Todo ocurre dentro de la evaluación, en la pestaña de Tratamiento. Sin saltar a otra pantalla.

1. El profesional selecciona el nutracéutico, la dosis y los días.
2. Atlas pregunta: **¿el paciente lo adquiere?** Sí, no con motivo, o aún no decide.
3. Si es sí, pregunta la **forma de entrega**: en consulta o a domicilio.
4. **Valida inventario** en la ubicación correspondiente. Si es domicilio, valida además que la ciudad esté habilitada y captura la dirección.
5. **Se bifurca según la modalidad del Integrante:**
   - **Comisión:** se genera el enlace de pago, **mostrado como QR en pantalla** para que el paciente pague en el momento. Al sellar el pago, se emite la factura al paciente.
   - **Distribución:** no hay checkout de CNV. Se registra la venta y queda en cola para la facturación quincenal al Integrante. El pago del paciente ocurre por sus medios.
6. La venta **descuenta inventario** y queda vinculada al tratamiento y al paciente.
7. La **entrega** se marca como estado de esa venta.

`/pagos` se conserva para el caso legítimo de una venta sin evaluación en curso (un paciente que vuelve solo a comprar), pero deja de ser el camino principal.

---

## 5. Plan por fases

### Fase 0: arranque limpio en producción

Esta fase no existía en la versión anterior de este plan y ahora es la primera, porque los datos actuales son de prueba y porque Alegra y Wompi están en sandbox.

**Purga y corte de arranque**

- Purgar los datos de prueba: transacciones, recepciones, entregas, checkouts y saldos de inventario.
- Definir una **fecha de corte de arranque**. Antes de esa fecha nada cuenta; a partir de ella, todo registro es real y auditable. Esa fecha debe quedar documentada, porque es la que separa el período de pruebas del período contable.
- Dejar la restricción que impide `treatment_id` nulo antes de recibir el primer dato real.

**Carga del inventario inicial**

El saldo de apertura **no se estima: se cuenta.** Debe cargarse a partir de un conteo físico, por producto y por lote con su fecha de vencimiento, y por ubicación (bodega central y bodega de cada Integrante).

Ese saldo contado puede contrastarse contra el saldo teórico, que se deriva de los documentos ya emitidos: unidades compradas al proveedor, menos las vendidas en firme a Integrantes bajo modalidad Distribución. Toda diferencia entre lo contado y lo teórico debe explicarse **antes** de arrancar, no después. Es el único momento en que esa conciliación es barata.

El producto de tercero en consignación se carga por separado, sin valor contable, según la sección 7 del modelo comercial.

**Paso de sandbox a producción**

- Re-mapear todos los identificadores de Alegra: productos, impuestos, numeraciones, bodegas, centros de costo. Los de sandbox no sirven en producción y esta es la causa número uno de facturas mal emitidas al hacer el cambio.
- Confirmar que cada producto exista en Alegra de producción con su tarifa de IVA y su código de identificación.
- Definir la **numeración que usará Atlas**: prefijo propio o compartido con la facturación manual. Decisión a confirmar con contabilidad.
- Wompi a producción, con validación del webhook en el ambiente real.
- **Emisión de prueba en producción contra un contacto controlado** antes de facturar al primer paciente real.

**Facturación en efectivo**

- Cablear la emisión de factura al registrar la venta, con la regla ya definida.
- **Cola de reintento visible** para facturas fallidas, con alerta. Una factura que falla en silencio es como se llega a un mes de ventas sin facturar.

**Criterio de aceptación de la fase:** una venta real de prueba controlada, en efectivo y por pasarela, genera factura validada por la DIAN, descuenta el inventario correcto y aparece conciliada contra Alegra.

### Fase 1: el puente venta ↔ entrega (la decisión estructural)

- La venta descuenta inventario; la entrega pasa a estado de cumplimiento.
- Cerrar la posibilidad de entregar sin vender.
- Auditoría de la entrega en `clinical_audit_log`.
- El flujo unificado desde Tratamiento, con QR en pantalla.

Esta fase es la que más código toca y la que más resuelve. No la fragmentaría.

### Fase 2: visibilidad del dinero

- **`/comercial`**: los datos están calculados y sellados desde agosto y no hay dónde verlos. Es, como dice el diagnóstico, lo más barato con más retorno.
- **Pantalla de comisiones para el Integrante.** Hoy no puede consultar lo que ha ganado desde ninguna parte. Eso no es solo incómodo: erosiona la confianza en un esquema donde él no maneja el dinero y depende de que CNV le liquide bien.
- **Liquidación**: el concepto no existe. Nada dice qué se pagó y qué se debe. Debe calcular comisión, IVA sobre la comisión y retención según el perfil tributario del Integrante, y producir el documento que corresponda a ese perfil.
- **Conciliación Atlas ↔ Alegra.** Hoy no existe y es indispensable: son dos sistemas que van a tener inventario y documentos, y nadie los compara. Se necesita un reporte que enfrente, por período, las ventas registradas en Atlas contra las facturas emitidas en Alegra, y que señale las diferencias. Sin esto, la contabilidad no tiene forma de verificar que el sistema operativo y el contable digan lo mismo.

### Fase 3: soporte de las dos modalidades y domicilios

- Modalidad vigente por Integrante, con historial.
- Bodega central como ubicación de inventario, además de las de cada Integrante.
- Ciclo de corte quincenal y facturación al Integrante bajo modalidad Distribución.
- Cupo de crédito con bloqueo de despacho.
- Órdenes de despacho a domicilio con estado y guía.

---

## 6. Reportes que la contabilidad va a necesitar

Conviene preverlos desde el diseño del modelo de datos. Reconstruirlos después es costoso y algunos son imposibles si el dato no se capturó en su momento:

- Ventas **por fecha de operación**, no solo por fecha de facturación. Es lo que permite cerrar bien el mes cuando una venta del día 31 se factura el 2.
- Ventas por municipio de destino, para el análisis de ICA territorial cuando haya domicilios.
- Inventario por ubicación, lote y titularidad (propio o de tercero), a una fecha dada.
- Liquidaciones por Integrante con detalle de comisión, IVA, retención y ajustes.
- Acumulado anual de pagos por Integrante, para el control del umbral de tarifa de retención.
- Conciliación de efectivo por Integrante: recaudado, consignado, pendiente.
- Movimiento de producto de tercero por proveedor: recibido, vendido, devuelto, faltante, saldo.
- Conciliación Atlas contra Alegra por período.

---

## 7. Dos cosas que conviene adelantar aunque estén en el backlog

**Inventario por lote.** Está diferido, y entiendo por qué. Pero con producto de tercero en el portafolio y una obligación contractual de trazar retiros por lote, el costo de no tenerlo cambió. No pide prioridad inmediata, sí que deje de ser "algún día".

**Conteo físico.** La maquinaria está construida y nunca se ha corrido. Correr el primer conteo no requiere desarrollo, requiere decidir hacerlo. Y hasta que no se corra, el inventario no está verificado contra la realidad en ningún punto desde que arrancó la operación.

---

## 8. Lo que no conviene construir todavía

- **Flujo de retracto completo.** Solo aplica a ventas a domicilio bajo modalidad Comisión, y todavía no hay domicilios. Construirlo antes que el domicilio es construir sobre algo que no existe.
- **Liquidación al proveedor externo** por productos de tercero. Depende de que exista el contrato de suministro, que hoy no está firmado.
- **Modalidad Distribución en producción.** Depende del Anexo 2 actualizado y de que haya al menos un Integrante habilitado. Conviene tener el modelo de datos preparado, pero no la operación encendida.

---

## 9. Preguntas abiertas que no son del equipo técnico

Estas dependen de decisiones de negocio o de contabilidad, y conviene no bloquear el desarrollo esperándolas:

- **La fecha de corte de arranque en producción**, que separa el período de pruebas del período contable.
- **El inventario físico inicial**, contado por producto, lote y ubicación. Es insumo de la Fase 0 y no lo puede producir el equipo técnico.
- **La numeración que usará Atlas** para facturar: prefijo propio o compartido con la facturación manual. A confirmar con contabilidad.
- Si existe la práctica de entregar muestras o cortesías, para saber si hay que modelarla.
- El listado de Integrantes reales con su modalidad asignada y su perfil tributario completo.

**Ya no son preguntas abiertas:** qué hacer con las ventas sin factura y si las entregas sin paciente se pueden reconstruir. Ambas desaparecen con la purga de datos de prueba.
