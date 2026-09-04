# Smoke: la encuesta del paciente (2026-09-04)

**En el teléfono, que es donde importa.** Todo lo de esta tanda es de la encuesta que contesta un
paciente, y las SEIS cosas que cambian se ven distinto en una pantalla angosta.

`pnpm dev`, abre el enlace del intake en el móvil (o el navegador en vista de móvil, 390 px de ancho).

---

## 1 · La referencia de cantidad, ahora en su propia línea

**Dónde.** Sección **Alimentación**, cualquiera de las quince preguntas de frecuencia.

**Qué tiene que verse.** Debajo del enunciado, **dos líneas separadas**:

- los ejemplos, en gris pequeño: *espinaca, acelga, brócoli, tomate…*
- y debajo, **en su propia píldora**: **Un puño cerrado**

**Qué sería defecto.** Que sigan en la misma línea, separadas por un `·`. Ese era el estado anterior: el
dato estaba y nadie lo leía.

**Lo que NO cambió, y es a propósito:** no hay emoji. El suyo dice "📏 Un puño cerrado"; `CLAUDE.md`
prohíbe emojis en la interfaz, y además evita meter un símbolo que se pueda leer como una señal.

**Comprueba también que fuera de Alimentación no aparecieron píldoras nuevas.** Las ayudas de otros
dominios (por ejemplo "Padres, hermanos, abuelos" en antecedentes) tienen que seguir en una sola línea
gris: ahí la cola no es una cantidad, y promoverla sería decir que sí lo es.

**Y ahora lleva tinte de marca**, no gris: el azul al 10 %. No es verde ni ámbar a propósito. Un verde
junto a "Verduras" leería "alimento bueno" y el mismo verde junto a "Ultraprocesados" leería lo contrario,
así que el color estaría calificando el alimento en vez de señalar una unidad de medida.

---

## 1bis · Los iconos de dominio

**Dónde.** El título de cada una de las ocho secciones.

**Qué tiene que verse.** Un icono gris a la izquierda del título: un plato en Alimentación, una gota en
Hidratación, una casa en Contexto social, un estetoscopio en Antecedentes.

**Qué sería defecto.** Que alguno sea un **símbolo de veredicto**: un triángulo de alerta, un visto bueno
o una cruz. Eso es exactamente lo que hace su archivo (⚠ en Conductas alimentarias) y lo que estamos
evitando. Todos son objetos, ninguno es un juicio.

**Van en gris, sin color propio**, y es deliberado: un tono por dominio sería identidad legítima, pero hoy
lo único cromático sin valencia es el azul de marca, que además es el color de acción, así que ocho
encabezados azules se leerían como pulsables. Eso queda para después de ver la encuesta terminada.

---

## 2 · El color de la orina

**Dónde.** Sección **Hidratación**, la pregunta *"¿Color de su orina habitualmente?"*.

**Qué tiene que verse.** Las cuatro opciones **en rejilla** (dos columnas en el teléfono, cuatro en
pantalla ancha) y, **debajo, una tira de cuatro barras de color**: transparente, amarillo claro, amarillo y
marrón. **Cada barra justo debajo de su opción**, y la de la opción elegida con el borde oscuro.

**Esto cambió respecto al smoke anterior:** iba dentro de la píldora y ahora va como en su archivo, que es
lo que preferiste al probarlo. La condición que lo hace correcto es que las barras y las opciones comparten
rejilla, así que el emparejamiento no depende del ancho.

**Qué sería defecto.**

- **Que alguna barra quede debajo de la opción equivocada.** Es lo único que importa aquí, y es lo que
  pasaría si las opciones y la tira dejaran de compartir rejilla.
- Que la etiqueta larga ("Oscuro (naranja / marrón)") se corte en vez de ocupar dos líneas dentro de su
  píldora. **Que ocupe dos líneas es esperado en el teléfono**, es el coste de que las cuatro columnas
  queden alineadas.
- Que aparezcan barras en **otras** preguntas.

---

## 3 · Las preguntas pendientes, con salto

**Es el más importante de los seis, y el que más pasos tiene.**

**Cómo provocarlo.** Empieza una encuesta y **deja preguntas sin responder a propósito** (por ejemplo
contesta solo Alimentación y salta el resto). Ve hasta la última sección y pulsa **Enviar**.

**Qué tiene que verse.** Una caja **gris neutra**, no ámbar ni roja, con:

1. La frase: *"Te faltan N preguntas por responder. **Puedes enviarla así y completarlas con tu
   profesional**, o volver a revisarlas."*
2. Debajo, **una lista de hasta ocho preguntas**, cada una con su número, su texto y su sección.
3. Si faltan más de ocho: *"y N más."*
4. Y los dos botones: **Enviar así** y **Volver a revisar**.

**Lo que hay que probar de verdad: PULSA UNA DE LA LISTA.** Tiene que llevarte a esa sección **y dejar la
pregunta a la vista, con su enunciado**, no al principio de la sección ni a una píldora suelta.

**Qué sería defecto.**

- **Que la caja salga ámbar o roja.** Era así hasta hoy, con los tokens de la escala clínica, y es el
  defecto que abrió esta tanda: una pregunta en blanco no es una severidad clínica. El texto decía "puedes
  enviarla así" y el color decía "algo va mal".
- **Que al pulsar una fila cambie de sección pero no baje a la pregunta.** Es el fallo probable: la sección
  destino todavía no está pintada cuando se pide el salto. Si pasa, dilo con la sección y la pregunta.
- Que los dos botones queden **fuera de la pantalla** por culpa de la lista. Por eso se corta en ocho.
- Que el número de la lista **no coincida** con el número que se ve al llegar a la pregunta.
- Que la cuenta de la caja **no coincida** con "N de 64 preguntas" de la barra de arriba.

---

## 4 · El deslizable del estrés

**Dónde.** Sección **Hábitos**, *"Nivel de estrés en el último mes"*.

**Qué tiene que verse.** Un **disco grande a la derecha** con el número elegido, en azul. Sin tocar nada,
el disco está apagado y muestra una raya.

**Qué sería defecto.** Que el disco **cambie de color según el nivel** (ámbar o rojo al subir): eso
calificaría la respuesta. Es azul siempre, el mismo azul de la opción elegida, porque dice "esta es tu
respuesta", no "tu respuesta es buena".

**Lo que NO se portó de él, y por qué:** sus etiquetas "Sin estrés" y "Máximo" bajo los extremos.
**Ya están visibles en el enunciado**, dos líneas más arriba: *"(1 = sin estrés, 10 = máximo)"*.
Repetirlas debajo sería redundancia, no el caso de la píldora de porción, donde el dato sí estaba
enterrado. Sus dos emojis de cara tampoco van: el proyecto no lleva emojis en la interfaz.

---

## 5 · El conteo por sección

**Dónde.** El título de cada sección.

**Qué tiene que verse.** Una píldora gris junto al título: **"18 preguntas"** en Alimentación,
**"3 preguntas"** en las cortas.

**Para qué es:** acotar. Alimentación tiene dieciocho y otras tienen tres, y hasta ahora las dos se veían
igual de largas al entrar. Saber que quedan tres es lo que evita abandonar.

**Qué sería defecto.** Que diga cuántas te **faltan** en vez de cuántas **hay**. Cuántas hay es un hecho de
la sección; cuántas faltan es un recordatorio, y eso ya lo lleva la barra de arriba, que además dice que
puedes dejarlas.

---

## Lo que NO vas a ver, y es deliberado

De su encuesta se dejaron fuera cuatro cosas, todas por el mismo motivo: **califican la respuesta antes de
darla.**

| Suyo | Por qué no va |
| --- | --- |
| **⚠️ y encabezado ámbar en D4** (Conductas alimentarias) | Es el único dominio pintado como advertencia, y sus preguntas son neutras: cuántas comidas, si desayuna, patrón, suplementos |
| **D6 entera en rojo** (Alergias y digestión) | Título, fondo y subencabezado rojos para preguntar por alergias, cirugías e hinchazón |
| **El contador "19/64 ítems" en rojo** | Pinta la incompletitud del paciente como error |
| **"✅ Alimentación Real protectora"** | Ya lo habíamos retirado el 2026-08-31, por lo mismo. Vive en las vistas del profesional |

Es el mismo criterio que aplicamos con los encabezados de categoría: **un control más entretenido está
bien; un color que dice "esto está mal" antes de contestar, no.**

---

## Y lo que ya estaba, para que no lo busques como nuevo

- **Los contadores de bebidas** (`− N +`) ya existían, y son mejores que los suyos: el nuestro arranca en
  "−" y distingue *sin tocar* de *cero explícito*; el suyo arranca en 0, que es una ausencia disfrazada de
  dato. La unidad ("vasos de 200 ml por día") ya viaja en el enunciado.
- **La línea de ejemplos** bajo cada pregunta ya estaba.
- **El progreso por preguntas** y **el guardado dentro de la sección** entraron el 2026-08-27.

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
