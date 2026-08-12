Mejoras (recuerda que no usamos emojis):


1. Encuesta: 
a. En vez que diga Atlas, mejor que conserve el logo de Atlas y poner Patients. Entonces quedaria Atlas Patients. Ya que toda la encuesta es de cara al paciente.
b. En la primera pantalla de la encuesta (consentimiento + texto largo) toca darle "ver mas" para ver todo el texto completo y al final completo se pone la firma del paciente o la firma del representante legal + los datos del representante legal. La idea es que cumpla todos los requisitos legales colombianos/internacionales para ser considerados firma electronica. El problema es que a dia de hoy pues no se puede llenar. Tambien toca ver si como ponemos lo del asentimiento del menor cuando tiene entre 14 y 17 años.
Mejor dicho, revisar que campos llenables están texto plano para que se puedan llenar. Aunque por ejemplo hay algunos que no son necesarios como la cedula del paciente, ya que se ponen en la siguiente pantalla.
b.2. Yo creo que es mejor mostrar el texto asi como lo tenemos con los campos que no se pueden llenar porque solo aparece una raya, pero que aparezcan asi cuando ya ellos hayan colocado la información, para que de este modo aparezca el texto renderizado con la información real que efectivamente ellos pusieron. En ese caso si me parece bien mostrar el texto renderizado del consentimiento completo. Pero antes no es necesario mostrar la parte con las rayas vacias (espacio de la firma), o si?
c. En la pantalla 2 de la encuesta (sino estoy mal datos identificables del paciente), el apartado de sexo y ciudad deberian ser desplegables. Incluso me atreveria a meter pais de una vez tambien con desplegable. Me imagino que ya hay algo construido para un desplegable con cada pais y ciudad en el mundo? que opinas de implementar esto de una vez? porque poner ciudad en campo abierto puede ocasionar typos, errores, etc. entonces no se si de pronto tienes una solución para esto.
d. No hay validación de texto. Ni siquiera el email, revisar entonces en cada apartado de la encuesta todo lo de seguridad, creo que era headers, inyección sql, input sanitazion, CORS, etc. ya que este enlace si está de cara a usuarios en general y es delicado.
e. Cuando la pregunta tenga la opción (otro/s) u (otra/s) se debe abrir un apartado para que la persona coloque libremente el texto de a que se refiere con ese "otro" que no está en la lista. Tambien seria bueno hacer un barrido para revisar si a alguna pregunta le falta colocar ese "otro/s" aunque creo que eso le corresponde mas a gildardo, no a nosotros, y que el solo de la aprobación y nosotros lo pronpongamos en que preguntas puntualmente.
f. algunas preguntas donde puedo seleccionar multiples respuestas, aparece la respuesta ninguna entre esas opciones. Es logico poder seleccionar una o mas respuestas y "ninguna" a la vez? o inmediatamente alguien presione ningune solo quede marcada ninguna y el resto se desmarque. Y en caso en que tenga ningun/a marcada y marque otra respuesta, se desmarque "ningun/a" y pueda seleccionar multiples respuestas, no?  
g. dividir en subpestañas las secciones de la encuesta y poder volver o adelantarme si le doy click a la subpestaña de la sección.
h. Hay que darles número a cada pregunta
i. Deberiamos habilitar la opción de que si da click sobre una respuesta marcada se pueda desmarcar? ya que a veces aparece "Responde lo que aplique a tu caso. Puedes dejar en blanco lo que no sepas" pero uno responde algo por accidente y no hay forma de desmarcarlo.
j. especificos de cada sección:
* Cada sección tiene el numero de items o preguntas a responder.

* alimentación (revisar si se cambia el nombre o se mantiene como mejora).
- el html lo llama como Patrón Usual de Consumo, tiene esta introducción: "Piensa en cómo comes habitualmente, no en lo que comiste ayer.
Para cada alimento, elige con qué frecuencia lo consumes en una semana típica.
📏 La referencia te ayuda a imaginar la cantidad usual."

- Te pongo el ejemplo de lo que tiene el html:
"1
Verduras y hortalizas
espinaca, acelga, brócoli, tomate, zanahoria, ahuyama, remolacha, pepino (frescas, de hoja verde y fuente de vitamina A)
📏 Un puño cerrado
Nunca
1–2 días
3–4 días
5–6 días
Todos los días
2
Frutas enteras
banano, mango, papaya, guayaba, naranja, lulo, tomate de árbol (enteras, no en jugo)
📏 1 fruta mediana o un pocillo
Nunca
1–2 días
3–4 días
5–6 días
Todos los días
3
Leguminosas
fríjol, lenteja, garbanzo, arveja, habas
📏 Un pocillo arriero cocido"

Y Atlas tiene solo:
"Verduras y hortalizas (frecuencia de consumo)
Nunca
1–2 días
3–4 días
5–6 días
Todos los días
"
Entonces falta adoptar esa descripción/ejemplos y medidas (reglas de medida) como puño, pocillo, etc. para que el paciente dimensione a que se refiere. Esto de hecho es muy util.

- Cosas que NO considero necesarias de adoptar:

sesgos al responder, por ejemplo en esta primera sección de alimentación o como se llama en el html: Patrón Usual de Consumo, dividen los alimentos en las siguientes 3 categorias/Secciones:

✅ Alimentación Real protectora
⚖️ Alimentación Real energética (moderar)
⚠️ Procesados y ultraprocesados (PCBU)

Literalmente pone simbolos de riesgos y palabras como moderar, entonces uno entiende que entre mas poquitas ponga mejor o entre mas ponga mejor, segun la sección. Entonces mejor las renombramos o directamente eliminamos esa separación y que todos los alimentos queden seguidos.

> **RESUELTO (2026-08-12) -> NO se eliminan, se PARAMETRIZAN POR AUDIENCIA.** Ver `PLAN_ENCUESTA.md` (PRECISION de Santiago, 2026-08-09). El sesgo es del que RESPONDE (paciente), no del que INTERPRETA (profesional): las 3 categorias de D1 (y la marca TCA de Q21 y la descripcion "Factor de Estres Metabolico" de Q39) DESAPARECEN de la encuesta del PACIENTE pero SE CONSERVAN cuando el PROFESIONAL revisa/edita (necesita ver que grupos son protectores/de riesgo para leer el patron). Un solo prop `audience` ('patient' | 'professional') en el widget compartido gobierna los tres a la vez. NO es contradiccion con lo que se le confirma a Gildardo en la ronda C2 (esas son las etiquetas del lado PROFESIONAL). Se aplica al portar D1.

Aunque al final de esta tanda 1 (aliemntación), aparece este bloque: 🕐 Hábitos de horario y condimentación con las 3 preguntas finales  (sal extra, desayuna regularmente, a que horas suele cenar), entonces no se si tambien eliminamos esa separación.


* Percepción corporal:
- Aqui la unica diferencia es que el html pone: "Seleccione todos los que apliquen" en la pregunta 21, ya que se pueden responder muchas a la vez. Solo que aqui está la opcion "ninguna" que fue otra corrección que te puse al inicio.
- Tambien pone esto: "⚠ TCA" en esa misma pregunta 21, y tambien cambia de color y aparece esta advertencia segun lo que marque: "⚠️ Esta respuesta será marcada para evaluación clínica. Pero nuevamente a mi en lo personal no me parece necesario, ya que podria sesgar la respuesta.
"
* Habitos:
- En la pregunta 25 vuelve y juega lo de poner el texto: "Puede seleccionar varios" y el problema con ninguna.

* Conductas Alimentarias
- 34 y 35 les falta el texto: "Puede seleccionar varios"
- en la 35 no está la opción "otros" que despliega texto libre.

* Antecedentes y estilo de vida.
- En el html se llama ( Epigenético / LE8) revisar si cambiar el nombre o se mantiene. Me parece que para un paciente es mas claro asi como está.
- 38, falta poner lo de que puede seleccionar varios, y poner esta descripcion: "Padres, hermanos, abuelos · Seleccione varios". Lo mismo en la 39, solo que aqui cambia la descripcion por "Usados para calcular el Factor de Estrés Metabólico en el Motor Nutricional" solo que este no se si sea necesario ponerlo. Para que le sirve a un paciente saber esto? seria bueno que esto apareceria en la encuesta de revisión/edición del profesional, no del paciente.
- En la 39 vuelve y juega el problema de "ninguna" y falta que se despliegue texto libre cuando coloque "otro"
- 40, falta "Puede seleccionar varios" y desplegar texto libre al poner "otros"	
- 42 Vuelve y juega "ninguna" y poner que "Puede seleccionar varios"1.
* Alergias y digestión
- en el html se llama (Alergias y Salud Digestiva) revisar si cambiar nombre o dejar asi.

- Aqui hay un error que debajo de intolerancias alimentarias (44) se salta a (63) justo debajo a "¿Le han realizado alguna cirugía que afecte la digestión o el metabolismo?" me imagino que es porque es nueva. En nuestra numeración de preguntas si corregimos para que sea ordenado. Por cierto, la 63 nos falta a nosotros.

- 43, 44 y 63 puede seleccionar varios falta ponerle. Todas 3 tiene el ninguna, entonces tambien toca corregir segun el mecanismo que te dije o que propongas.
- 43 y 63 tiene "otra" falta que se abra texto libre.
- 63 tiene esta descripcion adicional: "Ej.: vesícula, bypass/manga gástrica, intestino · Puede seleccionar varias"

Ese puede seleccionar varias mejor ponerlo como un badge o un estandar para que no se confunda con la descripcion.

Aqui hay una separación de sección (leve) y dice "Síntomas digestivos (ítems 45–51)" solo que en nuestro caso puede ser diferente ya que vamos a contar bien y puede que sea 46-52.

* hidratación:
- En el html se inicializan en 0, pero Atlas las inicializa en - (revisar si realmente lo dejamos asi o adoptamos el html), ambas cosas tienen  sus ventajas. ya que "-" significa que no hubo respuesta y dejarla en 0 es por velocidad. De hecho creo que es mejor dejarlo "-" tal cual como lo tenemos.
- Todo bien de resto, quiza colocar la guia del color segun la orina que seleccione seria una mejora estetica, pero fiel al html.

* Contexto social
- Todo está igual al html