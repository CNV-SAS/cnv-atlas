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

---

# CONSTRUIDO (tarde del 29) · y los insights que Santiago pregunta

## Lo que se hizo

**El origen de la compra es obligatorio en /pagos**, con la forma que la verificación impuso:

- **Ninguno preseleccionado**, y cada opción muestra **su fecha** y lo que prescribió. Lo que hay que evitar no
  es que la venta quede suelta: es que se elija cualquiera para poder cobrar.
- **Los borradores se ofrecen marcados** ("consulta en curso"). Exigir solo aprobados dejaba sin opción al
  paciente cuya consulta está abierta, y entonces se elegiría "suelta" por no tener alternativa.
- **Una consulta de más de seis meses avisa.** No bloquea: puede ser correcto (sigue el mismo plan) o una
  mentira, y eso lo decide quien atendió, que para decidirlo necesita ver la fecha.
- **Lo obligatorio no es el tratamiento: es decir por qué no hay uno**, con motivo, sellado en la venta.

## Los insights: qué se puede sacar ya y qué no

### Ya se puede, con lo guardado

| Pregunta | De dónde sale |
| --- | --- |
| Cuántos pacientes compran lo que el modelo recomendó | `treatment_nutraceuticals` (lo prescrito) contra las líneas de la venta atada a ese tratamiento |
| Cuántos compran **fuera** del modelo | Las líneas de la venta que **no** están entre lo prescrito de su tratamiento |
| Qué producto se prescribe mucho y se compra poco | Lo mismo, agrupado por producto: es la tasa de conversión de cada prescripción |
| Cuánto tarda en comprar desde la consulta | La fecha de la venta menos la del tratamiento |
| Qué profesional convierte más | Agrupando por `professional_id` |
| Y quién compra **sin consulta**, y por qué | `sin_tratamiento_motivo`, desde hoy |

**Sí, todo eso ya está en la base.** Solo faltaría organizarlo, como dices: es una pantalla de lectura, no
datos nuevos. **Con una condición:** solo vale para las ventas **desde hoy**. Las anteriores nacieron sin
tratamiento y no hay forma de saber de qué consulta salieron; atarlas después sería inventar.

### Todavía no se puede, y no es cosa de organizar

| Pregunta | Qué falta |
| --- | --- |
| **¿Le sirvió?** | Falta saber **qué tomó**. `nutraceutical_usage` sigue con 0 filas y `registerUsageAction` sin pantalla |
| ¿Cuánto tomó y por cuánto tiempo | Lo mismo |
| ¿Abandonó el producto y por qué | Lo mismo |

**Comprar no es tomar**, y esa es la frontera entre un insight comercial y uno científico. Lo de arriba
responde *"¿el modelo vende?"*. Lo de abajo responde *"¿el modelo funciona?"*, y para eso hace falta el
registro de consumo en el seguimiento, con la advertencia de Regla 0 que ya está escrita: preguntárselo al
**profesional** no toca la encuesta; al **paciente**, sí, y eso va a Gildardo.
