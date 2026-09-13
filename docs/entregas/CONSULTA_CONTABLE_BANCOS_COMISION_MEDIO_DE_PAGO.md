# Consulta a contabilidad: traslado de las cuentas puente, comisión de Wompi y medio de pago

**De:** equipo Atlas, vía Santiago Uribe · **Para:** contabilidad de CNV
**Fecha:** 13 de septiembre de 2026 · **Estado:** abierta

---

## En qué punto estamos

La facturación de Atlas ya funciona de punta a punta en el sandbox de Alegra. Cada venta a paciente sale
como factura electrónica aprobada por la DIAN, con sus líneas, su IVA y su centro de costo, y **su pago
queda registrado contra la cuenta puente del canal**, tal como se definió:

| Canal de la venta | Cuenta donde Atlas registra el pago |
|---|---|
| Efectivo | **Efectivo en poder de Integrantes** |
| Pasarela (Wompi) | **Wompi por liquidar** |

Así las facturas quedan **cobradas** y no por cobrar, y en Bancos ya se ven los ingresos separados por
canal. Bancolombia no se toca desde Atlas.

**Lo que falta decidir es qué pasa después**, cuando el dinero llega de verdad al banco. Son tres preguntas.

---

## Pregunta 1 · El traslado a Bancolombia: ¿quiere que Atlas le prepare algo?

Ya está acordado que el traslado de la cuenta puente a Bancolombia **lo registra contabilidad en Alegra**,
no Atlas. Lo que preguntamos es **cómo quiere operarlo**, porque los dos canales funcionan distinto:

**Efectivo.** El Integrante recibe el dinero del paciente y lo consigna a CNV cada quincena. **Atlas sabe
cuánto tiene que llegar de cada Integrante**, porque registra cada venta en efectivo con su profesional y su
fecha.

**Wompi.** Wompi retiene el dinero y lo desembolsa según su propio calendario, **ya descontada su comisión**.
Atlas sabe cuánto se cobró, pero no cuándo ni cuánto va a llegar neto.

**Lo que proponemos, para que diga si le sirve o no:**

- **Un reporte de "pendiente de consignar" por Integrante** (efectivo): qué ventas lleva cada uno sin
  consignar y por cuánto. Con eso, cuando llega una consignación, se sabe a qué ventas corresponde.
- **Un reporte de "cobrado por Wompi sin desembolsar"**: qué se cobró por pasarela y aún no aparece en el
  banco.

Y los dos permitirían una **conciliación entre fuentes independientes**: el saldo de cada cuenta puente en
Alegra contra lo que Atlas dice pendiente. Dos sistemas que no se copian entre sí y que tienen que dar lo
mismo.

**Preguntas concretas:**

1. ¿Le sirven esos dos reportes, o prefiere otra forma?
2. ¿Con qué periodicidad los necesita (por consignación, quincenal, mensual)?
3. ¿Quién hace el traslado en Alegra y en qué momento: al ver la consignación en el extracto, o al cierre?

---

## Pregunta 2 · La comisión de Wompi: ¿cómo se registra?

Esta es la que más nos importa, y tiene una consecuencia directa.

Hoy Atlas registra el pago por el **valor bruto**: si el paciente pagó 107.100, en "Wompi por liquidar"
entran 107.100. Es correcto para la factura, porque el paciente pagó eso y la comisión no se le descuenta.

**Pero lo que llega al banco es menos.** Si Wompi cobra, digamos, un 3% más IVA, a Bancolombia llegan unos
103.000. La diferencia es un gasto de CNV, y **no está registrada en ninguna parte**.

**Por qué nos importa en concreto:** el modelo comercial tiene abierta la pregunta de si **el margen del 10%
de LUVIA cubre el costo de servirlo**, y la comisión de la pasarela es parte de ese costo. El propio modelo
señala que *la comisión se calcula sobre el PVP completo y absorbe cerca del 30% de la participación de CNV*.
Sin la comisión registrada por venta, ese reporte no se puede construir.

**Preguntas concretas:**

1. ¿La comisión se registra **por venta** o **por desembolso** (una sola partida cuando Wompi liquida)?
2. ¿Quién la registra: contabilidad al conciliar el desembolso, o Atlas al sellar la venta?
3. ¿Contra qué cuenta de gasto va?
4. Para el reporte de margen por línea: ¿basta con la comisión **estimada** por venta (Atlas conoce la
   tarifa de Wompi), o tiene que ser la **real** del desembolso?

La pregunta 4 decide mucho: si basta la estimada, Atlas puede calcular el margen de LUVIA desde ya; si tiene
que ser la real, hay que esperar al desembolso y cruzarlo venta por venta.

---

## Pregunta 3 · El medio de pago en la factura

Todas las facturas salen hoy con **"Medio de pago: Instrumento no definido"**. Es correcto que salga así,
porque Atlas no lo está mandando, y es lo siguiente que queremos corregir.

**Y se puede mandar exacto, no adivinado:** cuando un paciente paga por Wompi, **Wompi nos dice con qué
instrumento pagó**. Los que puede informar son estos:

| Instrumento que informa Wompi | ¿Código de medio de pago DIAN? |
|---|---|
| Tarjeta de crédito | ? |
| Tarjeta débito | ? |
| PSE (débito bancario) | ? |
| Nequi | ? |
| Transferencia Bancolombia | ? |
| **Venta en efectivo** (no pasa por Wompi) | ? |

**Pregunta concreta:** ¿qué código de medio de pago de la DIAN corresponde a cada fila?

Con esa tabla, cada factura sale con el instrumento con el que el paciente pagó de verdad.

---

## Lo que NO le preguntamos, para que no haya confusión

- **El envío de la factura al correo del paciente** sale como pendiente en el sandbox. Verificamos que el
  correo sí llega a Alegra (está en el contacto y en la factura); lo que falla es el paso de envío, que el
  sandbox no ejecuta. Se confirma en producción y no es contable.
- **El traslado lo hace contabilidad.** No proponemos que Atlas lo automatice: Atlas registra el pago contra
  la cuenta puente y ahí termina, como se acordó.

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.



// Respuesta del chat contable:

Buen documento, las tres preguntas son las correctas. Déjame verificar los códigos de medio de pago de la DIAN, que es la única que no puedo responder de memoria.Las tres preguntas están bien planteadas. Te respondo y al final agrego **una cosa que ninguno de los dos vio** y que puede estar afectando lo que llega al banco.

## Pregunta 3: los códigos de medio de pago

Los códigos de la DIAN para este campo son: 10 - Efectivo, 20 - Cheque, 42 - Consignación bancaria, 45 - Transferencia Crédito Bancario, 46 - Transferencia Débito Interbancario, 48 - Tarjeta Crédito, 49 - Tarjeta Débito.

| Instrumento de Wompi | Código | Certeza |
|---|---|---|
| Tarjeta de crédito | **48** | Alta |
| Tarjeta débito | **49** | Alta |
| Venta en efectivo | **10** | Alta |
| PSE (débito bancario) | **42** | Media |
| Transferencia Bancolombia | **42** | Media |
| Nequi | **42** | Media |

Los tres primeros son inequívocos. Los otros tres no tienen código propio en el catálogo (Nequi no existía cuando se definió), así que hay que aproximar. Uso 42 (consignación bancaria) para todos porque describe bien "el dinero entró a la cuenta por un medio bancario".

Dos precisiones para el desarrollador: **este campo es informativo**, no cambia impuestos ni valores, así que un mapeo razonable basta y no vale la pena bloquear nada afinando PSE contra Nequi. Y conviene que **CC verifique primero qué códigos acepta Alegra** en su catálogo de medios de pago, porque puede exponer un subconjunto; el mapeo final se ajusta a lo que Alegra admita.

## Pregunta 1: los reportes, y sí, con antigüedad

Los dos que proponen sirven. Yo agregaría un tercero y una dimensión que pediste tú:

**Pendiente de consignar por Integrante**, con **antigüedad**. No solo cuánto debe cada uno, sino desde cuándo. Un Integrante con 200.000 de hace tres días es normal; uno con 200.000 de hace cinco semanas es un problema. Sin la columna de días, los dos se ven igual. Esto es lo que pediste con "plazos" y es lo que convierte el reporte en una herramienta de gestión y no solo en un dato.

**Cobrado por Wompi sin desembolsar.** Sí.

**Composición del desembolso**, que es el que falta: cuando Wompi liquida, ese depósito agrupa varias ventas. Alguien tiene que poder responder "¿qué ventas componen estos 2.340.000 que entraron hoy?". Sin ese reporte, conciliar el extracto es imposible.

**Periodicidad:** que no sean reportes programados sino **pantallas consultables en cualquier momento**. El de efectivo se usa cada quincena cuando llegan las consignaciones; el de Wompi, cada vez que hay un desembolso.

**Quién hace el traslado y cuándo:** contabilidad, **al ver el movimiento en el extracto**, no al cierre de mes. Si se espera al cierre, durante todo el mes el saldo de Bancolombia en Alegra no cuadra con el banco, que es justo lo que estamos evitando.

## Pregunta 2: la comisión de Wompi

**Se registra al desembolso, no por venta.** Razón: el gasto se soporta con la **factura que Wompi emite**, y esa factura llega con el desembolso. Registrarlo por venta sería anticipar un gasto sin documento que lo respalde.

**Quién:** contabilidad, al conciliar el desembolso contra la factura de Wompi.

**Contra qué cuenta:** gastos financieros, comisiones bancarias. El código exacto lo asigna la contadora. Y ojo con algo que se olvida: **el IVA de esa comisión es descontable**, así que hay que pedirle a Wompi su factura y no conformarse con el resumen del desembolso.

**La pregunta 4, que es la que decide el diseño: basta la estimada.** Atlas conoce la tarifa, así que puede calcular la comisión estimada por venta y construir el reporte de margen de LUVIA sin esperar al desembolso.

Con una condición: que exista una **verificación periódica** que compare la comisión estimada acumulada contra la real facturada por Wompi. Si divergen más de un margen razonable, la tarifa configurada está mal y hay que corregirla.

O sea, dos capas que no se confunden: **estimada para gestión** (reporte de margen, decisiones comerciales), **real para contabilidad** (el gasto que va a los libros). Es lo normal en costeo y evita bloquear el análisis esperando documentos.

## Lo que falta y puede estar afectando la plata

**Verifiquen si Wompi practica retención en la fuente.** Cuando un pago se hace con tarjeta, la entidad adquirente suele practicar retención en la fuente sobre el valor de la venta. Wompi es de Bancolombia, así que es probable que lo haga.

Si es así, **lo que llega al banco no es solo "bruto menos comisión"**, es "bruto menos comisión menos retención". Y la diferencia es enorme en tratamiento: la comisión es un **gasto** (plata que pierdes), la retención es un **anticipo de renta** (plata que recuperas al declarar, con su certificado).

Si hoy están tratando todo el descuento como comisión, estarían registrando como gasto algo que es un activo a favor de CNV. Pídanle a Wompi el detalle de qué compone el descuento de cada desembolso, y el certificado de retención si aplica.

**Y dos casos más que el documento no cubre:**

- **Contracargos o reversiones.** Un pago aprobado que Wompi reversa después. La factura ya existe y validada por la DIAN, así que la única salida es **nota crédito**. Debe entrar al bloque de reversa.
- **La retención que un Integrante practique**, si alguno es agente de retención en el flujo de comisiones. Ya está en el modelo, solo que no aparece en este documento.