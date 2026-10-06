# Plan · El registro de ventas bajo Distribución

**Decidido por Santiago el 2026-10-06: va la (a)**, construir el registro antes de que Katherine arranque. Su
razón, y es la buena: *"ponerla en Comisión significa que facture CNV cuando el acuerdo dice que factura
ella."* El acuerdo manda sobre la comodidad de construcción.

**Este documento es el plan, no el reporte.** Espera aprobación antes de ejecutarse.

---

## El riesgo central, y va primero porque ordena todo lo demás

**Una venta de Distribución NO puede entrar en la cola de facturación de Alegra.** Si entra, CNV le emite al
paciente una factura por un producto que **ya facturó la Integrante**: dos documentos fiscales por una sola
venta, uno de ellos falso.

**Por qué es fácil que pase:** la cola recoge por `status = 'paid'` (`facturacion-repository`, cinco consultas
distintas). Una venta de Distribución nace pagada, porque **está pagada**: el paciente ya le pagó a ella. O
sea que **entra sola**, sin que nadie escriba nada mal.

**Y por qué no lo atrapa nada de lo que ya corre:** `tsc` no ve un filtro que falta, el lint tampoco, y los
tests unitarios mockean la base. Esto se atrapa con **un candado contra base real** o en producción, emitiendo
el documento falso.

Así que el orden de construcción empieza por ahí, no por la pantalla.

---

## Sub-tarea 1 · Marcar la modalidad EN LA VENTA, no solo en sus líneas

**Lo que ya existe, y es casi suficiente:** `transaction_items.modality` se **sella por línea** en el momento
de la venta, leyendo la vigencia del Integrante **en la fecha de la venta** (no la de hoy, a propósito: el
cambio de modalidad rige desde el siguiente corte justamente para no partir una liquidación en dos).

**Lo que falta es el GRANO.** La modalidad está en las líneas y todo lo que necesita filtrar por ella mira
**ventas**: la cola de facturación, los insights, el tablero de Dirección, la bandeja de `/pagos`. Cada uno
tendría que unirse a `transaction_items` y agregar, y ahí nacen dos problemas:

1. **Cinco consultas con la misma regla escrita cinco veces** es exactamente cómo se desincronizan. Ya pasó
   con los rótulos clínicos y con el filtro de prueba.
2. Y una venta con líneas de **dos modalidades** es representable en la tabla aunque no pueda ocurrir, así que
   cada consulta tendría que decidir qué hacer con ese caso imposible. Cinco decisiones, cinco criterios.

**La propuesta: una columna DERIVADA en `transactions`, mantenida por trigger desde las líneas.** Es el mismo
mecanismo de `cuenta_como_de_prueba` (migración 0203), que ya está probado y que resolvió este problema exacto.

**Por qué derivada y no escrita por el writer:** una columna que el writer escribe puede divergir del valor
sellado en las líneas; una derivada no puede, porque su única fuente son las líneas. Es el argumento que hizo
correcta la 0203, y aquí vale igual.

**Esto contesta la pregunta de Santiago sobre los insights:** sí conviene distinguirlas, y la forma de hacerlo
no es un campo nuevo que alguien llene, es derivar el que ya se sella.

> **Y una advertencia sobre el momento:** agregar esta columna toca una tabla muy referenciada. Hay que mirar
> los embeds de `transactions` antes (`grep "transactions("`) por el hazard de los embeds ambiguos de
> PostgREST, y correr la suite de base real, no solo `tsc`.

**Candado:** contra base real. Que la columna de la venta coincida con la modalidad de sus líneas, y que un
cambio de modalidad del Integrante **no** reescriba las ventas viejas.

---

## Sub-tarea 2 · Sacar las ventas de Distribución de la cola de facturación

**Las cinco consultas de `facturacion-repository` filtran por la columna nueva.** Con la columna de la
sub-tarea 1, es un `and` por consulta.

**Candado, y es el del bloque:** contra base real, crear una venta de Distribución y comprobar que **ninguna**
de las vías la recoge: ni la cola de pendientes, ni el reintento, ni el conteo de agotadas, ni el pago en
Alegra. Escrito por **vía** y no una vez, porque son cinco sitios y el que se olvide es el que emite.

**Y el mensaje tiene que decir por qué**, donde se vea: una venta de Distribución sin factura de CNV **no es
un faltante de documento**, es lo correcto. Si la bandeja de "ventas sin documento" la muestra como pendiente,
alguien va a emitirla a mano.

---

## Sub-tarea 3 · El canal: que no sea "efectivo"

`payment_method = 'efectivo'` significa, en todo Atlas, **"custodia dinero de CNV"**, y la liquidación suma lo
custodiado. Una venta de Distribución **no** es eso: el dinero es de ella.

**Hace falta un valor nuevo en el enum `payment_method`.** El nombre importa menos que lo que significa; mi
propuesta es uno que diga que CNV **no recaudó**, no uno que suene a medio de pago (el paciente puede haberle
pagado a ella en efectivo, por transferencia o con datáfono, y eso es asunto de ella, no de Atlas).

**Lo que hay que barrer:** 18 archivos, 57 referencias. **La mayoría es mecánica** porque `medio-de-pago.ts`
centraliza la traducción a DIAN y a Alegra, y ese módulo no debería tocarse: una venta de Distribución no va a
Alegra, así que no necesita código de medio de pago.

**Dónde mirar con cuidado, que es lo que no es mecánico:** la liquidación de Comisión, `brutoReconocido`, el
histórico del profesional y el tablero de Dirección. Ninguno debe contar esta venta como comisión ni como
efectivo custodiado. **Los candados de esas cifras ya existen** y son los que tienen que quedar verdes.

---

## Sub-tarea 4 · La superficie que registra, sin cobrar

**Reusa `createPaidCashTransaction`, que ya hace el 80 %:** ubicación, líneas, sellado de base y descuento por
línea, idempotencia por intento, anulación de links que comparten producto, y el descuento de inventario.

**Lo que cambia es poco, y es lo que la respuesta legal simplificó:** es consignación, la propiedad pasa **en
la venta**, así que el movimiento de inventario es **idéntico** al de Comisión. Sale de su vitrina, contra
inventario de CNV, en el momento de la venta. No hay facturación al despachar ni notas crédito al devolver.

**Dos superficies, las mismas dos de hoy:** el bloque de venta en consulta de Tratamiento y `/pagos`. No es
una pantalla nueva: es que donde hoy dice "cobrar", bajo Distribución diga **"registrar"**.

**`exigirRecaudoDeCnv` se queda** bloqueando los dos caminos de **cobro** y deja pasar el de **registro**. Su
mensaje hay que actualizarlo: hoy dice que el registro *"todavía no está en Atlas"*, y dejaría de ser verdad.

**Lo que la pantalla tiene que decir, y no es decoración:** que el precio que se registra es el que **ella** le
cobró al paciente, y que el PVP de CNV es **sugerido**. Imponerlo sería fijación de precios (asesor legal,
2026-10-05), así que el campo tiene que ser suyo, con el sugerido al lado como referencia.

---

## Sub-tarea 5 · El cupo, que ya funciona

**Cero trabajo.** Verificado el 2026-10-05: `puedeDespacharse` topa el **saldo pendiente de pago** contra el
cupo, `estadoDeCredito` lo suma de las cuentas emitidas y **no pagadas**, y la mora se deduce de los plazos en
vez de una columna que habría que mantener al día.

**Lo único que le faltaba era de dónde leer**, y son justo las ventas de la sub-tarea 4. Así que esta
sub-tarea es **comprobar**, no construir: registrar ventas, emitir la cuenta, y ver que el saldo sube y que al
alcanzar el cupo se suspenden los despachos.

---

## Lo que NO entra en este bloque

- **La emisión de la cuenta quincenal en Alegra.** Necesita la configuración de producción, que está en el
  checklist de arranque.
- **El PVP sugerido en el reporte del paciente.** Es la recomendación del asesor legal y está en `BACKLOG.md`,
  pero añadir contenido al documento que recibe el paciente es otra decisión.
- **El corte extraordinario al terminar un contrato.** Va pegado al offboarding del Integrante
  (`BACKLOG.md`).

---

## Criterio de aceptación

1. Una venta de Distribución se registra desde las dos superficies, descuenta inventario de su vitrina y
   **no cobra nada** por CNV.
2. **Esa venta no aparece en ninguna de las cinco vías de facturación**, y la bandeja de documentos faltantes
   no la pide. *(El candado contra base real, por vía.)*
3. La cuenta quincenal de su corte la incluye, con la base y el descuento **sellados en la venta**.
4. Su saldo pendiente sube, y al alcanzar el cupo los despachos se suspenden con su motivo.
5. La liquidación de Comisión, el bruto reconocido y el tablero de Dirección **no la cuentan** como comisión
   ni como efectivo custodiado. *(Candados existentes, verdes.)*
6. Los dos caminos de **cobro** siguen bloqueados bajo Distribución, con el mensaje corregido.
7. `tsc`, `lint`, `check:rsc`, `check:cables`, la suite unitaria y **la suite de base en serie**.
8. Y el smoke humano en navegador de la superficie de registro: es un formulario, y los siete hazards de
   `CLAUDE.md` solo se ven ahí.
