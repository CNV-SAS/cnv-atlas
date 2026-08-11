# Consulta contable — Facturación de la venta de nutracéuticos (efectivo, pasarela y mixto)

**Estado:** BORRADOR, listo para enviar al asesor contable cuando Santiago decida. No enviado.

## Contexto

Atlas es la plataforma clínica de CNV. En el tratamiento, el profesional (un integrante de la red, no empleado de CNV) puede prescribir **nutracéuticos**, que son **producto de CNV**. Si el paciente compra, hay que **cobrar y facturar**.

Hasta ahora el único medio de cobro es la **pasarela (Wompi)**. Estamos agregando el **cobro en efectivo**, y con él aparecen preguntas de facturación que son de tu terreno, no del nuestro. La particularidad del efectivo: **lo recauda el integrante, pero el producto y el dinero son de CNV** (el integrante custodia ese efectivo y lo transfiere a CNV cada quincena). Su ingreso propio es solo la **comisión**.

## Lo que hay hoy (pasarela)

- El profesional arma la venta (paciente + productos del catálogo), se genera un **checkout de Wompi**; el paciente paga y, al confirmarse el pago, el sistema:
  - Sella la transacción como pagada.
  - Registra la **comisión del integrante** (un % sobre la base sin IVA, con la tasa del momento).
  - Registra el **ingreso de CNV** (el resto de la base sin IVA).
  - Crea una **factura borrador en Alegra** (integración ya existente).
- **El IVA se trata como recaudo**, no como ingreso: la comisión y el ingreso se calculan sobre la **base sin IVA**; el IVA va a la factura y a la DIAN. (Decisión ya tomada para la pasarela.)
- La comisión hoy **no se factura**: se registra internamente y se liquida al integrante (el bloque de liquidación está por construirse).

## Lo nuevo (efectivo y mixto)

- **Efectivo:** el integrante cobra en el momento; el dinero es de CNV y él lo custodia hasta transferirlo. Internamente lo sellamos igual que la pasarela (misma comisión, mismo ingreso de CNV), marcando el medio como "efectivo".
- **Mixto:** el paciente paga una parte por pasarela y otra en efectivo. Lo modelamos como **dos transacciones** (una por medio).

## Preguntas concretas

**Sobre quién factura y a quién:**
1. La venta en efectivo la recauda el integrante, pero el producto y el dinero son de CNV. **¿Quién factura, y a nombre de quién?** (¿CNV factura al paciente, con el integrante solo como recaudador?)
2. **¿Se crea un contacto por paciente en Alegra, o se factura a "consumidor final"?** Con datos de salud de por medio, crear un contacto identificado por paciente en un sistema contable tiene implicaciones de privacidad que preferimos evitar si no es necesario.

**Sobre la comisión del integrante:**
3. **¿Cómo se documenta la comisión del integrante?** ¿El integrante le factura a CNV por su comisión (es un tercero, no empleado), o CNV se la liquida por otra vía (cuenta de cobro, nómina de terceros)? Esto define cómo modelamos la liquidación.

**Sobre el IVA:**
4. **¿El IVA en efectivo se maneja igual que en la pasarela** (como recaudo sobre la base, a la factura y la DIAN), o el cobro en efectivo cambia algo (régimen, responsabilidad de IVA del integrante que recauda)?

**Sobre el mixto:**
5. Un pago **parte pasarela y parte efectivo**: **¿una factura por el total, o dos** (una por medio de pago)?

**Del lado técnico, agregamos:**
6. **Momento de la factura:** la pasarela factura al confirmarse el pago (asincrónico, por webhook); el efectivo se paga en el momento. **¿La factura en efectivo se emite al registrar la venta?**
7. **Numeración / resolución DIAN:** **¿la venta en efectivo usa la misma numeración y resolución de facturación que la pasarela, o requiere una resolución aparte** (por ejemplo, POS o factura electrónica con medio de pago "efectivo")?
8. **Devoluciones / anulaciones en efectivo:** si se anula o devuelve una venta en efectivo, **¿el mecanismo es nota crédito, igual que la pasarela?**

## Qué necesitamos de vuelta

- Para cada pregunta, la regla concreta (quién factura, a quién, con qué numeración, y cómo entra el IVA), en lenguaje que podamos traducir a la implementación.
- En particular, el **sí/no de crear contacto por paciente en Alegra** (punto 2): eso decide si el paciente queda identificado en el sistema contable o si facturamos a consumidor final.
- Con eso construimos la facturación de la venta en efectivo. Hasta que llegue tu respuesta, la venta en efectivo **se registra y sella internamente** (comisión + ingreso de CNV) pero **no emite factura**; la factura se conecta después, con tu regla.
