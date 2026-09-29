# Consulta para contabilidad · dónde se resta el cargo por faltante

**Para que Santiago la lleve. 2026-09-28. Una página.**

---

## El caso, con cifras

Un Integrante de CNV tiene producto en consignación. En el conteo se detecta un frasco faltante y, tras el
procedimiento, queda clasificado como **injustificado**: lo debe, al precio de venta al público sellado el día
de la detección. En la misma quincena causó comisiones por sus ventas.

| Dato | Valor |
| --- | --- |
| Comisiones causadas en el periodo | **400.000** |
| Cargo por el faltante injustificado (PVP sellado) | **180.000** |
| Perfil del Integrante | Persona natural, **responsable de IVA**, obligada a facturar |
| Retención en la fuente aplicable | 10 % (acumulado del año por debajo de 3.300 UVT) |

La pregunta es una sola: **ese cargo se resta del neto a girar, o se resta de la base gravada de la comisión.**

---

## Opción A · del neto (es la que está construida hoy)

El servicio de comisión se prestó completo, así que IVA y retención se calculan sobre los 400.000, y el
faltante se compensa después como otra obligación.

```
Comisión (base gravada)      400.000
IVA 19 %                    + 76.000
Retención 10 % sobre 400.000 − 40.000
Cargo por faltante          −180.000
──────────────────────────────────────
Neto girado                  256.000
```

Factura del Integrante a CNV: **400.000 + 76.000**. Retención certificada: **40.000**.

## Opción B · de la base gravada

El faltante reduce lo que se le reconoce por el periodo, y sobre esa cifra menor se calculan IVA y retención.

```
Comisión neta (400.000 − 180.000)  220.000
IVA 19 %                          + 41.800
Retención 10 % sobre 220.000      − 22.000
──────────────────────────────────────────
Neto girado                        239.800
```

Factura del Integrante a CNV: **220.000 + 41.800**. Retención certificada: **22.000**.

---

## Lo que cambia entre las dos

| | Opción A | Opción B | Diferencia |
| --- | --- | --- | --- |
| Neto girado al Integrante | 256.000 | 239.800 | **16.200** |
| IVA facturado (descontable para CNV) | 76.000 | 41.800 | **34.200** |
| Retención practicada y certificada | 40.000 | 22.000 | **18.000** |

**No es solo el giro:** cambian la base de la factura del Integrante, el IVA descontable de CNV y el
certificado de retención. Por eso conviene la línea de contabilidad antes de la primera liquidación real.

---

## Por qué está construida la A, y qué la volvería B

El modelo comercial trata las dos cifras como **obligaciones recíprocas que se compensan, transfiriendo solo
el saldo neto**. Compensar dos obligaciones no es lo mismo que reducir la base gravada de una de ellas: el
servicio de comisión se prestó por 400.000, y bajar la base a 220.000 significaría facturar y retener de menos
sobre un servicio que sí se prestó. Además hay una razón de naturaleza: la comisión es un **servicio gravado**
del Integrante a CNV; el faltante es un **producto no devuelto**, otra operación, con otro hecho económico.

**Lo que haría cambiar a B**, y es justamente lo que se pregunta: si contabilidad considera que el cargo por
faltante no es una obligación aparte sino un **menor valor del servicio del periodo** (una nota crédito o un
descuento sobre la comisión), entonces sí bajaría la base y la Opción B sería la correcta.

**Lo que no cambia en ninguna de las dos**, porque no se discute: la retención **nunca** se calcula sobre el
IVA, y el cargo aparece como **línea propia identificada** en la liquidación, no como un ajuste silencioso de
la cifra de arriba (el Integrante tiene que poder ver de dónde sale el descuento; hoy la pantalla se lo dice, y
le dice a dónde reclamar).

---

## Lo que se necesita de vuelta

Una sola frase: **A o B**, y si es B, si el menor valor se documenta como nota crédito del Integrante o como
descuento en la factura del periodo. El cambio en Atlas es de una línea de aritmética; lo que no se puede es
adivinarlo y descubrirlo en la primera declaración.
