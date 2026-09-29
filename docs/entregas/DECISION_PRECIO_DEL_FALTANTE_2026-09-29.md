# El faltante se está cobrando al PVP, y el modelo dice que no

**Para Santiago, 2026-09-29. Hallazgo, no cambio: no toqué la cifra.** Salió al leer la cláusula de vencidos
para construir la alerta de vencimiento, porque el vencido se cobra "al precio de facturación, con el mismo
tratamiento del faltante", y al ir a ver cuál es ese precio resultó que el del faltante no es ese.

**Por qué llega ahora y no antes:** hasta esta semana el cargo por faltante existía pero **nadie lo cobraba**
(se leía solo para mostrarlo en pantalla). Al conectarlo a la liquidación, la cifra dejó de ser decorativa.

---

## Lo que dice el modelo comercial, textual

> **Faltantes.** Se cobran al **precio de facturación** (precio base menos 20%), no al PVP completo. El 20% es
> margen del Integrante que en un faltante nadie ganó; **cobrar el PVP sería cobrar una utilidad inexistente**.
> El desincentivo se mantiene intacto, porque quien pierde el producto paga sin recibir nada del paciente.

Y el Anexo 2, en la redacción validada: *"las partes adoptan como referencia el precio de facturación vigente
del producto, entendido como el precio de venta al público menos el descuento comercial aplicable"*.

## Lo que hace Atlas hoy

`count-writer.ts` sella `nutraceuticals.unit_price`, que es el **PVP con IVA**. Es lo que se muestra al
Integrante, lo que se materializa como cargo y lo que ahora se descuenta de su liquidación.

| Producto | Lo que Atlas cobra hoy (PVP) | Lo que dice el modelo (base − 20%) | Diferencia |
| --- | --- | --- | --- |
| MULTICELL BASE | **107.100** | **72.000** | 35.100 de más (49 %) |
| El de 166.600 | **166.600** | **112.000** | 54.600 de más (49 %) |

Son dos cosas sumadas, y conviene separarlas porque no se deciden igual:

1. **El IVA.** El modelo dice que la indemnización **no lleva IVA** ("no genera factura de venta, no genera
   IVA, no genera comisión"): es cuenta de cobro por indemnización, no compraventa. El PVP lo trae dentro.
2. **El descuento comercial.** El 20 % es margen del Integrante que en un faltante nadie ganó.

## Lo que hay que decidir, y es tuyo

**Opción A. El código está mal y se corrige.** Es lo que manda `CLAUDE.md` por defecto (el documento gana), y
lo que yo recomiendo: el texto es explícito, razonado y coherente con el tratamiento contable que el mismo
documento fija. El arreglo sella `base(unit_price) × (1 − tasa del Integrante)`.

**Opción B. El documento se actualiza.** Solo si al escribirlo se decidió otra cosa con el abogado y el texto
quedó viejo. En ese caso lo que hay que corregir es el modelo, no seguir con la contradicción.

**Un detalle que la opción A obliga a resolver, y no es automático:** el 20 % no es una constante, es **la tasa
del Integrante**, que tiene vigencia por fecha (`professional_commission_rates`). Así que hay que sellar la
tasa **vigente a la detección**, igual que se sella el precio. Si su tasa cambia después, el caso viejo tiene
que seguir explicando su propia cuenta.

## Lo que no urge, y por eso no lo cambié solo

**Con siete Integrantes y cero casos abiertos, hoy no hay nadie cobrado de más.** Pero el mecanismo ya cobra
de verdad, así que esto se resuelve **antes del primer conteo con faltante**, no antes del arranque.

Y hay una consecuencia encadenada: **el vencido a cargo del Integrante se cobra al mismo precio**. Por eso la
alerta de vencimiento quedó construida hasta la **propuesta de quién asume**, sin el cargo: el cargo sale de
esta misma decisión y construirlo antes sería construir dos veces.
