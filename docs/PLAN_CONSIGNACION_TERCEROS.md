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

## Las preguntas que faltan antes de construir

1. **El eslabón de arriba: ¿se modela?** ¿Registramos "el consignante nos entregó 60 unidades", o ese
   tramo vive fuera de Atlas y el sistema arranca en la remesa al integrante?
2. **El faltante de un producto ajeno: ¿contra quién?** Hoy el cargo va al integrante. Con producto de
   tercero, CNV le debe la unidad al consignante **pase lo que pase** con el integrante. ¿Se cobran las
   dos, o CNV asume una?
3. **¿La factura del consignante la emite Atlas o se lleva aparte?** El punto (d) dice que las unidades
   por período disparan la factura; falta saber si el disparo es un reporte o un documento.
4. **Precio:** Santiago lo fija en **90.000** (no 89.990). Base sin IVA: **75.630,25**. Reparto por
   unidad: profesional **15.126,05**, CNV **7.563,03**, consignante **52.941,17**.

---

## Y una cosa aparte: el alérgeno de LUVIA

El asesor legal contradice la instrucción de Gildardo, y **eso no lo resolvemos nosotros**: va a la
ronda nueva. Ver `RONDA_GILDARDO_2026-08-28.md`.
