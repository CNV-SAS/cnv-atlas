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
