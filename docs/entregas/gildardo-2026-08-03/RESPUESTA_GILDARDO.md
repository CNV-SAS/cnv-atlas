# Respuesta de Gildardo, 2026-08-03 (versión recibida, verbatim)

> Documento recibido de la Dirección Científica. Se guarda tal cual se recibió (fuente de la ronda).
> La AUTORIDAD de aquí en adelante es la INSTRUCCIÓN ESCRITA, no el archivo prototipo (ver punto final).
> Los ítems accionables se registran en GILDARDO_QUERIES.md / CAMBIOS_AUTORIZADOS.md / ARCHITECTURE.md
> y se consolidarán en el documento único numerado y firmado (en preparación).

---

Santiago, respondo todo. Al final va una decisión de método para que dejemos de repetir esta conversación.

1. LAS CUATRO CONFIRMACIONES

A. Confirmado. Sin peso de referencia registrado no se emite prescripción calórica ni proteica. Quiten el respaldo por fórmula de mi archivo. Un peso meta calculado en silencio es peor que no prescribir: el profesional creería que decidió algo que no decidió.

B. Lo leyeron bien. El peso de referencia es el que el profesional registra al medir, la meta a la que quiere llevar al paciente. No es el peso ajustado que calcula una fórmula sobre el peso medido. Esa fórmula no entra en ninguna parte de la cadena.

C. Lo leyeron bien, y es exactamente lo que ya les había respondido. Se guardan las dos, cada una con su rótulo, ninguna reemplaza a la otra. Los diagnósticos ya emitidos conservan solo la de nueve estados y no se reescriben. El fenotipo F1 a F12 se agrega de aquí en adelante.

D. Actívenlo en Atlas. No esperen a mi archivo. Mi archivo es un prototipo, no la fuente normativa; lo que da validez clínica es mi instrucción escrita, y C1 dice que se active. Si un paciente da un valor distinto en mi archivo y en Atlas, el que está desactualizado es el mío. Regístrenlo como divergencia deliberada, igual que las demás.

2. C11: FIRMADO

Así lo quería. La referencia que ve el profesional debe salir del clasificador, no de la tabla de presentación, y la dirección del indicador debe quedar explícita: en el IFC lo bueno es hacia arriba, en el IRC hacia abajo. El candado que pusieron para que las dos no se separen en silencio es correcto y debe quedar. Firmo C11.

3. ENCUESTA INCOMPLETA: SE DIAGNOSTICA, PERO NO SALE LO QUE DEPENDE DE LO QUE FALTA

Es la misma regla de "sin índice contextual no hay edad bioeléctrica", un nivel arriba, y se resuelve igual.

El diagnóstico bioeléctrico se emite siempre. Sale de la medición, no de la encuesta, y no depende de lo que el paciente haya dejado en blanco.

Lo que depende de la encuesta no se emite si la encuesta no está completa: no se calcula el índice contextual con valores por defecto, no se emite edad bioeléctrica, y no se activa ruta de atención derivada de esos dominios. En su lugar aparece, para el profesional, cuáles dominios faltan y qué queda suspendido por eso.

Un dominio sin responder no es un dominio normal. Correrlo con un valor por defecto es inventar una respuesta que el paciente no dio, y ustedes ya comprobaron que eso mueve el nivel de riesgo y activa una ruta que no corresponde. Eso no puede quedar sellado.

El estado de completitud de la encuesta se guarda con el diagnóstico. Cuando el profesional la complete, se emite versión nueva con lo que faltaba, sin sobrescribir la anterior.

4. PROFESIONES: LOS CUATRO BLOQUES YA EXISTEN Y HAY QUE PORTARLOS

Aquí hay un malentendido de fondo y conviene aclararlo antes de seguir.

El modelo contempla cuatro profesiones:

Nutricionista.
Médico, en cualquiera de sus perfiles: funcional, endocrino u otra especialidad.
Deportólogo, entendido de forma amplia: educador físico, médico deportólogo o entrenador.
Psicólogo.

Cada uno de esos cuatro perfiles tiene su propio bloque de tratamiento en mi archivo, completo y funcionando. No es contenido pendiente de mi autoría ni una definición que yo tenga que escribir. Ya está escrito y ya corre.

Entonces la pregunta no es qué debería poder hacer cada profesión dentro del modelo. Es por qué en Atlas solo está portado el bloque del nutricionista, y cuándo portan los otros tres. Eso es trabajo de implementación, con el mismo procedimiento que usaron para el resto del motor: se porta tal como está, sin interpretarlo y sin completarlo por su cuenta. Si al portarlo encuentran algo que no puedan ejecutar, me lo reportan como me han reportado lo demás.

Quiero saber, entonces, tres cosas:

Si revisaron los cuatro bloques al inventariar mi archivo, o si solo se identificó el del nutricionista.

Cuánto trabajo es portar los otros tres, para saber si entra antes o después de lo que ya está en curso.

Qué más de mi archivo puede estar en la misma situación: escrito y funcionando de mi lado, pero no identificado del suyo. Si esto pasó con tres bloques de tratamiento completos, conviene revisar el inventario antes de que aparezca otra cosa igual más adelante.

Lo único que no cambia: el tratamiento nutricional lo activa únicamente el nutricionista. Ninguna de las otras tres genera el protocolo nutricional, ni prescribe calorías o proteína, ni arma el plan alimentario. Cada una opera su propio bloque, no el del nutricionista.

Mientras los otros tres no estén portados, esas profesiones operan en Atlas con lo que hay. Díganlo explícitamente en su pantalla, para que un profesional no crea que el modelo no tiene nada para su disciplina cuando sí lo tiene.

Sobre los exámenes: retiren telómeros y estrés oxidativo del listado de sugeridos. No es un examen de laboratorio estándar y no puede figurar como ordenable mientras yo no defina dónde se procesa y con qué protocolo. Ningún ítem de ese listado puede citar como referencia el propio modelo.

5. REMISIÓN: ES UNA ACCIÓN, NO UN TEXTO

Remitir debe poder registrarse: a quién se remite, por qué motivo, en qué fecha, y si el paciente volvió. Una remisión que solo se lee en pantalla no existe en la historia clínica, y es justo el punto donde el modelo se conecta con el resto del sistema de salud. Con cuatro profesiones operando, además, la remisión entre ellas es parte del modelo, no un accesorio.

Cuando la ruta remite a la misma profesión del que está atendiendo, no es una remisión. Es conducta propia. El texto no debe decir "remisión médica si hay hipertensión o diabetes activa", debe presentarse como lo que le corresponde hacer a él en esa consulta. Corrijan la redacción en ese sentido para todas las rutas.

6. LA CADENA CALÓRICA

6.1. Sobre el peso de referencia. Esto ya estaba respondido en P1: el gasto se calcula con Mifflin sobre el peso de referencia. Cunningham sobre el peso medido queda como dato informativo para el profesional, no entra en la prescripción.

6.2. Gasto total más sobrecosto, no kcal por kilo. Ya definí la asimetría: las estrategias que restan no llevan ajuste, porque la meta ya lo produce; las que suman llevan su ajuste explícito sobre el gasto calculado en el peso de referencia. En cáncer activo, entonces, el objetivo es el gasto más el sobrecosto. La regla por kilo se descarta: no puede convivir con un modelo que calcula gasto. La magnitud del sobrecosto es la que ya está en mi archivo; se la confirmo con cifra en el documento consolidado.

6.3. Sobre el peso de referencia, igual que el gasto. La cantidad por condición se las envío con C6, que ya les debía. No la tomen de ninguna de mis versiones anteriores: se contradicen y por eso les tocó preguntar.

6.4. Valor fijo por defecto, ligero. No construyan el factor sugerido. El profesional elige el factor, y esa elección es suya; un valor sugerido a partir del ejercicio prescrito le agrega una capa automática a una decisión que debe ser deliberada.

7. LA COMUNICACIÓN DEL CAMBIO AL PACIENTE

7.1. Los tres textos, sin cifra y sin nombrar el indicador:

Mejoró: "Los indicadores de tu evaluación muestran una evolución favorable respecto de tu medición anterior. Continúa con el plan acordado con tu profesional."

Sin cambio: "Tus indicadores se mantienen en un rango similar al de tu medición anterior, sin cambios significativos con la información disponible."

Empeoró: "Tus indicadores muestran una evolución menos favorable que en tu medición anterior. Tu profesional revisará contigo el plan en la próxima consulta."

7.2. Sí, el profesional lo confirma antes de que salga, y es un acto aparte de aprobar el reporte. Una banda que dice "empeoró" no puede llegarle a un paciente sin que una persona haya decidido comunicársela. Si el profesional no la confirma, el reporte sale sin esa sección.

Y nunca sale sola: la banda "empeoró" solo se emite acompañada de la próxima cita agendada. Sin cita agendada, no se emite.

7.3. Tienen razón y el texto de arriba ya lo recoge. Mientras la calibración sea provisional no se le dice a nadie que se mantuvo estable. Se dice que no hay cambios significativos con la información disponible, que es lo que el modelo sí sostiene.

CÓMO DEJAMOS DE REPETIR ESTA CONVERSACIÓN

Buena parte de esta ronda ya estaba respondida antes, y no es descuido de ustedes. Son dos causas y las dos se arreglan.

La primera es mía. Tienen varias versiones de mi prototipo y se contradicen entre sí, así que cada vez que portan algo se topan con una bifurcación que solo yo puedo resolver. Lo corto así: mi archivo deja de ser fuente de ejecución. La fuente es mi instrucción escrita. Donde el archivo y la instrucción discrepen, manda la instrucción, y ustedes lo registran como divergencia sin preguntarme.

La segunda es de método. Las respuestas están en mensajes sueltos, y cada conversación arranca sin memoria de las anteriores. Consolidemos: un solo documento numerado y firmado, con todo lo decidido hasta hoy, incluida esta ronda. Yo lo firmo, ustedes lo mantienen.

Y una regla de entrada, desde ahora: antes de preguntarme algo, revisen si ya está en ese documento. Si está, impleméntenlo. Si está y no les sirve, citen el número y díganme qué no funciona. Si no está, pregunten, y la respuesta entra al documento con número nuevo.

Lo que queda de mi lado: C6 con la proteína y el sobrecosto en cifras, P2 primero porque destraba los nutracéuticos por ruta, y P3.

Gildardo de Jesús Uribe Gil
Dirección Científica, CNV
