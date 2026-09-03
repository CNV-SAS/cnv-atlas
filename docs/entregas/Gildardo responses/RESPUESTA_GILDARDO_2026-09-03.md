# Respuesta a la ronda del 2026-09-03

**De:** Gildardo Uribe — Dirección Científica CNV

**Para:** Equipo Atlas

**Fecha:** 3 de septiembre de 2026

---

## 0. Lo mismo del 2 de septiembre, porque volvió a aparecer

**La encuesta es para el DFI. El mod nutricionista es para el tratamiento. No se combinan.**

Está escrito en el punto 0 de la respuesta anterior y vuelve en el punto 3 de esta ronda con otra
forma: pidiendo la correspondencia entre los grupos de la encuesta y los subgrupos de la lista de
intercambio, para estimar el consumo actual.

**No hay tal correspondencia y no debe haberla.** La D1 es un **patrón usual de consumo** y su salida
es un **mapa de calor por grupos**. No es un recordatorio de 24 horas, no produce porciones y no
produce nutrientes. Por eso se diseñó así.

Lo que ustedes describen —`calcConsumo` recorriendo campos de porciones que nadie captura— es una
observación correcta con la conclusión equivocada. Esa función no pertenece al camino de la encuesta.
Queda donde está, sin uso, hasta que se decida borrarla.

---

# 1 · El interruptor del LE8

**Tienen razón en no portarlo, y el señalamiento está bien hecho.**

El cambio del 2 de septiembre fue deliberado, no un descuido: quedó documentado en
`ACTUALIZACIONES_ATLAS_v8_2026-09-02.md` §11, con el efecto medido paciente por paciente. Lo que
corrige es real y era grave: dos de los ocho dominios del LE8 —alimentación e hidratación— leían
`d1_9`, `d1_10` y `d1_16`, campos que **solo existen en el objeto DEMO**. En paciente real daban cero,
así que esos dos dominios estaban clavados en su mínimo para todo el mundo, midiera lo que midiera la
persona.

**Y la condición de activación sigue sin cumplirse.** Verificado: la llamada del término contextual
sigue diciendo `_zBis(_icecVal, 58.578, 13.332)`. El mapeo se corrigió y la escala que lo convierte en
años, no. Con el mapeo bueno el ICEC de la población sube, así que esa media y esa desviación describen
a una población que ya no existe.

**La decisión:** _[PENDIENTE — una de las dos, y va firmada aparte]_

- **(a)** El interruptor vuelve a `false` hasta que se recalculen μ y σ sobre la base con el mapeo
  corregido. Sigue vigente D-006.
- **(b)** El interruptor se queda en `true` con μ y σ nuevas, que van en la misma entrega.

Lo que **no** va a pasar es que se quede en `true` con los números viejos. En eso el candado que
pusieron es correcto y se agradece.

---

# 2 · El bloque del mapa de regiones: existía, y el error fue mío

**No se quedó sin pegar: se quedó en otro archivo.**

Está en `lista_intercambio_por_region.js`, en la misma carpeta, con fecha del 2 de septiembre. Tiene
las diez regiones, los 111 municipios, el núcleo nacional de 56 alimentos y las dos funciones
—`regionDe` y `listaIntercambioPaciente`—. Todo salido de `INTER_TABLA_B`, ninguno nuevo.

**Lo que estuvo mal fue decir que iba dentro del HTML.** Fue a la entrega, pero suelto, y ni ustedes ni
yo lo buscamos fuera de los `.html` y los `.md`. Queda anotado para no repetirlo: cuando un bloque va
en archivo aparte, se dice en el documento.

**Ya está integrado en el `ATLAS_v8.html` de hoy y conectado a la vista**, que era lo único que
faltaba. El contenido no se tocó. Lo verificado:

| Ciudad | Región | Alimentos | Recorte |
| --- | --- | --- | --- |
| Barranquilla | Caribe | 83 | −76 % |
| Bogotá | Cundiboyacense | 82 | −77 % |
| Medellín | Antioquia y Eje Cafetero | 80 | −77 % |
| Quibdó | Pacífica | 71 | −80 % |
| Cali | Valle y Cauca | 70 | −80 % |
| Pasto | Nariño y alta montaña | 69 | −80 % |
| San Andrés | Insular | 67 | −81 % |
| Cúcuta | Santanderes | 65 | −81 % |
| Leticia | Amazonía | 65 | −81 % |
| Villavicencio | Orinoquía y Llanos | 62 | −82 % |

Las diez regiones tienen alimentos en los nueve grupos que la prescripción necesita; se verificó por
código, no a ojo. El nutricionista ve arriba de la lista qué región se aplicó y cuántos alimentos
quedaron.

**Se ampliaron los municipios de 111 a 224.** Las regiones de Colombia están determinadas y no son
materia de discusión; agregar municipios solo hace que más pacientes resuelvan a la suya. Las regiones
y sus alimentos no se tocaron.

**Y una advertencia sobre la regla de la ciudad desconocida, que sigue vigente y ahora importa más:**
la coincidencia es **exacta por nombre**. Hay municipios colombianos homónimos de ciudades del
exterior —Madrid y Armenia son los casos claros—. "Madrid" resuelve a Cundiboyacense y **"Madrid
España" no resuelve a ninguna región y recibe los 350**. Es deliberado. Si alguna vez se ablanda esa
comparación para que tolere variantes, ese es el caso que hay que probar primero.

---

# 3 · La correspondencia entre los 18 grupos y los 21 subgrupos

**No va, y no es que falte: es que no debe existir.** Ver el punto 0.

La encuesta no convierte frecuencia en porciones. Lo dije el 2 de septiembre y lo repito aquí porque
es la tercera vez que la pregunta vuelve con otro traje. El consumo actual no se estima desde la D1.

Lo que sí está bien visto es que `calcConsumo` no sirve para nada donde está. **Y es peor de lo que
ustedes describen:** no es un stub, está completa —lee dieciocho campos de porciones y multiplica por
la tabla de composición— y **nadie la invoca**. Lo mismo `generarAlertas` y lo mismo `TCAC`. Son tres
piezas muertas que además insinúan un puente entre la encuesta y el módulo nutricional que no debe
existir. **Quedan marcadas para borrarse**, no para conectarse.

---

# 4 · El tratamiento reemitido idéntico: no se le avisa al paciente

**Ni en ese caso ni en ninguno. No hay aviso al paciente.**

La pregunta de si el aviso cuelga del acto o del efecto no aplica, porque el aviso no existe. **Los
datos los analiza el profesional.** ¿Para qué asustar a alguien con un documento que lo único que le
dice es que su plan se volvió a mirar?

Lo que sí se conserva, y ahí no hay discusión, es lo que ustedes ya proponían conservar: **la
reapertura queda registrada en la historia con su motivo**, cambien o no las cifras. Es la formulación
del sellado: no es un candado, es una consecuencia registrada.

---

# 5 · El campo vacío que se lee como una decisión: tienen razón, y se arregló de otra manera

**El caso del 3 % de grasa es real y el diagnóstico de ustedes es correcto:** el motor no puede
distinguir una cifra escrita a propósito de un campo mal borrado.

Pero la solución no era ponerle un piso al campo. Era quitarle al motor la pretensión de saber. **Se
rehizo la cadena calórica entera**, y quedó así:

```
GEB  = Mifflin sobre el PESO META    (no sobre el peso actual, no el de Biodymanager)
GET  = GEB × factor de actividad
kcal = GET − la restricción que ponga el nutricionista
Proteína  0,8 g/kg  ── editable
Grasa     30 %      ── editable
Carbohidratos = el resto
```

**Ninguna patología mueve una caloría.** Se retiró la fórmula por diagnóstico —cáncer y desnutrición
tenían la suya, 27,5 kcal por kilo de peso actual—, se retiró que la dislipidemia bajara la grasa al
25 %, y se retiraron las cinco cifras de proteína que imponía cada rama.

**Y en el sitio de la decisión aparece la referencia.** Junto a los campos de proteína y grasa, un
panel que sale **siempre** y dice, según el diagnóstico del paciente, qué rango recomienda cada
condición, **por qué** —el mecanismo, no la cita— y de dónde sale. Cuando dos condiciones piden rangos
que no se solapan, **lo dice en vez de escoger**.

El caso que ustedes traen en el punto 8 se ve hoy así:

> **PROTEÍNA** · prescrito 0,8 g/kg · **CONDICIONES EN CONFLICTO**
> **ERC sin diálisis · 0,6–0,8 g/kg** — La urea que el riñón ya no filtra sale de la proteína. *KDIGO 2024*
> **FFMI bajo — desnutrición · 1,2–1,5 g/kg** — Sin sustrato no se reconstruye masa magra. *ESPEN 2015 · GLIM 2019*
> **ASMI bajo — sarcopenia · 1,2–1,5 g/kg** — El músculo envejecido responde peor al estímulo anabólico. *EWGSOP2 2019*
> ⚠ En la práctica suele mandar la indicación renal. **La cifra la decide usted.**

**Y si la cifra escrita queda fuera de lo sugerido, queda escrito en la historia clínica** con el
rango, la condición y la razón. No bloquea, no alarma: deja constancia de que fue una decisión.

**Lo que no se hizo es ponerle piso o techo a nada.** La regla del 27 de agosto sigue en pie: ninguna
cifra de la prescripción lleva validación. El motor propone, el profesional dispone, y ahora dispone
informado.

---

# 6 · P24: agregada la opción, y de paso corregida una contradicción mía

**Hecho.** La observación de Valentina es correcta y el arreglo va en la entrega de hoy:

| | Antes | Ahora |
| --- | --- | --- |
| **P23** ¿Cuántos días/semana? | 0 · 1 · 2 … 7 | **No hago ejercicio** · 1 · 2 … 7 |
| **P24** ¿Cuánto dura cada sesión? | Menos de 15 … Más de 60 | **0 minutos a la semana** · Menos de 15 … Más de 60 |

Se metió la opción con valor cero en las **cuatro** copias del mapa de minutos, para que valga por
diseño y no por accidente, y se corrigieron los **dos** generadores de prosa, que con "No hago
ejercicio" decían "sin dato" en vez de "no realiza actividad física".

**Y hay una contradicción mía que hay que resolver de paso:** la P23 dice *"(≥30 min)"* y la P24 ofrece
"Menos de 15" y "15–30 min". Si la P23 solo cuenta días con sesiones de treinta minutos o más, esas dos
opciones de la P24 no pueden existir. **Se quita el "(≥30 min)" de la P23** y la duración la establece
la P24, que es para lo que está. Va en la próxima entrega.

**Lo que no se hace son saltos condicionales.** La encuesta no tiene ninguno y no va a estrenarlos por
esto: con la opción agregada, el problema se resuelve sin cambiar el comportamiento del instrumento.

**Falta la pregunta de método anticonceptivo**, que va en el bloque de calidad de la toma, sección de
mujeres, para distinguir la amenorrea real de la que produce el método. No alcanzó a entrar hoy.

---

# 7 · P43 y P44: son cosas distintas y se quedan separadas

**Alergia e intolerancia no son lo mismo. ¿Por qué habrían de preguntarse juntas?**

Una es inmune y la otra digestiva, y el manejo es distinto. **La distinción es del paciente**, y la
encuesta la contesta el paciente: quien ya tiene una de las dos está en tratamiento, y quien está en
tratamiento sabe cuál tiene.

Sobre el lenguaje, Valentina tiene razón en un punto: la P44 pregunta por sustancias —lactosa, gluten,
fructosa— y el paciente responde con alimentos. Eso se aterriza sin tocar la clasificación, poniendo el
alimento al lado: *"Lactosa (leche y lácteos)"*, *"Gluten (trigo, pan, pasta)"*, *"Fructosa (frutas,
miel)"*. Va en la próxima entrega.

**Las dos preguntas siguen separadas y en ese orden.**

---

# 8 · Desnutrición y ERC: el chip desapareció, y de paso el IMC salió de la cadena

**La pregunta era si suprimir el atributo de proteína alta cuando aplica la rama renal. Se suprimieron
todos.**

El motor ya no propone gramos de proteína, así que no hay dos chips contradiciéndose: no queda
ninguno. Y las recomendaciones de proteína que estaban regadas por el resto de los módulos —el abordaje
por profesión de la Diana, los cuatro bloques del tratamiento médico, la tabla de restricciones y las
recomendaciones de la historia clínica— **se retiraron todas**. La proteína se prescribe en un solo
sitio: el módulo del nutricionista.

**Y se corrigió algo más grande que estaba debajo.** La desnutrición colgaba del **IMC < 18,5**, que no
mide composición. Un paciente con la masa magra depletada y peso normal no entraba, y uno delgado con
masa magra conservada sí. Ahora cada condición usa su propio índice y su propio corte internacional:

| | Índice | Corte | Fuente |
| --- | --- | --- | --- |
| **Desnutrición** | FFMI | < 17 H · < 15 M | ESPEN 2015 · GLIM 2019 |
| **Sarcopenia** | ASMI | < 7,0 H · < 5,5 M | EWGSOP2 2019 |

Venían unidas por un "o" dentro de `sarcopenia`, mezclando dos definiciones internacionales distintas.
Son los mismos cortes que ya usaban `cFFMI` y `cASMI`, así que la cadena de tratamiento y la Diana EFR
dejan de contradecirse.

**Consecuencia deliberada: las dos exigen bioimpedancia.** Sin BIS, FFMI y ASMI valen cero y no se
activa ninguna rama. Todo ATLAS va montado sobre el BIS; no hay razón para que esto fuera distinto.
Antes bastaban peso y talla para emitir una prescripción hipercalórica sin haber medido nada.

---

# 9 · Lo que encontré revisando, y que ustedes no preguntaron

**Un paciente sin medir recibía un diagnóstico completo.** Creando un paciente en blanco y entrando a
Diagnóstico › Diagnóstico Funcional, la Diana lo ubicaba en el **estado #61 de 81** y emitía
*"Desnutrición severa sin inflamación → riesgo fallo por inanición"*, con sus biomarcadores, sus
riesgos y sus cinco nutracéuticos.

La causa: `cIFC`, `cIRC`, `cFFMI` y `cFMI` no distinguen **cero** de **no medido**, y con el valor en
cero devuelven la categoría más baja. **Corregido:** los cuatro índices devuelven "sin dato" cuando no
hay medición, y eso apaga la Diana entera. Es la misma regla del ISCM sin MCA y de la EB-BIS sin PABU.

**La historia clínica imprimía la cifra base, no la prescrita.** Si el nutricionista ponía la proteína
en 1,5, la historia seguía diciendo 0,8. Corregido, y ahora también muestra el porcentaje de grasa, que
no salía.

**El GEB y los gramos de proteína usaban pesos distintos.** El gasto se calculaba sobre el peso meta y
los gramos de proteína sobre otro peso, que salía de una clave global y, si no estaba, caía al peso
actual o a 70 kg fijos. **Un solo peso para toda la cadena: el peso meta.**

---

## Resumen

| # | Decisión |
| --- | --- |
| **0** | **La encuesta es para el DFI; el mod nutricionista, para el tratamiento.** Tercera vez que se dice |
| **1** | **No lo porten con los números viejos.** El candado está bien puesto; la decisión sobre μ y σ va aparte |
| **2** | **El bloque existía, en `lista_intercambio_por_region.js`.** Error mío decir que iba dentro del HTML. **Ya está integrado y conectado**, y los municipios pasaron de 111 a 224 |
| **3** | **No va la correspondencia.** La frecuencia no se convierte en porciones. `calcConsumo`, `generarAlertas` y `TCAC` quedan marcadas para borrarse |
| **4** | **No hay aviso al paciente**, ni por acto ni por efecto. Los datos los analiza el profesional. La reapertura sí se registra |
| **5** | **La cadena calórica queda libre de patología.** GEB sobre peso meta, proteína 0,8, grasa 30 %, el resto en CHO, todo editable. **La referencia por diagnóstico aparece junto al campo**, con su porqué, y lo que salga del rango queda escrito en la historia |
| **6** | **Agregadas "No hago ejercicio" y "0 minutos a la semana".** Sale el "(≥30 min)" de la P23. **Sin saltos condicionales** |
| **7** | **Alergias e intolerancias siguen separadas.** La distinción es del paciente. Solo se aterriza el lenguaje de la P44 |
| **8** | **Se retiraron TODAS las recomendaciones de proteína** fuera del módulo nutricional. **Desnutrición pasa a FFMI y sarcopenia a ASMI**, con sus cortes internacionales. Las dos exigen BIS |
| **9** | **Sin medición no hay diagnóstico:** la Diana ya no clasifica ceros. Corregidos además la cifra que imprime la historia y el peso de cálculo de la proteína |

**Va el `ATLAS_v8.html` de hoy**, con el mapa de regiones ya dentro y conectado, la cadena calórica sin
patologías, la asesoría de macronutrientes en el módulo del nutricionista y la Diana con guarda de
medición.

© Connected Nutrition Ventures SAS, 2026. Documento interno.
