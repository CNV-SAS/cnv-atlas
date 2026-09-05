# Plan del modelo: productos de terceros en consignación

**Estado: PROPUESTA. No se ha construido nada.** Es dinero y hay tres partes.

Origen: LUVIA viene en consignación del **Centro de Nutrición Integral Katherine Ruiz** (60 unidades,
PVP **90.000** con IVA incluido), no de CNV. Respuestas de contabilidad recibidas el 2026-08-27.

---

## Lo que ya está bien, y no hay que tocar

**(a) El IVA nunca entra en la base del reparto: ESTO YA SE CUMPLE.**

`core/iva.ts` deriva la base con `baseFromTotal` (IVA general 19 %) y `payments-writer` calcula la
comisión y el ingreso **sobre la base**, no sobre el PVP. El propio módulo lo dice: *"el IVA es recaudo
(va a la factura y a la DIAN), no es ingreso"*.

Así que el punto (a) del contable **describe lo que el sistema ya hace**. No hay trabajo aquí, y conviene
saberlo antes de "arreglarlo".

---

## Lo que rompe el modelo, y por qué es uno solo y no cinco

**El reparto se calcula UNA VEZ POR TRANSACCIÓN, no por producto.**

Hoy `payments-writer` hace, para toda la venta:

```
base       = baseFromTotal(amount)
commission = base × tasa_del_profesional     -> professional_revenue (por transactionId)
cnv        = base - commission               -> cnv_revenue          (por transactionId)
```

Dos destinos, una tasa, un cálculo. Y la frase del contable lo rompe entero:

> *"el modelo debe soportar que un mismo profesional venda productos propios y de terceros **en la misma
> transacción**, con reparto distinto para cada uno"*

**Ese es el cambio, y los puntos (b), (c), (d) y (e) son consecuencias suyas**, no cinco trabajos
distintos:

| Punto del contable | Qué implica |
|---|---|
| **(e)** venta mixta, reparto distinto por producto | **El reparto pasa de por-transacción a por-ÍTEM.** Es el cambio estructural |
| **(b)** 20 % profesional, 10 % CNV, 70 % consignante | Un **tercer destino** de ingreso, que hoy no existe. Y las tasas dejan de vivir en el profesional |
| **(d)** unidades vendidas por período y por consignante | El **consignante como entidad**, y el producto sabiendo de quién es |
| **(c)** no entra al inventario valorizado | La **marca de propiedad**, que es la misma que necesita (d) |

La buena noticia: **`transaction_items` ya existe** con `nutraceuticalId`, `quantity` y `unitPrice`. El
dato por ítem está; lo que se calcula por transacción es el reparto.

---

## El modelo propuesto

### 1 · El consignante como entidad

Tabla nueva `consignors`: nombre, NIT, datos de contacto y facturación. Sin ella, (d) no se puede
responder y la factura del consignante no tiene contra quién emitirse.

### 2 · El producto sabe de quién es

En `nutraceuticals`, un `consignor_id` **nullable**:

- **NULL = producto propio de CNV.** Todo lo que existe hoy queda igual, sin migración de datos.
- **Con valor = producto de tercero.** Dispara el reparto a tres, se excluye del inventario valorizado
  (punto c), y agrupa las unidades vendidas por consignante (punto d).

Es una columna, pero **la suposición no vivía en las columnas**: vive en los tipos de evento
(`remesa` = *"CNV envía al integrante"*, `recepcion` = *"el integrante reconoce que recibió"*). Con
producto de tercero falta el eslabón de arriba, así que hace falta **un tipo de movimiento nuevo** para
"el consignante entregó a CNV", o la decisión explícita de no modelarlo y llevar ese eslabón fuera del
sistema. **Eso lo decide contabilidad, no nosotros.**

### 3 · El reparto, por ítem

`professional_revenue` y `cnv_revenue` pasan a llevar `transaction_item_id`, y aparece
`consignor_revenue`. Cada línea de la venta calcula su propio reparto:

| Producto | Profesional | CNV | Consignante |
|---|---|---|---|
| **Propio** | su tasa (0,20 por defecto) | el resto | no aplica |
| **De tercero** | 20 % | 10 % | 70 % |

Sobre la **base sin IVA de esa línea**, siempre.

**Y las tasas se guardan como snapshot en cada línea**, como ya se hace con `commission_rate`: si mañana
se renegocia el 70/10/20, las ventas viejas conservan el reparto con el que se hicieron. Sin eso, un
cambio de tarifa reescribiría la historia.

### 4 · Lo que NO se toca

- El **pago mixto** (dos transacciones, una por medio de pago) sigue igual: es ortogonal al reparto.
- El **IVA** sigue como está.
- El **inventario** del integrante (`nutraceutical_inventory`) sigue contando unidades igual: lo que
  cambia es cómo se valora y a quién se le debe, no cuántas hay.

---

## Preguntas que quedaban, y cuáles contestó el contable

1. ~~El eslabón de arriba: ¿se modela?~~ **CONTESTADA por Santiago (2026-09-05): el inventario vivo está
   en Atlas, así que la entrega del consignante SÍ se registra ahí.** Era la que decidía si hace falta un
   tipo de movimiento nuevo, y hace falta: los tipos actuales (`remesa` = CNV envía al integrante,
   `recepcion` = el integrante reconoce) no tienen el eslabón de arriba. Con eso desbloqueado, el saldo
   por lote del punto 5 se puede construir: entra el evento del consignante y la cifra que se concilia
   (recibidas − vendidas − devueltas − faltantes) tiene contra qué calcularse.
2. ~~El faltante de un producto ajeno: ¿contra quién?~~ **CONTESTADA:** las dos, y no es doble cobro. Son
   dos custodias encadenadas. Ver el punto 6.
3. ~~¿La factura del consignante la emite Atlas?~~ **CONTESTADA:** no. CNV no le emite documento fiscal;
   basta el REPORTE quincenal contra el que él factura. Ver el punto 7.
4. **Precio:** Santiago lo fija en **90.000** (no 89.990). Base sin IVA: **75.630,25**. Reparto por
   unidad: profesional **15.126,05**, CNV **7.563,03**, consignante **52.941,17**.

---

## Respuestas del contable (2026-08-27): lo que agregan al modelo

### 5 · El LOTE deja de ser opcional, y es justo lo que habíamos diferido

**Lo que tenemos hoy es la ETIQUETA, no el mecanismo.** `lote` existe como `text` en tres tablas, y el
comentario del schema lo dice sin rodeos: *"NO cambia el saldo (sigue por producto): el inventario POR
LOTE completo (saldo/vencimiento por lote) es un modelo mayor, diferido (ver BACKLOG T3b-3)"*.

**Ese modelo diferido es exactamente lo que el contable ahora exige**, y ya no es opcional:

- Cada entrega del consignante es un **lote**: fecha, cantidad, referencia al soporte firmado y **fecha
  de vencimiento**.
- **Con probióticos el vencimiento es obligatorio**, no opcional. LUVIA lleva probióticos.
- Las ventas, devoluciones y faltantes **descuentan contra el lote**, no contra el producto.
- La cifra que hay que poder dar en cualquier momento: **recibidas − vendidas − devueltas − faltantes =
  en poder de CNV y sus profesionales**. Es la que se concilia y la que sustenta cuánto se le paga.

Así que T3b-3 sale de "diferido" y entra a este plan. No es un añadido: **sin saldo por lote no hay
conciliación con el consignante ni alerta de vencimiento.**

### 6 · El faltante: el mecanismo ya es correcto, el PRECIO no

**Buena noticia: NO está modelado como venta.** `nutraceutical_faltante_cases` es un caso con cargo
sellado (`sealed_unit_price`, `sealed_total`, `charge_status`), y el cargo se materializa como
`pendiente_liquidacion`. **No genera factura, ni comisión, ni IVA.** Es exactamente lo que el contable
pide, y ya está así.

**Lo que no encaja es el precio que sella.** Hoy sella el **precio de venta (PVP)**, por la Cláusula 5.4
del Anexo 2. El contable dice que debe ser **el costo**, con su razón: *"cobrarle 90.000 sería cobrarle
una utilidad que nadie ganó"*.

**Eso es contractual, no técnico**, y por eso queda como pendiente de Santiago (ver abajo). El sistema
hace hoy lo que dice el contrato; cambiarlo exige cambiar el contrato primero.

**Y son DOS obligaciones, no una.** El contable las separa y no es doble cobro, son dos custodias
encadenadas:

| Relación | Qué pasa si se pierde una unidad | A qué precio |
|---|---|---|
| **CNV ↔ consignante** | CNV responde, pase lo que pase con el profesional | su **70 % + IVA** = 63.000 |
| **CNV ↔ profesional** | el profesional le debe la unidad a CNV | **a definir en contrato** (sugiere el costo, 63.000) |

Hoy solo existe la segunda. La primera no tiene ni concepto.

**Y una advertencia suya que es de producto, no de contabilidad:** el faltante de producto ajeno **debe
alertar distinto**. Con producto propio, CNV pierde su costo; con producto ajeno, **CNV tiene que sacar
plata para pagarle a un tercero**. Es peor, y el sistema debe hacerlo visible.

### 7 · El reporte quincenal al consignante

**CNV no le emite documento fiscal** (él es proveedor, no cliente). Lo que el sistema debe hacer:

- **Generar el reporte del período** con el detalle: unidades vendidas por producto × 63.000.
- **Conservarlo** como soporte del cruce: es lo que sustenta la factura que él emite y lo que respalda a
  CNV si hay que reconstruir la operación.
- **Quincenal**, para calzar con la liquidación a profesionales y la consignación de efectivo. Un solo
  ciclo operativo.

Al pagar su factura, CNV practica **retención en la fuente del 2,5 %** y emite el certificado. Eso ya
vive en el módulo de pagos a terceros.

### 8 · Devolución y alerta de vencimiento

**La devolución no es operación fiscal**: el producto nunca fue de CNV, así que no hay venta que
revertir ni nota crédito. Basta un **acta firmada por ambas partes**, con el mismo formato del soporte
de entrega. El sistema **registra la devolución contra el lote** para que la conciliación cuadre.

**Alerta de vencimiento: 60 días antes. No la tenemos.** Y depende del punto 5: sin fecha de
vencimiento por lote no hay contra qué alertar.

---

---

## Decisiones CERRADAS con el legal (2026-08-27)

### 1 · El faltante va al PVP, no al costo. **Lo que tenemos hoy está bien y no se toca**

Lo fija la **Cláusula 5.4 del Anexo 2**, y el legal lo confirma con un argumento que es mejor que la
cláusula sola:

> **Si se cobra el costo, el integrante queda indiferente entre vender y perder.**

**Esto CONTRADICE al contable**, que sugería el costo. Manda el legal, y queda escrito aquí para que
nadie "corrija" el PVP más adelante creyendo que es un descuido.

**Y verificado antes de tocarlo: el faltante NO se factura.** No hay ninguna referencia a Alegra ni a
factura en el módulo; es un caso con cargo sellado que se materializa como `pendiente_liquidacion`. Así
que el PVP que sella es un **valor de indemnización**, no un precio de venta, y nunca sale como tal
hacia la DIAN. Es lo que el contable pedía, y ya estaba así.

### 2 · Los vencidos son DOS preguntas, no una

- **Hacia el integrante:** la regla de la **Cláusula 7**, que ya conocemos. Si Atlas alertó y no actuó,
  asume él; si no alertó, asume CNV.
- **Hacia el consignante:** revierten **sin cargo para CNV**, pero **hay que pactarlo**. Santiago lo
  cierra en el addendum.

El legal recomienda **devolver tres o cuatro meses antes del vencimiento**, para que el consignante
pueda colocarlas.

### La alerta de vencimiento BAJA DE PRIORIDAD

Con vencimiento en **2028** y 60 unidades, **no es urgente**. Sigue en el plan porque la Cláusula 7 hace
que "si Atlas alertó" tenga consecuencia económica, pero no bloquea nada hoy.

## Pendientes de SANTIAGO (no son de sistema y no los decidimos)

El contable señala dos que hay que cerrar **con el consignante**, y advierte que son de las que más
pleitos generan en consignación:

1. ~~A qué precio se le cobra el faltante al profesional.~~ **CERRADA por el legal: al PVP**, y el
   sistema ya lo hace. Ver arriba.
2. **El ADDENDUM con el consignante** (lo único que sigue abierto de este bloque): que los vencidos
   revierten sin cargo para CNV, y el plazo máximo de consignación. Hacia el integrante ya está resuelto
   por la Cláusula 7.

---

## El cierre del contable, que es el criterio de diseño

> *"El sistema debe distinguir producto propio de producto en consignación de terceros **en todo el
> flujo** (inventario, faltantes, liquidación, alertas). Hoy es LUVIA, pero si el modelo funciona van a
> llegar más consignantes."*

Por eso el `consignor_id` va en el catálogo y no un caso especial para LUVIA: **la estructura tiene que
contemplar N consignantes desde el principio**, aunque hoy haya uno.

## Y una cosa aparte: el alérgeno de LUVIA. CERRADA, y esta nota estaba mal

Decía que la contradicción entre el asesor legal y Gildardo iba a la ronda del 28. **No fue:** la
pregunta se cayó antes de enviarse, porque su punto 0 del 27 la contestó (nada de tablas de alérgenos ni
cruces; solo mostrar lo que la encuesta capturó). La propia ronda del 28 lo dice: *"Con eso se cae
también la pregunta que traíamos sobre el alérgeno de LUVIA"*. **LUVIA entra con ese criterio y no hay
nada abierto ahí.**
