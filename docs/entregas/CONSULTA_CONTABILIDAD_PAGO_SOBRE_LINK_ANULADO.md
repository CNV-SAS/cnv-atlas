# Consulta a contabilidad: un pago que llega sobre un link de pago anulado

**Preparada el 2026-09-14** para que Santiago la lleve a contabilidad. **Sin datos de pacientes.** La decisión de Atlas ya está tomada por Santiago y se construye así en la sesión 2 del Bloque 3. Lo que se pide a contabilidad es **cómo se registra y quién resuelve**.

---

## El caso, en palabras simples

1. En consulta, el Integrante genera un **link de pago** (QR) y el paciente abre la página de pago de Wompi en su teléfono.
2. La tarjeta no pasa, o el paciente cambia de idea, y **paga en efectivo**. Al registrar el efectivo, Atlas **anula el link** para que no quede cobrado dos veces, y **emite la factura** de la venta en efectivo.
3. Pero la página de Wompi seguía abierta en el teléfono, y el paciente (o un segundo intento) **paga también con tarjeta**. Wompi aprueba el pago y nos avisa.

Resultado: **el mismo producto quedó pagado dos veces**, una en efectivo, ya facturada, y otra por Wompi, sobre un link que Atlas ya había anulado.

**Qué tan probable es:** poco, pero posible. Wompi deja pagar una página ya abierta mientras no venza. Atlas va a ponerle a la página de Wompi el mismo vencimiento que tiene el link (24 horas), y eso reduce la ventana sin cerrarla.

## Lo que hará Atlas (decidido)

- **Registra el pago como recibido**, porque el dinero sí entró.
- **NO emite factura y NO descuenta inventario** por ese segundo pago.
- La venta queda en una lista **"Revisar: pago sobre link anulado"**, con alerta a Dirección.
- **La razón:** una factura electrónica validada por la DIAN solo se deshace con **nota crédito**, y Atlas todavía no emite notas crédito (llegan en el Bloque 3b). Facturar sola una venta que probablemente se devuelve dejaría una factura que no se puede corregir desde Atlas.

Quien revisa tiene dos salidas:

- **Fue un cobro doble:** se le devuelve al paciente el pago de Wompi. No se factura nada.
- **Fue una segunda compra real** (el paciente quería dos unidades): se marca "Fue una segunda compra" en la lista, y Atlas descuenta el inventario y emite la factura.

---

## Las preguntas

**1. ¿Está bien no facturar hasta revisar?** Y si se decide que fue una segunda compra real, **¿la factura lleva la fecha del pago o la fecha en que se revisa?** ¿Hay un plazo máximo para resolver la revisión?

**2. Mientras se revisa, ¿cómo se registra ese dinero que entró por Wompi sin factura?** Hoy los pagos de Wompi van contra la cuenta puente de Wompi al facturar. Este llega sin factura: ¿anticipo de cliente, cuenta por pagar al paciente, otra cuenta?

**3. Si se devuelve, ¿quién asume la comisión de Wompi y la retención en la fuente de esa transacción?** ¿Es gasto de CNV, o se recupera? (Atlas verifica aparte con Wompi cómo se hace la devolución de un pago aprobado, y si la comisión se reintegra.)

**4. ¿Quién resuelve la lista "Revisar"?** (Hoy la resuelven admin y dirección, los mismos que ven el ingreso de CNV, hasta que contabilidad diga otra cosa.) ¿Dirección, contabilidad, o el Integrante con aprobación? ¿Hace falta dejar un soporte, por ejemplo la confirmación escrita del paciente de que no quería dos unidades?

**5. El caso al revés.** Al revisar puede resultar que el efectivo **no** se recibió: el Integrante lo registró, pero el paciente terminó pagando solo con tarjeta. Entonces la factura que sobra es la del efectivo, y esa ya está emitida. **¿Cómo se maneja mientras no existe nota crédito en Atlas?** ¿Nota crédito manual en Alegra, con qué referencia?

---

## Lo que NO se pregunta, porque ya está decidido

- Sellar el pago aunque el link esté anulado: el dinero es de CNV (decisión 4 del Bloque 3).
- No facturar sola la venta anulada que se paga (Santiago, 2026-09-14).
- Pago mixto: una factura por el total, y queda fuera de la sesión 2.
