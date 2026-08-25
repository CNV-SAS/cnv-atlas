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

**Y una corrección nuestra, antes de que la leas en otro lado:** en un borrador de esta ronda te íbamos a decir que habíamos agregado la **cirugía digestiva o metabólica** porque tu HC no la mostraba. **Nos equivocamos: tu historia clínica sí la tiene**, en su propia sección ("ANTECEDENTES QUIRÚRGICOS"), y también tiene "EXPOSICIÓN A CONTAMINANTES", que nosotros todavía no mostramos. Lo revisamos mirando una captura de un paciente que no tenía ninguna de las dos, y una captura enseña un caso, no lo que el programa hace. Las dos van a nuestra historia clínica, sin pregunta de por medio: son tuyas.

---

# Parte 7 · Lo que recibe el paciente (la más importante de esta ronda, junto con la 3.1)

## 7.1 · Hoy le mandamos el documento clínico, no uno para él

El único documento que Atlas le envía hoy al paciente lleva, tal cual: **IFC, IRC, PABU, ICA-BIS, ISCM, IEHH**, el código de estado **N_N_N_A** y la frase **"Sector funcional (FyR)"**.

Un paciente no puede leer eso. Y es lo único que recibe.

**Encontramos que tú ya resolviste esto y nosotros no lo habíamos visto.** Tu archivo tiene `enviarInformePaciente`, con un botón que dice *"Comparte una versión amigable de la composición corporal"*, y el contenido está completo en el código (L13394). Lleva:

- **peso, talla, IMC con su categoría, ICT con su categoría, cintura**
- **masa grasa en kg y en %, masa magra, masa muscular, agua total**
- **ángulo de fase con su categoría**
- el **DFI reescrito para el paciente**
- el **resumen** del análisis

Y el DFI reescrito es lo que más nos llamó la atención, porque es una decisión clínica tuya, no una simplificación:

| Lo interno | Lo que ve el paciente |
|---|---|
| BAJO / MEDIO / ALTO / CRÍTICO | **Óptimo / A mejorar / Requiere atención / Prioritario** |
| severidad 0-3 por dominio | **En equilibrio / A vigilar / A trabajar / Prioritario** |
| dominio conductual con severidad alta | *"Te acompañaremos de cerca en tu relación con la alimentación y la imagen corporal; tu bienestar emocional es la prioridad."* |
| el veto | *"Tu profesional te acompañará de cerca; priorizaremos tu bienestar emocional antes que cualquier cambio en la alimentación."* |

Tu propio comentario en el código lo dice: *"sin CRÍTICO alarmante, sin mencionar TCA; el veto se reformula como acompañamiento"*.

**Y no lleva ninguno de los índices del modelo.** Ni IFC, ni IRC, ni PABU, ni ICA-BIS, ni ISCM, ni IEHH, ni el código de estado. Justo lo que nosotros sí estamos mandando.

### Lo que te preguntamos

Tenemos el contenido, así que la pregunta no es qué lleva, es cómo debe llegar:

1. **¿Confirmas que es ESE el documento que recibe el paciente, y que el nuestro de hoy no debería enviarse tal cual?** Queremos oírtelo antes de cambiar lo que sale de la clínica.
2. **En tu archivo ese informe va a la app del paciente**, que entra con documento y fecha de nacimiento. Nosotros hoy mandamos por **correo**. ¿El mismo contenido sirve por correo, o hay algo que solo tiene sentido en la app?
3. **¿Cuántos documentos son en total?** Tu prototipo tiene botones de envío en varias pantallas. Nosotros hemos inventariado tres: el **plan** (papel), el **informe de composición** (este) y la **consulta completa** (papel). ¿Falta alguno, y cuál recibe el paciente por defecto?
4. **Y la historia clínica: ¿la recibe el paciente?** Nuestra lectura es que no, que es el documento del profesional y de la institución. Confírmalo o corrígenos.

**Mientras respondes no tocamos el envío.** Lo que se manda cambia con tu respuesta, y no queremos versionar dos veces un documento que sale hacia una persona.

## 7.2 · Y una restricción que pusimos nosotros de más

En tu decisión del 3 de agosto (§7) dijiste que un "empeoró" solo se comunica si el profesional lo **confirma** y va **acompañado de la próxima cita agendada**; y que **sin eso, el reporte sale sin esa sección**.

Lo implementamos así. Pero además hicimos algo que **tú no pediste**: hoy Atlas **impide aprobar y enviar el reporte** mientras no se confirme y se agende.

La diferencia importa. Tu regla degrada: el documento sale, sin la sección del cambio. La nuestra bloquea: el documento no sale.

Nos pareció coherente (mandarle una mala noticia sin decirle cuándo lo vuelven a ver es peor que no mandarla), pero **es una restricción sobre un acto clínico y la pusimos nosotros**. ¿La apruebas, o prefieres tu versión, donde el reporte se puede enviar y simplemente no lleva esa sección?

Y sigue abierta una consulta tuya de entonces que nunca cerramos: **¿"cita agendada" se cumple con el campo de fecha lleno**, o exige algo más?

## 7.3 · Tu tabla de la historia clínica muestra dos filas que dicen "Normal" y "Óptimo"

Esto es un **reporte**, no una pregunta, y es de la misma familia que la Parte 6.

Portamos tu regla de la tabla de la HC: *"mostrar ítems alterados; ocultar solo los normales y sin clasificación"*. Al comparar las dos pantallas con el mismo paciente vimos que la tuya muestra **SMM/W: Óptimo** y **AF: Normal**. Lo verificamos con sus valores reales y hay dos causas distintas:

- **SMM/W 41,2 "Óptimo"** aparece porque tu regla cuenta el **azul** como alterado (`clf.c==="#3b82f6"`) y `cSMM` usa ese azul justamente para **Óptimo**. Es el mismo azul ambiguo del que te hablamos en la Parte 6, ahora al revés: a nosotros nos pintaba un desnutrido de verde, a ti te mete lo óptimo en la lista de alterados.
- **AF 6,7 "Normal"** aparece porque **`cAF` devuelve la etiqueta "Normal" con el color ámbar** (`#f59e0b`) para el rango 6,5-7,0 en hombres. La etiqueta y el color se contradicen dentro del mismo clasificador.

No copiamos ninguna de las dos: nuestra tabla oculta lo que nuestras etiquetas llaman óptimo o normal. Te lo decimos por si el color de `cAF` es un error de tecleo, que es lo que parece.
## 7.4 · Dos cosas que se deciden con tu respuesta al 7.1

**La primera.** Tú decidiste (1 de agosto) que **la cifra de EB-BIS nunca va al paciente**, y lo respetamos: no está en el reporte que le enviamos. Pero la **historia clínica sí la muestra**, junto a los demás índices del modelo, porque es el documento del profesional.

Si tu respuesta al 7.1 fuera que la historia clínica también llega al paciente, esa fila tendría que salir, y con ella todo el bloque ANI BIS-E. **No lo cambiamos hasta que respondas**, pero queremos que sepas que esa pregunta decide esto también.

**La segunda.** Tu historia clínica titula el resumen con la profesión de quien atiende ("RESUMEN DIAGNÓSTICO · NUTRICIONISTA") y lo llena con el contenido de esa disciplina. Nosotros tenemos portado **el resumen del nutricionista**; para las otras tres profesiones el modelo tiene contenido y todavía no lo hemos portado, así que en esos casos la sección lo dice en vez de mostrar el del nutricionista con otro título. Es coherente con lo que ya acordamos para las pantallas de las otras profesiones, y lo mencionamos por si el orden de porte te importa.


---

# Parte 8 · La pantalla del nutricionista: cuatro cosas del cotejo

Cotejamos tu subpestaña de nutrición contra la nuestra, pantalla contra pantalla. La mayoría coincide. Estas cuatro no, y tres de ellas son cosas que hicimos nosotros.

## 8.1 · Fundimos tus dos bloques en uno, y queremos que lo apruebes

Tu pantalla tiene **dos bloques separados**:

- **Objetivo del tratamiento nutricional:** el texto del objetivo, con cuatro campos debajo (objetivo calórico, actividad prescrita, déficit, peso meta).
- **Fórmula sintética:** la calculadora, con GEB, factor de actividad, GET, objetivo, peso de cálculo, proteína g/kg, proteína total, grasas % y g, y CHO por diferencia.

**Nosotros los fundimos en uno solo, que llamamos la cadena calórica.** La ciencia es la que tú nos diste el 9 de agosto (Mifflin sobre el peso actual, el déficit desde el peso meta, las cifras de proteína por condición); lo que cambiamos es cómo se presenta.

**Lo que gana al estar junto:**

- **Cuadre de macros:** las calorías de proteína, grasa y carbohidratos tienen que sumar el objetivo. Si no cierran, se ve. En dos bloques separados, un objetivo movido a mano puede quedar sin cuadrar con los macros y nadie lo nota.
- **Se distingue lo calculado de lo ajustado:** cada cifra muestra si es la del motor o la que movió el profesional. Hoy en tu pantalla, una vez escrita, una cifra ajustada se ve igual que una calculada.
- **Un solo sitio donde se toca el objetivo.** En tu pantalla el objetivo calórico aparece en los dos bloques, y hay que saber cuál manda.

**Lo que se pierde, y es lo que queremos preguntarte:** tú separaste **dos momentos** distintos, *decidir la meta* y *ver la cadena que la produce*. Fundidos, decidir queda dentro de calcular, y eso puede empujar al profesional a mover la calculadora cuando solo quería fijar una meta.

**¿Apruebas nuestro modelo, o prefieres tus dos bloques separados?** No lo cambiamos sin tu visto bueno: reorganiza cómo se prescribe.

**Y un detalle de tu pantalla, de paso:** el mismo factor de actividad se llama **"Actividad prescrita (FA)"** en un bloque y **"Factor actividad (PAL)"** en el otro. Parece un desliz.

## 8.2 · Nuestras "Guías dietarias": el sitio donde aterriza tu resumen clínico

Es un bloque donde el profesional escribe recomendaciones a mano, junto al objetivo. **La caja la diseñamos nosotros**, antes de tener tu archivo, y no tiene equivalente en tu pantalla.

Pero al revisarlo encontramos que **no está vacía de contenido tuyo**: al generar el diagnóstico, Atlas siembra ahí, como primera guía, **el resumen clínico que emite tu motor**. Así que hoy es el único sitio donde ese texto llega a una pantalla, y encima queda editable por el profesional.

**Dos preguntas, entonces:**

1. **¿Te parece bien que tu resumen clínico aterrice ahí, editable?** La alternativa es mostrarlo como salida del modelo, en solo lectura, y dejar la caja para lo que escribe el profesional.
2. **Y la caja en sí: ¿sobra?** Si crees que el plan y las restricciones ya cubren lo que el nutricionista necesita escribir, la quitamos.

## 8.3 · Las observaciones del profesional: dos sitios en tu modelo, y uno de los dos se pierde

Al cotejar Seguimiento encontramos que tu modelo tiene **dos formas distintas** de que un profesional anote, y no se parecen entre sí.

**La primera: notas clínicas estructuradas por profesión**, que aterrizan en la historia clínica.

| | Campos |
|---|---|
| Médico | Diagnóstico médico · Medicamentos prescritos · Indicaciones médicas |
| Psicología | Evaluación psicológica · Objetivos psicológicos · Técnicas / indicaciones |
| Entrenamiento | Diagnóstico funcional · Programa de ejercicio · Intensidad y frecuencia |

El **nutricionista no tiene**, y entendemos por qué: su plan es el registro.

**La segunda: las "Observaciones" del bloque de próximo control**, en Seguimiento. Esa no es por disciplina: es del **control**, y la escribe quien atienda.

**Y aquí está lo que queremos decirte, porque creemos que no es lo que pretendías.** Seguimos esa observación en tu archivo:

- Se guarda como `notas_profesional` en `evaluaciones_obbia`, **con `onConflict: 'documento'`**. Es decir: **una sola fila por paciente**. La observación del control de marzo **se sobrescribe** cuando se guarda la de junio.
- Y **no la lee nadie**: buscamos `notas_profesional` en todo el archivo y solo aparece al escribir. No sale en la historia clínica ni en ninguna otra pantalla.

**Así que hoy, en tu prototipo, lo que el profesional escribe en Observaciones se guarda, borra lo anterior, y no lo vuelve a ver nadie.** Es la misma familia del 8.5, pero al revés: ahí el modelo propone y nadie recoge; aquí la persona escribe y nada lo muestra.

### Lo que te proponemos

**Que las observaciones sean POR EVALUACIÓN, no por paciente, y que aparezcan en la historia clínica de esa consulta.** Una observación de seguimiento es sobre *ese* control: guardarla por paciente hace que la historia del paciente tenga una sola observación, la última, y que las anteriores desaparezcan sin dejar rastro.

Y con eso resuelto, la pregunta del nutricionista se ordena sola. Son dos, no una:

1. **¿Confirmas que las observaciones del control deben conservarse por consulta y verse en la historia clínica?**
2. **¿Y el nutricionista debería tener además su nota estructurada, como las otras tres profesiones?** El argumento a favor es que hoy su única vía de registro es el plan, y no todo lo que observa cabe ahí. El argumento en contra es el tuyo, y por eso preguntamos. *(Nosotros le pusimos unas "Notas del tratamiento" que hoy no llegan a ningún documento; si deben quedarse, irían a la historia clínica como las tuyas.)*

*(Las tres notas por profesión las estamos portando: nos faltaban. Y las portaremos precargadas desde lo que ya calculan tus motores, por lo que decimos en el 8.5.)*

## 8.4 · El orden de los bloques

Los dos órdenes difieren bastante, y el tuyo tiene una lógica que nos convenció: **fijar el objetivo → ver si el plan cumple → ajustar la calculadora → repartir**. Pones la validación arriba, antes de la fórmula; nosotros al final.

Vamos a alinearnos con el tuyo. Solo te avisamos de un caso que tu prototipo no tiene que resolver y el nuestro sí: en una **consulta inicial** todavía no hay plan, así que la validación arriba estaría vacía. Ahí mostraremos un aviso de que aparece al armar el plan, en vez de una tabla de ceros.

Y una diferencia donde nos quedamos con lo nuestro, dinos si te parece mal: tú pones **los tiempos de comida activos DESPUÉS** de la tabla de distribución, y nosotros antes. Como los tiempos activos gobiernan la distribución, ponerlos después obliga a subir a corregir.

## 8.5 · La pregunta que vale más que las otras cuatro: ¿qué otras salidas del modelo no llegan a donde deberían?

Esta no salió de un cotejo. Salió de juntar tres hallazgos que veníamos tratando por separado, y al ponerlos en fila resultan el mismo:

**Uno.** Tu motor de ejercicio calcula la prescripción completa (frecuencia, intensidad, tiempo, tipo, volumen, progresión) y tu pantalla la muestra. Al lado tienes un campo de notas llamado **"Intensidad y frecuencia"**, y **empieza vacío**. El deportólogo lee lo que el modelo calculó y **lo vuelve a teclear**. Lo mismo con "Programa de ejercicio".

**Dos.** Tu motor emite las restricciones médicas del paciente (hiposódica, nefroprotectora, lo que aplique) y tu pantalla las muestra. **No viajaban al prompt del menú**: la IA generaba sin verlas, salvo que el profesional las volviera a escribir a mano en el campo de restricciones.

**Tres.** La encuesta captura alergias e intolerancias con opciones cerradas, y tu historia clínica las muestra. **No entran a ningún motor ni al menú.**

**Los tres tienen la misma forma: el modelo produce algo correcto, y luego el sistema le pide a una persona que lo escriba otra vez, o simplemente no lo pasa al siguiente paso.** No es un descuido puntual; parece una característica de cómo creció el prototipo, y es entendible: cada pantalla se construyó como una pieza que funciona sola.

**Nosotros ya arreglamos dos** (las restricciones ahora sí viajan al menú; las alergias esperan tu respuesta del 3.2). El tercero lo estábamos a punto de portar **como caja de texto vacía**, hasta que nos dimos cuenta de que sería importar el hueco.

**Lo que hicimos en Atlas, y que te proponemos como criterio general:** donde el modelo propone algo, la pantalla lo precarga y el profesional lo ajusta, marcando lo que cambió. Es lo que ya hacemos en la cadena calórica.

**Y por eso la pregunta:** en lugar de irte preguntando pieza por pieza si esto o aquello debería precargarse, **¿qué otras salidas del modelo sabes que no están llegando a donde deberían?** Tú sabes lo que el modelo calcula mejor que nosotros; nosotros sabemos lo que la pantalla consume. Si nos das la lista, la cerramos de una vez en vez de irla descubriendo de a un hallazgo por cotejo.

*(Verificamos el nuestro antes de preguntarte: en Atlas, cada salida de los tres motores portados llega hoy a una pantalla. El hueco no es de consumo, es de que la propuesta no se pueda tomar.)*

## 8.6 · La próxima cita: tú la propones desde la ruta y nosotros no

Verificamos de dónde sale la fecha que aparece al final de tu historia clínica, y **es la misma del bloque de próximo control de Seguimiento**, con una cascada que nos parece bien pensada:

1. La fecha que el profesional guardó en Seguimiento.
2. Si no hay, **la que sugiere el protocolo del DFI**: la frecuencia de la ruta activa (por ejemplo "Cada 90 días") sumada a la fecha de consulta.

O sea: **el modelo propone la fecha, el profesional la confirma o la cambia, y la historia clínica muestra la que valga.** Es justo el criterio que pedimos en el 8.5, aplicado por ti.

**En Atlas la próxima cita solo se captura en un caso:** cuando el profesional confirma que va a comunicarle un "empeoró" al paciente. En un seguimiento normal **no hay dónde fijarla**, y nunca la proponemos desde la ruta.

No es una pregunta, es un hueco nuestro que vamos a cerrar copiando tu mecánica. Te lo decimos por si la frecuencia de cada ruta debe leerse de otra parte, o si hay rutas donde la fecha no deba sugerirse sola.

# Parte 9 · Seguimiento: una pregunta y tres cosas de tu pantalla

Con esto queda cotejada la última etapa. Tu pantalla de Seguimiento es **visual** (tres gráficos) y la nuestra es **tabular** (deltas de los siete índices). Vamos a tener las dos: un gráfico muestra la tendencia, una tabla da el número.

## 9.1 · ¿Cuál es el cambio mínimo detectable? (la pregunta)

Tu pantalla sigue la **capacitancia de membrana (C)** como parámetro de control. En las capturas que miramos, C pasa de **2,960 a 2,960** entre dos consultas: no se movió.

Y ahí nos frenamos, porque **no sabemos qué decir**. Un valor que no cambia puede ser dos cosas muy distintas:

- El paciente se mantuvo estable, que es información clínica real.
- O el cambio fue **más pequeño de lo que la medición distingue**, y entonces no sabemos nada.

**Sin saber cuál de las dos, "se mantuvo estable" afirma más de lo que tenemos.** Por eso, mientras respondes, nuestra pantalla va a decir **"sin cambio respecto de la medición anterior"**, sin calificarlo.

**Y la misma pregunta resuelve algo que dejaste abierto en agosto.** El corte de ±2 años de las tres bandas de la EB-BIS lo diste como **operativo y provisional**, "a reemplazar por el cambio mínimo detectable cuando exista". Es la misma pieza que falta aquí.

Entonces:

1. **¿Existe un cambio mínimo detectable para la EB-BIS y para C?** Si lo tienes, lo cableamos en los dos sitios.
2. **Si no existe todavía: ¿de dónde saldría?** ¿De la repetibilidad del equipo, de una cohorte, de un criterio tuyo?
3. **Y mientras tanto: ¿te parece bien decir "sin cambio" sin calificar**, o prefieres otra redacción?

## 9.2 · Dos cosas de tu pantalla de Seguimiento

Reporte, no pregunta. Las dos las vimos en tus capturas y **no las vamos a copiar**.

**Una: el gráfico de convergencia se sale de su panel.** Con dos consultas, la serie de ICA-BIS se dibuja más allá del recuadro y se monta sobre el gráfico vecino; las etiquetas se pisan. Miramos por qué, y no es cosa del tamaño: tu `lineFollow` emite el SVG con ancho fijo de 560 y `overflow: visible`, **sin `viewBox`**. Sin `viewBox`, el `maxWidth: 100%` recorta la ventana pero no encoge el dibujo, y `overflow: visible` deja que lo que sobra se pinte encima. Como el contenedor reparte el ancho entre dos columnas, cada una puede quedar en menos de 560. **Agregarle un `viewBox` lo arregla entero.**

*(Y una cosa que sí hiciste bien y portamos tal cual: PABU e ICA-BIS van en dos gráficos separados, con su propia escala y su propia línea de referencia. Tienen objetivos distintos —acercarse a φ, y tender a cero— y juntarlos habría sido peor.)*

**Dos: con una sola consulta, la pantalla dibuja igual.** El radar compara "Inicial 2026-08-13 vs Última 2026-08-13": **la misma medición contra sí misma**, con dos polígonos. Y las series pintan un punto suelto. Nosotros vamos a decir en su lugar que hace falta una segunda medición, y **cuándo correspondería** según la frecuencia de la ruta activa. Convierte un vacío en información, que es lo que el profesional necesita en la primera consulta.

## 9.3 · La fecha del próximo control se guarda sin que nadie la confirme

Tu bloque de próximo control **propone** la fecha (la frecuencia de la ruta sumada a la consulta) y el profesional puede cambiarla y guardar. Eso está bien pensado, y es lo que vamos a copiar: **en Atlas hoy la próxima cita solo se puede fijar cuando se confirma un "empeoró"**, y en un seguimiento normal no hay dónde ponerla.

Pero al seguir el dato encontramos esto: **la fecha sugerida queda persistida en cuanto la pantalla la propone**, antes de que nadie pulse "Guardar próximo control" (un efecto la escribe cada vez que cambia el campo, incluida la precarga). Y tu historia clínica lee de ahí. Así que **una fecha que nadie confirmó aparece como la próxima cita del paciente**.

**Nosotros lo vamos a hacer distinto, y te decimos por qué:** la sugerida se **muestra**, y se **guarda solo cuando el profesional confirma**. La razón no es de estilo. Tu propia regla dice que un "empeoró" solo se le comunica al paciente **con la cita agendada**; si la sugerida se guardara sola, esa condición se cumpliría sin que nadie decidiera nada, y la regla quedaría vacía por dentro.

Dinos si lo ves de otra forma.

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
| 6 | **Cuatro defectos nuestros ya arreglados** por deducir severidad del tono (un desnutrido salía en verde) + tres cosas de tu pantalla | **Reporte, no pregunta** |
| 7.1 | **¿Qué recibe el paciente?** Hoy le mandamos IFC, IRC, PABU y el código N_N_N_A. Tu informe amigable ya existe en tu archivo | **La más importante, con 3.1** |
| 7.2 | El bloqueo de enviar sin agendar lo pusimos NOSOTROS: ¿lo apruebas? | Restricción nuestra |
| 7.3 | Tu tabla de la HC muestra "Normal" y "Óptimo" como alterados (cAF y el azul) | Reporte |
| 7.4 | Dos cosas que dependen del 7.1: la EB-BIS en la historia clínica y el resumen por profesión | Informativo |
| 8.1 | **Fundimos tu "Objetivo del tratamiento" y tu "Fórmula sintética" en una sola cadena.** ¿Lo apruebas? | **Propuesta nuestra** |
| 8.2 | Las "Guías dietarias": ahí aterriza tu resumen clínico, editable. ¿Bien así? | Propuesta nuestra |
| 8.3 | **Las observaciones del control se sobrescriben por paciente y no las lee nadie.** ¿Por evaluación y a la historia clínica? | **Pregunta + reporte** |
| 8.4 | Nos alineamos a tu orden de bloques; dos avisos | Declaración |
| 8.5 | **¿Qué otras salidas del modelo no llegan a donde deberían?** (tres casos concretos) | **Pregunta abierta, la más útil** |
| 8.6 | Tú propones la próxima cita desde la ruta y nosotros no: hueco nuestro | Declaración |
| 9.1 | **¿Cuál es el cambio mínimo detectable?** (resuelve C y el ±2 provisional de la EB-BIS) | **Pregunta** |
| 9.2 | Tu gráfico de convergencia se desborda (le falta el viewBox del SVG); y con una consulta dibuja igual | Reporte |
| 9.3 | La fecha sugerida se guarda sin confirmar; nosotros la mostramos y la guardamos al confirmar | Reporte + declaración |



**Lo que bloquea es la Parte 1. Lo más importante son el 3.1, el 7.1 y el 8.5.** El envío al paciente queda congelado hasta que respondas el 7.1. El resto lo seguimos construyendo mientras respondes.
