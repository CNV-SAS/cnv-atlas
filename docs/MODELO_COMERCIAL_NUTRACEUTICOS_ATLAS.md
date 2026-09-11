# Modelo comercial de nutracéuticos: especificación para Atlas

**Objeto:** definir las dos modalidades de comercialización, el esquema de envío a domicilio, la incorporación de productos de terceros al portafolio, el tratamiento contable y tributario de cada flujo, y lo que Atlas debe soportar para operarlos.

**Alcance:** especificación funcional para implementación técnica, con las reglas fiscales que condicionan el diseño y las directrices de construcción.

**Cómo leerlo:** las secciones 1 a 7 definen el modelo. Las secciones 8 a 10 definen lo que el sistema debe soportar. La sección 11 define cómo y en qué orden se construye.

**Nota sobre cifras:** todos los valores monetarios de este documento son ilustrativos. El listado de precios oficial vive en Atlas y es la única fuente válida.

---

## 1. Concepto base: la consignación no cambia

En **ambas modalidades**, el producto es propiedad de CNV hasta el momento de la venta al paciente. Esto no varía y es el eje de todo lo demás.

Lo que cambia entre modalidades es **quién cobra al paciente y quién factura**, no de quién es el producto mientras está en inventario.

En el instante de la venta, bajo la modalidad Distribución la propiedad pasa de CNV al Integrante y de este al paciente en un mismo acto. Bajo la modalidad Comisión, pasa directamente de CNV al paciente.

---

## 2. Las dos modalidades

Un Integrante opera bajo **una sola modalidad a la vez**. La asigna un administrador de CNV en el perfil del Integrante, y queda registrada con fecha de vigencia.

| | **Modalidad Comisión** | **Modalidad Distribución** |
|---|---|---|
| Quién cobra al paciente | CNV, por pasarela | El Integrante, por sus propios medios |
| Quién factura al paciente | CNV | El Integrante, en nombre propio |
| Remuneración del Integrante | Comisión del 20% sobre precio base | Descuento comercial del 20% sobre precio base |
| CNV factura al Integrante | No | Sí, quincenalmente, por lo vendido |
| El Integrante factura a CNV | Sí, su comisión (o CNV emite documento soporte) | No |
| Control del PVP | CNV lo fija | CNV lo sugiere, no puede imponerlo |
| Relación de consumo con el paciente | CNV es el expendedor | El Integrante es el expendedor |
| Volumen de facturas de CNV | Una por cada venta a paciente | Dos al mes por Integrante |

### Requisitos para la modalidad Distribución

- Ser responsable de IVA. **Este requisito protege al Integrante, no a CNV:** si no lo es, el IVA que CNV le factura se convierte en costo no descontable y su margen real cae por debajo de lo que ganaría con comisión.
- Estar habilitado como facturador electrónico ante la DIAN.
- Aceptar cupo de crédito, plazos de pago y registro obligatorio de ventas en Atlas.
- Estar al día en sus obligaciones económicas con CNV.

La pérdida sobreviniente de cualquiera de estas condiciones permite a CNV revertir la operación a modalidad Comisión con quince días de preaviso.

### Cambio de modalidad

El cambio surte efecto **al inicio del siguiente período de corte**. El período en curso se cierra bajo la modalidad anterior, para no partir una liquidación en dos regímenes.

---

## 3. Flujo de la modalidad Comisión

**Canal digital (preferente).** Atlas genera el enlace o código de pago al registrar la venta. El pago del paciente ingresa directamente a CNV por la pasarela. El Integrante no maneja dinero. CNV emite la factura al paciente.

**Canal efectivo (excepcional).** El Integrante registra la venta y conserva el efectivo por cuenta de CNV. Lo transfiere quincenalmente, los días 15 y último de cada mes, y envía el comprobante el mismo día.

**Momento de la factura al paciente.** En canal digital, al confirmarse el pago en la pasarela. En canal efectivo, **al registrar la venta**, no cuando el Integrante consigne: el hecho económico ocurre cuando se entrega el producto y se recibe el pago. La consignación posterior es un movimiento entre CNV y el Integrante, no la venta.

**El efectivo en poder del Integrante es una cuenta por cobrar de CNV.** Entre el cobro y la consignación, ese dinero es de CNV pero está en poder de un tercero. Atlas debe llevar el saldo pendiente de consignar por Integrante y conciliarlo contra cada transferencia.

**Liquidación.** Mensual, dentro de los cinco días hábiles del mes siguiente. Atlas determina el efectivo recaudado que pertenece a CNV, los faltantes injustificados, y la comisión causada. Las obligaciones recíprocas se compensan y solo se transfiere el saldo neto. La parte deudora paga dentro de los cinco días hábiles siguientes al reporte.

**Advertencia para el diseño:** el saldo neto puede resultar **a cargo del Integrante**, no solo a su favor. Un faltante puede superar la comisión mensual de quien vende poco. El sistema debe tratar el saldo negativo como caso normal, no como error.

### 3.1. Tratamiento tributario del pago de la comisión

Esta sección condiciona el diseño de la liquidación y del perfil del Integrante.

**La comisión es un servicio gravado.** Si el Integrante es responsable de IVA, su comisión lleva **IVA del 19%** sobre el valor de la comisión. Ese IVA es descontable para CNV, de modo que el costo real de la comisión no aumenta.

**CNV practica retención en la fuente.** Las comisiones se retienen bajo el concepto de honorarios y comisiones:

| Situación del Integrante | Tarifa |
|---|---|
| Persona natural, pagos anuales acumulados ≤ 3.300 UVT | 10% |
| Persona natural, pagos anuales acumulados > 3.300 UVT | 11% |
| Persona jurídica | 11% |

Con la UVT 2026 de $52.374, las 3.300 UVT equivalen a **$172.834.200 anuales**. El sistema debe llevar el **acumulado pagado por Integrante en el año** y cambiar a la tarifa del 11% a partir del pago en que se supere ese umbral.

La retención se calcula sobre el valor de la comisión, **no sobre el IVA**.

**Quién emite el soporte del pago:**

| Perfil del Integrante | Documento |
|---|---|
| Obligado a facturar (código 52 o equivalente en su RUT) | El Integrante emite factura electrónica a CNV |
| No obligado a facturar | CNV emite **documento soporte electrónico** |

Atlas debe registrar esta condición en el perfil del Integrante, porque determina qué documento se genera en cada liquidación.

**CNV emite certificado de retención** al Integrante por cada retención practicada. Es el documento con el que él descuenta ese valor en su declaración de renta.

**Ejemplo ilustrativo** (producto de base 100.000, PVP 119.000, Integrante responsable de IVA y no declarante):

| Concepto | Valor |
|---|---|
| Comisión 20% sobre base | 20.000 |
| IVA 19% sobre la comisión | 3.800 |
| Valor facturado por el Integrante | 23.800 |
| Retención en la fuente (10% sobre 20.000) | −2.000 |
| **Neto a girar al Integrante** | **21.800** |

**Dependencia:** la habilitación del documento soporte electrónico en Alegra es condición previa a la primera liquidación con Integrantes no obligados a facturar.

---

## 4. Flujo de la modalidad Distribución

**Registro.** El Integrante registra cada venta en Atlas al momento de la transacción, con producto, cantidad, paciente y precio. El registro es condición de la facturación y es el soporte de la operación.

**Facturación al paciente.** La hace el Integrante, con su propia numeración y responsabilidad tributaria. CNV no interviene ni recauda del paciente.

**Ciclo de facturación de CNV al Integrante:**

| Momento | Actuación |
|---|---|
| Corte | Días 15 y último de cada mes, sobre ventas registradas en el período |
| Factura | CNV emite dentro de los dos días hábiles siguientes al corte. **Si no hubo ventas, no se emite factura** |
| Objeción | El Integrante tiene dos días hábiles para objetar de forma sustentada. CNV corrige en tres días hábiles. La objeción parcial no suspende el pago de lo no objetado |
| Pago | Tres días hábiles desde la recepción de la factura |

**Precio de facturación.** Se aplica el 20% de descuento sobre el **precio base** (sin IVA), y el IVA del 19% se recalcula sobre la base ya descontada. Con un producto de base 100.000 y PVP 119.000: base descontada 80.000, IVA 15.200, total **95.200 por unidad**.

Aritméticamente equivale a multiplicar el PVP con IVA por 0,80. Esa es la fórmula de verificación rápida, pero **la factura debe discriminar base descontada e IVA por separado**, no presentar un total con IVA incluido.

**El descuento debe registrarse como descuento comercial efectivo al momento de la venta**, no condicionado a hechos futuros, para que reduzca válidamente la base gravable del IVA.

**Cupo de crédito.** Tope de saldo pendiente por Integrante. Al alcanzarlo, el sistema suspende el despacho de nuevo inventario hasta que se ponga al día.

**Mora.** Pasados tres días calendario del plazo: suspensión de despachos e intereses a la tasa máxima legal mercantil. Pasados diez días: CNV puede revertir a modalidad Comisión o terminar la consignación, sin que ello termine el Contrato Marco.

### 4.1. Retenciones que practica el Integrante a CNV

Cuando el Integrante sea agente de retención (identificable por el **código 07** en su RUT), practicará a CNV:

- **Retefuente por compra de bienes: 2,5%** sobre la base, cuando la factura supere la base mínima de 27 UVT.
- Eventualmente **reteIVA** y **reteICA**, según su configuración municipal.

Esto **reduce el neto recibido pero no afecta el ingreso registrado**: CNV reconoce el ingreso completo y la retención se contabiliza como anticipo de renta a favor de CNV, soportado en el certificado que expide el Integrante.

Atlas debe registrar qué Integrantes son agentes retenedores para anticipar el neto esperado por factura y alimentar la proyección de caja.

---

## 5. Envío a domicilio

### 5.1. El concepto de dos bodegas

El inventario de CNV vive en **dos tipos de ubicación**:

- **Bodega del Integrante:** el producto en consignación que está físicamente en su consultorio.
- **Bodega central de CNV:** el producto que aún no ha salido a ninguna vitrina.

En ambos casos el producto es de CNV. La diferencia es únicamente dónde está.

Cuando la venta se entrega en consulta, el descuento de inventario se hace contra la bodega del Integrante. Cuando la venta se despacha a domicilio, **el descuento se hace contra la bodega central**, porque es de ahí de donde sale el producto.

Esto significa que el envío a domicilio **no es una excepción al modelo de consignación**: es el mismo principio aplicado a producto que nunca pasó por el consultorio. La propiedad, el momento de la venta y la facturación funcionan exactamente igual. Lo único que cambia es de qué ubicación se descuenta.

### 5.2. Quién despacha

**CNV despacha siempre**, en ambas modalidades. El Integrante nunca reenvía producto.

La razón es operativa: el caso de domicilio existe precisamente cuando el Integrante no tiene el producto a la mano, sea porque la consulta fue virtual, porque se le agotó, o porque el paciente prefiere recibirlo en casa. Pedirle que primero reciba y luego reenvíe duplicaría el flete y el tiempo.

### 5.3. Las cuatro combinaciones

| | **Entrega en consulta** | **Envío a domicilio** |
|---|---|---|
| **Comisión** | Descuenta de bodega del Integrante. Paciente paga a CNV el producto por el checkout. | Descuenta de bodega central. Paciente paga a CNV el producto más el flete, en el mismo checkout. |
| **Distribución** | Descuenta de bodega del Integrante. Paciente le paga al Integrante. | Descuenta de bodega central. Paciente le paga al Integrante el producto más el flete. CNV factura al Integrante el producto con descuento **más el flete**. |

Bajo Distribución, el flete **se suma** a la factura quincenal del Integrante, quien lo recupera del paciente. El Integrante no gana ni pierde en el envío: solo lo traslada.

### 5.4. Tarifa y tratamiento fiscal del flete

Tarifa fija por envío, **independiente del número de unidades**. Esto ya constituye un incentivo natural al pedido más grande: quien compra tres unidades paga un tercio de flete por unidad.

**El flete forma parte de la base gravable del IVA y se factura con IVA del 19%.** Por el artículo 447 del Estatuto Tributario, la base gravable incluye acarreos y demás erogaciones complementarias, aunque se facturen o convengan por separado. Como el producto principal está gravado al 19%, el flete que lo acompaña sigue esa suerte.

Esto aplica en las dos modalidades: en el checkout al paciente bajo Comisión, y en la factura quincenal al Integrante bajo Distribución.

La tarifa **vive en Atlas, no en los documentos contractuales**. El Anexo 2 y el Manual del Integrante remiten a "la tarifa vigente publicada en Atlas", de modo que pueda ajustarse cuando cambien las tarifas de la transportadora sin modificar documentos firmados.

### 5.5. Cobertura

Atlas debe manejar una **lista de ciudades habilitadas** para domicilio. Para destinos fuera de esa lista (zonas apartadas, San Andrés, Amazonas), el sistema no ofrece la opción de envío, o la ofrece con cotización caso a caso.

El criterio: es preferible no ofrecer el domicilio a un destino que ofrecerlo y perder dinero en cada envío.

**Consideración tributaria territorial.** Las ventas despachadas a otros municipios pueden generar obligación de industria y comercio (ICA) en la jurisdicción de destino, según dónde se entienda realizada la venta. Con la lista de ciudades habilitadas en expansión, Atlas debe **registrar el municipio de destino de cada venta** para permitir el análisis de ICA territorial. La determinación de en qué municipios se configura la obligación corresponde al área contable.

### 5.6. Riesgo de transporte

**CNV asume el riesgo del transporte en ambas modalidades**: pérdida, daño o demora en la entrega.

La razón es que CNV elige la transportadora, controla el empaque y contrata el flete. Trasladarle ese riesgo al Integrante bajo modalidad Distribución, cuando él no participó en ninguna de esas decisiones, sería injusto y difícil de sostener.

**Tratamiento contable de la pérdida en tránsito:** el producto perdido se da de baja del inventario de CNV contra gasto, y si la venta ya se había registrado y facturado, se emite nota crédito al adquirente (paciente bajo Comisión, Integrante bajo Distribución). No se le cobra al Integrante.

### 5.7. Venta a distancia y derecho de retracto

Bajo modalidad **Comisión**, el envío a domicilio convierte la operación en venta a distancia frente al paciente, lo que activa el derecho de retracto de cinco días hábiles y la reversión del pago en compras electrónicas (Ley 1480 de 2011).

Bajo modalidad **Distribución**, ese frente lo asume el Integrante, que es el expendedor frente al paciente.

**Alcance del retracto en producto consumible sellado (validado).** El artículo 47 lista siete excepciones al retracto. Para estos productos solo una es sostenible, y con un límite:

- **Bienes perecederos** y **bienes que caducan con rapidez** no aplican: el producto tiene dos años de vida útil.
- **Bienes de uso personal** (numeral 7) sí aplica, **pero solo cuando el sello está roto**. Un frasco sellado y sin abrir puede revenderse, de modo que el fundamento de la excepción desaparece. Además existe doctrina de la Superintendencia en el sentido de que invocar esta excepción exige acreditarla, no basta afirmarla.

**Regla operativa:**

| Estado del producto | Dentro de 5 días hábiles |
|---|---|
| Sellado, sin abrir | El retracto **procede**. CNV lo honra. |
| Sello roto o envase abierto | El retracto **no procede**, por bien de uso personal. El sello es la evidencia que lo acredita. |

**El reintegro incluye el flete.** El artículo exige devolver "todas las sumas pagadas sin descuentos ni retenciones por concepto alguno". CNV asume el costo del envío de ida y no lo recupera. La devolución del producto corre por cuenta del consumidor, en las mismas condiciones en que lo recibió.

**Texto para publicar en Atlas y en el reporte del paciente:**

> *Derecho de retracto. Si su compra fue entregada a domicilio, usted puede retractarse dentro de los cinco (5) días hábiles siguientes a la entrega, conforme al artículo 47 de la Ley 1480 de 2011, siempre que el producto se encuentre sin abrir y con su sello original intacto. En ese caso se le reintegrará la totalidad de lo pagado, incluido el valor del envío. Los productos con el sello roto o el envase abierto se encuentran exceptuados del retracto por tratarse de bienes de uso personal, conforme al numeral 7 del mismo artículo. La devolución del producto corre por cuenta del consumidor, en las mismas condiciones en que lo recibió.*

**Tratamiento contable del retracto ejercido** (aplica bajo Comisión):

1. CNV emite **nota crédito** al paciente por el total facturado, incluido el flete si aplica.
2. Se **reversa la comisión** causada al Integrante. Si ya fue liquidada y pagada, se descuenta en la liquidación siguiente.
3. El producto devuelto **reingresa al inventario** de CNV, previa verificación de estado. Si no es apto para reventa, se da de baja contra gasto.
4. El IVA de la nota crédito ajusta la declaración del período en que se emite.

Atlas debe soportar este flujo completo, con estados, y no permitir que la reversión de comisión quede manual.

---

## 6. Reglas comunes a ambas modalidades

**Faltantes.** Se cobran al **precio de facturación** (precio base menos 20%), no al PVP completo. El 20% es margen del Integrante que en un faltante nadie ganó; cobrar el PVP sería cobrar una utilidad inexistente. El desincentivo se mantiene intacto, porque quien pierde el producto paga sin recibir nada del paciente.

El faltante se trata como **responsabilidad del depositario por pérdida de mercancía en custodia**, no como compra. No se factura como venta ni lleva IVA: es cuenta de cobro por indemnización.

**Redacción contractual (validada).** Para que el documento y la operación digan lo mismo, el Anexo 2 debe recoger esta figura en los siguientes términos:

> *EL INTEGRANTE recibe y conserva los productos en calidad de depositario, por cuenta y riesgo de CNV, y responde por su pérdida, sustracción, destrucción o deterioro mientras permanezcan bajo su custodia, salvo caso fortuito o fuerza mayor debidamente acreditados.*
>
> *Verificada la pérdida y vencido el plazo de justificación previsto en el Reglamento Operativo sin que se acredite una causa exonerativa, EL INTEGRANTE indemnizará a CNV el valor de la mercancía perdida. Para liquidar esa indemnización las partes adoptan como referencia el precio de facturación vigente del producto, entendido como el precio de venta al público menos el descuento comercial aplicable.*
>
> *Esta indemnización resarce a CNV la pérdida del bien y no constituye compraventa: no transfiere a EL INTEGRANTE la propiedad de los productos perdidos, no genera comisión ni descuento comercial a su favor, y no se documenta mediante factura de venta.*

Tres elementos son deliberados: el verbo es "indemnizará", no "pagará el precio"; el precio de facturación aparece como **método de liquidación** y no como precio de una operación; y el último párrafo niega expresamente los tres rasgos que caracterizarían una venta. La coherencia entre el papel y la práctica es lo que protege: si alguien emite una factura de venta por un faltante, el texto deja de servir.

**Tratamiento contable del faltante:** el producto se da de baja del inventario contra una cuenta por cobrar al Integrante. La diferencia entre el valor cobrado y el costo del inventario se registra como recuperación, no como ingreso operacional por venta. **No genera factura de venta, no genera IVA, no genera comisión.** Modelarlo en el sistema como concepto de ajuste de liquidación, nunca como venta.

**Flujo de faltante:** detección en conteo físico, reporte inmediato, plazo de justificación de cinco días hábiles. Si se justifica, ajuste sin cargo. Si no, se incorpora a la liquidación o factura del período siguiente. El sistema no debe cobrar automáticamente al detectar la diferencia: debe abrir un caso con estados.

**Vencidos.** El producto no vendido que se vence lo asume CNV, por conservar la propiedad, **salvo** que Atlas haya generado la alerta de vencimiento y el Integrante no haya actuado, caso en el cual lo asume él al precio de facturación, con el mismo tratamiento del faltante.

**Alerta de vencimiento.** El sistema alerta con sesenta días de anticipación sobre el vencimiento de cada lote en poder de un Integrante, y registra si la alerta fue vista y atendida. Ese registro es lo que determina quién asume el vencido.

**Devoluciones.** Producto no vendido que vuelve a CNV es solo movimiento de inventario, sin efecto de venta, porque nunca se facturó. Basta acta de devolución. Distinto es un producto ya facturado bajo Distribución, que sí requiere **nota crédito**.

**Conteo físico y conciliación.** Se mantienen en ambas modalidades. Es el único control que detecta ventas no registradas, y bajo Distribución esa detección importa más, porque una venta no registrada es producto de CNV que salió sin factura.

**PVP sugerido visible al paciente.** En Atlas y en el reporte del paciente debe aparecer como "Precio de venta al público sugerido por CNV". Bajo Distribución, CNV no puede imponer el precio de reventa (sería fijación de precios), pero mostrarlo al paciente es presión de mercado legítima y es el mecanismo real de consistencia.

**Política de precios documentada.** El descuento del 20% bajo Distribución debe constar como política comercial escrita, con condiciones objetivas de acceso, aplicable por igual a todo Integrante que las cumpla, y aprobada en acta. Esto es lo que evita que se interprete como precio discrecional entre partes relacionadas. Otorgar porcentajes distintos a Integrantes en la misma condición, sin justificación documentada, debilita esa defensa.

**Contenido mínimo de esa política (validado).** No es una cláusula del anexo, es un documento corporativo aparte. Debe contener:

- **Objeto:** las condiciones objetivas bajo las cuales CNV otorga descuento comercial sobre el PVP de su línea de nutracéuticos.
- **Condiciones de acceso verificables:** operar bajo modalidad Distribución, ser responsable de IVA, estar habilitado como facturador electrónico, aceptar cupo y plazos, estar al día. Quien las cumple accede; quien no, no.
- **Porcentaje único** para todos los que cumplan, con mención expresa de que no se otorgan porcentajes diferenciados a Integrantes en la misma situación.
- **Mecanismo de modificación:** quién puede ajustarlo, con qué preaviso y con qué formalidad.
- **Excepciones, si las hubiera**, con el criterio objetivo que las justifica (por ejemplo, volumen mínimo). Lo que debilita la política no es tener escalas, sino tenerlas sin criterio escrito.
- **Aprobación en acta** del órgano competente, con fecha.

El punto de fondo: una política escrita y aplicada uniformemente permite sostener que el descuento es una condición comercial general y no un precio acordado de forma discrecional con partes conocidas. Esto adquiere especial relevancia cuando un Integrante es a la vez proveedor de CNV.

**Garantía legal del producto bajo Distribución.** Al ser el Integrante el expendedor frente al paciente, le corresponde atender no solo el retracto sino la garantía legal de la Ley 1480. Para que no quede solo frente a un reclamo que no puede resolver, el Anexo 2 debe establecer que **CNV, como titular de la marca, responde frente al Integrante por defectos de fabricación, composición o etiquetado**, y le presta soporte en la atención de reclamos de calidad del producto. El Integrante responde por la custodia y la conservación; CNV, por lo que el producto es.

**Datos del paciente en la facturación.** A la contabilidad solo viajan datos de identificación y contacto: nombre, tipo y número de documento, correo. **Nunca información clínica.** El nombre del producto en la factura no debe revelar condición de salud. El campo de observaciones de la factura no debe usarse para contenido clínico.

---

## 7. Productos de terceros en el portafolio

CNV puede incorporar al portafolio productos que no son de su marca, recibidos en consignación de un proveedor externo. El caso vigente es **LUVIA (fibra funcional con probióticos)**, recibido en consignación de Centro de Nutrición Integral Katherine Ruiz S.A.S.

### 7.1. La cadena de consignación es doble

Esta es la diferencia estructural con los productos propios:

**Proveedor externo → CNV → Integrante → paciente**

CNV es **consignatario** frente al proveedor y **consignante** frente al Integrante. El producto nunca es de CNV: es del proveedor hasta la venta al paciente. CNV no compra, custodia y coloca.

Esto tiene una consecuencia que conviene tener presente: **CNV no puede devolver al proveedor un producto que se perdió en poder de un Integrante.** Si eso ocurre, CNV le debe al proveedor su participación, con independencia de que logre o no cobrarle al Integrante.

### 7.2. Reparto del precio

**El reparto se calcula sobre la base sin IVA**, igual que en los productos propios. El IVA no es de ninguna de las partes: es recaudo en tránsito hacia la DIAN y no puede repartirse.

Sobre el caso LUVIA, con PVP de referencia de 90.000 (base 75.630, IVA 14.370):

| Parte | Participación | Sobre base | Observación |
|---|---|---|---|
| Proveedor externo | 70% | 52.941 | Factura a CNV 63.000 (52.941 + IVA 10.059) |
| Integrante | 20% | 15.126 | Comisión o descuento, según su modalidad |
| CNV | 10% | 7.563 | Margen bruto |
| | | **75.630** | Suma igual a la base |

**Error a evitar:** aplicar los porcentajes sobre el PVP con IVA. Con 90.000 daría 63.000 / 18.000 / 9.000, lo que significaría repartir entre las partes 14.370 que pertenecen a la DIAN, y pagarle al Integrante 2.874 de más por unidad. El atajo de multiplicar el PVP por 0,70 sirve únicamente para obtener el **total facturado por el proveedor con IVA incluido**, no su participación.

El Integrante recibe la **misma participación** que en los productos propios, de modo que para él la operación es indistinta. La diferencia la absorbe CNV, que pasa de su margen habitual a un 10%.

**Nota financiera para revisión.** CNV asume sobre estos productos el mismo costo operativo que sobre los propios (inventario, logística, facturación, conciliación, exposición de responsabilidad) con una fracción del margen. Tres datos concretos:

- **Costo de la pasarela.** Bajo modalidad Comisión, CNV recauda el PVP completo y la pasarela cobra su comisión sobre ese total, no sobre el margen de CNV. Con una tarifa del 2,5%, son 2.250 sobre 90.000, de modo que **el margen neto por unidad cae de 7.563 a 5.313**: la pasarela absorbe cerca del 30% de la participación de CNV, porque está recaudando un dinero que en un 70% pertenece a un tercero.
- **Domicilio de una unidad.** Genera 7.563 de margen bruto contra un flete de valor comparable o superior.
- **Retracto ejercido.** Deja pérdida neta: CNV reintegra el flete completo y la comisión de la pasarela ya se causó.

Conviene evaluar si el 10% cubre el costo de servir estos productos. Dos ajustes posibles, en orden de facilidad para negociar: que el costo de la pasarela se descuente del PVP antes del reparto, de modo que cada parte lo asuma en proporción a su participación; o condicionar estos productos a pedidos de más de una unidad cuando hay domicilio.

### 7.3. Ruta de facturación y tratamiento tributario

Existen dos rutas posibles para estructurar esta operación. **CNV adopta la primera**, y esta definición es vinculante para la implementación.

**Ruta adoptada: compraventa encadenada contra reporte de ventas.**

1. El producto permanece en consignación física. La entrega del proveedor a CNV **no constituye venta** y no genera documento fiscal.
2. Al corte, CNV reporta al proveedor las unidades efectivamente vendidas.
3. El proveedor **emite factura electrónica a CNV** por esas unidades, con IVA discriminado.
4. CNV **factura al paciente el PVP completo**, con IVA. En el momento de la venta el producto ya es de CNV, de modo que no está facturando bien ajeno.
5. CNV paga la factura del proveedor **practicando retención en la fuente** y emitiendo el certificado.

**Por qué esta ruta y no la alternativa.** La otra opción sería que CNV facturara al proveedor una comisión por servicio de comercialización y el proveedor facturara al paciente. Se descarta porque obligaría al paciente a un segundo checkout, dejaría a CNV sin control del cobro, y trasladaría al proveedor la relación de consumo con un paciente que nunca contrató con él.

**El IVA es neutro para CNV.** Cobra 14.370 al paciente, paga 10.059 al proveedor, y gira a la DIAN la diferencia de 4.311. El proveedor gira sus 10.059. La DIAN recibe el impuesto completo, una sola vez, repartido en dos eslabones.

**Retención al proveedor externo.** CNV es agente de retención y practica **retefuente por compra de bienes del 2,5%** sobre la base, cuando la factura supere la base mínima de 27 UVT. Sobre 52.941 por unidad, una factura alcanza esa base a partir de aproximadamente 27 unidades; por debajo de ese volumen no hay retención. Si el proveedor está en municipio con reteICA aplicable, verificar también esa retención.

| Concepto (por unidad) | Valor |
|---|---|
| Factura del proveedor a CNV | 63.000 |
| Base | 52.941 |
| IVA 19% | 10.059 |
| Retefuente 2,5% sobre base (si supera base mínima) | −1.324 |
| **Neto girado al proveedor** | **61.676** |

**Reconocimiento contable.** La compra al proveedor y la venta al paciente ocurren en el mismo acto económico. CNV registra simultáneamente el costo de la mercancía y el ingreso por la venta; no hay inventario propio en ningún momento intermedio.

### 7.4. Productos de tercero bajo modalidad Distribución

El esquema funciona igual, con un eslabón adicional. La cadena pasa a ser **proveedor → CNV → Integrante → paciente**, con dos facturaciones de por medio:

- El proveedor factura a CNV el 70% de la base más IVA.
- CNV factura al Integrante el 80% de la base más IVA (PVP menos su descuento comercial del 20%).
- El Integrante factura al paciente el PVP que él defina.

El margen de CNV sigue siendo el 10% de la base y el del Integrante el 20%. La diferencia respecto a Comisión es quién factura al paciente y quién asume la relación de consumo.

**Advertencia para el diseño:** bajo Distribución, CNV pierde visibilidad del precio final al que se vende un producto de tercero. Si el contrato con el proveedor fija un PVP de referencia, CNV solo puede sugerirlo al Integrante, no imponerlo. Esto debe advertirse al proveedor antes de habilitar su producto para Integrantes en esta modalidad.

### 7.5. Faltantes, vencidos, devoluciones y retractos de producto de tercero

Aquí está la diferencia estructural con el producto propio, y el sistema debe tratarla distinto.

**Faltante: son dos obligaciones encadenadas, no una.**

- **CNV frente al proveedor:** CNV custodia el producto y responde por él. Si se pierde, CNV le debe su participación al proveedor, con independencia de que logre cobrarle al Integrante.
- **CNV frente al Integrante:** el Integrante custodia lo que CNV le entregó y responde ante CNV.

No es doble cobro: son dos custodias encadenadas y cada quien responde por la suya. Los valores son distintos, porque cada eslabón responde por lo que dejó de percibir el siguiente:

| Relación | Valor |
|---|---|
| CNV le paga al proveedor | Su participación: 52.941 + IVA |
| CNV le cobra al Integrante | Precio de facturación: PVP menos 20% |

**Con producto propio, un faltante le cuesta a CNV su costo de inventario. Con producto de tercero, le obliga a desembolsar dinero a favor de un tercero.** Es una situación peor y el sistema debe hacerla visible: la alerta de faltante de producto de tercero debe diferenciarse de la de producto propio.

**Vencidos.** El producto de tercero vencido se reversa al proveedor sin cargo para CNV, según la cláusula correspondiente del contrato de suministro. Si el vencimiento ocurrió por inacción de un Integrante pese a la alerta, CNV le cobra a él con el mismo tratamiento del faltante, y responde ante el proveedor según lo pactado.

**Devoluciones de inventario no vendido.** Acta de devolución, sin efecto fiscal, porque nunca se facturó. Se registra contra el lote correspondiente para que la conciliación cuadre.

**Retracto o devolución de venta ya facturada: cadena de notas crédito.** Como hubo dos facturas, hay que revertir las dos:

1. CNV emite **nota crédito al paciente** por el total, incluido el flete.
2. El **proveedor emite nota crédito a CNV** por esa unidad. Esto debe quedar expresamente en el contrato de suministro; sin esa cláusula, CNV reintegra al paciente y no recupera nada del proveedor.
3. Se **reversa la comisión** del Integrante.
4. El producto **reingresa a la consignación** del proveedor, previa verificación de estado.

Atlas debe soportar la cadena completa y no permitir que ningún eslabón quede manual.

### 7.6. Criterios de admisión al portafolio

Solo se incorporan productos que cumplan, de forma acumulativa:

- **Respaldo científico** del ingrediente activo y de su uso en la indicación propuesta. El registro sanitario INVIMA es un requisito regulatorio mínimo, no evidencia científica: son cosas distintas y ambas deben verificarse.
- **No competencia** con el portafolio propio del modelo. Un producto de tercero complementa, no sustituye.
- **Compatibilidad con el modelo ANI-BIS-E**, de modo que su recomendación pueda sustentarse en los indicadores del modelo.
- **Registro sanitario vigente** y trazabilidad completa por lote y fecha de vencimiento.
- **Contrato de suministro suscrito** con el proveedor, con las condiciones de la sección 7.5.

La decisión de admisión corresponde a la dirección científica y debe quedar documentada, con el criterio aplicado en cada caso. Sin ese registro, la admisión de un producto de un proveedor que además es Integrante de la red es difícil de explicar.

### 7.7. Responsabilidad frente al paciente

Bajo la Ley 1480, el productor y el expendedor responden **solidariamente** frente al consumidor. En una cadena de cuatro eslabones, cualquiera puede ser demandado sin que el paciente deba probar de quién fue la culpa.

**El punto crítico es la doctrina del fabricante aparente.** El artículo 20 presume productor a quien pone su marca o signo distintivo en el producto. Si LUVIA se presenta al paciente sin distinguirlo con claridad de la línea propia de CNV, un juez podría tratar a CNV como su fabricante.

**Por eso Atlas debe exigir, sin excepción:** que en la ficha del producto, en el reporte del paciente y en la factura, el producto de tercero aparezca identificado con **el nombre de su titular de marca**, y nunca con el mismo tratamiento visual que la línea propia. La distinción debe ser evidente para el paciente, no una nota al pie.

**Indicaciones de uso.** El profesional debe seguir las indicaciones del fabricante del producto, no las del Reglamento Operativo del modelo, que está construido para la línea propia.

**Alérgenos. EN CONFLICTO ABIERTO desde el 2026-09-11; este párrafo NO está implementado y no se implementa hasta que el asesor legal responda.** El texto original se conserva íntegro abajo porque es lo que pasó revisión; lo que cambió es su estado, no su contenido.

> LUVIA contiene avena, y por tanto gluten. Atlas ya captura las alergias declaradas del paciente, de modo que existe un deber reforzado: no basta mostrar el alérgeno, el sistema debe **bloquear activamente** la recomendación a un paciente con intolerancia declarada, exigiendo confirmación afirmativa del profesional para continuar y registrando quién la dio. Este control debe ser obligatorio para todo producto de tercero con alérgenos declarados.

**Dirección Científica instruyó lo contrario, dos veces** (27 de agosto y 11 de septiembre): sin bloqueo, sin confirmación y sin registro, porque traducir un ingrediente a una alergia es contenido clínico que su modelo no tiene, y porque un cruce que no detecta un alimento que lleva el alérgeno sin nombrarlo *"no le quita la responsabilidad a CNV: la esconde detrás de una pantalla que el profesional aprende a creerle"*.

**No es una discrepancia clínica, es de responsabilidad frente al consumidor**, así que no la decide ninguno de los dos: va al asesor legal en **`docs/entregas/RESUMEN_LEGAL_ALERGENO_LUVIA.md`**, con las tres preguntas concretas y lo que costaría construirlo. **Mientras tanto manda su instrucción**, que es la autoridad sobre el contenido clínico, y **LUVIA está habilitada** (migración `0126`).

**Lo que de esta misma §7.7 sí se cumple y no está en disputa:** el titular de marca del producto de tercero aparece en la ficha, el reporte y la factura.

### 7.8. Contrato con el proveedor externo

**Estado actual: no existe.** La relación con el proveedor de LUVIA opera hoy sobre un soporte de entrega en consignación, que es un control interno de bodega y no un contrato. El producto ya está en poder de CNV. Esto debe resolverse antes de un segundo envío o de ampliar volumen.

**Régimen de piloto.** CNV opera esta primera entrega como piloto, con el fin de validar la operación antes de contratar. Un piloto sin límites escritos se convierte en la operación permanente sin papeles, de modo que estos límites son parte de la decisión:

| Límite | Definición |
|---|---|
| Volumen | Las unidades ya recibidas. No se reciben nuevas entregas sin contrato firmado |
| Duración | Hasta agotar o devolver esas unidades |
| Modalidad | Solo modalidad Comisión. No se habilita bajo Distribución durante el piloto |
| Domicilio | No se ofrece envío a domicilio de producto de tercero durante el piloto |
| Integrantes | Número acotado, definido por la administración |

**Acuerdo mínimo por escrito antes de la primera venta.** Aunque el contrato completo llegue después, estos seis puntos deben quedar confirmados por escrito, aunque sea por correo con acuse:

1. Reparto del precio (70 / 20 / 10 sobre base sin IVA).
2. Que el proveedor factura a CNV las unidades vendidas, y CNV factura al paciente.
3. Periodicidad del reporte y de la facturación.
4. Plazo máximo de consignación y manejo de lo no vendido.
5. Quién asume el producto vencido.
6. Que el proveedor emite nota crédito a CNV cuando un paciente se retracta o devuelve.

**Verificación previa:** confirmar si el proveedor tiene relación formal con el laboratorio maquilador y si es el titular del registro sanitario. El registro sanitario de LUVIA debe estar verificado **antes de la primera venta**, porque bajo la ruta adoptada CNV es quien factura al paciente y por tanto quien figura como vendedor.

**Verificación previa:** confirmar si el proveedor tiene relación formal con el laboratorio maquilador y si es el titular del registro sanitario. Si el titular es el laboratorio, hay una desconexión entre quién responde ante INVIMA y quién aparece como dueño de la marca, que debe quedar clara antes de contratar. Cualquier indemnidad que ofrezca un proveedor que no tenga garantías propias detrás es una promesa sin respaldo.

**Contenido mínimo del contrato:**

- Responsabilidad del proveedor por seguridad, composición e idoneidad del producto, y mantenimiento del registro sanitario vigente.
- Indemnidad a favor de CNV por reclamos derivados de defectos de fabricación, composición o etiquetado no atribuibles al manejo de CNV o de su red.
- Garantía de exactitud de la información de alérgenos, ingredientes y contraindicaciones, con autorización para trasladarla al paciente a través de Atlas.
- Procedimiento de retiro de producto: notificación inmediata ante cualquier alerta sanitaria. CNV puede comprometerse a trazar y notificar a los pacientes del lote afectado, capacidad que ya tiene porque Atlas vincula paciente, producto y lote.
- Manejo de vencidos y no vendidos: reversión al proveedor sin cargo para CNV, con devolución preferiblemente tres o cuatro meses antes del vencimiento.
- Precio de consignación explícito como cláusula, no como cifra implícita en un recibo.
- Seguro de responsabilidad civil de producto vigente, con constancia de cobertura.

### 7.9. Conflicto de interés cuando el proveedor es Integrante

El proveedor de LUVIA es a la vez Integrante de la red. No es un impedimento, pero **debe quedar documentado**: las condiciones comerciales de admisión del producto y el reparto del precio deben responder a criterios objetivos aplicables a cualquier proveedor en la misma situación, no a la relación existente.

Esto conecta con la política de precios de la sección 6: la defensa frente a una eventual objeción es la uniformidad documentada del criterio, no la buena fe de las partes.

### 7.10. Qué necesita Atlas

- Marcar cada producto del portafolio como **propio** o **de tercero**, con el titular de marca y el proveedor asociados. Esta marca condiciona el comportamiento en inventario, liquidación, faltantes y alertas, no solo la presentación.
- **Esquema de reparto configurable por producto y por proveedor**, calculado siempre sobre base sin IVA. No dejar porcentajes fijos en el código: no todos los terceros tendrán el mismo reparto.
- **Proveedor externo como entidad**, con su perfil tributario (documento con DV, responsable de IVA, agente de retención) y su ciclo de corte.
- **Reporte de unidades vendidas por período y por proveedor**, con base e IVA discriminados por unidad, que es el insumo con el que el proveedor emite su factura. Conservarlo como soporte del cruce.
- Liquidación al proveedor externo por lo efectivamente vendido. **Ciclo quincenal, alineado con el de Distribución y el de consignación de efectivo**, para operar un solo calendario.
- Inventario de producto de tercero **en control físico, sin valor contable propio**: recibidas, vendidas, devueltas, faltantes y saldo en poder de cada Integrante, por lote.
- Identificación visual diferenciada del producto de tercero en ficha, reporte y factura.
- Bloqueo activo por alérgeno declarado, con confirmación registrada.
- Trazabilidad por lote hasta el paciente, para retiros dirigidos.
- **Alerta diferenciada de faltante de producto de tercero**, por implicar desembolso a favor de un proveedor.
- Cadena de notas crédito para retractos y devoluciones de venta.
- Bandera de disponibilidad por modalidad y por canal, para poder restringir un producto de tercero a modalidad Comisión y sin domicilio durante un piloto.

---

## 8. Flujo en Atlas

El flujo clínico es idéntico hasta el punto de tratamiento. La bifurcación ocurre después.

**Tramo común:**

1. El profesional inicia la evaluación con el paciente.
2. Llega a tratamiento y selecciona los nutracéuticos.
3. Define dosis y días.
4. Atlas pregunta si el paciente los adquiere: sí, no (con motivo), o aún no decide.

**Si adquiere, Atlas pregunta la forma de entrega:**

- **En consulta:** valida disponibilidad en la bodega del Integrante.
- **A domicilio:** valida disponibilidad en la **bodega central** y que la ciudad esté habilitada. Captura dirección, ciudad, teléfono y nombre de quien recibe. Agrega el flete.

**Validación de inventario obligatoria.** Atlas no debe permitir cerrar una venta a domicilio si no hay existencias en bodega central. Sin esa validación es posible vender lo que no se tiene, y el problema no aparece hasta que hay varias órdenes pendientes sin producto.

**Captura obligatoria de datos de facturación.** Bajo Comisión, la factura electrónica exige **tipo y número de documento del paciente** más correo. Atlas debe exigirlos al armar la venta, no antes, para no estorbar el flujo clínico, pero sí antes de generar el cobro.

**Entonces se bifurca según la modalidad:**

- **Comisión:** se abre el checkout de la pasarela por el total (producto más flete si aplica). Al confirmarse el pago, Atlas genera la factura al paciente y descuenta inventario de la ubicación correspondiente.
- **Distribución:** no hay checkout de CNV. Atlas registra la venta, descuenta inventario y deja el registro en cola para la facturación quincenal al Integrante. El pago del paciente ocurre fuera de Atlas, por los medios del Integrante.

**Si hubo domicilio**, en ambos casos se genera una orden de despacho para la bodega central, con estado (pendiente, despachado, entregado) y número de guía.

---

## 9. Lo que Atlas necesita construir

**Modelo de datos**

- Modalidad vigente por Integrante, con historial y fecha de vigencia.
- **Perfil tributario del Integrante:** tipo de persona, documento con DV, responsable de IVA (sí/no), obligado a facturar (sí/no), agente de retención (código 07, sí/no), acumulado anual de comisiones pagadas, y cuenta bancaria con titular validado contra su documento.
- Ubicaciones de inventario: bodega central y una por Integrante, con existencias por producto y **lote con fecha de vencimiento**.
- Cupo de crédito y saldo pendiente por Integrante (solo Distribución).
- Saldo de efectivo pendiente de consignar por Integrante (solo Comisión, canal efectivo).
- Registro de venta con producto, lote, cantidad, paciente, precio, canal de pago, forma de entrega, fecha, municipio de destino, Integrante y ubicación de descuento.
- Orden de despacho con dirección, estado y guía.
- Estado de faltante con máquina de estados.
- Datos fiscales de cada documento emitido: CUFE, número, estado DIAN.

**Funcionalidad**

- Perfil del Integrante con las dos cards de modalidad, y asignación por parte de un administrador.
- Validación de inventario antes de permitir la venta, diferenciada por ubicación.
- Lista de ciudades habilitadas para domicilio.
- Consolidado de corte quincenal para Distribución, con detalle por venta.
- Cálculo de saldo pendiente y bloqueo automático de despacho al alcanzar el cupo.
- Alertas de mora a los tres y diez días.
- Liquidación mensual con compensación para Comisión, admitiendo saldo neto negativo.
- **Cálculo de comisión con IVA y retención**, según el perfil tributario del Integrante, con cambio automático de tarifa al superar el umbral anual.
- **Generación del certificado de retención** por cada retención practicada.
- Reporte de inventario exportable por Integrante, fechado.
- Alertas de vencimiento a sesenta días, con registro de si fueron vistas y atendidas.
- Flujo de retracto con reversión de comisión y reingreso a inventario.
- Enlace de pago dinámico por venta, renderizable como código QR en pantalla.

**Sobre el QR:** el enlace de pago que Atlas genera puede mostrarse como código QR sin ninguna dependencia externa, ya que cualquier URL se puede codificar así. Esto da la experiencia de "escanear y pagar" que piden los profesionales, conservando la trazabilidad completa. **No usar QR estáticos a la cuenta bancaria:** no confirman el pago, no vinculan la transacción con la venta ni con el paciente, y obligan al paciente a digitar el monto.

---

## 10. Integración con Alegra

Necesidades funcionales. Los detalles técnicos deben contrastarse con la documentación vigente de la API antes de estimar.

### 10.1. Reglas transversales

**Los identificadores de Alegra son distintos entre sandbox y producción.** Todo ID de producto, impuesto, numeración, bodega y centro de costo debe re-mapearse al pasar a producción. No dejar identificadores fijos en el código.

**El IVA se hereda de la configuración del producto en Alegra**, no se calcula en Atlas. Cada producto debe existir en Alegra con su tarifa correcta y su código de identificación (evita la observación FAZ09 de la DIAN).

**El consecutivo lo asigna siempre Alegra.** Atlas nunca genera números de factura.

**Prefijos diferenciados.** Conviene una numeración distinta para las facturas generadas automáticamente por Atlas y las emitidas manualmente, para evitar choques de consecutivo y facilitar la conciliación.

**Idempotencia.** Una venta genera una y solo una factura. Ante timeout, reintento o doble confirmación de la pasarela, el sistema no debe duplicar documentos.

**Tolerancia a fallos.** Si Alegra o la DIAN no responden, la venta se sella en Atlas y la emisión se encola para reintento. La operación clínica nunca se bloquea por una falla de facturación.

**Estados de la DIAN.** Tratar "aprobada con observaciones" como documento válido: no reintentar ni duplicar. Solo "rechazada" obliga a corregir y reemitir.

**Centro de costo.** Todas las operaciones de esta línea se asignan al centro de costo de nutracéuticos.

### 10.2. Documentos por flujo

| Operación | Documento | Emite |
|---|---|---|
| Venta a paciente (Comisión) | Factura electrónica de venta | CNV |
| Corte quincenal (Distribución) | Factura electrónica de venta al Integrante | CNV |
| Comisión del Integrante obligado a facturar | Factura electrónica | El Integrante |
| Comisión del Integrante no obligado a facturar | Documento soporte electrónico | CNV |
| Retención practicada | Certificado de retención | CNV |
| Devolución, retracto o corrección | Nota crédito | Quien emitió el documento original |
| Faltante o vencido a cargo del Integrante | Cuenta de cobro, sin IVA | CNV |
| Devolución de inventario no vendido | Acta de devolución, sin efecto fiscal | Ambas partes |
| Entrega en consignación de un proveedor externo | Acta o soporte de entrega, sin efecto fiscal | Ambas partes |
| Corte de producto de tercero vendido | Factura electrónica de venta a CNV | El proveedor externo |
| Retención practicada al proveedor externo | Certificado de retención | CNV |
| Retracto de producto de tercero | Nota crédito al paciente **y** nota crédito del proveedor a CNV | Cada emisor sobre su propia factura |

### 10.3. Detalle por operación

**Facturación bajo Distribución.** Al cierre de cada corte, generar factura de venta al Integrante con: el Integrante como tercero, un renglón por producto con cantidad y precio base, el descuento comercial del 20% como línea de descuento (no como precio ya rebajado), IVA del 19% sobre la base descontada, y un renglón por los fletes del período con su IVA. Adjuntar o referenciar el detalle de las ventas que la componen, porque el Integrante tiene derecho a objetar de forma sustentada.

Registrar el descuento como línea explícita, y no como precio rebajado, documenta que el 20% es política comercial y no un precio discrecional.

**Facturación bajo Comisión.** La venta al paciente la factura CNV al confirmarse el pago en la pasarela. El flete, cuando aplique, va como línea adicional con IVA.

**Pago de la comisión.** Según el perfil del Integrante, se recibe su factura o CNV emite documento soporte. En ambos casos CNV practica la retención que corresponda y emite el certificado.

**Cuentas de cobro por faltantes.** No van como factura de venta ni llevan IVA. Verificar el mecanismo disponible en Alegra para este tipo de documento, porque emitirlo como factura de venta sería incorrecto fiscalmente.

**Inventario de producto propio.** El producto despachado y no vendido sigue en el balance de CNV como inventario en poder de terceros, en cuenta o bodega separada del inventario en sede propia. Conviene una bodega por Integrante más la central, que Atlas concilie.

**Inventario de producto de tercero: no va al balance de CNV.** El producto en consignación de un proveedor externo no es propiedad de CNV en ningún momento, de modo que **no se registra como inventario valorizado**: va en cuentas de orden, o como bodega de control sin valor. Al venderse, entra como compra y sale de inmediato como costo de venta, en el mismo acto.

Registrarlo como inventario propio inflaría el activo de CNV con mercancía ajena. Esta distinción debe existir tanto en Alegra como en Atlas.

**Operaciones con proveedores externos.** Registrar la factura de compra que emite el proveedor, con su IVA descontable, y la retención practicada con su certificado. El proveedor se crea como tercero con su perfil tributario completo.

### 10.4. Reconocimiento del ingreso y corte contable

**El ingreso se reconoce cuando se transfiere el control al paciente**, es decir, en el momento de la venta, en ambas modalidades. El corte quincenal de Distribución es una agrupación administrativa para facturar, no el momento del reconocimiento.

**Consecuencia para los cierres de mes:** las ventas de los últimos días del mes se reconocen en ese mes, aunque su factura se emita en los primeros días del siguiente. Lo mismo aplica al IVA, que se causa en la fecha más temprana entre entrega, factura o pago (artículo 429 del Estatuto Tributario).

Atlas debe poder generar el **detalle de ventas por fecha de operación**, no solo por fecha de facturación, para que el cierre contable mensual sea correcto.

---

## 11. Directrices de implementación

Esta sección define cómo se construye lo anterior. No es una recomendación de estilo: son las condiciones bajo las cuales el modelo funciona.

### 11.1. Principios no negociables

**Uno. El reparto se calcula siempre sobre la base sin IVA.** Comisión, descuento comercial y participación de proveedor. El IVA no es de ninguna de las partes. Cualquier cálculo que parta del precio con IVA está mal, aunque el total coincida por casualidad.

**Dos. Nada de valores fijos en el código.** Van en configuración, porque todos cambian: porcentajes de reparto (por producto y proveedor), tarifas de retención y su umbral anual, tarifa de IVA por producto, tarifa de flete, días de alerta de vencimiento, plazos de pago y mora, cupos de crédito.

**Tres. Producto propio y producto de tercero se distinguen en todo el flujo.** No es una etiqueta de presentación: cambia el tratamiento de inventario, de liquidación, de faltantes y de alertas. Modelar la distinción desde el primer día, aunque hoy solo exista un producto de tercero.

**Cuatro. La operación clínica nunca se bloquea por una falla de facturación.** Si Alegra o la DIAN no responden, la venta se sella en Atlas y la emisión se encola. La única excepción es la validación de inventario, que sí debe bloquear, porque vender lo que no se tiene crea un problema mayor.

**Cinco. Una venta genera un solo documento.** Idempotencia ante reintentos, timeouts y confirmaciones duplicadas de la pasarela.

**Seis. El faltante nunca es una venta.** No genera factura, ni IVA, ni comisión. Es un concepto de ajuste en la liquidación, con su propia máquina de estados.

**Siete. A la contabilidad solo viajan datos de identificación.** Nunca información clínica, ni en el nombre del producto, ni en observaciones, ni en campos libres.

**Ocho. Todo movimiento de inventario se registra contra un lote**, con su fecha de vencimiento. Sin lote no hay trazabilidad hasta el paciente, y sin trazabilidad no hay retiro dirigido posible.

### 11.2. Orden de construcción

Las fases están ordenadas por dependencia técnica y por urgencia operativa. Una fase no arranca sin que la anterior cumpla sus criterios de aceptación.

**Fase 0 — Cimientos.** Es lo que todo lo demás necesita y no produce nada visible por sí sola.

- Perfil tributario del Integrante, con los campos de la sección 9 y validaciones cruzadas.
- Catálogo con marca de propio / de tercero, titular de marca, proveedor y esquema de reparto configurable.
- Lotes con fecha de vencimiento y ubicaciones de inventario.
- Proveedor externo como entidad, con su perfil tributario.
- Re-mapeo de identificadores de Alegra de sandbox a producción.

*Criterio de aceptación:* se puede registrar un producto de tercero con su reparto, recibirlo por lote en una bodega, y consultar el saldo por ubicación.

**Fase 1 — Modalidad Comisión con producto propio y de tercero.** Es la operación que ya está corriendo y la que tiene producto en la calle.

- Venta, checkout, factura al paciente con captura de datos obligatoria.
- Descuento de inventario por lote y ubicación.
- **Bloqueo activo por alérgeno declarado.** No se difiere: hay producto con gluten ya entregado a Integrantes.
- Identificación visual diferenciada del producto de tercero.
- Canal efectivo con saldo pendiente de consignar por Integrante.

*Criterio de aceptación:* una venta de producto de tercero a un paciente con alergia declarada no se puede completar sin confirmación registrada del profesional; y la factura al paciente sale validada por la DIAN con el producto identificado con su titular de marca.

**Fase 2 — Liquidaciones.** Es donde se mueve el dinero y donde un error cuesta caro.

- Cálculo de comisión con IVA y retención según perfil, con acumulado anual y cambio de tarifa.
- Emisión o recepción del documento según el perfil del Integrante, y certificado de retención.
- Reporte quincenal al proveedor externo, con base e IVA discriminados.
- Faltantes con máquina de estados y alerta diferenciada para producto de tercero.
- Compensación con saldo neto, admitiendo saldo negativo.

*Criterio de aceptación:* una liquidación de prueba con tres Integrantes de perfiles tributarios distintos produce los tres documentos correctos y los tres netos correctos; y un faltante de producto de tercero genera las dos obligaciones separadas.

**Fase 3 — Modalidad Distribución.**

- Corte quincenal y facturación al Integrante con línea de descuento explícita.
- Cupo de crédito con bloqueo de despacho, mora y alertas.
- Flujo de objeción.
- Marca de agente retenedor para anticipar el neto.

*Criterio de aceptación:* la factura quincenal muestra precio base, descuento del 20% como línea propia, e IVA sobre la base descontada; y al alcanzar el cupo el sistema impide el despacho.

**Fase 4 — Envío a domicilio.**

- Bodega central, ciudades habilitadas, flete con IVA, órdenes de despacho con guía.
- Registro del municipio de destino.
- Flujo de retracto con cadena de notas crédito y reversión de comisión.

*Criterio de aceptación:* un retracto ejercido sobre una venta a domicilio revierte la factura, la comisión y el inventario sin intervención manual.

### 11.3. Lo que no se construye todavía

- **Domicilio de producto de tercero.** Excluido durante el piloto por la economía del flete contra un margen del 10%.
- **Producto de tercero bajo modalidad Distribución.** El modelo está definido en la sección 7.4, pero no se habilita hasta que exista contrato de suministro.
- **Múltiples proveedores externos simultáneos.** La estructura debe soportarlo, pero la operación arranca con uno.

### 11.4. Reportes que la contabilidad va a necesitar

Conviene preverlos desde el diseño, porque reconstruirlos después es costoso:

- Ventas **por fecha de operación**, no solo por fecha de facturación, para el corte contable mensual.
- Ventas por municipio de destino, para el análisis de ICA territorial.
- Inventario por ubicación, lote y titularidad (propio / de tercero), a una fecha dada.
- Liquidaciones por Integrante con detalle de comisión, IVA, retención y ajustes.
- Acumulado anual de pagos por Integrante, para el control del umbral de retención.
- Conciliación de efectivo por Integrante.
- Movimiento de producto de tercero por proveedor: recibido, vendido, devuelto, faltante, saldo.

---

## 12. Puntos abiertos

**Para validación contable:**

- Confirmación de tarifa de retención aplicable a comisiones y existencia de base mínima para ese concepto.
- Tratamiento del IVA sobre comisiones según el perfil de cada Integrante.
- Determinación de obligación de ICA en municipios de destino de domicilios.
- Aplicación de autorretención especial a título de renta sobre los ingresos de esta línea.
- Mecanismo de registro de las cuentas de cobro por faltantes en Alegra.

**Resueltos en esta versión (antes abiertos en validación legal):**

- Alcance del derecho de retracto en producto sellado: resuelto en la sección 5.7, con regla operativa y texto para publicar.
- Redacción contractual del faltante como responsabilidad del depositario: resuelta en la sección 6, con texto listo para el Anexo 2.
- Contenido mínimo de la política de precios y descuentos: resuelto en la sección 6.

**Resueltos en esta versión (productos de terceros, sección 7):**

- Ruta de facturación: se adopta la compraventa encadenada contra reporte de ventas. El proveedor factura a CNV lo vendido; CNV factura el 100% al paciente. Definida en la sección 7.3.
- Tratamiento de inventario de producto ajeno: cuentas de orden, sin valor contable propio. Definido en las secciones 7.3 y 10.3.
- Reconocimiento: la compra al proveedor y la venta al paciente ocurren en el mismo acto, sin inventario propio intermedio.
- Faltante de producto de tercero: dos obligaciones encadenadas con valores distintos. Definido en la sección 7.5.
- Corrección del reparto: se calcula sobre base sin IVA, no sobre PVP con IVA. Sección 7.2.

**Para validación contable y tributaria (productos de terceros):**

- Confirmación de la retención aplicable al proveedor externo y del efecto de la base mínima de 27 UVT en facturas de bajo volumen.
- Revelación requerida, si la hay, por mantener mercancía de terceros en custodia.
- **Decisión financiera pendiente:** suficiencia del margen del 10% frente al costo de servir estos productos. El dato central es que la comisión de la pasarela se calcula sobre el PVP completo y absorbe cerca del 30% de la participación de CNV. Opciones planteadas en la sección 7.2.

**Pendientes contractuales:**

- Contrato de suministro con el proveedor de LUVIA. **No existe hoy y el producto ya está en poder de CNV.** Es el pendiente más urgente de esta sección.
- Verificación de la titularidad del registro sanitario de LUVIA y de la relación del proveedor con el laboratorio maquilador.
- Documentación del criterio de admisión de productos de terceros y del conflicto de interés cuando el proveedor es Integrante.

**Bloqueantes antes de la primera venta de producto de tercero. ATENCIÓN: LUVIA quedó habilitada para venta el 2026-09-11 y estos dos siguen abiertos.** La habilitación resolvió el tercero de otra manera y no tocó los dos primeros, que no son clínicos y no los cierra Dirección Científica.

- **ABIERTO ·** Verificación del registro sanitario de LUVIA y de su titularidad.
- **ABIERTO ·** Acuerdo mínimo por escrito con el proveedor, según los seis puntos de la sección 7.8.
- **RESUELTO DE OTRA MANERA ·** El alérgeno declarado está cargado en Atlas (`0124`) y **se muestra tal como lo dice la ficha**; el bloqueo activo **no se construye**, por la instrucción de Dirección Científica del 27 de agosto y del 11 de septiembre. El conflicto con la §7.7 está en `docs/entregas/RESUMEN_LEGAL_ALERGENO_LUVIA.md`.

---

## 13. Las dos cards para el perfil del Integrante

Texto propuesto para la interfaz. La modalidad activa la asigna un administrador de CNV.

> **Nota de diseño:** ambas modalidades dejan al Integrante el mismo margen del 20%. Las diferencias reales son de operación, riesgo y carga administrativa, no de rentabilidad. Las cards deben transmitir eso, para que la decisión se tome por el criterio correcto.

### Modalidad Comisión

**CNV cobra al paciente y usted recibe una comisión.**

El paciente paga directamente a CNV a través del enlace de pago que genera Atlas. CNV emite la factura al paciente. Usted recibe su comisión en la liquidación mensual.

*Requisitos:* ninguno adicional a la vinculación.

*A favor:*
- No maneja facturación al paciente, ni notas crédito, ni pagos a CNV.
- No requiere ser responsable de IVA.
- Sin cupo de crédito ni plazos de pago que cumplir.
- No asume el riesgo de la relación de consumo con el paciente (garantías, retracto en ventas a domicilio).
- No necesita capital de trabajo: nunca le compra inventario a CNV.

*En contra:*
- Si usted también le cobra al paciente por consulta u otros productos, él hace dos pagos a dos destinatarios distintos.
- No define el precio de venta al público.
- **CNV le practica retención en la fuente sobre su comisión** (10% u 11% según su situación). No es un descuento de CNV: es un anticipo de su propio impuesto de renta, y usted recibe el certificado para descontarlo en su declaración.
- **Si usted es responsable de IVA, su comisión lleva IVA del 19%** y usted debe declararlo. Si está obligado a facturar, debe emitirle factura a CNV por cada liquidación.

### Modalidad Distribución

**Usted cobra y factura al paciente, y CNV le factura a usted.**

El paciente le paga a usted, y usted le factura con su propia facturación, en un solo documento junto con sus demás servicios o productos. Cada quincena CNV le factura los productos vendidos al precio base menos su descuento comercial, más IVA.

*Requisitos:* ser responsable de IVA y facturador electrónico habilitado, aceptar cupo de crédito y registro de ventas en Atlas, estar al día con CNV.

*A favor:*
- El paciente hace un solo pago por todo.
- Usted define el precio final de venta.
- Mayor control sobre su relación comercial con el paciente.
- **No le practicamos retención sobre su margen**, porque su ganancia es un descuento comercial, no un pago de CNV a usted.
- **El IVA que le facturamos es descontable para usted**, así que no es un costo: lo compensa con el IVA que cobra al paciente.
- Paga después de vender: la factura quincenal cubre solo lo efectivamente vendido en el período.

*En contra:*
- Asume su propia facturación al paciente y las notas crédito de estos productos.
- Recibe factura de CNV cada quincena y debe pagarla en el plazo acordado.
- Opera con un cupo de crédito que, al agotarse, suspende los despachos.
- **Asume la relación de consumo con el paciente:** garantías, reclamos y, en ventas a domicilio, el derecho de retracto.
- **Requiere estar al día en sus obligaciones tributarias**, porque usted es quien factura y declara el IVA de estas ventas.
- Si usted es agente de retención, deberá practicarle retención a CNV y expedirle el certificado correspondiente.
