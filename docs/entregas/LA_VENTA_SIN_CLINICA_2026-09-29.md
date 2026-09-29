# Una venta que no sabe de qué tratamiento salió

**Para Santiago, 2026-09-29. Verificado contra el código y contra la base, no de memoria. No construí nada:
esto es un bloque propio y lo decides tú.**

Tu planteamiento es correcto y el hueco es más grande de lo que la pregunta sugiere. Lo resumo en una frase:
**Atlas sabe perfectamente quién pagó, y no sabe si le sirvió.**

---

## Lo que hay, verificado

### a) Sí: la venta guarda el tratamiento cuando nace en Tratamiento

`transactions.treatment_id` existe, y `venta-en-consulta-form` lo manda (`fd.set("treatmentId", treatmentId)`).
Así que una venta hecha en la consulta **queda atada a su tratamiento**, y por él al diagnóstico y a la
evaluación. Esa cadena está completa.

### b) Sí: la de /pagos queda huérfana

Ni el formulario del link de pago ni el de la venta ya cobrada mandan `treatmentId`. La acción lo lee del
formulario, no lo encuentra, y la venta nace con `treatment_id` nulo. **No hay aviso ni registro de que falte**:
se ve exactamente igual que una atada.

Y no es un caso raro. /pagos existe precisamente para **el paciente que vuelve solo a comprar**, que es el
caso recurrente: el que ya tiene su plan y vuelve por su siguiente frasco. O sea que **el hueco está justo en
la compra que más dice sobre si el producto le sirvió**, porque es la que se repite.

### c) No: no hay forma de saber qué tomó de verdad entre dos consultas

Y aquí está lo que más me llamó la atención. **La pieza existe y no está conectada:**

| | |
| --- | --- |
| La tabla | `nutraceutical_usage (treatment_id, nutraceutical_id, quantity)` |
| Su lector | Existe, en `nutraceuticals-repository` |
| Su acción | `registerUsageAction` |
| Filas hoy | **0** |
| Pantalla que la llame | **ninguna** |

Tenías razón: **es justo esta pieza.** Está en la lista de acciones huérfanas declaradas a propósito del
candado `acciones-con-puerta`, o sea que se sabía que estaba sin cable y se dejó así.

**Y el seguimiento no lo pregunta por otro lado:** busqué en todo el módulo de seguimiento y no hay ninguna
pregunta sobre nutracéuticos ni sobre adherencia. Así que hoy, en el control siguiente, no hay forma de saber
si tomó lo que se le prescribió.

---

## La distinción que me parece la clave

Hay **tres hechos distintos** que hoy Atlas mezcla o pierde, y conviene no confundirlos al decidir:

1. **Qué se le PRESCRIBIÓ.** Está completo, en el tratamiento, con su posología del catálogo.
2. **Qué COMPRÓ.** Está, pero desconectado de lo clínico cuando pasa por /pagos.
3. **Qué TOMÓ.** No está en ninguna parte.

**Y el 2 no implica el 3**, que es lo que hace que la data clínica valga o no valga: alguien puede comprar tres
frascos y tomar uno, o comprar uno y no abrirlo. Si la pregunta científica es "¿le sirvió?", la variable
independiente es **lo que tomó**, no lo que pagó. Lo comprado es, como mucho, un indicio.

Por eso creo que si se hace, **el orden importa**: atar la venta al tratamiento (2) es barato y cierra el
agujero contable-clínico, pero **no responde tu pregunta**. Lo que la responde es el 3.

---

## Lo que yo propondría, por tamaño

**Chico, y cierra (a) y (b).** Que la venta desde /pagos pida el tratamiento cuando el paciente tenga uno
abierto. Es un desplegable con sus tratamientos, y si no tiene ninguno se registra suelta **diciendo que
queda suelta**. Con eso ninguna venta nace huérfana en silencio, y desde cualquier venta se puede llegar a la
evaluación que la originó.

**Mediano, y es lo que responde tu pregunta.** Conectar `registerUsageAction` al **seguimiento**: al abrir el
control siguiente, el profesional (o el paciente en su encuesta) registra de lo prescrito **qué tomó y cuánto**.
Con eso, y con la trayectoria de indicadores que ya existe, se puede cruzar "tomó X durante Y" contra "su EB
BIS se movió así".

**Y una advertencia de la Regla 0, que es la que puede matar la idea buena.** Preguntar adherencia es
**capturar un dato nuevo que el archivo de Gildardo no tiene**. Si se le pregunta al paciente dentro de la
encuesta, eso es contenido de la encuesta, que está congelado. Así que:

- **Preguntárselo al PROFESIONAL** en el seguimiento (una nota de su consulta) no toca la encuesta.
- **Preguntárselo al PACIENTE** dentro de la encuesta, sí. Eso va a Gildardo primero.

La diferencia no es de formulario: es de quién dice el dato y bajo qué instrumento.

---

## Lo que no haría

**No inferir el consumo de lo comprado.** Sería un dato derivado que se vería igual que un dato medido, y el
día que alguien saque una conclusión científica de ahí, no sabrá que la base era una suposición. Si no se sabe
qué tomó, el sistema debe decir que no se sabe.
