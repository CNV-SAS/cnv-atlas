# Respuestas contables — Facturación de la venta de nutracéuticos (efectivo, pasarela y mixto)

**Estado:** Decisiones tomadas para implementación. Pendiente de validación por la contadora en los dos puntos marcados al final.
**Documento origen:** CONSULTA_CONTABLE_FACTURACION.md

---

## Principio rector

**CNV vende. El integrante recauda.** El producto es de CNV, el precio lo pone CNV, el ingreso es de CNV. El integrante nunca es la parte vendedora, aunque toque el dinero. Todas las respuestas de abajo se derivan de este principio.

Segundo principio: **el IVA no es ingreso de nadie, es recaudo en tránsito.** No entra en la base de la comisión ni en el ingreso de CNV.

---

## 1. Quién factura y a quién

**CNV le factura al paciente.** El integrante actúa como recaudador, no como vendedor.

- En Alegra: factura de venta de CNV al paciente, con medio de pago "efectivo".
- El efectivo que el integrante custodia hasta consignar es una **cuenta por cobrar a ese integrante** (plata de CNV en poder de un tercero).

**Implicación para Atlas:** hay que modelar el saldo de efectivo en poder de cada integrante y conciliarlo contra cada consignación quincenal. Sin esto, no se puede saber cuánto debe cada integrante en un momento dado.

---

## 2. Contacto por paciente o consumidor final

**Contacto identificado por paciente.** No aplica "consumidor final".

Razón: "consumidor final" es una figura del POS (tiquete de máquina registradora), no de la factura electrónica de venta, que exige identificar al adquirente.

**Cómo se resuelve la preocupación de privacidad:** en Alegra solo entran **datos de identificación y contacto** (nombre, tipo y número de documento, correo). **Nunca datos clínicos.** Alegra es un sistema contable, no clínico. El dato sensible (medición, diagnóstico funcional, motivo de la prescripción) se queda en Atlas y no cruza la integración.

**Regla adicional de diseño:** el nombre del producto en la factura no debe revelar condición de salud.

- Correcto: `MULTI-CELL BASE`
- Incorrecto: `suplemento para pacientes con resistencia a la insulina`

---

## 3. Cómo se documenta la comisión del integrante

Ver la sección **Comisiones a los integrantes** más abajo. Depende del estado tributario de cada integrante.

---

## 4. El IVA en efectivo

**Idéntico a la pasarela. No cambia nada.**

El IVA depende de **qué** se vende, no de **cómo** se paga. El régimen tributario del integrante tampoco afecta, porque el integrante no está vendiendo: vende CNV.

- Se mantiene el tratamiento del IVA como recaudo.
- La comisión y el ingreso de CNV se siguen calculando sobre la **base sin IVA**.
- No se reparte comisión sobre el IVA, porque ese dinero no es de CNV.

**Nota:** los nutracéuticos están gravados al **19%**, confirmado contra los registros INVIMA (RSA-3987-2026 y NSA-3618-2026), que los clasifican como alimentos y bebidas, categoría no excluida del artículo 424 del ET.

---

## 5. Pago mixto (parte pasarela, parte efectivo)

**Una sola factura por el total.**

La venta es una sola operación; el medio de pago es un detalle del cobro, no de la operación. Partirla en dos facturas fragmentaría artificialmente una misma venta.

- **Internamente en Atlas:** se puede seguir modelando como dos transacciones de cobro (correcto para control de recaudo).
- **Al facturar:** se consolida en un solo documento.
- La factura electrónica admite más de un medio de pago. Si la API de Alegra no lo soporta bien, usar el medio predominante y dejar el detalle del desglose en Atlas.

---

## 6. Momento de emisión de la factura

| Medio | Momento de emisión |
|---|---|
| Efectivo | **Al registrar la venta**, en el momento |
| Pasarela | Al confirmarse el pago (webhook de Wompi) |

La factura en efectivo **no espera** a que el integrante consigne. La consignación es un movimiento posterior entre CNV y el integrante, no la venta. El hecho económico ocurre cuando se entrega el producto y se recibe el pago.

---

## 7. Numeración y resolución DIAN

**La misma resolución de factura electrónica para todos los medios de pago.**

- El medio de pago **no** determina la numeración.
- **No se requiere resolución POS.** El POS aplica a caja registradora física, tiene límite de 5 UVT y no da derecho a IVA descontable al comprador. No es el caso de CNV.
- Una sola numeración, diferenciando con el campo **medio de pago** (efectivo / transferencia / tarjeta).

**Regla crítica de implementación:** el consecutivo lo asigna **siempre Alegra**. Atlas nunca debe generar números de factura, para evitar choques de consecutivo entre las facturas automáticas y las emitidas manualmente.

---

## 8. Devoluciones y anulaciones

**Nota crédito, igual para los dos medios.**

Una factura electrónica validada por la DIAN no se borra ni se edita. Se anula o corrige con nota crédito.

**Regla adicional:** si la devolución corresponde a una venta en efectivo, la nota crédito **también debe revertir la comisión** del integrante.

---

## Puntos faltantes en el documento original

### A. Control del efectivo en poder del integrante

Entre el cobro y la consignación, ese dinero es de CNV pero está en poder de un tercero. Atlas debe:

- Llevar el **saldo pendiente de consignar por integrante**.
- Conciliar cada consignación quincenal contra las ventas en efectivo registradas.
- Alertar sobre saldos vencidos.

### B. Idempotencia y manejo de fallas

Si Alegra o la DIAN no responden al registrar una venta en efectivo:

- **No bloquear la operación clínica.** La venta se sella en Atlas.
- **Encolar y reintentar** la emisión de la factura.
- Evitar emisión duplicada ante reintentos o timeouts: **una venta = una factura**.

### C. Datos a capturar y persistir de cada factura

- CUFE
- Número de factura asignado por Alegra
- Estado DIAN

Tratar **"aprobada con observaciones" como válida** (no reintentar ni duplicar). Solo **"rechazada"** obliga a corregir y reemitir.

---

## Comisiones a los integrantes (20% sobre base sin IVA)

Este es previsiblemente el mayor gasto recurrente asociado a la línea de nutracéuticos, por lo que conviene modelarlo bien desde el inicio.

### ¿Lleva retención en la fuente?

**Sí.** La comisión es un ingreso gravado para el integrante y CNV es agente de retención (responsabilidad 07 del RUT). El concepto aplicable es **honorarios o comisiones**, no servicios ni compras.

### Tarifas según el perfil del integrante

| Perfil del integrante | Retención |
|---|---|
| Persona natural **declarante** de renta | 11% |
| Persona natural **no declarante** | 10% |
| **Persona jurídica** (factura vía SAS o consultorio constituido) | 11% |

**Alternativa para personas naturales:** en ciertos casos puede aplicar la **tabla del artículo 383 del ET**, que tiene tramo exento y produce retención menor o nula en comisiones bajas. Cuál aplica depende de la situación de cada integrante y **lo define la contadora**.

### Documentación del pago según el estado tributario

| Situación del integrante | Cómo se documenta |
|---|---|
| Tiene RUT y **es responsable de IVA** | El integrante factura la comisión **con IVA 19%** (ese IVA es descontable para CNV, pero aumenta la salida de caja) |
| Tiene RUT y **no es responsable de IVA** | Factura o cuenta de cobro **sin IVA** |
| **No tiene RUT** o no está obligado a facturar | **CNV emite documento soporte electrónico** |

> El tercer escenario hace que la habilitación del **documento soporte electrónico** en Alegra sea indispensable, no opcional, antes de liquidar la primera ronda de comisiones.

### Implicación de diseño para Atlas

Cada integrante debe tener en su perfil su **estado tributario**, capturado durante el onboarding:

- Tipo de persona (natural / jurídica)
- Tiene RUT (sí / no)
- Es declarante de renta (sí / no)
- Es responsable de IVA (sí / no)
- NIT o cédula
- Está obligado a facturar (sí / no)

Sin estos campos no es posible calcular la retención ni determinar si CNV emite documento soporte o espera factura del integrante. **Recogerlos desde el primer integrante**, no cuando ya sean muchos.

### Comunicación al integrante

Debe quedar explícito en el contrato de integrante y explicarse en el onboarding: **la comisión bruta no es lo que recibe.**

Ejemplo: si la comisión liquidada es $100.000 y aplica retención del 11%, el integrante recibe $89.000 y CNV gira $11.000 a la DIAN.

**No es un descuento de CNV.** Es un anticipo del impuesto de renta del propio integrante, y CNV debe emitirle el **certificado de retención** para que lo descuente en su declaración.

---

## Pendientes de validación por la contadora

Todo lo anterior es regla general y puede implementarse. Estos dos puntos requieren confirmación antes de quemarlos en código:

1. **Tarifa exacta de retención por comisiones** según el perfil de cada integrante (10%, 11% o tabla del artículo 383).
2. **Tratamiento contable del efectivo en custodia** del integrante y mecánica de la conciliación quincenal.

---

## Resumen ejecutivo para implementación

| Pregunta | Decisión |
|---|---|
| ¿Quién factura? | CNV al paciente. El integrante solo recauda. |
| ¿Contacto o consumidor final? | Contacto identificado, solo con datos de identificación y contacto. Nunca datos clínicos. |
| ¿El IVA cambia con el efectivo? | No. 19% en ambos medios, tratado como recaudo sobre la base. |
| ¿Mixto: una o dos facturas? | Una sola por el total. |
| ¿Cuándo se emite en efectivo? | Al registrar la venta. |
| ¿Numeración aparte? | No. Misma resolución, diferenciando por medio de pago. |
| ¿Devoluciones? | Nota crédito, revirtiendo también la comisión. |
| ¿Comisión lleva retención? | Sí, 10% u 11% según perfil, o tabla 383. |
| ¿Quién asigna el consecutivo? | Siempre Alegra. Nunca Atlas. |
