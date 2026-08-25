# Ronda para Gildardo · 2026-08-24

**De:** Equipo Atlas · **Para:** Gildardo Uribe, Dirección Científica CNV

**Recibida tu respuesta del 23.** Ya aplicamos lo que cerraba sin ambigüedad: retiramos la residencia prolongada y sus dos columnas, movimos **salud celular a Diagnóstico**, y rotulamos la lista de intercambio como **lista base**, diciendo en pantalla que la selección por ciudad está pendiente, para que ningún profesional la entregue creyendo que ya está adaptada a su paciente. Y **descartamos de esta ronda todo lo que tu respuesta ya resolvió**, por eso es más corta de lo que iba a ser.

**Vamos a portar `motorTratNutri` con tus tres correcciones.** Antes necesitamos las cuatro respuestas de la Parte 1: **las cuatro cambian QUÉ se porta, no cómo**, y portar y rehacer no es opción en el motor de toda la prescripción.

---

# Parte 1 · Cuatro cosas cortas, antes de portar

## 1.1 · "Por grupo": tu tabla tiene tres niveles y creemos que hablamos de dos cosas distintas

Respondiste que las porciones van **por grupo**, y que los alimentos aparecen dentro "para que el nutricionista los despliegue, no para que reparta porciones entre ellos".

**Tu tabla tiene tres niveles, no dos:**

| Nivel | Qué es | Cuántos | ¿Lleva casilla de porciones en tu archivo? |
|---|---|---|---|
| 1 | **Grupo** (Harinas, Lácteos, Carnes...) | 12 | **no**, es la fila de encabezado |
| 2 | **Subgrupo** (Leche entera, Leche descremada, Carnes magras...) | 21 | **SÍ**, una casilla por subgrupo |
| 3 | **Alimentos** (Kumis, Leche de cabra, Arroz blanco...) | 350 | no, se despliegan con "ver N alimentos" |

Tu frase describe el **nivel 3** exactamente cuando dice "se despliegan para verlos". Pero "por grupo", leído al pie, es el **nivel 1**. Y en tu archivo la casilla está en el **nivel 2**: una por subgrupo. Es lo que portamos.

**Creemos que es vocabulario:** nosotros te preguntamos por "los 21 alimentos" cuando en realidad son subgrupos, y tú respondiste llamando "alimentos" a los 350. Si es eso, lo que tenemos ya es fiel y no hay nada que cambiar.

**¿La casilla de porciones va en el nivel 1 (12) o en el nivel 2 (21, como está hoy en tu archivo)?**

No lo tocamos hasta que respondas: si es el nivel 2, cambiarlo sería alejarnos de tu archivo, no acercarnos.

## 1.2 · El déficit quedaría contado dos veces

Nos pides dos cosas que, juntas, se suman sin querer:

- **(1.2)** que el gasto se calcule sobre el **peso de referencia** (el peso meta), no sobre el actual;
- **(1.1)** que el **déficit de 500** se conserve como sugerencia editable.

**El gasto calculado sobre el peso meta ya es, por definición, la ingesta que lleva a ese peso.** Es un objetivo con el déficit dentro. Restarle además 500 aplica un segundo déficit sobre el primero.

**El efecto concreto en un paciente con obesidad:** su gasto se calcula sobre un peso menor que el suyo (primera bajada) y luego se le restan 500 (segunda bajada). El objetivo puede terminar **en el piso de 1.500 / 1.200 kcal por dos vías sumadas**, no porque lo hayas prescrito así sino porque las dos correcciones se acumulan.

**Con el gasto ya sobre el peso de referencia, ¿el déficit sugerido sigue siendo 500, es otro número, o pasa a cero y el peso meta es el único que fija el objetivo?**

## 1.3 · La proteína de 1,25 no baja solo en cáncer: también en desnutrición

Anotaste 1.3 como "la fila de cáncer". **La línea de tu motor es esta:**

```js
if (hasCancer || desnutricion) { tipoEnergia = "Hipercalórica"; protKg = 1.25; ... }
```

`desnutricion` es **IMC < 18,5**. Así que al mandar `motorTratNutri` la proteína baja de 1,5–2,0 a **1,25 g/kg también para los desnutridos**, que son los fenotipos F7 y F10 y **el perfil con riesgo de síndrome de realimentación**, donde la proteína es parte del soporte.

No es una fila: **son dos poblaciones**, y la segunda es la más frágil.

**¿1,25 aplica también al desnutrido, o esa rama debería separarse y conservar el rango más alto para desnutrición?**

## 1.4 · El par de ECM/BCM

Aplicamos tu regla ("toda la composición corporal se estratifica por sexo; si encuentran uno que no lo hace, corríjanlo y repórtenlo"). Barrimos **todos** los umbrales de composición del motor. **Todos la cumplen menos uno:**

> **`ECM/BCM > 1,4`**, la badge de "ECM/BCM elevado" de salud celular. No distingue sexo.

**No lo corregimos**, porque corregirlo sería inventar un umbral clínico: diste el par para FFMI (17/15) y para FMI (6/9), pero no para este. **Danos los dos valores y lo aplicamos.**

*(Verificamos también `MCA_dif < −1`, que tampoco distingue. Ahí creemos que no hace falta: es un residuo contra `MCA_ref`, que el Biody entrega por sexo y edad, así que la estratificación ya está dentro de la referencia. Si lo ves distinto, dinos.)*

---

# Parte 2 · Tu pregunta: de dónde salió salud celular en Tratamiento

**De tu propio archivo, y no por interpretación.**

`celBadges` está en la entrega que confirmaste vigente (`ATLAS_v8.html` del 2026-08-19), en la **línea 17126**. Esa línea cae **dentro de la subpestaña del nutricionista de Tratamiento**: el bloque `tabTrat === "plan_nutricional"` abre en la 16595 y el del médico empieza en la 17184.

Nuestro comentario de porte cita `ATLAS_v7.html:15702-15706`, el mismo bloque en la entrega anterior. **Lo portamos de donde estaba.**

**Y eso responde lo que de verdad preguntabas:** no hay más piezas movidas de sitio por interpretación, porque esta no se movió. **Ya está en Diagnóstico**, junto a la composición, y queda claro en el código que el cambio es tuyo y no una corrección nuestra.

---

# Parte 3 · Qué alimenta al modelo, y qué alimenta al menú

Dos preguntas distintas que se tocan. La primera (3.1) es la grande y es del MODELO: qué de lo que se le pregunta al paciente debe llegar al motor. La segunda (3.3 a 3.5) es del MENÚ: estábamos por rehacer el generador para que **adapte** el menú base según las restricciones, como hace el tuyo, y antes de escribir ese prompt necesitamos saber qué debe mirar, porque cada versión queda registrada y no queremos versionarlo dos veces.

**Lo que el menú mira HOY en Atlas:** objetivo calórico · proteína objetivo · restricciones del modelo · restricciones que escribe el profesional · fenotipo estructural · sector funcional · rutas priorizadas.

## 3.1 · La pregunta más importante de esta ronda: 25 de las 64 preguntas no llegan al modelo

Verificamos las **64 preguntas** de la encuesta vigente, una por una. **39 alimentan el motor y 25 no.**

Y comprobamos qué hace tu archivo con esas 25: **tampoco las consume**. Aparecen en la declaración de la encuesta y en el conteo de completitud, no en el cálculo. **Así que no es que se nos haya perdido nada al portar:** es que el instrumento pregunta más de lo que el modelo consume, y eso es igual en los dos.

**El dominio de alergias y digestión queda ENTERO fuera**, las diez preguntas, incluidos los siete síntomas digestivos. Y hay una que nos llamó la atención: **"¿ronca durante el sueño?" es tamizaje de apnea**, y hoy no entra a ninguna parte.

### La tabla completa, para que decidas sobre ella

Aquí están las 25, por dominio. La última columna dice si algo en Atlas las usa hoy, aunque no sea el motor.

| Dominio | Pregunta | ¿Alguien la usa? |
|---|---|---|
| Hábitos | ¿Qué tipo de actividad realiza? | nadie |
| Hábitos | ¿Cómo califica la calidad de su sueño? | nadie |
| Hábitos | **¿Ronca durante el sueño?** | nadie |
| Hábitos | ¿Con qué frecuencia consume alcohol? | nadie |
| Conductas alimentarias | ¿Cuántas comidas hace al día? | nadie |
| Conductas alimentarias | ¿Desayuna regularmente? | nadie |
| Conductas alimentarias | ¿Sigue algún patrón alimentario? | nadie |
| Conductas alimentarias | ¿Qué suplementos toma actualmente? | nadie |
| Antecedentes | ¿Toma medicamentos para la presión arterial? | historia clínica |
| Antecedentes | ¿Fue amamantado/a en su infancia? | historia clínica |
| Antecedentes | ¿Exposición habitual a contaminantes? | nadie |
| Alergias y digestión | ¿Alergias alimentarias diagnosticadas? | historia clínica |
| Alergias y digestión | ¿Intolerancias alimentarias? | historia clínica |
| Alergias y digestión | ¿Cirugía que afecte la digestión o el metabolismo? | historia clínica |
| Alergias y digestión | Hinchazón abdominal | nadie |
| Alergias y digestión | Gases / flatulencia | nadie |
| Alergias y digestión | Dolor abdominal | nadie |
| Alergias y digestión | Diarrea | nadie |
| Alergias y digestión | Estreñimiento | nadie |
| Alergias y digestión | Reflujo / acidez | nadie |
| Alergias y digestión | Náuseas | nadie |
| Hidratación | Café (tazas por día) | nadie |
| Hidratación | Té (tazas por día) | nadie |
| Hidratación | Jugos naturales (vasos por día) | nadie |
| Hidratación | ¿Color de su orina habitualmente? | nadie |

**Cinco tienen consumidor y veinte no tienen NINGUNO.** Y es importante el matiz: no es que el modelo no las use, es que **no las usa nada**. Verificamos que todos los lectores de los cuatro motores (nutricional, médico, ejercicio y psicológico) y la vista de patrón alimentario descartan la respuesta si la pregunta no está en el contrato. Las cinco que sí tienen consumidor lo tienen **desde ayer**, porque las pusimos en la historia clínica al portar la tuya. **Las otras veinte: el paciente las responde y no llegan a ninguna parte.**

Y una curiosidad que salió de ahí y que quizá te diga algo: **la pregunta "¿Sigue algún patrón alimentario?" no alimenta la vista de patrón alimentario.** Esa sale de los 15 grupos de D1 más los 3 horarios. El nombre sugiere un consumidor que no existe. Es el tipo de cosa que pasa cuando el instrumento y el modelo crecen por caminos distintos, y por eso preferimos preguntarte por el contrato completo en vez de ir campo por campo.

### Las dos preguntas que salen de aquí

1. **¿Cuáles de esas 25 deberían entrar al modelo?** Es criterio tuyo, no nuestro. Decide sobre la tabla y lo cableamos.
2. **Y las que no deban entrar ni las use nadie: ¿siguen valiendo la pena en el instrumento?** No lo preguntamos para recortar: puede que las quieras ahí como registro clínico, y es una razón válida. Pero si alguna no la va a usar nadie nunca, el paciente está dedicando tiempo a una pregunta que no cambia nada, y eso también es un costo.

Preferimos preguntarlo así, de una, en vez de irlos encontrando de a uno en cada bloque que construimos.

## 3.2 · El caso concreto: los antecedentes clínicos, y por qué urgen

Esto es un **caso particular de 3.1**, y va aparte porque tiene consecuencia inmediata sobre lo que se le entrega al paciente.

**Un paciente que declaró alergia a los mariscos puede recibir un menú con mariscos**, salvo que el profesional la teclee a mano. Verificamos qué hace tu archivo: las lee **en un solo sitio**, para el párrafo clínico ("presenta ... alergia a X"), y en toda el área del plan y del menú no aparecen.

**Dos de este bloque pesan más que las alergias en algunos pacientes:**

- **La cirugía metabólica o digestiva.** Un bypass gástrico no es un detalle: cambia absorción, requerimiento proteico y tolerancia.
- **"¿Toma medicamentos para la presión?"** es lo que separa una hipertensión **controlada** de una que no lo está. El motor sabe el diagnóstico (esa sí entra) y **no sabe si está tratada**.

**El agravante, y es el que más nos preocupa.** Tu historia clínica **muestra estas preguntas** con su valor: vimos en tu pantalla "Medicación antihipertensiva", "Alergias alimentarias" e "Intolerancias". La nuestra las muestra también. Entonces el documento clínico que firma el profesional **afirma que el paciente es alérgico al marisco** en la misma consulta en la que el menú se lo puede servir. El dato no falta: está a la vista en una hoja y ausente en la otra, que es peor, porque el plan parece verificado contra la historia.

Mientras se decide, en Atlas esos datos salen en la historia clínica **marcados como "solo registro"**, con una nota que dice que el paciente los declaró y que el diagnóstico no los tuvo en cuenta. Es incómodo a propósito.

**Nuestra propuesta:** que las alergias viajen al menú **en bloque propio y por encima de todo lo demás**. Una restricción médica se puede matizar; una alergia declarada, no. ¿La apruebas? ¿Y la intolerancia igual de dura, o con matiz (la lactosa admite grados, el maní no)?

## 3.3 · El menú no sabe cuántas porciones lleva cada comida

El desayuno del menú **no refleja las porciones que la distribución le asignó al desayuno**. La cadena va objetivo → intercambio → distribución → menú, y **se corta en el último eslabón**.

**Verificado también en tu archivo:** la distribución (`interDist`) solo la lee su propia tabla; ningún código del menú la toca.

Tu respuesta a P-25 nos dice que los porcentajes por tiempo son un valor por defecto que el nutricionista ajusta. Eso hace la pregunta más concreta: **si el profesional ajusta el reparto, ¿el menú debe respetarlo, o solo tenerlo en cuenta?** Hoy no hace ninguna de las dos.

## 3.4 · El contexto del paciente: acceso e inseguridad alimentaria

Un paciente con inseguridad alimentaria o acceso limitado **no debería recibir un menú con salmón**.

**El dato ya existe y ya lo usas:** tu párrafo del resumen dice "presenta inseguridad alimentaria frecuente" o "con acceso fácil a alimentos frescos". Lo portamos tal cual. Lo que no ocurre es que llegue al menú.

**Esto no lo proponemos: te lo preguntamos.** Que un menú se module por la situación socioeconómica es criterio clínico y toca cómo se le presenta el plan a una persona. ¿Debe considerarlo? Y si sí, ¿cómo lo dirías sin que el paciente lea un plan que le recuerda lo que no puede comprar?

## 3.5 · Y la pregunta de fondo: ¿qué más?

Las tres de arriba aparecieron **buscando otra cosa**. Si tres salen solas, probablemente haya más que no vemos porque no sabemos qué buscar. **Con la lista de lo que hoy viaja (arriba), ¿qué falta?**

---

# Parte 4 · Lo que aplicamos con tu regla, sin preguntarte

Tu regla del 23 (**el motor propone, el profesional dispone**) resolvió esto sin que haga falta una pregunta aparte. Lo declaramos para que lo sepas, no para que decidas:

**Una comida activa y vacía.** Se puede dejar el desayuno activo y repartirle cero porciones: el plan queda diciendo dos cosas a la vez. Tu archivo compara la suma **por alimento** (bien), pero no tiene verificación **por tiempo de comida**, así que ese caso pasa sin marca.

**Lo aplicamos como tu regla indica: avisa y deja guardar**, igual que el descuadre por alimento. El texto dice cuál es la salida: *"El desayuno está activo pero no tiene porciones asignadas. Si el paciente no hace esa comida, apaga la casilla."*

Si prefieres que no se avise, se quita en una línea.

---

# Parte 5 · Tres cosas que encontramos mirando tu archivo (informativo)

No requieren nada de ti. Van porque cambian qué tenemos que construir.

**Tu plan tiene dos caras.** La lista de intercambio del paciente está marcada como "solo impresión": no se ve en pantalla. Al mirarlo completo, lo que se imprime **excluye lo técnico** (fórmula sintética, tabla de trabajo, validación) y deja lo que el paciente usa. Nos parece bien y no lo teníamos modelado. **La dejamos visible en pantalla por ahora**, porque todavía no tenemos superficie de impresión; la moveremos cuando construyamos el envío. Lo decimos para que no parezca que la pusimos ahí por decisión propia.

**Hay cuatro salidas al paciente, no una:** el plan impreso, un correo que hoy manda una sola línea sin adjunto, el envío del informe de composición a la app del paciente, y la impresión de la pestaña completa. Son **tres documentos por dos canales**; nos sirve para ordenar el bloque de envío antes de construirlo.

**Tu historia clínica tiene once secciones** y nuestro reporte en PDF trae seis. No es una pregunta: es alcance que no teníamos dimensionado, y probablemente sea una pestaña propia.

---

# Parte 6 · Cuatro defectos NUESTROS, ya arreglados, que quizá te sirvan para tu archivo

Esto **no es una pregunta**: es un reporte. Los cuatro son defectos de Atlas, no tuyos, y ya están corregidos. Te los pasamos porque salen de cómo leímos **tus** clasificadores, y puede que a ti te interese revisar cómo los pintas.

**No es que copiáramos mal tus colores. Es que dedujimos la severidad del TONO, y el tono no la lleva.**

Nuestra tabla de índices pinta un semáforo a partir del color que devuelve cada clasificador. La regla era: verde óptimo, ámbar alerta, rojo crítico. Y comparábamos dos canales del color antes de mirar la etiqueta. **Todo azul caía en "óptimo"**, porque en un azul el verde supera al rojo. Los cuatro casos:

| Lo que decía la etiqueta | Cómo se veía |
|---|---|
| **"Desnutrición"** (FFMI bajo) | color de **óptimo** |
| **"Disfunción celular severa"** (mapa AF×IR) | color de **óptimo** |
| **"Alto — sospecha anabolizantes"** (FFMI alto) | color de **óptimo** |
| **"Bajo"** (FMI, déficit de masa grasa) | color de **óptimo** |

**El primero es el que importa.** La historia clínica que acabamos de construir muestra **solo los índices alterados**, siguiendo tu propia regla. Con el defecto vivo, un paciente **desnutrido** habría recibido un documento clínico que dice **"Sin índices alterados"**. Un papel firmado afirmando que un desnutrido está bien.

**Lo que lo hace difícil de ver, y es lo que quizá te sirva:** el azul en tu archivo **no tiene un significado único**. `cSMM` lo usa para **"Óptimo"**, que es el mejor nivel; `cFMI` lo usa para el déficit. Es coincidencia de tono, no semántica. Por eso nuestro arreglo dejó de mirar el color y pasó a mirar **la etiqueta**, con los benignos nombrados uno por uno ("Óptimo", "Bajo (atleta)") y con el default del lado seguro: un azul que no reconozcamos se trata como alteración, porque en un documento que filtra por alteración es mejor que algo aparezca de más.

En el mapa AF×IR ni la etiqueta alcanzaba: *"Hidratación óptima · Masa celular límite"* contiene la palabra "óptima" y lo que se clasifica es la otra mitad. Ahí la severidad quedó escrita para las nueve interpretaciones, una por una.

**Si tu archivo también decide algo a partir de ese color, vale la pena mirarlo.** Y si el azul de `cSMM` y el de `cFMI` deberían ser tonos distintos, es cosa tuya, no nuestra: nosotros no cambiamos tus colores, solo dejamos de deducir de ellos.

---

## Y tres cosas de tu pantalla que vimos al portar la historia clínica

**1. `undefined` literales.** En el bloque de composición corporal aparece, tal cual:

> Fenotipo MCCB: F7 — **undefined**   PBI: **undefined**

El fenotipo sí sale (F7), lo que falta es su **nombre**; y el PBI no sale del todo. Es la que más nos preocupa de las tres: puede que el problema no sea solo el rótulo.

**2. El motivo de consulta sale sin separador.** Las opciones se concatenan pegadas: *"Control de peso / composición corporal**Rendimiento deportivo**Envejecimiento saludable / longevidad"*. Nosotros las unimos con coma.

**3. La fecha de la firma es la de impresión.** El pie `FIRMA Y FECHA` usa la fecha del día en que se abre el documento. Una historia clínica impresa tres meses después queda fechada tres meses tarde. Nosotros usamos la fecha de la evaluación.

**Y una cosa que sí agregamos a la HC**, para que la conozcas: **la cirugía digestiva o metabólica**. La encuesta la pregunta y tu HC no la muestra. Un bypass gástrico cambia absorción, requerimiento proteico y tolerancia, así que omitirla de una historia clínica nos pareció copiar un hueco. Si tienes una razón para dejarla fuera, dínosla y la quitamos.

---

# Resumen

| # | Qué | Tipo |
|---|---|---|
| 1.1 | ¿La casilla de porciones va en el nivel 1 o en el 2? | **Bloquea el porte** |
| 1.2 | ¿El déficit sigue en 500 con el gasto ya sobre el peso meta? | **Bloquea el porte** |
| 1.3 | ¿1,25 g/kg aplica también al desnutrido? | **Bloquea el porte** |
| 1.4 | El par H/M de ECM/BCM | Dato que falta |
| 2 | Salud celular salió de tu archivo, línea 17126 | **Respuesta a tu pregunta** |
| 3.1 | **25 de las 64 preguntas no llegan al modelo. ¿Cuáles deberían?** (con la tabla completa) | **La más importante** |
| 3.2 | Los antecedentes clínicos: el caso concreto, con consecuencia sobre el menú | Propuesta, seguridad |
| 3.3 | ¿El menú debe respetar el reparto por tiempos? | Pregunta |
| 3.4 | ¿El menú debe considerar el acceso a alimentos? | Criterio tuyo |
| 3.5 | ¿Qué más debería alimentar el menú? | Pregunta abierta |
| 4 | Aviso de comida activa y vacía: aplicado con tu regla | Declaración |
| 5 | Dos caras, cuatro salidas, historia clínica | Informativo |
| 6 | **Cuatro defectos nuestros ya arreglados** por deducir severidad del tono (un desnutrido salia en verde) + tres cosas de tu pantalla | **Reporte, no pregunta** |

**Lo que bloquea es la Parte 1. Lo más importante es el 3.1.** El resto lo seguimos construyendo mientras respondes.
