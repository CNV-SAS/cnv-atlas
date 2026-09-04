# Lo que queda sin resolver del lado científico

**Para Santiago. 2026-09-04.** Este documento no va para Gildardo. Está escrito para que sepas, sin
tecnicismos, qué queda abierto después de su entrega final y qué efecto tiene cada cosa.

---

## Resumen

| # | Qué es | ¿Pregunta o trabajo nuestro? | ¿Bloquea el hito 2? |
| --- | --- | --- | --- |
| 1 | El interruptor del LE8: su archivo dice una cosa y él dijo la contraria dos veces | **Pregunta**, y es la seria | No, si dejamos lo de hoy |
| 2 | Tres colores dicen lo contrario que su etiqueta | **Pregunta**, y es barata | No |
| 3 | Dos cosas que prometió "para la próxima entrega" y no llegaron | Recordatorio | No |
| 4 | Portar a Atlas las opciones de ejercicio que él ya arregló | **Trabajo nuestro** | No, pero se ve |
| 5 | Dos cosas de su archivo que salieron de un barrido, las dos chicas | **Preguntas**, sin prisa | No |

---

## 1 · El interruptor del LE8

**Es lo único serio que queda, y necesitas sus palabras para decidirlo. Van las tres, textuales.**

### Qué decide este interruptor

Cómo se calcula la **edad biológica** (él la llama EB-BIS): el número que le dice a una persona de 45
años que su cuerpo está como el de una de 52.

### Cita 1 · El comentario que él escribió al lado del interruptor, en el archivo del 4 de septiembre

> ```
> ── CONDICIÓN DE ACTIVACIÓN (Dirección Científica, 9-ago-2026) ──────
> Resuelto el punto 13 del paquete: el ICEC es el componente contextual que
> afecta la edad bioeléctrica, y por tanto NO puede activarse el mapeo dejando
> intactas la media y la desviación con que se estandariza. Se recalibran en el
> MISMO acto, nunca por separado.
>
> Para poner esto en `true` hacen falta las dos cosas a la vez:
>   1. Recalcular μ y σ del ICEC sobre la base de datos con el mapeo YA
>      corregido (hoy: μ = 58,578 · σ = 13,332, en la ecuación EB-BIS v5).
>   2. Sustituir esos dos números en la llamada a _zBis del término contextual.
>
> Recalcular μ y σ es un cálculo sobre nuestros propios registros, no una
> decisión de diseño: mientras no exista, esta bandera se queda en `false` y
> D-006 sigue vigente. Activarla sola bajaría la edad bioeléctrica de TODOS los
> pacientes entre 1 y 8 años, más cuanto más sano esté el paciente.
> ```
>
> **Y la línea siguiente, en el mismo archivo:**
> ```
> const LE8_MAPEO_CORREGIDO = true;
> ```

### Cita 2 · Lo que dijo el 30 de agosto sobre μ y σ

> **Hicieron bien en no encenderlo, y la nota que los frenó es mía.**
>
> La media 58,578 y la desviación 13,332 del ICEC **no están establecidas**, y por eso escribí esa
> advertencia al lado del interruptor. **Encender el mapeo sin la recalibración movería la edad biológica
> de todos los pacientes entre uno y ocho años contra dos constantes que yo mismo marqué como no
> verificadas.** Eso no se hace.
>
> **La recalibración va por mi lado y llega con el dato, no con una instrucción.** Hasta entonces el
> interruptor se queda en `false`. **No lo enciendan por partes ni por su cuenta.**

### Cita 3 · Lo que dijo el 4 de septiembre sobre por qué la recalibración es imposible hoy

> **El interruptor está en `true` por decisión de esta Dirección, tomada el 2 de septiembre y reafirmada
> ese mismo día.** No es un descuido, no es un estado intermedio y no es la segunda vez que se les pasa:
> es la segunda vez que **no se les dijo**.
>
> [...] con el mapeo apagado, **dos de los ocho dominios del LE8 —Alimentación e Hidratación— leían
> campos que solo existen en el objeto `DEMO`**. En paciente real daban cero, y esos dos dominios
> quedaban clavados en 30 y en 20 **para todo el mundo, midiera lo que midiera la persona**.
>
> Eso sí era un defecto, y de los que no se ven: el LE8 parecía funcionar porque se probaba con el caso
> demo.
>
> **La recalibración no está pendiente de una firma. Está bloqueada por ausencia de dato.**
>
> μ y σ del ICEC se calculan sobre una población con ICEC medido. **Ninguna fuente disponible lo trae**
> [...] La razón es estructural, no logística: **el ICEC se calcula desde la encuesta**, y ninguna de
> esas fuentes la trae. [...] **es que hoy no existe la tercera cosa que ambas requieren.** Se recalibra
> cuando haya una masa de pacientes con encuesta completa.
>
> Y sobre las mismas constantes, en la misma respuesta:
>
> **μ = 58,578 y σ = 13,332 tampoco tienen origen documentado.** No aparecen en ninguno de los dos
> documentos técnicos de la EB-BIS [...] **la v5 necesita su documento técnico.**

### Lo que las tres dicen juntas

Puestas en orden, el cuadro es este:

1. Su comentario y su mensaje del 30 dicen lo mismo: **el interruptor se queda apagado hasta recalibrar**,
   y no se enciende "por partes ni por su cuenta".
2. Su respuesta del 4 dice que **la recalibración es imposible hoy** y que las dos constantes **no tienen
   origen documentado**.
3. **Y su archivo lo tiene encendido.**

Por su propia regla del 30 de agosto, con la condición 1 imposible de cumplir, el interruptor **no podría
encenderse nunca**. Y sin embargo está encendido.

**Las dos opciones tienen un problema escrito por él:**

- **Encendido:** la edad biológica de todos baja entre 1 y 8 años, contra dos constantes que él mismo
  marcó como no verificadas y que ahora dice que no tienen origen documentado.
- **Apagado (lo de hoy):** dos de los ocho componentes del LE8 corren clavados en el mismo valor para
  todo el mundo, midiera lo que midiera la persona.

**No lo tocamos.** Atlas sigue en `false`.

### El dato que hacía falta: qué pasa con los diagnósticos ya emitidos

**Esto también lo contestó él**, el 30 de agosto, en el mismo párrafo de la cita 2:

> **Y sí: la conducta de reemisión aplica igual a la EB-BIS.** Es la misma regla del 12b, y con más razón
> aquí, porque una recalibración poblacional mueve a todos por definición: **reemisión obligatoria si el
> paciente cambia de banda, y aviso cuando le cambie el tratamiento.**

O sea que si se enciende:

- Los diagnósticos ya emitidos **no se marcan como desfasados en bloque**. La regla es por paciente.
- **Hay que reemitir a todo paciente que cambie de banda** de edad biológica. Como el cambio baja la edad
  entre 1 y 8 años, muchos cruzarían una banda.
- **Se le avisa a cada uno cuyo tratamiento cambie** como consecuencia.

**Y aquí está lo que vuelve la decisión fácil:** medido hoy sobre la base, **no hay ningún tratamiento
aprobado y no hay pacientes reales todavía**. Así que la reemisión obligatoria, que es lo caro de esta
decisión, **hoy no cuesta nada**. Después del hito 2 sí, y crece con cada paciente que entre.

*(Ese conteo se midió antes en esta sesión. Vale la pena repetirlo el día que se decida, porque es
justamente el número que cambia.)*

### Mi recomendación

**Preguntárselo en una línea**, no en una ronda: *"tu archivo lo tiene encendido y el 30 de agosto nos
dijiste que se quedaba apagado hasta recalibrar, que hoy es imposible. ¿Cuál mandamos?"*.

Y si contesta que encendido, **el momento de hacerlo es AHORA**, antes del hito 2, precisamente porque no
hay pacientes a quienes reemitir. Cada semana que pase lo encarece.

---

## 2 · Tres colores dicen lo contrario que su etiqueta

Atlas clasifica al paciente en nueve casillas que cruzan qué tan bien funciona su célula con cuánta
inflamación tiene. Cada casilla tiene un nombre y un color.

En su entrega arregló los **nombres**. Los **colores** no los movió, y él mismo lo señala al final:

> **Una cosa que queda señalada y sin tocar:** los colores de `FYR_LABELS` no se movieron, y con los
> rótulos nuevos hay tres que ya no acompañan. `3_3` "Función normal con riesgo" sigue en cian, `2_2`
> "Función sin riesgo" sigue en ámbar y `1_2` "Disfunción sin riesgo" sigue en rojo. **El color es
> contenido de esta Dirección y va firmado aparte**, no inferido de la nueva redacción.

**Efecto:** el color es lo primero que lee un profesional apurado. Hoy hay un paciente **con** riesgo
pintado de celeste (color de tranquilidad) y uno **sin** riesgo pintado de rojo (color de alarma). El
semáforo está al revés en tres de las nueve casillas.

**Qué podemos hacer:** nada por nuestra cuenta, los colores son suyos. Pero es la pregunta más barata que
queda: **son tres códigos de color.** Vale pedírselos por mensaje.

Mientras tanto sí podemos, sin tocar su ciencia, **hacer que el nombre pese más que el color** en la
pantalla. No arregla el problema, reduce la lectura equivocada.

---

## 3 · Dos cosas que prometió "para la próxima entrega" y no llegaron

Verificado contra el archivo del 4 de septiembre: **ninguna de las dos está.**

**a) Quitar el "(≥30 min)" de la pregunta 23.** Él mismo detectó la contradicción el 3 de septiembre:

> **Y hay una contradicción mía que hay que resolver de paso:** la P23 dice *"(≥30 min)"* y la P24 ofrece
> "Menos de 15" y "15–30 min". Si la P23 solo cuenta días con sesiones de treinta minutos o más, esas dos
> opciones de la P24 no pueden existir. **Se quita el "(≥30 min)" de la P23** y la duración la establece
> la P24, que es para lo que está. Va en la próxima entrega.

El rótulo sigue igual en el archivo del 4.

**b) Aterrizar el lenguaje de la pregunta 44.** Sobre alergias e intolerancias ya contestó lo de fondo, y
la respuesta fue que **siguen separadas**: *"Alergia e intolerancia no son lo mismo. ¿Por qué habrían de
preguntarse juntas?"*. Lo único que quedó pendiente fue el lenguaje:

> Sobre el lenguaje, Valentina tiene razón en un punto: la P44 pregunta por sustancias —lactosa, gluten,
> fructosa— y el paciente responde con alimentos. Eso se aterriza sin tocar la clasificación, poniendo el
> alimento al lado: *"Lactosa (leche y lácteos)"*, *"Gluten (trigo, pan, pasta)"*, *"Fructosa (frutas,
> miel)"*. Va en la próxima entrega.

Las opciones del archivo del 4 siguen siendo "Ninguna · Lactosa · Gluten · Fructosa", sin el alimento al
lado.

**Efecto:** el (a) deja una pregunta que se contradice con la siguiente. El (b) deja a un paciente
respondiendo con alimentos a una pregunta que le habla de sustancias.

**Qué podemos hacer:** las dos son de una línea y las dos están escritas por él, palabra por palabra, en
la cita de arriba. **No hace falta que él escriba nada nuevo: basta que confirme que las apliquemos.**
Es distinto de inventar contenido.

---

## 4 · Portar las opciones de ejercicio, que él ya arregló

**Esto no es una pregunta: es trabajo nuestro que está atrasado.**

Él arregló la observación de Valentina en su entrega del 3 de septiembre, y **Atlas todavía no lo tiene**:

| | Su archivo (desde el 3-sep) | Atlas hoy |
| --- | --- | --- |
| **P23** ¿Cuántos días/semana? | **"No hago ejercicio"** · 1 · 2 … 7 | "0" · 1 · 2 … 7 |
| **P24** ¿Cuánto dura cada sesión? | **"0 minutos a la semana"** · Menos de 15 … | Menos de 15 … |

**Efecto:** quien no hace ejercicio ya contestó 0 días, y a renglón seguido la encuesta le obliga a decir
cuántos minutos hace. **Tiene que responder algo falso para poder avanzar**, porque no deja seguir con
campos vacíos. Eso es lo que vio Valentina, y en su archivo ya está resuelto.

**Qué hay que hacer, y por qué no lo hice ya:** cambiar las opciones de una pregunta **obliga a subir la
versión de la encuesta**, y eso tiene consecuencias que hay que planear (las evaluaciones viejas siguen
apuntando a la versión anterior). Es un bloque con su plan y su prueba, no un cambio de una línea.
Conviene juntarlo con las dos correcciones del punto 3, para hacer un solo bump en vez de tres.

---

## 5 · Dos cosas que salieron de barrer su archivo al revés

Las dos aparecieron mirando **qué tiene su archivo que nosotros no**, que es la dirección que ningún
candado nuestro vigila (los candados prueban que lo nuestro sigue estando en el suyo, no al revés).

**Las dos son chicas y ninguna corre prisa.** Van aquí y no en una ronda: el ciclo con él está cerrado.

### a) Su archivo tiene dos clasificadores del índice cintura-cadera, con etiquetas distintas

El índice cintura-cadera se clasifica en su archivo en **dos sitios**, con los mismos cortes (0,90 en
hombre, 0,85 en mujer) y **distinta redacción**:

| Dónde | Debajo del corte | Encima |
| --- | --- | --- |
| `dICC` | "Normal" | "Riesgo cardiovascular" |
| `clasifICC` | "Riesgo bajo" | "Riesgo alto — distribución central" |

Es la **misma forma** del problema que él acaba de arreglar en los nueve sectores: dos sitios de su archivo
nombrando lo mismo de dos maneras.

**Verificado: no tiene consecuencia visible en Atlas.** Nosotros portamos solo `dICC`, byte a byte, y el
índice se pinta en **un único sitio**. Un profesional nunca ve las dos etiquetas para el mismo paciente.
El problema vive en su prototipo, no en nuestro porte.

**Lo que se le preguntaría, cuando haya ocasión:** cuál de las dos manda. La suya viva dice más
("distribución central" explica *por qué* es riesgo), así que puede que la nuestra se quede corta.

### b) Tiene un clasificador completo que nadie llama, ni él

`clasifLancet` es un clasificador de cuatro niveles que cruza IMC con masa grasa y masa magra, rotulado
*"Propuesta The Lancet 2025"*. Está completo, con sus etiquetas y sus colores.

**Y en su propio archivo aparece una sola vez: la declaración.** Nadie lo invoca.

Es la misma situación de las tres piezas que él declaró muertas en septiembre (*"quedan marcadas para
borrarse, no para conectarse"*), **con una diferencia: esta nunca la ha mencionado.**

**No lo portamos**, y no por pereza: conectar una pieza que su propio archivo no conecta sería estrenar
una clasificación clínica por nuestra cuenta, que es justo lo que la Regla 0 prohíbe. Lo que cabe es
preguntarle si es un resto o algo que piensa usar.

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
