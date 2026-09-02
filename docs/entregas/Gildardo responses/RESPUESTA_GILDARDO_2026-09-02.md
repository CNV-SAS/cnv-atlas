# Respuesta a la ronda del 2026-09-01

**De:** Gildardo Uribe — Dirección Científica CNV

**Para:** Equipo Atlas

**Fecha:** 2 de septiembre de 2026

---

## 0. La separación que hay que hacer de una vez: la encuesta no es el módulo del nutricionista

**Son dos instrumentos con dos propósitos distintos, y llevan varias rondas mezclándose.**

| | Para qué es |
| --- | --- |
| **La encuesta** | Determinar el **DFI**. Su salida es un mapa de consumo por grupos, tal como está |
| **El mod nutricionista** | Ayudar a dar **tratamiento convencional** |

**No se combinan y no se suponen el uno desde el otro.** La encuesta no alimenta la prescripción
dietética y el módulo del nutricionista no se apoya en la frecuencia de consumo. Cada uno con lo suyo.

Esto ya estaba dicho el 30 de agosto y vuelve a aparecer en el punto 1 de esta ronda con otra forma. Lo
dejo escrito aquí para que no haya una tercera vez.

---

# 1 · La frecuencia de consumo NO se convierte en porciones

**No es que falte capturar las porciones: es que no deben existir.**

La encuesta mide **frecuencia**, y esa medida tiene un propósito: alimentar el DFI. Convertirla a
porciones diarias sería **inexacto**, y lo único que se quiere de ella es el mapa de consumo por grupos,
que es lo que ya produce.

Lo que ustedes describen —que `calcConsumo` recorre dieciocho campos de porciones que nadie captura— es
correcto como observación, pero la conclusión no es construir esa captura. **Es que esa función no
pertenece al camino de la encuesta.** Pertenece al del nutricionista, que es otro instrumento, con otra
entrada y otro propósito.

**Por eso las diez alertas de consumo no esperan un dato mío: esperan que se separen los dos módulos.**
Con la separación hecha, la pregunta de dónde salen las porciones se responde sola, porque deja de
hacerse desde la encuesta.

**Y las dos reglas de azúcares siguen leyendo el índice de frecuencia**, que es lo que la encuesta
captura y para lo que sirve.

---

# 10.4 · Los alimentos por región: va el criterio, y va hecho

**Se escogen según la ciudad del paciente.** Va abajo el mapa completo, con una condición que es la que
lo hace utilizable: **todos los alimentos salen de INTER_TABLA_B. Ninguno es nuevo.** Cada nombre se
verificó uno por uno contra la lista; los que no estaban se descartaron en vez de agregarse.

## Las diez zonas y su criterio

La región Andina se parte en cinco porque no come igual Medellín que Pasto, y ese es justamente el
sentido de recortar por ciudad.

| Zona | Qué la marca |
| --- | --- |
| **Caribe** | Ñame, batata, yuca, plátano; fríjol cabecita negra, zaragoza y caraota; chivo, pargo, camarón; queso costeño, butifarra; mango, papaya, guayaba, patilla, guanábana; auyama, coco |
| **Pacífica** | Chontaduro, borojó, murrapo; plátano y yuca; pargo, bagre, camarón; coco y aceite de palma |
| **Antioquia y Eje Cafetero** | Mazamorra, arepa redonda, pandequeso, pandeyuca, almojábana; cargamanto y bola roja; papa criolla, arracacha; cerdo, morcilla, quesito; tomate de árbol, granadilla, mora, lulo, curuba, uchuva, feijoa; aguacate |
| **Cundiboyacense** | Cuchuco de cebada; papa común y criolla, cubios, chuguas; arveja seca; curuba, feijoa, uchuva, papayuela, pera, ciruela; cidrayota, brócoli, coliflor; cuajada, queso campesino |
| **Santanderes** | Arepa de maíz, yuca; **cabra y chivo**, hígado, callo, lengua; cargamanto, garbanzo; piña, guayaba, naranja |
| **Valle y Cauca** | Pandeyuca, arroz; chontaduro, borojó, lulo, maracuyá, zapote; cerdo, pargo |
| **Nariño y alta montaña** | **Cuy**, trucha; papa criolla, cubios, chuguas, arracacha; chirimoya, lulo, mora, curuba |
| **Orinoquía y Llanos** | **Res y ternera**, hígado, lengua; arroz, yuca, plátano; mango, guayaba, maracuyá |
| **Amazonía** | Bagre, pargo, trucha; yuca, plátano; chontaduro, borojó, guanábana |
| **Insular** | Pargo, camarón, langostino, atún; ñame, batata, yuca; coco; mango, papaya, guanábana |

## El núcleo nacional, que va siempre

**Cincuenta y seis alimentos que se consiguen en cualquier ciudad del país** y que van con todas las
zonas: leche, huevo, pollo, res, cerdo, atún, lenteja, garbanzo, arroz, pan, avena, pastas, arepa, papa,
yuca, plátano, banano, naranja, mango, papaya, tomate, cebolla, zanahoria, aceites, aguacate y café.

**Sin ese núcleo el recorte dejaría a alguna zona sin opciones en un grupo entero**, y un plan no se
puede armar así. Verificado: las diez zonas tienen alimentos en los nueve grupos que la prescripción
necesita.

## Lo que recibe el paciente

| Zona | Alimentos | Recorte |
| --- | --- | --- |
| Caribe | 83 | −76 % |
| Antioquia y Eje Cafetero | 80 | −77 % |
| Cundiboyacense | 82 | −77 % |
| Nariño | 69 | −80 % |
| Insular | 67 | −81 % |
| Amazonía | 65 | −81 % |

De 350 a unos setenta. Eso es lo que pedía el §7.1: **informarlo, no abrumarlo.**

## Dos reglas de implementación

1. **Si la ciudad no está en el mapa, no se recorta:** recibe la lista completa. Más vale una lista larga
   que una a la que le falte lo que esa persona come.
2. **Van 111 ciudades mapeadas**, incluidas las cabeceras y los municipios grandes de cada zona. Se
   añaden más cuando aparezcan pacientes de sitios que no estén.

**El bloque de código va en la entrega**, con las diez zonas, las ciudades, el núcleo y la función que
resuelve la lista a partir de la ciudad. Está probado: Barranquilla resuelve a Caribe, Pasto a Nariño,
una ciudad desconocida devuelve los 350, y funciona con o sin tildes.

---

# 11.1 · El peso meta lo define el nutricionista. Punto

**¿En qué parte no se entiende?** El peso meta es **editable** precisamente porque lo fija el
profesional, y esa decisión **prima sobre cualquier otra consideración**, venga del IMC, de la identidad
FMI+FFMI o de donde sea.

Que el paciente sea deportista o no **da igual**: no cambia quién decide. El nutricionista acuerda una
meta con su paciente y esa meta gobierna la prescripción, incluida la proteína.

**Lo que sí hay que corregir es el punto de partida**, que es lo que ustedes miden bien: mientras el
profesional no toque ese campo, el número que sale por defecto no puede recortarle 7,6 kg a alguien con
composición corporal normal. **Ahí sí adopta motorProtocolo la identidad peso = (FMI + FFMI) × talla²**,
por la misma razón por la que la adoptó el otro motor: el IMC no distingue grasa de músculo y el peso meta
es la palanca de toda la cadena.

Pero que quede claro el orden: **eso es un punto de partida, no una prescripción.** La prescripción es lo
que el nutricionista fije encima.

---

# 9.6 · Cuál motor manda: ninguno. Manda el equipo

**El BiodyManager ya entrega el gasto basal en el export, y ATLAS ya lo importa.** Calcularlo con una
fórmula propia es sustituir una medición por una estimación.

Con eso desaparece la pregunta de cuál de mis dos motores gobierna el gasto, porque deja de haber dos
fórmulas: hay un dato.

## Lo que encontramos al revisarlo

**No eran dos fórmulas. Eran tres**, y una con la etiqueta equivocada:

| Dónde | Qué calculaba |
| --- | --- |
| La cadena calórica | `500 + 22 × FFM`, rotulado "Cunningham" — **que no es Cunningham** (370 + 21,6 × FFM) |
| `motorTratNutri` | Mifflin sobre peso meta |
| El protocolo | Mifflin sobre peso actual |

**Y verificamos contra el equipo, con once mediciones reales:**

| Fórmula | Error medio absoluto contra el equipo |
| --- | --- |
| **Harris-Benedict** | **20 kcal** |
| Müller | 27 |
| Owen | 45 |
| Cunningham | 60 |
| Mifflin | 71 |

**El equipo usa Harris-Benedict.** Y las dos fórmulas del software se desviaban de él en sentidos
opuestos —Cunningham +18 kcal de media, Mifflin sobre peso meta −79—, lo que entre ellas daba **hasta 205
kcal de diferencia sobre el mismo paciente**. En una mujer de 61 kg: 1.359 por un lado, 1.154 por el otro.
Esa diferencia no era de criterio clínico: era de no haber usado el dato que ya estaba.

## Cómo queda

1. **Manda el gasto basal del equipo**, y la pantalla dice que es medido.
2. **Cuando no venga en el export, el respaldo es Harris-Benedict** —la del propio equipo—, para que la
   estimación dé la misma cifra que habría dado la medición y no un tercer criterio.
3. **En la cadena que fija la ingesta, Harris-Benedict sobre el PESO META.** Son dos preguntas distintas
   con la misma fórmula: el gasto medido es el de hoy, sobre el peso actual; la ingesta que lleva a la
   meta se calcula sobre la meta, como quedó dicho el 26 de agosto.
4. **La proteína la prescribe el motor** —1 g/kg, no el mínimo poblacional de 0,8— sobre el peso meta que
   fije el nutricionista.

---

# Las demás

**2 · La fecha de consulta se captura**, y es **ella** la que fecha la historia clínica y el reporte. La
fecha de creación del registro es cuándo el paciente firmó, no cuándo se le atendió, y eso en un documento
legal no se deduce.

**3 · Las dos fechas distintas** se resuelven con lo anterior: una sola fecha en los dos documentos.

**4 · Renormalizar el riesgo sobre los dominios medidos: correcto.** Que a un paciente le baje el riesgo
por no haberle medido algo es la misma lectura favorable de un vacío. Y que la pantalla diga sobre cuántos
dominios se calculó, también.

**5 · Los encabezados de categoría: el orden se queda, el rótulo sale de la encuesta del paciente.** Su
argumento del sesgo de deseabilidad es correcto y es propio del instrumento: anunciarle a alguien que el
bloque que va a contestar son "ultraprocesados" le mueve la respuesta. Lo que dije es que el orden es el
mensaje, y el orden no se tocó. En las vistas del profesional se quedan.

**6 y 8 · diagProf y tratSugerido.** `diagProf` es la **impresión diagnóstica** que escribe ese
profesional, distinta del diagnóstico del modelo. `tratSugerido` es **lo que él propone**, frente a lo que
propone el motor. **Van en Atlas, con esos nombres.** Sus "Notas del tratamiento" son uno de los dos, no un
tercer campo: pórtenlos y no mantengan uno paralelo. Los **cuatro** roles llevan los dos campos.

**7 · La cintura al umbral: no era deliberado, era un defecto**, y estaba en las dos circunferencias. La
cintura y la cadera leían primero la columna de referencia, que es el corte de la OMS —102 cm para todo
hombre— y no la medida. Corregido en esta entrega: esa lectura queda **retirada**, no movida al final. Su
decisión de no mapear ese campo fue la correcta.

**9.1 · Las guías dietarias vuelven.** Que en un paciente de prueba solo tuviera una línea mal usada no
dice que sobre; dice que nadie la usó todavía. Es el sitio donde el profesional escribe lo que el motor no
calcula.

**9.2 · Los tiempos de comida se quedan donde los pusieron.** Gobiernan las dos tablas de abajo, y
decidirlos después de repartir obliga a rehacer el reparto. Es el mismo orden de trabajo por el que separé
el objetivo de la cadena.

**9.5 · La procedencia del peso meta se queda.** No es lo mismo el peso acordado con el paciente en
consulta que uno ajustado después al armar el plan, y quien lea el plan tiene que poder distinguirlos.

**9.7 · Los dos bloques se quedan**, por la razón que ustedes citan, que es mía. **El rótulo vuelve a
"fórmula sintética"**: es el nombre que tiene en el modelo, y los nombres del modelo no se traducen en la
interfaz.

**10.8 · Los nutracéuticos los escribo yo.** Qué hace un nutracéutico en un cuerpo es contenido clínico y
no sale de un catálogo de inventario. Va en la próxima entrega, una línea por producto.

**11.3 · La meta del desnutrido severo no se acota por fórmula: la ajusta el nutricionista**, igual que
cualquier otro peso meta. Los +15,9 kg son el destino que da la identidad y está bien que se vea; lo que
gobierna el plan de hoy es lo que el profesional fije encima. Es la misma respuesta del 11.1.

**11.5 · Manda la definición nueva del Δ del IAE.** El guion era una lectura suya, razonable, pero ya está
dicho explícitamente cómo se calcula.

---

## Resumen

| # | Decisión |
| --- | --- |
| **0** | **La encuesta es para el DFI; el mod nutricionista, para el tratamiento.** No se combinan ni se suponen el uno desde el otro |
| **1** | **La frecuencia NO se convierte en porciones.** No falta capturarlas: no deben existir en ese camino. Las reglas de azúcares siguen leyendo el índice de frecuencia |
| **2** | **La fecha de consulta se captura**, y es la que fecha la historia clínica y el reporte |
| **5** | **El orden se queda; el rótulo sale** de la encuesta del paciente, por el sesgo de deseabilidad |
| **6 y 8** | **diagProf y tratSugerido van en Atlas con esos nombres**, en los cuatro roles. Las "notas" son uno de ellos |
| **7** | **Era un defecto, ya corregido** en las dos circunferencias |
| **9.1** | **Las guías dietarias vuelven** |
| **9.6** | **Manda el gasto basal del equipo.** Había TRES fórmulas, una mal rotulada, con hasta **205 kcal** de diferencia. El equipo usa **Harris-Benedict**, que es el respaldo cuando el dato no venga |
| **9.7** | **Dos bloques**, y el rótulo vuelve a **"fórmula sintética"** |
| **10.4** | **Mapa de alimentos por región, entregado**: 10 zonas, 111 ciudades, todo salido de INTER_TABLA_B. De 350 a unos 70 por zona |
| **10.8** | **Los nutracéuticos los escribo yo** |
| **11.1** | **El peso meta lo define el nutricionista y prima sobre todo.** motorProtocolo adopta la identidad FMI+FFMI **como punto de partida**, no como prescripción |
| **11.3** | **No se acota por fórmula: la ajusta el nutricionista** |
| **11.5** | **Manda la definición nueva** |

**Va el ATLAS_v8.html de hoy**, con el gasto basal unificado, las dos circunferencias corregidas y el
mapa de alimentos por región en archivo aparte.

© Connected Nutrition Ventures SAS, 2026. Documento interno.
