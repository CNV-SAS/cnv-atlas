# Smoke acumulado · un solo recorrido

> **REEMPLAZADA, y su sucesora tambien: la guia viva es `SMOKE_UNICO_2026-09-26.md`.** (Lo fue primero por `SMOKE_ACUMULADO_2026-09-25.md`.) No se sigue tal cual: dos de sus afirmaciones
> cayeron. (1) El control de LUVIA de la parte 1 esta AL REVES: al momento de la venta el producto ya es de
> CNV, asi que reincorporarlo tiene que funcionar, y el bloqueo se retiro. (2) La devolucion de la parte 1
> ya SI mueve el dinero. Se conserva porque el resto de sus pasos y sus datos de preparacion siguen siendo
> los mismos, y porque el error de LUVIA explica por que la guia no es la autoridad: el modelo lo es.

**Para Santiago, 2026-09-24.** Todo lo construido desde que se retomó lo comercial, en el orden en que tiene
sentido probarlo. Son tres partes y cada una se puede parar sin dañar la siguiente.

**Antes de empezar:**

- Migraciones al día: **172 en el repo, 172 en la nube** (0169, 0170 y 0171 son de estos días).
- Entra como **admin / Dirección** (las tres pantallas son suyas).
- Ten a mano un **paciente de prueba** y un **producto** cualquiera del catálogo.

---

## Parte 1 · La devolución física y la cuarentena

**Qué se prueba:** que lo que devuelve un paciente **no vuelve solo al inventario vendible**, que espera
verificación, y que la decisión de reincorporarlo o darlo de baja la toma una persona y queda con su nombre.

### Preparar

Hace falta **una venta pagada y marcada como entregada**. Si no tienes una a mano, sirve una venta en efectivo
nueva desde `/pagos`, entregándola después.

**Dónde está todo esto:** en **/pagos**, no en /admin. Y la sección *Devueltas pendientes de verificación*
**solo aparece cuando hay algo esperando**: antes de registrar la primera devolución no existe, y eso es
normal.

### Los pasos

1. Ve a **/pagos**, a la lista de **Transacciones**. En una venta **pagada y entregada** aparece
   **"El paciente devolvió algo"**.
2. Ábrelo y registra la devolución: qué producto de esa venta, cuántas unidades y por qué.
3. **Qué tiene que verse:** la unidad aparece en *Devueltas pendientes*, con su motivo, y **el saldo del
   integrante NO sube**. Compruébalo en su inventario: lo devuelto no volvió a su vitrina.
4. En esa unidad, elige **Reincorporar al lote**, con su destino y el resultado de la verificación (por
   ejemplo "Sellada, íntegra y sin vencer").
5. **Qué tiene que verse:** desaparece de la lista y **ahora sí** sube el saldo de la ubicación elegida.
6. Registra otra devolución y esta vez **Dar de baja**, con su motivo.
7. **Qué tiene que verse:** desaparece de la lista y **no sube ningún saldo**. La unidad se perdió, que es lo
   que significa dar de baja.

### El control que de verdad importa

Intenta **reincorporar LUVIA** (es el único producto de tercero). Tiene que **negarse**, diciendo que vuelve
a la consignación del proveedor y no al inventario de CNV. Si te deja, avísame: eso es exactamente lo que
contabilidad prohibió.

---

## Parte 2 · Las ventas que ya ocurrieron (Bloque R)

**Qué se prueba:** que se puedan registrar en Atlas las ventas que se hicieron antes, con su fecha real y
con la factura que ya existe, **sin que Atlas vuelva a facturar** y **sin que el paciente aparezca como
deudor**.

### Preparar

Un **paciente**, un **producto**, y un **número de factura** inventado para la prueba (por ejemplo
`PRUEBA-001`). No hace falta que exista en Alegra: Atlas no va a llamar a Alegra, que es justo el punto.

### Los pasos

1. Ve a **/admin/ventas-retroactivas**.
2. Elige quién la vendió, a qué paciente, **una fecha de hace meses**, el número de factura, el medio de pago
   y el producto **con el precio que tenía ese día** (no el de hoy).
3. Pulsa **Registrar la venta**.
4. **Qué tiene que verse:** el aviso con el total, y la venta en la lista de abajo **con la fecha que le
   pusiste**, no la de hoy.
5. Ve a **/pagos**. **Qué NO tiene que verse:** esa venta en los paneles de facturación pendiente ni como
   "por cobrar". Si aparece ahí, avísame: significaría que Atlas quiere cobrarle otra vez a alguien que ya
   pagó.
6. Mira el inventario del integrante: **bajó** por esa venta. Si el saldo no alcanzaba, la venta queda
   marcada como *No alcanzó el saldo* en la lista, y eso también es correcto (los números no cuadran y se
   ve).

### Los controles

- Intenta registrar **la misma factura dos veces**: tiene que negarse.
- Intenta una **fecha futura**: tiene que negarse.
- **Borra** la venta de prueba con *Borrarla*. Si ya descontó inventario, se negará y te dirá por qué; eso
  también es correcto, y entonces se corrige con una devolución.

---

## Parte 3 · Las comisiones y la liquidación

**Qué se prueba:** que se le pueda pagar a un integrante lo que vendió, **una sola vez**, con su IVA y su
retención bien calculados.

### Preparar: esto SÍ necesita un dato que puede no existir

La liquidación **se niega** si el integrante no tiene completo su perfil tributario. Necesita tres datos:
persona natural o jurídica, si es responsable de IVA, y si está obligado a facturar. **Es a propósito:**
asumirlos es girar de menos o de más.

Si la pantalla te dice que faltan, complétalos en su perfil, o con esto en el SQL editor (cámbiale el
nombre al integrante que vayas a usar):

```sql
update professional_profiles pp
   set tax_person_type = 'natural',      -- o 'juridica'
       tax_is_vat_responsible = true,    -- ¿su comisión lleva IVA del 19 %?
       tax_must_invoice = true           -- ¿él le factura a CNV? (si no, CNV emite documento soporte)
  from profiles p
 where p.id = pp.profile_id
   and p.full_name = 'Profesional Demo';
```

Y hace falta **al menos una venta pagada** de ese integrante, que es lo que causa la comisión. Las ventas del
smoke de las partes anteriores sirven.

### Los pasos

1. Ve a **/comercial**.
2. **Qué tiene que verse:** el integrante en *Comisiones por liquidar*, con lo causado y en cuántas
   comisiones. Si le faltan datos tributarios, en vez del botón sale qué falta.
3. Pulsa **Liquidar hasta hoy**.
4. **Qué tiene que verse:** la liquidación abajo, con la cuenta explicada: comisión, IVA si aplica, y la
   retención con su porcentaje. Y la línea que dice quién emite el documento (él le factura a CNV, o CNV
   emite documento soporte).
5. **Comprueba la cuenta a mano**, que es lo que prueba que no está inventada: con una comisión de 20.000 y
   un integrante responsable de IVA, tiene que decir **IVA 3.800**, **retención 10 % 2.000** y **neto
   21.800**. La retención va sobre la comisión, **nunca sobre el IVA**.
6. Vuelve a mirar *Comisiones por liquidar*: **ese integrante ya no está**. Sus comisiones quedaron marcadas
   y no se pueden pagar otra vez.
7. Registra el giro con una referencia (por ejemplo `TRANSF-PRUEBA`).
8. **Qué tiene que verse:** la liquidación queda con su fecha de giro y su referencia, y ya no ofrece
   registrarlo de nuevo.

### El control de la reversión

Este es el que vale la pena hacer si tienes tiempo. Registra una devolución o una reversa que **revierta una
comisión ya liquidada**, y vuelve a `/comercial`: el integrante reaparece con un pendiente **negativo**. Eso
es lo que contabilidad pidió (D-3b-2): lo ya pagado se descuenta en la liquidación siguiente, y si el neteo
queda en negativo, es una deuda que arrastra, no un giro.

---

## Qué reportar

De cada parte: lo que viste y, sobre todo, lo que **no** viste. Si algo se ve distinto de lo escrito aquí,
mándame la pantalla tal cual, sin arreglarlo: el texto de esta guía es la afirmación que se está probando, y
si la realidad no coincide, puede estar mal la guía y no el código.

**Al terminar**, las ventas y devoluciones de prueba se pueden dejar: son de un paciente de prueba y no
ensucian cifras reales mientras no haya operación real. Lo único que conviene no dejar a medias es una
liquidación **calculada y sin girar**, porque retiene comisiones que quedarían fuera de la siguiente: si la
hiciste por error, bórrala desde la pantalla antes de registrar el giro.
