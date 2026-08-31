# Ronda del 2026-08-31

**De:** Equipo Atlas
**Para:** Gildardo Uribe, Dirección Científica CNV
**Fecha:** 31 de agosto de 2026

---

## Antes de nada: tu respuesta del 30 está aplicada

| Lo tuyo | Estado |
| --- | --- |
| **Punto 4** · el dominio sin dato no puntúa, y el radar no dibuja ese vértice | **Aplicado.** Y encontramos cuatro sitios, no uno: ver el punto 4 de abajo |
| **Punto 5** · las tres positivas en bloque aparte | **Aplicado.** Bloque propio, con menos peso visual |
| **Punto 1** · la conducta general del dato ausente | **Aplicada sin volver a preguntar**, como pediste. Barrimos y arreglamos dos sitios más |
| **Punto 2** · no hay puente que construir | **Retirada la pregunta.** Y de ahí sale el punto 1 de esta ronda |
| **Punto 3** · el interruptor del ICEC se queda en `false` | **Sin tocar.** Queda esperando tu recalibración |
| **Punto 6** · conectar la dinamometría; el sellado se reabre | **En construcción**, en ese orden |
| **Punto 8** · una nota por profesión | **En construcción** |

**Y tu punto 0 quedó registrado como regla de trabajo nuestra**, no como una corrección puntual: *"cuando
una pieza del archivo no coincide con otra, la primera pregunta no es cuál corregir, sino si están mirando
dos instrumentos distintos"*. Barrimos el resto del código buscando el mismo error y **el único cruce era
el que tú señalaste**: el resto lee cada regla contra su tabla.

---

## Los cinco de un vistazo

**Solo uno bloquea construcción**, y es el que queda de tu punto 2. Tres son declaraciones.

| # | Qué es | Qué necesitamos de ti | ¿Bloquea? |
| --- | --- | --- | --- |
| **1** | **Dónde se capturan las porciones por grupo de la tabla de composición** | El sitio. Sin ellas, `calcConsumo` suma cero | **SÍ · las diez alertas** |
| **2** | Tu archivo captura una **fecha de consulta**; Atlas la deduce | Si esa fecha debe capturarse en Atlas | No |
| **3** | Declaración: nuestra historia clínica y nuestro reporte dicen "Fecha" con **fechas distintas** | Nada, salvo que lo veas distinto | No |
| **4** | Declaración: tu punto 4 tenía **cuatro sitios**, y describimos mal uno | Nada, salvo que lo veas distinto | No |
| **5** | Los **encabezados de categoría** de la matriz: los quitamos de la encuesta del paciente | Si se quedan solo para el profesional | No |

---

# 1 · Ya podemos portar la tabla de composición. Falta saber de dónde salen las porciones

**Tu punto 2 desbloqueó las diez alertas casi del todo, y queda un solo dato.**

Vamos a portar la tabla de composición y sus reglas tal como están, con su numeración y sus unidades, que
es lo que pediste. Y el omega-3 estaba donde dijiste: en esa tabla, con su valor por grupo. Lo habíamos
buscado en la lista de intercambio, que es el instrumento equivocado.

**El dato que falta es el insumo.** Tu `calcConsumo` recorre los dieciocho grupos de la tabla y multiplica
**porciones × nutriente**:

```js
for (let i = 1; i <= 18; i++) {
  const p = Number(enc[`d1_${i}`]) || 0;   // porciones/día del grupo i
  if (!p) continue;
  const g = TCAC[i]; ...
}
```

**Esos `d1_1` … `d1_18` no los captura la encuesta.** Buscamos en todo tu archivo dónde se escriben: la
única escritura de un campo D1 es la matriz de frecuencia (`d1_N_i`, el índice 0-4). Los dieciocho de
porciones aparecen solo en el objeto de demostración, bajo el comentario `// Consumo D1`.

**Y no lo decimos como hallazgo nuestro: lo escribiste tú, tres campos más allá, sobre el LE8:**

> *"Los campos d1_9, d1_10 y d1_16 que lee calcLE8 **NO existen en la encuesta**: solo viven en el objeto
> DEMO, y por eso el defecto pasó inadvertido (al probar con el caso demo, el LE8 parecía funcionar). En un
> paciente real las tres lecturas dan 0."*

Es exactamente lo mismo, en la función de al lado.

**¿Dónde se capturan esas porciones?** En tu objeto de demostración van junto al peso, la talla y la
cintura, que son las que el profesional escribe en el Motor, así que nuestra lectura es que las registra
él y no el paciente. Pero es lectura nuestra, y por eso preguntamos en vez de construirlo.

**Y por eso el porte va con las reglas apagadas hasta que respondas**, no por prudencia sino por tu propio
punto 1: con las porciones en cero, `cons.fibra` vale 0 y **"Fibra muy baja" se dispararía en todos los
pacientes**. Sería el dato ausente entrando como respuesta, y encima como alarma.

**Y una línea que va con esto, no aparte.** Tus dos reglas de azúcares (`d1_15` y `d1_14`, que nos
corregiste el 28 a `d1_13`) piden `>= 2`. Las estamos leyendo como el **índice 0-4** de la frecuencia, que
es lo que Atlas captura hoy. Si las porciones se capturan, esas dos podrían leer porciones. **¿Cuál de las
dos?** Va aquí y no como pregunta suelta porque es la misma decisión vista del otro lado.

---

# 2 · Tu archivo captura una fecha de consulta. Atlas la deduce

**Y es una diferencia que hoy no se nota y mañana sí.**

Tu archivo tiene un campo **"Fecha de consulta"**, que el profesional escribe, en el bloque de
identificación. Y es **la única fecha de todo tu producto**: viaja de la encuesta a la antropometría, de
ahí al BIS y de ahí al encabezado del reporte. La fecha de medición del equipo no aparece nunca.

**Atlas no la captura.** Deduce esa fecha de cuándo se creó el registro, que **en una evaluación inicial es
cuándo el paciente firmó**, y puede ser días antes de la consulta.

**Hoy da casi igual**, porque el escaneo y la consulta ocurren el mismo día. Pero el modelo que CNV quiere
a mediano plazo separa las dos: el tamizaje se haría antes, incluso en casa del paciente, y la consulta
después. Ahí la deducción deja de aproximar y pasa a estar mal, en la **historia clínica**, que es el
documento legal.

**¿Esa fecha debe capturarse en Atlas, como en tu archivo?** Y si es así, **¿es ella la que fecha la
historia clínica y el reporte?**

---

# 3 · Declaración: nuestra historia clínica y nuestro reporte se fechan distinto

**No es pregunta; es un defecto nuestro que encontramos preparando lo anterior y preferimos que lo sepas.**

En Atlas, la historia clínica dice `Fecha:` con la fecha del registro, y el reporte dice `Fecha:` con la de
la medición del equipo. **Dos documentos del mismo acto, la misma etiqueta, dos fechas.** En tu archivo hay
una sola y no hay ambigüedad posible.

Lo resolvemos con tu respuesta al punto 2. Lo decimos ahora porque es del tipo de cosa que pasa
inadvertida hasta que alguien compara dos impresiones del mismo paciente.

---

# 4 · Declaración: tu punto 4 tenía cuatro sitios, y describimos mal uno

**Aplicado. Y al aplicarlo pasaron dos cosas que van escritas.**

**La primera: eran cuatro, no uno.** Señalaste el `?? 1` del dominio metabólico. Los otros tres tenían la
misma forma: el celular, el epigenético y el de envejecimiento. Los cuatro corregidos, y tu `?? 1` se
conserva para lo que lo escribiste (una clasificación fuera del mapa, donde **sí** hay dato).

**La segunda es una corrección de lo que dijimos, no del código.** Reportamos internamente que el dominio
de Envejecimiento sin dato **afirmaba patología** (severidad 2, *"envejecimiento acelerado"*). Esa rama
existe en tu función, pero **no se alcanzaba**: el adaptador fabricaba un IAE de 0 y lo clasificaba
*"Concordante"*, así que lo que de verdad pasaba era la lectura **favorable**: el dominio salía en verde
con *"su ritmo de envejecimiento es acorde con su edad cronológica"* sobre un paciente al que nadie le
calculó la edad biológica. El defecto era real; nuestra descripción no. Lo corregimos aquí porque razonar
sobre la función suelta en vez de ejecutar el flujo completo es un error que ya nos costó otras veces.

**Y una consecuencia que preferimos que veas, porque cambia una prescripción.** Ese dominio inventado
activaba la **Ruta 4 (Desaceleración del Envejecimiento)** y le ponía a las cuatro profesiones un objetivo
de envejecimiento, con una meta medible a 24 semanas: *"reducción del IAE de al menos 2 años"*. Sobre un
IAE que no existe. Ya no.

**Lo único que decidimos nosotros, y va declarado:** el riesgo integrado ahora se **renormaliza** sobre los
dominios medidos. Dejarlo como estaba hacía que el término ausente sumara cero, o sea que **al paciente le
bajaba el riesgo por no haber medido**, que es la misma lectura favorable de un vacío. Y la pantalla dice
sobre cuántos dominios se calculó. Si prefieres otra conducta, dilo aquí.

---

# 5 · Los encabezados de categoría: los quitamos de la encuesta del paciente

**Es una divergencia contra tu archivo, decidida por nosotros, y por eso va con las dos mitades.**

**La primera mitad es tuya, y la portamos.** Tu archivo agrupa los quince alimentos en tres bloques y pinta
el rótulo de cada uno encima, en la encuesta que responde el paciente, cada uno con su banda de color. Y tu
regla es explícita: *"la agrupación que ve el paciente es esa misma: el orden es el mensaje"*.

**La segunda mitad es la que nos hizo dudar.** Es un cuestionario de frecuencia de consumo, y decirle a
alguien que el bloque que va a contestar son "procesados y ultraprocesados" antes de que conteste lo empuja
hacia la respuesta que se espera de él. El sesgo de deseabilidad está descrito en este instrumento, y no es
parejo: aprieta hacia abajo en el bloque de riesgo y hacia arriba en el protector.

**Qué hicimos mientras respondes:** los retiramos de la pantalla del paciente y los dejamos en las vistas
del profesional, con tu banda de color. **El orden no se tocó:** las carnes rojas siguen en la posición 11.
Se retiró el rótulo, no la agrupación.

**¿Se quedan solo en la vista del profesional, o vuelven también a la del paciente?** Si dices que vuelven,
vuelven: es tu instrumento.

---

## Lo que queda esperando, y de quién es

**Tuyo:** la recalibración del ICEC (μ y σ), que dijiste que va por tu lado y llega con el dato. El
interruptor sigue en `false` y no lo tocamos.

**Nuestro:** conectar la dinamometría al motor, reabrir el sellado con la reemisión del 12b, y las tres
notas por profesión. Los tres en construcción, sin bloqueo.

**Y una sola pregunta bloquea algo:** la del punto 1.

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
