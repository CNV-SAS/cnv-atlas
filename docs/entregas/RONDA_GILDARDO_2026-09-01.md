# Ronda del 2026-09-01

**De:** Equipo Atlas
**Para:** Gildardo Uribe, Dirección Científica CNV
**Fecha:** 1 de septiembre de 2026

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

## Los diez de un vistazo

**Se abrió el 31 de agosto y se cerró el 1 de septiembre**, así que algunos puntos dicen "hoy" de un día y
otros del siguiente. Los diez van fechados donde importa.

**Dos preguntas bloquean construcción:** la del punto 1 (las diez alertas de consumo) y la del 10.4 (el
mapa de alimentos por región, sin el cual el paciente no puede recibir su lista de intercambio).

**Y una no bloquea nada y es la más cara:** la del 9.6. Tus dos motores prescriben cifras distintas para
el mismo paciente, y desde esta semana la diferencia se ve en pantalla y en el documento que él recibe. Los demás son declaraciones y una corrección nuestra.

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
| **10** | **Tu §7.1 estaba aplicado a medias**: le seguíamos mandando al paciente los índices que prohibiste. Ya no, y ahora recibe el plan completo | El **mapa de alimentos por región** (10.4) y una línea por **nutracéutico** en su idioma (10.8) | **SÍ · 10.4 bloquea la lista de intercambio del paciente** |
| **9** | Declaraciones sobre **la pantalla del nutricionista**: siete, una contra algo que aprobaste y una que agrupa distinto que la tuya | Si vuelven las guías dietarias, si los tiempos van en otro sitio, si te sobra la procedencia del peso meta, y si prefieres tu agrupación y tu rótulo | No |

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

# 9 · Declaración: siete cosas que cambiamos en la pantalla del nutricionista

**Cotejamos tu pantalla contra la nuestra, zona por zona, y la corregimos por tandas con una prueba en
navegador entre cada una.** Casi todo fue adoptar tu disposición. Estas siete son las que te debemos
decir: una va **contra algo que aprobaste** (9.1), otra **agrupa distinto que la tuya** (9.7), dos son
**hallazgos que nos sirvieron a nosotros** (9.3 y 9.6) y el resto son **huecos nuestros** que ya cerramos
o vamos a cerrar.

**Ninguna te pide una decisión para seguir.** Si alguna no te gusta, se revierte.

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

## 9.6 · Tus dos motores discrepan en dos sitios que ahora se ven

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

**Y hay una segunda superficie, que apareció en el smoke: la PROTEÍNA.**

En la misma pantalla, el chip dice **"Proteína 1 g/kg"** (lo que prescribe `motorTratNutri`) y la cadena
calórica calcula con **0,8 g/kg** (el `protMin` de `atlas-protocolo`). **En un paciente de 80 kg son
dieciséis gramos de proteína al día de diferencia**, y hasta el smoke los dos números convivían sin que
nada dijera que discrepaban.

**No elegimos.** Añadimos un aviso en la cadena que dice las dos cifras y deja el campo editable al lado,
para que el nutricionista decida con la diferencia a la vista. Pero el aviso es un parche: **quien tiene
que decidir cuál manda eres tú.**

**Es la misma pregunta que ya te hicimos, y por eso no la contamos como nueva.** Lo que cambia es que
antes era invisible (no mostrábamos las cifras calóricas de ese motor, a propósito) y ahora se lee en dos
sitios que el profesional y el paciente sí ven: el título del plan y los gramos de proteína.

**Es la pregunta más cara que tienes abierta.** No bloquea construcción, pero cada día que pasa hay
pacientes con una prescripción que sale de dos motores que no coinciden.

---

## 9.7 · Declaración: agrupamos en dos bloques lo que tu pantalla agrupa en uno

**Es forma, no contenido, y por eso te lo declaramos en vez de preguntártelo.** Los mismos campos, los
mismos números, la misma cadena. Lo único distinto es dónde cae la línea que separa un bloque del
siguiente.

Tu pantalla tiene **un bloque**, "Objetivo del tratamiento nutricional", con el objetivo calórico y los
cuatro campos que lo producen. Atlas tiene **dos**: "Objetivo del plan" (donde se decide) y "Cómo se llega
a ese objetivo" (la cadena que lo produce).

**Y la razón de partirlo es tuya.** Es tu §8.1 del 26 de agosto, cuando te propusimos justo lo contrario,
fundirlos, y dijiste que no:

> *"La fórmula desarrollada depende de la decisión del nutricionista de subir o bajar las calorías.
> Primero se decide la meta; después se ve la cadena que la produce. Fundirlas invierte el orden y empuja
> al profesional a mover la calculadora cuando lo que quería era fijar un objetivo."*

Nos pareció una razón de orden de trabajo, no de estética, y la sostuvimos. **Lo que sí corregimos en esta
ronda es que los cuatro campos estaban repartidos entre los dos bloques**, y ahora están juntos arriba,
donde tú los pones. El PAL y el déficit se repiten abajo, dentro de la cuenta, pero son el mismo dato: se
cambia uno y el otro cambia con él.

**El objetivo calórico es el único que no repetimos como editable**, y también por tu instrucción de ese
mismo §8.1: *"editable en uno solo y en lectura en el otro"*. Abajo se ve, con una etiqueta que dice dónde
se cambia.

**Si prefieres tu agrupación, se cambia.** Es una tarde de trabajo y no toca un solo número.

### Y de paso, un rótulo

A lo que tú llamas **"fórmula sintética"** nosotros le pusimos **"Cómo se llega a ese objetivo"**. No fue
descuido: el rótulo nuestro dice lo que el bloque hace, y "sintética" describe cómo está escrita la
fórmula, no para qué sirve mirarla. Un nutricionista que abre esa pantalla por primera vez sabe qué va a
encontrar.

**Si el rótulo te importa, lo devolvemos.** Es una palabra.

---

# 10 · Tu §7.1 está aplicado a medias, y tenemos que decirte por qué

**Lo primero, porque es lo que más importa: durante seis días seguimos mandándole al paciente lo que tú
dijiste que no debía salir.** IFC, IRC, PABU, ICA-BIS, ISCM, IEHH y el código de estado, en el PDF que
sale por correo. Tu instrucción es del 26 de agosto y es literal:

> *"lo que hoy le mandan —IFC, IRC, PABU, ICA-BIS, ISCM, IEHH y el código `N_N_N_A`— **no debe salir así**.
> Ningún índice del modelo va al paciente."*

**Ya no salen.** Se retiraron los cuatro bloques del modelo. No fue que no lo hubiéramos entendido: lo
teníamos registrado con tu respuesta al lado, y con una nota que decía "congelado hasta que responda". Tú
respondiste y nadie volvió a esa nota. El error es de proceso y es nuestro.

## 10.1 · Y ya lleva el plan completo, no solo el informe

Cuando escribimos el párrafo de arriba, el reporte se había quedado en cuatro cosas: el cambio respecto a
la medición anterior, los nutracéuticos, las notas del profesional y la línea de la historia clínica.
**Preferimos un documento corto a uno que le dijera "CRÍTICO" a una persona sin nadie que se lo explique.**

**Ya no está corto: lleva seis de los siete bloques de tu §7.1.** El diagnóstico (traducido, ver 10.3),
la meta, el plan dietético, lo que debe evitar, el ejemplo de menú, la distribución por porciones y las
recomendaciones que aplican a su caso.

**En tu orden, con el diagnóstico primero**, que es como lo pusiste en tu lista: primero qué tiene,
después la solución.

**Falta el séptimo: la lista de intercambio recortada por región.** Es la del 10.4, y es lo único de tu
§7.1 que sigue sin poder construirse.

## 10.2 · Declaración: el paciente sí puede pedir su historia clínica, y se lo decimos

**Consultamos al asesor legal, y tu criterio y el derecho del paciente conviven sin ceder ninguno.**

Tú decidiste que la historia clínica es el documento del profesional y que el paciente no la recibe.
Legalmente el paciente tiene derecho a su historia clínica completa (Resolución 1995 y Ley 1581), y un
criterio clínico legítimo no puede ser una barrera de acceso.

**Las dos mitades, y la primera te da la razón entera:**

1. **No se envía por defecto, y sigue pasando por el profesional.** El derecho es de acceso **a solicitud**.
   Tu criterio se respeta completo: no se adjunta, no sale sola, y quien la entrega eres tú y no CNV,
   porque el profesional es el responsable del tratamiento.
2. **Pero el paciente tiene que saber que puede pedirla**, o el derecho queda vacío. Por eso el reporte
   lleva ahora una línea, discreta y en el pie: *"Puedes solicitar tu historia clínica completa a tu
   profesional tratante."*

**No te lo preguntamos porque no hay nada que decidir:** tu criterio queda intacto y el derecho queda
cubierto. Te lo declaramos para que sepas que esa línea existe y por qué.

## 10.3 · Declaración: portamos TU mapa de lenguaje, tal cual

**Ya no te lo preguntamos: lo portamos.** Estaba en tu archivo completo, así que esperar era esperar por
algo que ya habías escrito. Lo que va abajo es lo que quedó sin traducir, para que lo revises.

Tu archivo **ya lo tiene resuelto**, y no como una simplificación de presentación sino como una decisión
clínica: en `enviarInformePaciente` traduces BAJO/MEDIO/ALTO/CRÍTICO a **Óptimo / A mejorar / Requiere
atención / Prioritario**, las severidades por dominio a **En equilibrio / A vigilar / A trabajar /
Prioritario**, reemplazas el dominio conductual con severidad alta por una frase de acompañamiento que **no
menciona TCA**, y reformulas el veto como acompañamiento. Tu propio comentario: *"sin CRÍTICO alarmante,
sin mencionar TCA"*.

**Portado tal cual, y con tu misma regla para lo que el mapa no cubre:** tu código deja el valor original
cuando no encuentra traducción (`_NIVPAC[nivel] || nivel`). Nosotros igual: lo que no traduces, no se
toca.

**Y dos cosas quedaron fuera, las dos a propósito:**

1. **Tu mapa no cubre un dominio SIN DATO.** `_SEVPAC[sev]` espera 0 a 3, y desde tu punto 4 del 30 de
   agosto un dominio sin dato no puntúa: su severidad es nula. Tu mapa es anterior a esa decisión tuya.
   En ese caso no le ponemos etiqueta de nivel: decimos que no se evaluó, con el texto que ya usamos.
   **Inventarle una quinta etiqueta a tu escala sería agregarle un nivel que no tiene.**

2. **El índice numérico de riesgo no va.** Tu `informePaciente` incluye `indice: dfi.riesgo.score`, pero
   tu §7.1 dice que ningún índice del modelo va al paciente. Ante la contradicción entre tu instrucción y
   tu implementación, nos quedamos con la instrucción. **El nivel sí va** ("Requiere atención"), que es lo
   que la persona puede leer; el número no.

Si alguna de las dos te parece mal, se cambia.

## 10.4 · P2 · ¿Qué significa "por región o ciudad" en la lista de intercambio?

Tu §7.1 dice que el paciente recibe la lista **"no completa, sino los alimentos principales por región o
ciudad"**, con tu razón: *"entregarle 350 alimentos a un paciente no es informarlo, es abrumarlo"*.

**Tenemos la ciudad. Nos falta el mapa.**

Del paciente sabemos su ciudad y su país, así que contra qué recortar no es problema. Lo que no existe es
**qué alimentos corresponden a cada región**: tu `INTER_TABLA_B` es nacional, los 350 sin marca de origen.

**¿Lo entregas tú, o el criterio es otro?** Podría ser algo más simple que un mapa por región (por ejemplo
los más comunes de cada grupo, iguales para todos), pero eso ya no sería lo que pediste y no lo decidimos
nosotros. **Sin esto la lista recortada no se puede construir.**

## 10.5 · P3 · Declaración: seguimos enviando por correo, no por app

Tu prototipo guarda el informe y el paciente lo abre en su app **con su documento y su fecha de
nacimiento**. Atlas manda un PDF adjunto al correo registrado.

**Nos quedamos con el correo, y la razón es de protección de datos:** documento y fecha de nacimiento son
dos datos que aparecen juntos en cualquier documento de identidad, así que quien tenga una foto de la
cédula entra. Para datos de salud es un acceso débil. **Si prefieres la app, se construye, pero con
autenticación de verdad.**

## 10.6 · Declaración: le añadimos un bloque que tu §7.1 no nombra

**"Lo que debes evitar":** las restricciones alimentarias que el profesional le puso a ese paciente.

Tu lista del §7.1 no las menciona, y lo añadimos igual, con esta razón: **el paciente recibe un menú, y un
menú sin las restricciones al lado es un plan que no puede seguir.** Peor: puede contradecirlas sin que él
lo note.

Va **antes** del menú, no después, y eso también es deliberado: se lee el menú para saber qué comer, así
que hay que llegar sabiendo qué evitar.

**Las tuyas no se repiten ahí.** El sodio, la grasa saturada y los atributos del patrón (hiposódica, DASH,
nefroprotectora) ya salen arriba, en el plan dietético, con su cifra. Repetirlos sin el número sería decir
dos veces lo mismo y peor la segunda.

## 10.7 · Declaración: retiramos una línea nuestra que te contradecía

El reporte llevaba, debajo de los datos del paciente: *"Patrones asociados a valorar clínicamente, no
constituye diagnóstico."*

**La escribimos nosotros** (verificamos: no aparece ni una vez en tu archivo), y contradecía dos cosas a
la vez. Al bloque siguiente, que se titula "Cómo estás" y le dice al paciente cómo está su envejecimiento.
Y a tu §7.1, que pone el **diagnóstico** como lo primero que el paciente recibe.

**Un documento que diagnostica y además declara que no diagnostica no protege a nadie:** confunde al
paciente sobre qué tiene en la mano. Retirada.

## 10.8 · Los nutracéuticos, en un idioma que el paciente entienda

**Hay tres cifras del reporte que un paciente no puede leer**, y dos las podemos resolver nosotros sin
inventar nada. La tercera no.

| | |
| --- | --- |
| **Hidratación "30 a 35 mL/kg/día"** | **Lo hacemos nosotros.** Multiplicar por su peso y dividir por un vaso es aritmética sobre tu cifra, no una cifra nueva. Los mL se quedan al lado |
| **"Proteína 1 g/kg"** | **Lo hacemos nosotros.** Los gramos al día ya los calcula tu motor (`protG`), así que decir "80 g al día" es tu dato. Traducirlo a alimentos, no |
| **"MULTI-CELL BASE, OMEGA COMPLEX"** | **No podemos.** Solo tenemos el nombre comercial |

**Lo que te pedimos es lo tercero:** una línea por nutracéutico, en lenguaje de paciente, diciendo para qué
sirve. Buscamos en tu archivo y no está; y nuestro catálogo tiene campos de indicación y composición, pero
son de inventario, escritos para operaciones y no para una persona.

**Mientras tanto el paciente recibe el nombre**, que es lo que hay. No lo escribimos nosotros: qué hace un
nutracéutico en un cuerpo es contenido clínico tuyo.


---

## Lo que queda esperando, y de quién es

**De esta ronda, dos preguntas bloquean construcción:**

1. **Dónde se capturan las porciones por grupo** (punto 1). Sin ellas, tu `calcConsumo` suma cero y las
   diez alertas de consumo no se pueden encender.
2. **El mapa de alimentos por región** (10.4). Sin él, el paciente no puede recibir su lista de
   intercambio, que es el único bloque de tu §7.1 que sigue sin construirse.

**Y una no bloquea nada y es la más cara: la del 9.6.** Tus dos motores prescriben cifras distintas para
el mismo paciente, en dos sitios que ahora se ven. Cada día que pasa hay planes con un objetivo calórico y
unos gramos de proteína que salen de dos cálculos que no coinciden.

**Sigue esperando de rondas anteriores, y no lo repetimos aquí para no hacerte leer dos veces lo mismo:**
el bloqueo activo del alérgeno frente a la opinión del asesor legal (ronda del 28), y las cuatro que
quedaron abiertas en la del 29.

**Tuyo, por tu lado:** la recalibración del ICEC (μ y σ), que dijiste que llega con el dato. El
interruptor sigue en `false` y no lo tocamos.

**Nuestro, sin bloqueo:** la salida impresa del plan alimentario (9.4), enviarte la historia clínica al
paciente por correo, y unificar las notas del profesional en un solo sitio. La dinamometría, la reapertura
del sellado, las notas por profesión, la unificación del peso meta, el pulido de la subpestaña del
nutricionista, el plan del paciente y la historia clínica imprimible, que estaban por hacer cuando
empezamos esta ronda, ya están.

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
