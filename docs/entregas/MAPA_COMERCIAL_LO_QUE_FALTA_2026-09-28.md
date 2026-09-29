# Lo que falta de lo comercial · mapa verificado

**Para Santiago, 2026-09-28.** Verificado contra el código, no copiado del inventario de huecos del
2026-08-06: de esos huecos **la mayoría ya están cerrados**, y repetir esa lista habría hecho replantear cosas
hechas (es el error que la propia cabecera de `BACKLOG.md` advierte).

---

## Lo que YA está cerrado, para no volver a dimensionarlo

| Hueco de agosto | Estado |
| --- | --- |
| Remesa CNV→integrante (consignación) | **Hecho.** CNV declara, el integrante confirma |
| Inventario por profesional | **Hecho.** Por ubicación, producto y lote |
| Conteo físico semanal | **Hecho** |
| Faltantes con estados, plazos y dos personas para cobrar | **Hecho** |
| Venta en efectivo / que no pasó por el checkout | **Hecho**, más transferencia y la venta retroactiva |
| Liquidación del integrante | **Hecho**, con IVA y retención |
| Devolución del paciente, con su dinero y su nota crédito | **Hecho** |
| El checkout no respetaba la disponibilidad | **Hecho.** `solo_tienda` y `no_disponible` se niegan, con el motivo |
| Modalidad de consignación | **Hecho el mecanismo.** Ver abajo qué falta de Distribución |

---

## Lo que falta, en cuatro grupos

### Grupo A · Se puede verificar en UN MISMO recorrido (son el mismo circuito)

**A1 · El recaudo de Distribución.** El mecanismo de la modalidad está y el sellado la obedece; falta el lado
del dinero: que el paciente le pague **al integrante**, su facturación al paciente, la **factura quincenal de
CNV al integrante** (base menos su descuento, más IVA, con el detalle de las ventas que la componen) y el
**cupo de crédito** que al agotarse suspende los despachos.

Hoy los dos caminos de venta **bloquean** a un integrante en Distribución, diciendo por qué. Así que no hay
nada silencioso, pero Katherine sigue anotando por fuera.

**No arranca de cero:** la factura quincenal es la suma de `cnv_amount` de sus líneas ya selladas como
`distribucion`.

**A2 · El domicilio.** `transactions.delivery_mode` ya admite `'domicilio'` y **nada lo escribe**: no hay
dirección, ni flete, ni el derecho de retracto que §5.7 activa justamente por venta a distancia. Va con A1
porque comparten lo mismo: quién cobra, quién entrega y quién responde.

**A3 · La devolución del integrante a CNV.** La del **paciente** está hecha; la del integrante devolviendo a
CNV lo no vendido **no existe**, y es parte del ciclo de consignación (el modelo la lista entre lo que se
compensa en la liquidación, junto con los vencidos).

**A4 · Los vencimientos.** Los lotes tienen `expires_on` y el despacho ya usa FEFO, pero **nada avisa** de un
lote próximo a vencer ni vencido. Y eso sí tiene consecuencia económica: un frasco vencido en la vitrina es
producto de CNV que no se puede vender, y el modelo lo compensa en la liquidación.

> **Por qué los cuatro van juntos en un recorrido:** todos terminan en la liquidación. Se prueban con un
> integrante, un producto y un corte: se le vende, se le devuelve, se le vence algo, y se mira que la
> liquidación cuadre. Probarlos por separado obliga a montar tres veces el mismo escenario.

### Grupo B · Merece su PROPIO recorrido

**B1 · Las condiciones BIS corregibles.** Es clínico, no comercial, y su prueba es otra: corregir una
condición **rehace el diagnóstico**, así que hay que verificar que el nuevo dice lo que debe y que el viejo
queda reemplazado. Mezclarlo con un recorrido de dinero confunde qué falló. **Es lo próximo que construyo.**

**B2 · El registro de contraindicaciones del paciente.** Se quedó sin superficie al retirar el botón de razón
clínica (hoy, a tu pedido). La tabla está vacía, así que no se perdió nada, pero la capacidad sí. Su sitio
propio ya lo prevé el enum: `observacion_clinica`, una contraindicación **independiente de prescribir**.

### Grupo C · Son DECISIONES, no desarrollo

**C1 · ¿Puede el integrante objetar un faltante?** El procedimiento le da 5 días para justificar, pero una vez
clasificado **no tiene voz**: si CNV se equivoca, no hay vía de reclamo en el sistema. Es una pregunta para ti
y el abogado: ¿la objeción vive por fuera (un canal, un plazo) o hay que modelarla?

**C2 · `/comercial` promete lo que `/pagos` ya hace.** Ya está anotado como decisión tuya.

**C3 · Las tres grafías del motor** (`MULTICELL BASE`, `HEPA DETOX`, `GUTIMMUNE PRO`). En **su** HTML esto es
un defecto vivo: esos tres salen con "Según criterio clínico" en vez de su dosis. **En Atlas no**: tenemos
`MOTOR_ALIAS` con las tres y un candado que verifica que cada nombre que el motor puede emitir resuelva a un
producto. Así que para nosotros no es trabajo; es un aviso que le conviene a Gildardo.

### Grupo D · Operativo tuyo, no código

**D1 · La configuración de Alegra producción** (la fila de `alegra_config` y los cinco `alegra_items`), que ya
está en el checklist de arranque.

**D2 · El Dedicated Pooler**, dimensionado en el backlog.

---

## Lo que propongo

**Que encadene el Grupo A completo** mientras corres el smoke único, porque es un solo circuito y se verifica
de una. Antes va B1 (las condiciones BIS), que es lo que tiene a una integrante bloqueada hoy.

**Y que el Grupo C se resuelva antes de poner las claves reales de Alegra y Wompi**, porque C1 es un derecho
del integrante y arrancar sin eso significa clasificar faltantes sin vía de reclamo.
