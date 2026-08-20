# Respuestas: lista única de etnia, y código de verificación en seguimientos

**Para:** el equipo de Atlas y la dirección científica.

---

# Parte 1 · Vuelta a una sola pregunta de etnia

## Respuesta corta

**Sí es implementable, y para operación regional la decisión de unificar en una sola pregunta es acertada** por razones que van más allá del método invocado. Pero recomiendo **una modificación en la lista**: sustituir "Mulato/a" como categoría independiente. Y hay un asunto de fondo, mucho mayor que esta lista, que conviene poner sobre la mesa: el consentimiento vigente está construido sobre derecho colombiano y ustedes van a operar en quince países.

## Pregunta 1 · Viabilidad legal de la lista única en quince países

**Viable, y de hecho mejor que lo que teníamos.** Mi recomendación anterior de usar categorías DANE partía de un supuesto que esta consulta corrige: que la operación era colombiana. Para operación regional, esa lista no solo pierde sentido, sino que es inaplicable: cada país tiene su propio marco oficial y no son compatibles entre sí. Brasil clasifica por color/raza con categorías propias, México distingue población indígena y afromexicana, Chile y Perú tienen sus propias construcciones. Una lista armonizada única es la decisión correcta para comparar entre países, aunque sacrifique la comparación con la estadística oficial de cada uno.

Es decir: la dirección científica llega a la conclusión correcta, aunque el argumento que da (parametrización del archivo) no sea el que mejor la sostiene. El argumento fuerte es la operación regional.

**Lo que sí exige la operación en quince países**, y aplica a cualquier lista: en prácticamente todos los ordenamientos de la región, el origen racial o étnico es dato sensible con requisitos reforzados. Las tres condiciones que ya cumplen (autodeclaración, carácter voluntario, no condicionar el servicio) son el denominador común de esos regímenes, así que la lista en sí no genera un problema legal adicional.

## Pregunta 2 · Sobre "Mulato/a"

**Sí tiene implicaciones, y recomiendo no usarlo como categoría independiente.**

El término proviene, según la etimología aceptada por la Real Academia Española, de "mulo": el animal híbrido y estéril. Es una construcción del sistema de castas colonial, diseñada para clasificar a las personas por proporción de mezcla. Aunque en Colombia el DANE lo conserva dentro de una fórmula agrupada, su uso como opción autónoma en un instrumento clínico regional tiene tres problemas:

**De aceptabilidad.** Su carga varía mucho entre países: en algunos se percibe como descriptivo y en otros como francamente ofensivo. En un instrumento que va a operar en quince países, esa variabilidad es un riesgo innecesario. Un paciente que se sienta agredido por una categoría en un formulario clínico no solo no responde: pierde confianza en todo el proceso.

**De coherencia interna.** La lista incluye dos categorías de mezcla (mestizo: indígena y europea; mulato: africana y europea) pero omite la tercera del mismo sistema (indígena y africana). Si se adopta la lógica de castas, queda incompleta; si no se adopta, "mulato" sobra.

**De redundancia.** En la práctica, quien se autorreconoce mulato casi siempre también se reconoce afrodescendiente. Tenerlos separados divide una población que interesa analizar junta.

**Recomendación concreta:** conservar las siete opciones que pide la dirección científica, pero fusionar esa categoría en la de afrodescendencia, así:

> Mestizo/a · Blanco/a · **Afrodescendiente (incluye negro/a, mulato/a, afrolatino/a)** · Indígena · Otro · Prefiero no indicar

Esto mantiene la estructura y el número de opciones prácticamente igual, no rompe la parametrización del archivo de referencia (la categoría sigue existiendo, solo cambia su etiqueta), y elimina el término aislado. Si la dirección científica considera imprescindible conservar la granularidad, la alternativa es mantenerla pero con una etiqueta menos cargada, del tipo "Afrodescendiente de ascendencia mixta".

Si aun así se decide conservar "Mulato/a" tal cual, no hay impedimento legal. Es una decisión de riesgo reputacional y de calidad del dato, no de legalidad, y corresponde a la dirección científica tomarla con esa información a la vista.

## Pregunta 3 · El campo de texto libre en "Otro"

Sí, hay precauciones necesarias. El texto libre sobre un dato sensible es la vía más común de fuga de información no prevista.

**Riesgos concretos:** el paciente puede escribir su nacionalidad, su pueblo o comunidad específica ("comunidad X del resguardo Y"), su religión, o incluso información clínica. Cualquiera de esas cosas convierte el campo en un identificador directo: en una cohorte, alguien que declara pertenecer a una comunidad pequeña queda identificado con certeza, sin necesidad de su nombre.

**Precauciones a implementar:**

- **Límite de caracteres corto**, del orden de 50, que fuerce una respuesta categórica y no un relato.
- **Advertencia visible en el campo**: indicar que no se registren datos de identificación, ni información de salud, ni datos de terceros.
- **Nunca usar el texto libre como variable de estratificación directa.** Solo puede alimentar análisis después de un proceso de normalización a categorías, revisado por una persona.
- **Excluir el campo de cualquier exportación o vista agregada** hasta que haya sido normalizado. Un reporte que incluya texto libre sin revisar es una fuga esperando ocurrir.
- **Tratarlo con la misma protección que el campo estructurado**, incluido el régimen de acceso que ya definieron.

## Pregunta 4 · Qué se pierde al retirar la pregunta de ascendencia

Conviene precisar qué es cada cosa, porque la consulta las nombra al revés de como quedan.

La lista que ahora pide la dirección científica **es**, en sustancia, una pregunta de ascendencia aparente. Lo que se retira no es la ascendencia: **es la pertenencia étnica en sentido estricto**, la de grupos reconocidos.

**Lo que se pierde con eso:**

- La capacidad de identificar grupos con reconocimiento jurídico diferenciado (raizales, palenqueros, Rrom en Colombia, y sus equivalentes en otros países). Estos grupos son numéricamente pequeños pero de alto interés para investigación poblacional, precisamente por su distintividad.
- La comparabilidad con estadística oficial de cada país.
- La posibilidad de reportar bajo enfoque diferencial si alguna vez se requiere.

**Lo que se gana:** una variable comparable entre quince países, con celdas más grandes y por tanto menos problemas de reidentificación, y un formulario más corto.

**Mi lectura:** para el objetivo declarado (comparar composición corporal entre poblaciones a escala regional), el intercambio es razonable. La pérdida se concentra en grupos minoritarios que, de todos modos, habrían caído bajo supresión de celdas en casi cualquier análisis. Vale la pena que quede documentado en el protocolo de investigación que se tomó esta decisión y por qué.

**Mantengo, eso sí, la advertencia científica del dictamen anterior**, y con la operación regional se vuelve más fuerte, no menos: "mestizo" significa cosas distintas en México, en Colombia y en Argentina, tanto en composición ancestral real como en autopercepción. Agregar bajo una misma etiqueta a poblaciones de quince países es una simplificación que un revisor de revista indexada va a cuestionar. Si ObBIA va a publicar diferencias poblacionales usando esta variable, el protocolo debería anticipar esa objeción y declarar los límites de la medida.

## Pregunta 5 · Cobertura del consentimiento v1.0

**Para Colombia, sí queda cubierto.** El texto habla genéricamente de "pertenencia étnica" sin enumerar categorías, y la Ley 1581 trata el origen racial y el étnico bajo la misma categoría de dato sensible. Cambiar la lista no dispara nueva versión.

**Pero aquí está el punto que me parece más importante de toda esta consulta**, y excede lo que preguntaron: el consentimiento v1.0 está construido íntegramente sobre derecho colombiano. Cita la Ley 1581 de 2012, la Ley 527 de 1999, las Resoluciones 1995 de 1999 y 839 de 2017, y designa a la Superintendencia de Industria y Comercio como autoridad de reclamo.

Si el sistema va a operar en quince países, **ese documento no sirve fuera de Colombia sin adaptación**. Cada jurisdicción tiene su propia autoridad de control, sus propios plazos de conservación de historia clínica, sus propios requisitos de autorización para datos sensibles, y sus propias reglas sobre transferencia internacional. Un paciente en Perú al que se le dice que puede reclamar ante la SIC colombiana no tiene un canal de derechos real.

Esto es un asunto de mucho mayor calado que la lista de categorías étnicas, y conviene abordarlo antes de operar fuera de Colombia, no después. No es algo que se resuelva en una consulta: requiere revisión jurídica local en cada país donde se pretenda operar.

---

# Parte 2 · Código de verificación en consultas de seguimiento

## Respuesta corta

**Su lectura es correcta en lo esencial: el seguimiento no requiere consentimiento nuevo, y pueden aligerarlo.** Con dos matices sobre cuándo sí hay que volver a pedirlo.

## Pregunta 1 · ¿El seguimiento requiere consentimiento nuevo?

**No, y el propio texto del consentimiento lo resuelve.** El numeral 4, entre las finalidades necesarias, incluye expresamente: *"Generar su reporte y dar continuidad y seguimiento a su atención."* El seguimiento no es una finalidad nueva que requiera autorización adicional: es una de las finalidades que el paciente ya autorizó.

Además, hay un argumento de calidad del consentimiento que conviene tener presente: **pedir la misma autorización repetidamente la degrada**. Un paciente que debe firmar lo mismo en cada visita deja de leerlo a la tercera vez y empieza a hacer clic mecánicamente. Un consentimiento que se convierte en trámite deja de ser informado, que es precisamente lo que la norma exige que sea.

## Pregunta 2 · ¿Pueden omitir el código en seguimiento?

**Sí, en el escenario normal.** El código cumplía dos funciones y ninguna se sostiene en un seguimiento ordinario: como firma electrónica, porque no hay acto nuevo que firmar; y como verificación de identidad, porque en el seguimiento el paciente está frente al profesional que ya lo conoce y que verificó su identidad presencialmente.

**Tres excepciones en las que sí debe exigirse:**

- **Si el paciente modifica alguna autorización.** Otorgar una que antes no tenía, o revocar una vigente, es un acto de voluntad nuevo y necesita el mismo respaldo probatorio que el original. Este es el caso más importante.
- **Si cambia el medio de contacto registrado.** Verificar el nuevo correo o teléfono es lo que mantiene válido el canal por el que se entregan copias y notificaciones.
- **Si hay cambio sustantivo de versión** (siguiente punto).

## Pregunta 3 · Si cambió la versión del consentimiento

Depende de la naturaleza del cambio, y conviene que el sistema lo distinga formalmente en lugar de tratar todo cambio igual:

**Cambio sustantivo** (nuevas finalidades, nuevas categorías de datos, nuevos destinatarios, cambio en el alcance de lo autorizado): **requiere nueva aceptación con código**. La autorización anterior no cubre lo que no existía cuando se otorgó.

**Cambio no sustantivo** (redacción, correcciones, aclaraciones que no alteran el alcance): **la autorización previa sigue siendo válida**. Basta con presentar la versión vigente de forma informativa, sin exigir nueva firma.

**Recomendación de implementación:** que cada versión del documento lleve una marca explícita de si el cambio fue sustantivo. Así el sistema decide automáticamente si fuerza re-consentimiento, en lugar de depender del criterio de quien publique la versión. Es el mismo criterio que ya aplican para los documentos contractuales con Integrantes.

## Pregunta 4 · Qué constancia dejar en el seguimiento

**Sí, y es imprescindible.** Cada evaluación debe quedar asociada a la versión de consentimiento y al registro de autorización específico bajo el cual se realizó.

Esto no es burocracia: es lo que hace posible responder correctamente cuando un paciente revoca una autorización o cuando alguien reclama. Sin ese sello, no se puede determinar bajo qué autorizaciones se capturó cada dato, y por tanto no se puede aplicar la regla de que la revocación opera hacia adelante sin invalidar lo anterior.

**Qué registrar en cada encuentro de seguimiento:**

- Referencia al registro de consentimiento vigente en ese momento (identificador y versión).
- Verificación, al inicio del flujo, de que las autorizaciones necesarias siguen vigentes y no revocadas. Si alguna fue revocada, el flujo se detiene, tal como ya está definido.
- Marca de tiempo del encuentro.

No hace falta duplicar el texto ni generar un nuevo documento firmado: basta la referencia al consentimiento vigente. Un puntero, no una copia.
