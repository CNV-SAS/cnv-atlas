# Respuestas: borrador de encuesta antes del consentimiento, y captura de etnia

**Para:** el equipo de Atlas.
**Marco aplicable:** Ley 1581 de 2012 (arts. 3, 4, 5, 6, 9 y 12), Decreto 1074 de 2015, Constitución Política (art. 7), Ley 21 de 1991 (Convenio 169 de la OIT).

---

# Parte 1 · Conservar un borrador antes de firmar el consentimiento

## Respuesta corta

**No, no como está planteado.** Guardar respuestas de salud sin ninguna autorización previa carece de base legal en Colombia. Pero el problema tiene una solución mejor que el borrador, y probablemente resuelve el abandono más eficazmente: **mover el consentimiento al principio del flujo, no al final.**

## Por qué el borrador sin autorización no se sostiene

Tres piezas de la Ley 1581 concurren y no dejan margen:

- **El almacenamiento es tratamiento.** El artículo 3 define tratamiento como cualquier operación sobre datos personales, incluyendo expresamente la recolección y el almacenamiento. Guardar el borrador es tratar los datos, aunque nadie los mire.
- **La autorización debe ser previa.** El artículo 9 exige autorización *previa e informada* del titular. No hay figura de convalidación posterior: no existe la idea de "guardo ahora y legitimo después cuando firme".
- **Los datos de salud son sensibles.** El artículo 6 prohíbe el tratamiento de datos sensibles, salvo excepciones taxativas, la principal de las cuales es la autorización explícita del titular.

Aquí conviene señalar una diferencia importante frente al régimen europeo, porque es una fuente habitual de error al diseñar sistemas: **el RGPD admite el interés legítimo como base de tratamiento; la Ley 1581 colombiana no.** El régimen colombiano descansa esencialmente en la autorización. Un argumento del tipo "es en beneficio del propio titular, para que no pierda su trabajo" es razonable en lo práctico y jurídicamente insuficiente: no existe esa base habilitante en la ley.

El caso límite que ustedes mismos identifican, el borrador abandonado, lo confirma: datos de salud de una persona que nunca autorizó nada, sin titular con quien hablar. No hay forma de sostener eso.

## La solución que recomiendo: invertir el orden del flujo

Vale la pena preguntarse por qué el consentimiento está al final de 63 preguntas. Ponerlo ahí tiene dos problemas, no uno:

- **Legal:** obliga a recolectar datos de salud antes de tener autorización, que es exactamente el nudo de esta consulta.
- **De abandono:** el paciente invierte 63 preguntas y *después* se encuentra con un muro (leer un consentimiento largo, esperar un código por correo). Ese es el peor lugar posible para poner fricción. Si abandona ahí, se pierde todo el esfuerzo, suyo y del sistema.

**Con el consentimiento al inicio, ambos problemas desaparecen a la vez.** Todo lo que se recolecte después está autorizado, el borrador deja de ser un problema jurídico y pasa a ser una función normal del sistema, y la fricción queda al comienzo, cuando el paciente todavía no ha invertido nada y el costo psicológico de abandonar es bajo.

Además hay una razón de fondo: **un consentimiento informado que se firma después de entregar los datos no es realmente previo.** Aunque el sistema no los persista, el paciente ya los proporcionó. Pedirle autorización al final es pedirle que ratifique algo que ya hizo, no que decida si quiere hacerlo. El orden correcto es informar, autorizar, y luego recolectar.

## Si deciden mantener el consentimiento al final

Entonces hace falta **una autorización mínima al inicio**, específica y acotada, que habilite únicamente la conservación temporal del borrador. No es el consentimiento completo: es una autorización breve, con su propia finalidad, que el paciente acepta antes de la primera pregunta.

Redacción sugerida:

> *"Para que no pierda su progreso si se interrumpe el formulario, sus respuestas se guardan temporalmente en nuestros servidores mientras lo completa. Si no finaliza el proceso, esas respuestas se eliminan automáticamente en un plazo máximo de [N] días, sin que se cree ninguna historia clínica ni registro a su nombre. Al continuar, usted autoriza esta conservación temporal."*
>
> `[ ]` *Entiendo y autorizo la conservación temporal de mis respuestas.*

Esto convierte el borrador en tratamiento autorizado. Es una casilla, no un documento.

## Plazo de conservación

**Entre 72 horas y 7 días, y me inclino por 72 horas.**

No hay un plazo legal aplicable: la ley exige que la conservación no exceda lo necesario para la finalidad (principio de finalidad, art. 4). La finalidad aquí es estrecha: permitir que alguien retome un formulario interrumpido. Ese comportamiento ocurre en horas o en pocos días, no en semanas. Un plazo largo no aporta utilidad y sí aumenta el volumen de datos de salud sin consentimiento pleno acumulados en el sistema.

72 horas cubre el caso realista (se cayó la conexión, se acabó la batería, lo retoma esa noche o al día siguiente) sin acumular exposición. Si la evidencia de uso muestra que la gente retoma más tarde, se puede ampliar; empezar corto y ampliar es más fácil que al revés.

## Qué hacer al vencer: borrar, no anonimizar

**Eliminación completa.** Dos razones:

- **La anonimización sirve para conservar valor estadístico.** Un borrador incompleto no tiene valor de investigación: son respuestas parciales de alguien que no completó el proceso. No hay nada que valga la pena preservar.
- **Anonimizar bien es difícil y aquí sería contraproducente.** Un conjunto de respuestas de salud con edad, sexo, peso y talla es reidentificable con facilidad. Anonimizarlo de verdad exigiría aplicar el estándar completo de la Política de Gobernanza del Dato sobre unos datos que no aportan nada. Es trabajo y riesgo sin beneficio.

Recomendación operativa: eliminación por proceso automático, con registro de la eliminación (cuántos borradores se eliminaron y cuándo) pero sin conservar su contenido. Ese registro es la evidencia de que la regla se cumple.

## ¿Hace falta aviso al paciente?

**Sí, y no es opcional.** El artículo 12 obliga a informar al titular la finalidad del tratamiento. Si se guarda el borrador, el paciente debe saber que se guarda, por cuánto tiempo, y qué pasa al vencer. El texto sugerido arriba cumple esa función.

## Una observación adicional sobre las 63 preguntas

Fuera del terreno jurídico, y como observación: 63 preguntas es mucho para un intake, y el borrador es una solución al síntoma. Vale la pena preguntarse si todas son necesarias en la primera consulta, o si algunas podrían recogerse en el seguimiento. Reducir el formulario atacaría el abandono de raíz, mientras que el borrador solo lo mitiga. No es materia de esta consulta, pero si el abandono es el problema real, ahí hay más margen que en la persistencia técnica.

---

# Parte 2 · Captura de etnia

## Respuesta corta

**Sí se puede capturar, pero hace falta una autorización separada y específica, ubicada en el bloque de autorizaciones opcionales.** No basta con ampliar la casilla actual de datos sensibles de salud, y hacerlo así sería además un error con consecuencias.

## Por qué separada y no ampliando la casilla actual

El origen racial o étnico es dato sensible por el artículo 5, en una categoría distinta de los datos de salud. Podría pensarse que basta con reformular la casilla existente para que cubra ambas categorías. **No conviene, y la razón es decisiva:**

La autorización de datos sensibles de salud es **necesaria para el servicio**: sin datos de salud no hay evaluación ANI-BIS-E posible. Por eso está en el bloque de autorizaciones necesarias, y por eso no marcarla impide continuar.

La etnia **no es necesaria para el servicio**: se captura para estratificación de investigación. El artículo 6 prohíbe condicionar la prestación de un servicio a que el titular entregue datos sensibles que no son indispensables para él.

Si fusionan ambas en una sola casilla obligatoria, **estarían condicionando la atención clínica a que el paciente revele su origen étnico.** Eso es exactamente lo que el artículo 6 impide, y convertiría una casilla hoy correcta en una infracción.

**Ubicación correcta: en el bloque de autorizaciones opcionales**, junto a las de investigación y comunicaciones, no en el de necesarias.

## Redacción sugerida

Para el numeral 5 (usos opcionales):

> *"Informar su pertenencia étnica, con el fin de que los análisis del modelo puedan considerar las diferencias de composición corporal entre poblaciones. Este dato es completamente voluntario: usted puede recibir su atención normalmente sin informarlo, y no responder no tiene ninguna consecuencia sobre su evaluación ni su tratamiento."*

Para el numeral 12 (autorizaciones opcionales):

> `[ ]` *"Autorizo el tratamiento de mi información sobre pertenencia étnica, de forma voluntaria, para los fines de análisis descritos en el numeral 5."*

Dos precisiones sobre esta redacción. Primero, evita deliberadamente la expresión "origen racial": aunque es el término del artículo 5, en el trato con el paciente el estándar colombiano es la **pertenencia étnica por autorreconocimiento**, que es como lo formula el DANE y como la persona lo entiende. Segundo, explicita el motivo (diferencias de composición corporal entre poblaciones), porque una autorización sensible sin finalidad clara es débil: el titular debe saber para qué.

## ¿Basta con que quede vacío si no responde?

**No, es necesario pero no suficiente.** Que no haya valor por defecto cumple con no inferir el dato, pero el artículo 6 exige tres cosas más:

- **Autorización explícita y diferenciada**, es decir su propia casilla, no una casilla compartida ni una aceptación general.
- **Advertencia expresa de facultatividad**: el paciente debe ser informado de que no está obligado a responder preguntas sobre datos sensibles. La redacción sugerida lo incorpora.
- **Ausencia de consecuencia**: que no responder no altere en nada el servicio, y que eso sea visible para el paciente, no solo cierto internamente.

Añadiría una cuarta, de diseño: la pregunta debe incluir una opción explícita de **"Prefiero no responder"**, distinta de dejarla en blanco. Dejar algo vacío puede ser un olvido; elegir no responder es una decisión registrable, y en un dato sensible esa distinción importa.

## Categorías a utilizar

Recomiendo las del **autorreconocimiento étnico del DANE**, por comparabilidad estadística y porque es el estándar que la institucionalidad colombiana reconoce:

- Indígena
- Gitano o Rrom
- Raizal del Archipiélago de San Andrés, Providencia y Santa Catalina
- Palenquero de San Basilio
- Negro, mulato, afrodescendiente o afrocolombiano
- Ninguno de los anteriores
- Prefiero no responder

El principio operativo es el **autorreconocimiento**: el dato lo declara la persona sobre sí misma, nunca lo asigna el profesional ni lo infiere el sistema a partir de otra información. Esto no es solo buena práctica estadística; asignar una categoría étnica a alguien sin su declaración sería tratar un dato sensible sin autorización, además de un problema ético evidente.

## Gobernanza para el uso agregado: aquí está el riesgo real

Su intuición es correcta y el riesgo es mayor de lo que parece. Un ejemplo concreto lo ilustra: según el censo de 2018, en toda Colombia se autorreconocieron como población Rrom **menos de tres mil personas**. Si en una cohorte de estudio hay un paciente Rrom, cualquier tabla estratificada por etnia lo expone: no hace falta el nombre, la categoría misma lo identifica dentro de ese conjunto. Lo mismo ocurre, en menor grado, con población raizal o palenquera.

Esto significa que **la etnia no es un cuasi-identificador más: en grupos minoritarios es prácticamente un identificador directo.** Las reglas de gobernanza deben ser en consecuencia:

- **Doble autorización.** Solo pueden usarse para investigación los datos de pacientes que otorgaron **ambas** autorizaciones: la de etnia y la de investigación. Una sin la otra no habilita el uso.
- **Nunca a nivel de fila.** El uso es exclusivamente agregado, por cohortes. Ningún análisis, reporte o exportación debe permitir ver la etnia asociada a un registro individual, ni siquiera seudonimizado.
- **Supresión de celdas por debajo del umbral.** Se aplica el estándar de anonimización de la Política de Gobernanza del Dato. Este es el control crítico: si una categoría étnica tiene menos observaciones que el umbral, esa celda se suprime, no se publica ni se muestra. Sin esta regla, la estratificación étnica es una vía de reidentificación abierta.
- **Prohibición de combinación fina.** Cruzar etnia con otras variables (edad exacta, ciudad, profesional tratante) multiplica el riesgo. Los cruces deben evaluarse contra el mismo umbral, no solo la variable étnica aislada.

## Dos advertencias adicionales

**Los datos étnicos tienen peso constitucional en Colombia.** No son un dato demográfico más: la Constitución reconoce y protege la diversidad étnica y cultural de la Nación, y el Convenio 169 de la OIT, incorporado por la Ley 21 de 1991, establece protecciones reforzadas para pueblos indígenas y tribales. Esto no impide capturar el dato con autorización individual, pero sí eleva el estándar de cuidado esperado, especialmente en lo que se publique.

**Si ObBIA-Latam va a publicar hallazgos diferenciados por etnia, eso es investigación con implicaciones adicionales.** No basta la autorización de tratamiento: publicar conclusiones sobre características biológicas de grupos étnicos específicos es terreno sensible, con historia de mal uso, y debería pasar por el comité de ética correspondiente antes de la publicación, no solo antes de la recolección. Vale la pena que el protocolo del estudio lo contemple desde el diseño y no como un trámite final.

---

# Resumen de decisiones

| Punto | Decisión |
|---|---|
| Guardar borrador sin autorización | No es viable |
| Solución recomendada | Mover el consentimiento al inicio del flujo |
| Alternativa si el consentimiento sigue al final | Autorización mínima específica para el borrador, antes de la primera pregunta |
| Plazo del borrador | 72 horas, ampliable si la evidencia de uso lo justifica |
| Al vencer | Eliminación completa, con registro del hecho pero no del contenido |
| Aviso al paciente | Obligatorio si se guarda |
| Captura de etnia | Viable, con autorización separada |
| Ubicación de esa autorización | Bloque de opcionales, nunca en las necesarias |
| Categorías | Autorreconocimiento DANE, más "prefiero no responder" |
| Uso en investigación | Doble autorización, solo agregado, con supresión de celdas bajo umbral |
