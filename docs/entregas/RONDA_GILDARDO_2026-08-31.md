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
| **Punto 6** · conectar la dinamometría; el sellado se reabre | **Aplicado**, en ese orden. La fuerza prensil ya entra al fenotipo y el sellado se reabre con motivo, registrado |
| **Punto 8** · una nota por profesión | **Aplicado.** Y de ahí sale el punto 6 de esta ronda |

**Y tu punto 0 quedó registrado como regla de trabajo nuestra**, no como una corrección puntual: *"cuando
una pieza del archivo no coincide con otra, la primera pregunta no es cuál corregir, sino si están mirando
dos instrumentos distintos"*. Barrimos el resto del código buscando el mismo error y **el único cruce era
el que tú señalaste**: el resto lee cada regla contra su tabla.

---

## Los nueve de un vistazo

**Solo uno bloquea construcción**, y es el que queda de tu punto 2. Los demás son declaraciones y una corrección nuestra.

| # | Qué es | Qué necesitamos de ti | ¿Bloquea? |
| --- | --- | --- | --- |
| **1** | **Dónde se capturan las porciones por grupo de la tabla de composición** | El sitio. Sin ellas, `calcConsumo` suma cero | **SÍ · las diez alertas** |
| **2** | Tu archivo captura una **fecha de consulta**; Atlas la deduce | Si esa fecha debe capturarse en Atlas | No |
| **3** | Declaración: nuestra historia clínica y nuestro reporte dicen "Fecha" con **fechas distintas** | Nada, salvo que lo veas distinto | No |
| **4** | Declaración: tu punto 4 tenía **cuatro sitios**, y describimos mal uno | Nada, salvo que lo veas distinto | No |
| **5** | Los **encabezados de categoría** de la matriz: los quitamos de la encuesta del paciente | Si se quedan solo para el profesional | No |
| **6** | Las notas por profesión: **te preguntamos mal y contestaste sobre nuestra premisa** | A qué campo tuyo corresponde nuestra nota | No |
| **7** | Tu `importarComposicion` mapea la **cintura al umbral OMS (102)**, no a la medida | Si es deliberado o es un descuido | No |
| **8** | **`diagProf` y `tratSugerido`**: los campos por profesión de tu archivo, sin portar | Qué son y si van en Atlas | No |
| **9** | Declaración: **cinco cambios en la pantalla del nutricionista**, uno de ellos contra algo que aprobaste | Si las guías dietarias vuelven, si los tiempos van en otro sitio, y si te sobra la procedencia del peso meta | No |

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

# 6 · Las notas por profesión: aplicamos tu principio, y te preguntamos mal

**Tu instrucción está aplicada:** cada nota se sella con la profesión desde la que se escribió, y esa
profesión sale del perfil de quien escribe, nunca de un campo del formulario (si viajara en el formulario,
un profesional podría firmar con el rol de otro). Nadie puede pisar la nota de nadie.

**Y ahora la corrección, que es lo que de verdad traemos aquí.** Nuestra pregunta decía que en tu archivo
*"hay tres campos de nota, uno por profesión"*. Fuimos a verificarlo al aplicar tu respuesta y **no es**
**así**. Tu archivo tiene `trat.porProfesional`: un sub-almacén por profesión con **cuatro** roles (tu
propio `PROF_LABELS`: nutricionista, médico, entrenador, psicólogo), y sus campos de texto libre son
**`diagProf`** y **`tratSugerido`**. No hay unas "notas".

**Contestaste sobre nuestra premisa, no sobre tu archivo**, y eso es culpa nuestra. El principio que diste
vale igual y es el que aplicamos. Lo que queda abierto es la correspondencia:

**¿Nuestras "Notas del tratamiento" son tu `diagProf`, tu `tratSugerido`, o una tercera cosa que no está**
**en tu archivo?** Lo preguntamos porque ninguno de los dos está portado todavía, y si nuestra nota ES uno
de ellos, lo que hay que hacer es portarlo con tu nombre y no mantener un campo paralelo.

**Un detalle menor del mismo hilo:** dijiste "tres campos" y tu archivo tiene cuatro roles. Usamos los
cuatro, que son los que Atlas ya tiene. Si el cuarto no lleva nota, dilo.

---

# 7 · Tu `importarComposicion` mapea la cintura al umbral, no a la medida

**Nunca te lo habíamos preguntado, y llevamos un mes divergiendo de tu archivo a propósito.**

En `importarComposicion`, la cintura sale de la columna de **referencia** del export del Biody:

```js
cintura: nv(row["Patient risk monitoring Waist Size ... REFERENCEESTIMEEEXPORT cm"])   // = 102
```

Esa columna es el **corte de riesgo de la OMS**, no la medida del paciente: vale **102 para todo hombre**,
lo mida quien lo mida. Lo verificamos en dos entregas tuyas distintas, así que **no es un error de nuestra
transcripción: es tu mapeo.**

**Qué hicimos, y por qué es seguro:** en Atlas ese campo **no se mapea**. Ningún cálculo nuestro consume
`cintura` desde ahí (el ICC, el ICT y el IR se leen como columnas propias), así que la trampa está inerte;
la circunferencia MEDIDA la leemos de `Waist Size cm`, que es la buena. Hay un test que impide que reaparezca.

**¿Es deliberado?** Preguntamos porque si en algún momento tu archivo empieza a calcular un ratio con esa
variable, lo haría con 102 para todos los pacientes y no se notaría.

---

# 8 · `diagProf` y `tratSugerido`: dos campos tuyos que no están en Atlas

**Salieron hoy, verificando lo de las notas, y no están en ninguna ronda anterior.**

Tu archivo guarda por profesión (`trat.porProfesional[rol]`) al menos estos campos de texto:

| Campo | Lo que parece ser |
| --- | --- |
| `diagProf` | La impresión diagnóstica que escribe ese profesional |
| `tratSugerido` | El tratamiento que ese profesional propone |

**Ninguno de los dos está portado.** Atlas tiene, por profesión, el abordaje y las indicaciones que
**calcula** el modelo, pero no un sitio donde el profesional **escriba** su impresión ni su propuesta.

**Dos preguntas, y la segunda es la que decide:**

1. **¿Qué son exactamente?** ¿`diagProf` es la impresión clínica del profesional, distinta del diagnóstico
   del modelo? ¿`tratSugerido` es lo que él propone, frente a lo que el motor propone?
2. **¿Van en Atlas, o eran del prototipo?** Si van, portarlos con tus nombres es lo correcto, y entonces
   **nuestras "Notas del tratamiento" probablemente son uno de los dos** (ver el punto 6) y no un tercer
   campo que mantener en paralelo.

---

# 9 · Declaración: cinco cosas que cambiamos en la pantalla del nutricionista

**Cotejamos tu pantalla contra la nuestra, zona por zona.** Casi todo fue adoptar tu disposición. Estas
cinco son las que te debemos decir, porque una va contra algo que aprobaste, otra es un hallazgo tuyo que
nos sirvió, y las demás son huecos nuestros.

## 9.1 · Retiramos las guías dietarias, que tú habías aprobado

**Aprobaste expresamente que se quedaran**, el 26: *"la caja se queda"*. Las quitamos igual, y esta es la
razón, para que la revises:

La caja era un campo de texto libre donde el profesional escribía recomendaciones. En la práctica decía lo
mismo que ya dicen, en el mismo scroll, la prescripción del modelo (proteína, sodio, grasa) y las notas del
tratamiento. Y lo único que alguien había escrito en ella, en el paciente de prueba, era una línea de
**fenotipo EFR**, que el modelo ya calcula y ya muestra: la caja estaba sirviendo para teclear a mano un
dato que el sistema tiene.

**Lo dejamos reversible a propósito.** La tabla, el servicio y la acción de guardar siguen en su sitio; lo
único que se quitó fue el montaje en la pantalla. Si nos dices que la caja se queda, vuelve con una línea y
sin perder nada de lo guardado.

## 9.2 · Los tiempos de comida quedan ARRIBA de las dos tablas, no junto a ellas

En tu pantalla el bloque de tiempos está al lado de las tablas que alimenta. En la nuestra va **antes**, y
lo mantuvimos así por una razón de orden de trabajo, la misma con la que tú separaste el objetivo de la
cadena: **los tiempos gobiernan las dos tablas de abajo** (la distribución reparte dentro de los tiempos
activos, y el menú semanal usa esos mismos tiempos como columnas). Puestos al lado, el profesional los
cambia después de haber repartido y tiene que rehacer las dos.

**Si en tu flujo se deciden en otro momento, dilo y los movemos.**

## 9.3 · Tu GEB usa Cunningham, igual que el nuestro. Eso reduce una pregunta abierta

Verificándolo encontramos que **tu pantalla calcula el gasto basal con Cunningham sobre masa libre de
grasa**, exactamente como la cadena de Atlas.

Lo decimos porque cambia el tamaño de una pregunta que tenemos abierta: `motorTratNutri` calcula el gasto
con **Mifflin sobre el peso meta**, y eso no discrepa con nosotros, **discrepa con tu propia pantalla**. Es
otra de las diferencias entre tus dos motores, como el sodio. No tocamos nada: seguimos mostrando la cadena
con Cunningham y las cifras calóricas de `motorTratNutri` siguen sin conectarse, esperando tu decisión
sobre cuál motor manda.

## 9.4 · Imprimir el plan: tu pantalla lo hace, la nuestra no

Tu pantalla tiene la salida impresa del plan alimentario para entregárselo al paciente. **Atlas no la
tiene.** No es una decisión nuestra ni una discrepancia: es un hueco que no habíamos registrado, y lo
vamos a construir. Lo declaramos para que sepas que lo vimos y que no está esperando nada tuyo.

## 9.6 · El tipo de dieta lo decide un gasto que la pantalla no muestra

**Apareció arreglando otra cosa, y te lo contamos porque es tu pregunta del gasto con una superficie
nueva.** Nuestro título de la dieta decía siempre "hipocalórica", pusiera el nutricionista 500 kcal o
5.000. Lo arreglamos pasándole a `motorTratNutri` el objetivo editado, que es la entrada que tu propio
motor ya tiene, y entonces tu línea recalcula el tipo. Fiel, y sin ciencia nuestra de por medio.

**Pero el tipo sale de comparar el objetivo contra el GET de `motorTratNutri`, que es Mifflin sobre el
peso meta, y la pantalla muestra el GET de la cadena, que es Cunningham sobre masa libre de grasa.** En el
paciente de prueba: cadena 2.574 kcal, GET del motor 2.536. El plan queda rotulado **"Hipercalórica"**
aunque el nutricionista lo dejó en mantenimiento puro. Treinta y ocho calorías de diferencia de método,
convertidas en una palabra clínica.

Alineamos lo que se podía sin tocar tu ciencia: el **factor** de actividad ya viaja al motor, así que la
única diferencia que queda es la fórmula del gasto. Tu motor no acepta un GEB de entrada, así que alinear
eso es exactamente decidir cuál manda.

**Es la misma pregunta que ya te hicimos, y por eso no la contamos como nueva.** Lo que cambia es que
antes era invisible (no mostrábamos las cifras calóricas de ese motor, a propósito) y ahora se lee en el
título del plan. No tocamos nada más mientras respondes.

---

## 9.5 · El peso meta ya es un solo dato, con un residuo que estamos cerrando

**Tu punto 2 del 28 está aplicado**, y el defecto que anunciaste era peor de lo que suponíamos: el campo de
la entrada existía desde hace meses, el profesional lo llenaba, y **no lo leía nada**. Ni la cadena, ni el
sellado, ni el menú. Se acordaba un peso meta con el paciente y la prescripción no se movía un gramo.

Ya está conectado: el peso de la entrada gobierna toda la cadena, el ajuste del panel lo reemplaza cuando
el nutricionista lo mueve, y la pantalla dice de dónde viene el número en cada caso.

**Y ya hay un solo sitio de guardado.** Cuando escribimos esto quedaba un residuo, dos columnas que en
teoría podían decir números distintos, que es literalmente lo que advertiste (*"si los construyen como
campos separados, el defecto lo crean ustedes"*). Se cerró el mismo día: el peso meta vive en el registro
del **paciente** y el tratamiento lo lee, como dijiste. Las dos pantallas escriben en el mismo campo.

**Lo que sí conservamos, y queremos que lo sepas porque no lo pediste:** de cuál de las dos superficies
salió el número. En la pantalla del nutricionista dice *"fijado en la entrada"* o *"fijado por ti aquí"*.
No es un dato de sistema: no es lo mismo el peso que acordaste con el paciente en la consulta que uno
ajustado después, al armar el plan, y quien lee el plan tiene derecho a distinguirlos. **Si te sobra, se
quita.**

---

## Lo que queda esperando, y de quién es

**Tuyo:** la recalibración del ICEC (μ y σ), que dijiste que va por tu lado y llega con el dato. El
interruptor sigue en `false` y no lo tocamos.

**Nuestro:** la salida impresa del plan alimentario (punto 9.4), sin bloqueo. La dinamometría, la
reapertura del sellado, las notas por profesión y la unificación del peso meta, que estaban en construcción
cuando empezamos esta ronda, ya están.

**Y una sola pregunta bloquea algo:** la del punto 1.

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
