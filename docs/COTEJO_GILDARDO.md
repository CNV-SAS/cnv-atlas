Documento de revisión de ATLAS. Observaciones de Gildardo y debajo de cada observación, Santiago muestra su opinion.

**Contexto:**
Gildardo (encargado de toda la parte clinica y cientifica del modelo ani-bis-e), no sabe nada de desarrollo, de UX, de software.
Santiago (encargado del desarrollo de software, administración, comercial, legalidad del modelo ani-bis-e), no sabe nada de lo clinico ni cientifico.

Atlas: plataforma web que hace realidad el modelo ani-bis-e (modelo de atención en salud, Alimentación y Nutrición Informada, basado en Bioimpedancia Espectroscópica y Epigenética).

1. Los nombres de las pestañas fueron cambiados y no están acordes a lo que yo planifique, no entiendo porque en vez de Evaluaciones se pone Profesional: Modelo ANI BIS E y que quede una vez ingresado en ese link, Encuesta, Antropometría, Diagnóstico, rutas de atención, seguimiento y reporte/HC tal cual esta en el html, dejen de ser tercos y acaten mi directriz, la razón es sencilla, asi esta ATLAS, la versión que conocen los profesionales, asi lo han trabajado, ya se les envió una ruta de como ver y subir el paciente… NO ES NEGOCIABLE
// Santiago: No entiendo a que se refiere. En Atlas html hay 3 pantallas: 
a. Ingreso por una landing que muestra 3 botones: soy paciente, soy profesional, y administrador. Si le da a soy paciente puede responder encuesta.
b. Luego al entrar al flujo del profesional, aparece un pantalla que dice nuevo paciente, pacientes guardados, y un listado de pacientes con barra de busqueda.
c. al darle click en la tabla de pacientes "revisar", me lleva al modelo ani-bis-e que son 6 subpestañas.

Nosotros en Atlas web, en cambio, tenemos:
a. Inicio de sesión (RLS) y enlace para responder encuesta que no requiere login para pacientes (más profesional)
b. Aparece un homepage dashboard con un sidebar con todos los items. Realmente con lo que hemos hecho hasta el momento, el profesional solo necesita ir a /pacientes y /evaluaciones para generar en link de su encuesta. Casi la misma tabla con barra de busqueda del html la tenemos en /pacientes 
c. en la tabla de pacientes le damos "ver resultados" y me lleva a ANI-BIS-E solo que nosotros tenemos 5 pestañas donde personalmente considero que organizamos mucho mejor la información. Sin embargo, ya es decisión de Gildardo si conserva las 5 (que nos parece mejor), o pone las 7 del html. El resto de cosas si dependian de nosotros ya que no era algo clínico, era experiencia del usuario y arquitectura profesional.
## VEREDICTO SANTIAGO : En espera de reunión Gildardo.
## VEREDICTO CLAUDE:
**VA, y es más pequeño de lo que parece.** Verificado en su entrega vigente (v8 del 4 de septiembre, `MODS_CLINICA`): sus módulos son **SEIS**, no siete. Encuesta · Antrop. & BIS · Diagnóstico · **Rutas de atención** · Seguimiento · Reporte/HC. Y su propio id interno de "Rutas de atención" es `tratamiento`: es un rótulo distinto sobre la misma etapa.

**Contra las nuestras cinco, la diferencia entera es:** partir "Evaluación" en dos (Encuesta y Antropometría, que **ya son dos subpestañas nuestras** dentro de ella) y renombrar "Tratamiento" a "Rutas de atención". Nada más. No hay reorganización que deshacer.

**Y una corrección a la lectura de Santiago: él no pidió la landing.** Su texto pide que el contenedor se llame "Profesional: Modelo ANI BIS E" y que dentro estén las seis. Las tres pantallas del html las trajo Santiago al describir el archivo. La defensa del login es correcta pero es contra algo que nadie pidió, y llevarla a la reunión convierte un cambio de rótulos en una discusión de arquitectura.

**Qué cuesta:** el arreglo de `TABS` en `evaluation-tabs.tsx`, repartir dos slots que ya existen, y el rótulo del sidebar. Barato. El precio real es que las etapas pasan de cinco a seis y hay textos que dicen "las cinco etapas": hay que barrerlos (misma familia que [[texto-afirma-estado-sin-derivarlo]]).


2. Están mezclando en evaluación la encuesta y antropometría, eso enreda el proceso, se debe recordar que la encuesta se debe hacer aparte, para que puede asociarse con el APP Atlas Patients, al elegir al profesional, aparece el listado de todas las evaluaciones realizadas por el profesional, pero debe haber una posibilidad de que el profesional haga un filtro por nombre o apellido, cuadno tenga 100 pacientes, será difícil que lo encuentre.
// Santiago: Gildardo está algo confundido ya que sigue hablado de una app Atlas patients, cuando en realidad las personas acceden a la encuesta de atlas desde cualquier dispositivo y navegador poniendo el link. Pero bueno, yo me encargo de explicarle ya que el a futur quiere una app full para el paciente con mas funcionalidades. Ahora bien, lo de poner encuesta y antropometria en la pestaña evaluación hace todo el sentido del mundo. Ya que los profesionales distinguen por etapas del modelo. Sin embargo, en este caso la decisión es suya. Yo trato de convencerlo en persona. Pero el tiene la ultima palabra aquí. Por otro lado, el piensa que deberian aparecer todas las evaluaciones que el profesional hizo y eso me parece incorrecto. Me parece mejor una tabla de pacientes y que en cada paciente aparezca sus evaluaciones correspondientes.
## VEREDICTO SANTIAGO : En espera de reunión Gildardo.
## VEREDICTO CLAUDE:
**Son dos cosas y hay que separarlas, porque una ya está hecha y la otra no.**

**(a) El filtro. Verificado: `/pacientes` YA lo tiene** (`lista-pacientes.tsx`: busca por nombre y por número de documento, con su rótulo accesible). Lo que **NO** lo tiene es `/evaluaciones`, que es justo la pantalla de la que él habla: "el listado de todas las evaluaciones realizadas por el profesional". **Esa mitad VA**, y es el mismo componente. Barato.

**(b) Pacientes primero o evaluaciones primero: no hay que elegir.** Atlas tiene las DOS pantallas hoy. Él tiene su listado de evaluaciones y Santiago su tabla de pacientes con las evaluaciones dentro. No es un conflicto que resolver en reunión, es un dato que darle.

**Lo del Atlas Patients**: de acuerdo con Santiago, es suyo explicarlo. No toca código.


3. La encuesta se evalúa aparte, no en conjunto con el mod antropometría; si está bien ejecutada con firma de consentimiento informado, se pasa a temas de calidad de la medida, quitar estas preguntas que no sé porque se pusieron, si yo nunca dije que estuvieran allí: 
¿Está en estado febril agudo o con deshidratación marcada?
 ¿Presenta edema severo o anasarca?
// Santiago: La encuesta y mod antrop están en 2 subpestañas, solo que es el mismo problema del punto 2. En cuanto a las preguntas de las condiciones BIS, el manda aquí y si debemos quitar estas 2 condiciones: ¿Presenta edema severo o anasarca? y ¿Está en estado febril agudo o con deshidratación marcada?. Ya que estas 2 no estaban en el html y el acaba de decir que solo quitemos estas 2. El resto se mantienen.
## VEREDICTO SANTIAGO : Corregir.
## VEREDICTO CLAUDE:
**VA. Las dos preguntas son nuestras: verificado que NO existen en su html** (ni "anasarca", ni "febril", ni "edema severo" como pregunta; su `BIAQualityCheck` tiene ocho, todas las nuestras de calidad).

**Y hay una TERCERA en el mismo lote que él no nombró: "¿Tiene amputación de algún segmento corporal?".** Entró con esas dos, es del mismo tipo (`validez`), y **tampoco está en su archivo**. El precedente de la Regla 0 (las tablas de alérgenos, 2026-08-27 §10) dice que lo nuestro que su archivo no tiene se retira. Pero él nombró dos, no tres. **No la quitamos por nuestra cuenta: se le pregunta.** Es una línea en la reunión.

**Qué cuesta, y el cuidado:** **no se borran las filas del catálogo.** Las respuestas viven en `condition_answers` (JSONB por clave) selladas contra una versión, y la vista de solo lectura saca los rótulos del catálogo: borrar en sitio dejaría a las evaluaciones viejas mostrando respuestas sin pregunta. Se publica una **v2 del catálogo** sin ellas, que es para lo que existe el versionado. Barato y sin tocar lo emitido.

4. El peso meta y la fuerza prensil no tienen nada que hacer debajo de procesos de calidad de la medida, están salidas de donde las tenia, que es en mod antropometría. No pueden tomar decisiones autónomas de como llamar o donde poner lo que ya esta puesto y organizado, eso no les corresponde es científico y tiene un propósito. Una razón para que lo entiendan es que el peso meta se establece al revisar al paciente y sus datos, si lo ponen antes el profesional NO tiene como acordarse del contexto del paciente… NO puede ir ahi.
// Santiago: Tiene toda la razón Gildardo, debemos mover estos 2 apartados a la subpestaña Antropometria.
## VEREDICTO SANTIAGO : Corregir.
## VEREDICTO CLAUDE:
**VA, y es la SEGUNDA vez que lo dice.** El 2026-08-30 §6a ya había escrito *"nunca la puse en las condiciones del BIS"*. Nosotros le pusimos un rótulo propio al bloque ("Medidas del profesional"), lo dejamos donde estaba, y aplazamos la ubicación al cotejo visual. El cotejo la dejó en DIV-18, que termina con esta frase textual: *"si quiere que sean editables en Antropometría, se hace, y el precio es el segundo guardado"*. **Acaba de contestarla. DIV-18 se cierra con su respuesta.**

**Y su razón es nueva y es la buena:** el peso meta se fija después de ver al paciente. No es ubicación, es secuencia. Eso no lo habíamos oído.

**Verificado en su archivo:** su bloque "Datos Personales" de modAntropometría lleva Edad, Sexo, Peso, Estatura, Cintura, Cadera y **Fuerza prensil**, todos editables. Nuestro `AntropometriaEditable` ya vive ahí con cintura y cadera y ya guarda campo por campo.

**Qué cuesta: el segundo guardado, y el argumento técnico de DIV-18 se cae.** Decía que un update parcial desde Antropometría afectaría cero filas porque la fila de condiciones podría no existir. **No puede no existir:** la app no habilita el import mientras las condiciones no estén guardadas, y Antropometría vive detrás del import. Cuando el profesional llega ahí, la fila siempre está. Media jornada.

5. En vez de evaluación poner encuesta aparte y antropometría aparte; cuando el profesional de click en antropometría debe salir TODO lo que está en ATLAS_v8; de la misma manera que está en el html.
// Santiago: Aquí se repite lo que hablamos.
## VEREDICTO SANTIAGO: En espera de reunión Gildardo.
## VEREDICTO CLAUDE:
**Es el 1. Mismo veredicto, mismo costo.** Lo único que añade es *"debe salir TODO lo que está en ATLAS_v8"*, que es el punto 6.

6. Cuando subo el archivo a antropometría; No están los datos antropométricos por nivel de Wang como esta en ATLAS ¿Por qué? Mi insistencia en que NO SE PEUEDE CAMBIAR NADA DE LO CIENTIFICO, ni de como aparece y es lo primero que hicieron, recortaron TODA la información que aparece y como aparece en modAntropometria. El peso meta y fuerza prensil quedan aquí.
// Santiago: Gildardo no habia visto la tabla de wang porque era un desplegable. Hay 2 opciones, que la tabla siempre aparezca abierta de primeras. O quitar la opción de desplegable. Me inclino por la primera opción.
## VEREDICTO SANTIAGO : Elegir opción y corregir.
## VEREDICTO CLAUDE:
**VA, y es UNA palabra.** Verificado: la tabla de Wang está dentro de un `<details>` (`DetailsSection`) **sin `defaultOpen`**, así que nace cerrada. Con la prop nace abierta y el desplegable se conserva.

**Y de acuerdo con Santiago en elegir la primera opción, con el argumento:** la tabla son unas treinta filas por encima del bloque de sarcopenia; quitar el desplegable obliga a recorrerla siempre. Abierta por defecto da las dos cosas, y sobre todo **arregla la causa real de su queja, que fue no verla.**

**Pero su punto dice más que Wang** (*"recortaron TODA la información"*), así que lo verifiqué entero. Su modAntropometría tiene cuatro bloques: Importar datos · Datos Personales · Composición Corporal (Wang) · Diagnóstico de Sarcopenia. **Tenemos los cuatro**, con una diferencia real: su "Datos Personales" trae **edad y sexo editables ahí mismo**; en Atlas salen del registro del paciente y no se tocan desde la evaluación. **Eso es deliberado y hay que decírselo**, no callarlo: en su archivo no hay registro de pacientes ni consentimiento firmado contra un documento, y en Atlas cambiar el sexo o la edad desde una pantalla de medición reescribiría el insumo del motor por debajo de un diagnóstico ya emitido. **Es el punto 2 del cotejo anterior**, que sigue abierto por decisión de producto.

7. En diagnostico diagnóstico encuesta debe ir primero
// Santiago: El manda lo clínico, hagamolo así y pongamos el mismo orden del html:
Diagnostico encuesta, luego composición corporal y luego diagnostico funcional y va a tocar crear la cuarta subpestaña: resumen del diagnostico.
## VEREDICTO SANTIAGO : Corregir.
## VEREDICTO CLAUDE:
**VA. Verbatim del suyo** (`TABS` de su módulo de diagnóstico): Diagnóstico Encuesta (D1-D8) · Composición Corporal · Diagnóstico Funcional · **Resumen del Diagnóstico**. Cuatro, en ese orden.

De acuerdo con Santiago en las dos partes: es suyo lo clínico y no hay razón para diferir.

**Qué cuesta:** crear la cuarta subpestaña y mover el bloque del criterio, que es exactamente lo que pide el punto 11. **Los dos son un solo trabajo.** Un día.

8. El modo diagnóstico que hace la IA no es ni el 5% de lo que está diseñado en ATLAS
// Santiago: No le habia pasado el documento de Pendientes cientificos. Mi error. Pero ya ahi da su respuesta y quiere que sea tan completo como el del html sin mandar información del nombre del paciente.
## VEREDICTO SANTIAGO : Corregir.
## VEREDICTO CLAUDE:
**VA, y ya estaba en marcha.** Es el punto 12 del cotejo cerrado y la pregunta 1 de `PENDIENTES_CIENTIFICOS.md`, que ya lleva su respuesta escrita: *"Elijan como abre el párrafo... Lo importante es que sea igual al html pero sin el nombre del paciente."*

**Y en el árbol de trabajo apareció una segunda respuesta suya que gobierna todo el porte**, en la cabecera del mismo documento: *"traten de enviar edad, diagnóstico, todo lo del prompt completo que tiene el html, para que no pierda la sustancia, pero NO enviar el nombre"*. Eso cierra la pregunta: **se porta su prompt entero menos la identificación.**

**Verificado qué hay que portar** (su v8, pipeline de cuatro pasos: patrones, hipótesis causal, validación, síntesis): el esqueleto obligatorio de los cinco dominios del DFI, la apertura por riesgo funcional integrado, los cortes por sexo de IFC/IRC/PABU, la regla de la dirección de la PABU frente a φ, la de que el IFC prevalece sobre el ángulo de fase, y el formato en prosa. **El nuestro tope 120 palabras y un párrafo.** Tiene razón: no es ni el 5%.

**Qué cuesta:** es un prompt versionado (regla dura 9), así que es una v3 en `criterion.system`, más los campos nuevos del mensaje de usuario. Un día. **Y arrastra el punto 9, que se resuelve dentro de este mismo porte.**


9. Aparece en el moddiganostico que hay evidencia de PCR elevada ¡eso de donde sale? Nunca puse tal cosa en lo que pretendía del diagnóstico simulado por IA que estaba dirigido SOLO a la evidencia de los 5 dominios del Diagnostico funcional. Eso no se puede poner porque nos pone en riesgo, sin haber hecho pruebas de laboratorio ¡porque se cambió lo que ya se había hecho en ATLAS? ¿Quién lo autorizo?
// Santiago: Eso que lo revise Claude donde aparece y quitarlo inmediatamente. O si eso es lo que genera la IA, revisar el prompt que le manda el html y adaptarlo con las instrucciones que Gildardo está diciendo en este punto.
## VEREDICTO SANTIAGO : Buscar y Corregir.
## VEREDICTO CLAUDE:
**VA, es real y es grave. Pero la pregunta "¿quién lo autorizó?" tiene una respuesta incómoda: él.**

**Verificado, y con la cita literal.** "PCR" está en su archivo **setenta y cuatro veces**, en dos sitios:
- La tabla `DX` de los 81 estados EFR (de su Excel "Desenlaces EFR"), campo `bio`: *"PCR↑, HOMA-IR↑, CK variable, ferritina↑..."*.
- Y su propio generador de biomarcadores, línea 4814 de su v8: `if (ircAdv) bioP.push("PCR elevada, signos de sobrehidratación")`. **La frase exacta, escrita por él.**

Su narrativa la imprime: *"Biomarcadores clave a tener en cuenta: ..."*, bajo el rótulo *"Biomarcadores clave (puente bioeléctrico → bioquímico)"*.

**Y aun así tiene razón, porque el defecto SÍ es nuestro y es exactamente el que él describe.** En su archivo eso es una **hipótesis**: qué laboratorios pedir, con dos marcos que lo dicen ("a tener en cuenta", "puente bioeléctrico → bioquímico"). **Su IA nunca lo recibe:** su prompt manda el bloque DFI, los cinco dominios con su severidad y su evidencia, y los datos crudos. El campo `bio` no viaja.

**Nosotros sí se lo mandamos.** `criterion.v1.ts` arma la línea `Biomarcadores asociados: ${input.biomarcadores}` sin ningún marco, y el modelo hizo lo que hace un modelo: convirtió su hipótesis en un hallazgo. **"Hay evidencia de PCR elevada" no está en ningún archivo: lo escribió el modelo con lo que le dimos.** Y su instrucción de que el diagnóstico se estructure sobre los cinco dominios funcionales es justamente la que lo habría impedido.

**Discrepo de la instrucción de Santiago de "quitarlo inmediatamente":** el bloque de pantalla es SUYO, está en su html con su rótulo, y borrarlo sería retirar su contenido. **Lo que se corta es el cable a la IA, no el bloque.**

**Qué cuesta:** sacar `biomarcadores` de `CriterionPromptInput` (un campo) y ponerle al bloque de pantalla su subtítulo completo, *"(puente bioeléctrico → bioquímico)"*, que es el marco que lo vuelve hipótesis. **Y lo absorbe el porte del punto 8**, cuyo prompt no lo lleva. Horas, no días.

**La pregunta para él, corta:** ¿el bloque "Biomarcadores clave" se queda en pantalla, con su subtítulo? Nosotros decimos que sí, y que lo que no puede es entrar al texto de la IA.

10. Aparece en la mitad del nivel II entre lso datos de diagnostico de composición corporal y el modelo ani bis e, una cosa del nivel II que no etiendo porque esta ahí, en este caso es hidratación celular deficiente
// Santiago: Se refiere al mini bloque de la subpestaña composición comporal, que va antes de los indicadores ANI-BIS-E que dice: "Nivel III · Salud celular" esto simplemente se quita, quizá fue algo que iba en un reporte y se nos coló.
## VEREDICTO SANTIAGO : Corregir.
## VEREDICTO CLAUDE:
**NO como borrado. Y aquí discrepo de Santiago de frente, porque el archivo lo desmiente.**

**No "se nos coló de un reporte". Es `celBadges`, es suyo, y lo puso ahí ÉL.** El 2026-08-23, P-28, textual: *"En Diagnóstico, tal como está en el HTML. **No es negociable**: hidratación celular, ángulo de fase y masa celular activa son hallazgos, no conducta."* Y en el mismo párrafo nos preguntó de dónde lo habíamos sacado; se lo respondimos: de su propio archivo, dentro de la subpestaña del nutricionista de Tratamiento. **Lo movimos porque él lo mandó.**

**Y leyendo su frase entera, no está pidiendo borrarlo.** Dice: *"aparece **en la mitad** del nivel II, **entre** los datos de composición corporal y el modelo ani bis e"*. **Verificado que ese es exactamente nuestro orden de render:** tabla de Wang → Nivel III Salud celular → Indicadores ANI-BIS-E. **Está describiendo dónde queda, no que exista.** Lo que le estorba es que el bloque parta en dos la lectura de composición.

### CORREGIDO · el dato de Santiago cambió este veredicto, y el bloque se RETIRÓ

Lo de arriba decía "se mueve, no se borra". Santiago aportó que para el mismo paciente la tabla de Wang
dice *"Hidratación celular adecuada"* en tres filas mientras la badge decía *"Hidratación celular
deficiente"*, y que en su archivo esa badge no aparece. Verificado lo uno y lo otro:

**(a) ¿Se contradicen sobre el mismo paciente?** En pantalla sí, en cálculo no. Son **dos indicadores
distintos con nombres que chocan en español**: las tres filas son el AIC como porcentaje (referencia
60-65%) y la badge es la hidratación de la masa libre de grasa (referencia 73,2%). La badge **no
contradecía a su fuente**: la misma tabla de Wang tiene su propia fila de esa hidratación y las dos
coinciden. **La badge era un duplicado de esa fila**, puesto al lado de tres que hablan de otra cosa.

**(b) ¿Su archivo lo pinta?** **No.** `celBadges` aparece **cinco** veces en su v8 del 4 de septiembre: la
declaración y los cuatro `push`. **Ningún render la lee.** Lo mismo `alimentBadges`. **Control de que no
es otra forma de pintarlas:** `condBadges`, en el mismo archivo, **sí** se pinta. Portamos una pieza que
su software calcula y descarta.

**(c) ¿De dónde sale cada uno?** La badge de `hidSG` contra `hidSG_ref`, su condición verbatim. Las filas,
de `dAICpct`. No son dos fuentes de una cosa: son dos cosas.

**Así que se retiró, y NO deshace su P-28.** Lo que esa instrucción nombra (hidratación celular, ángulo de
fase, masa celular activa) sigue en Diagnóstico: son **tres filas** de la tabla de Wang con sus
clasificadores, verificado una por una. Se fue el duplicado, no el tema.

**Lo que sí se pierde y va declarado:** el **ECM/BCM > 1,4** era el único de los cuatro **sin fila propia**,
así que desaparece de la pantalla. Su archivo tampoco lo muestra. Va como pregunta 17 del documento.

**Y mi lectura de arriba estaba mal por lo mismo que aciertan los controles:** leí su frase (*"aparece en
la mitad, entre..."*) y concluí que describía una posición, sin ir a mirar si su archivo lo pintaba. La
frase sí describe una posición. Lo que no verifiqué es que la pieza no debía estar ahí en absoluto.

11. El resumen del diagnóstico generado por IA es aparte, no va dentro de ninguno d ellos 3 que tienen, y va de ultimo INSISTO, DEBE IR IGUAL A COMO ESTA EN el HTML.
// Santiago: El bloque del criterio del profesional, se mueve a la subpestaña nueva que creamos "resumen del diagnostico". Ya que el manda aquí.
## VEREDICTO SANTIAGO : Corregir.
## VEREDICTO CLAUDE:
**VA, y es el mismo trabajo que el 7.** El bloque del criterio del profesional se mueve a la nueva subpestaña "Resumen del diagnóstico", que va de última.

**Un cuidado nuestro que no cambia el veredicto:** en su archivo ese panel es de **solo lectura** (lo escribe la IA); el nuestro es donde el profesional **escribe** el suyo. Van a convivir los dos en esa subpestaña, el borrador de la IA y el criterio del profesional debajo. Eso es lo correcto y coincide con su orden, pero conviene decírselo para que no lo lea como que le cambiamos el panel.

**Qué cuesta:** compartido con el 7.

12. La impresión del plan del nutricionista no está como esta en el HTML, es poco profesional, parece una lista de mercado y NO TIENE TODOS los elementos que parametrice deben salir en el plan.
// Santiago: Esto es un pendiente de nosotros. Corregir el tema de reportes.
## VEREDICTO SANTIAGO : Está en la cola para mejorar, en espera.
## VEREDICTO CLAUDE:
**VA, y ya es el primer punto de la cola** (`BACKLOG.md`, "el pase de diseño de los tres documentos": historia clínica, reporte del paciente y plan imprimible). De acuerdo con Santiago en que está en espera.

**Pero su frase añade algo que la cola NO cubre y hay que sacarlo antes de empezar:** *"NO TIENE TODOS los elementos que parametricé deben salir en el plan"*. Eso no es forma, es contenido faltante, y **no lo podemos deducir**. El pase de diseño arregla que parezca una lista de mercado; no puede adivinar qué elementos parametrizó.

**La pregunta para él, y es de las que valen la reunión:** **cuáles son esos elementos.** Sin esa lista el pase de diseño se hace sobre un plan incompleto y hay que rehacerlo.

13. En mod seguimiento se debe poner la diana del DFI ¿Por qué la quitaron?, que en esta versión no aparece, se había parametrizado que debe quedar de fondo la inicial y sobre esa se muestra la dina nueva superpuesta, para poder que el paciente pueda ver el cambio
// Santiago: Pongamos la Diana, así solo tenga una evaluación. Segun entiendo, la decisión que habiamos tomado era que solo apareciera la Diana cuando habian 2 o mas evaluaciones, pero va a tocar revertirla.
## VEREDICTO SANTIAGO: Corregir.
## VEREDICTO CLAUDE:
**VA.** Verificado el portón: `seguimiento-visual.tsx` sólo pinta la Diana si hay `inicial && ultima`, y `ultima` exige `length > 1`. Con una sola medición no se dibuja nada. `DfiRadar` ya recibe `comparar` como opcional, así que con una medición pinta el polígono solo.

**Y de acuerdo con la lección de la capacitancia, con un matiz que la hace más fuerte aquí:** allí hacía falta una referencia (la mediana del grupo) para que un punto significara algo. **En la Diana la escala YA es la referencia**: los cinco ejes van de Óptimo a Crítico, que son niveles absolutos, no relativos a otra medición. Un polígono solo se lee. La decisión de exigir dos era nuestra y era la equivocada.

**Qué cuesta:** una condición. Y el texto del encabezado, que hoy dice "inicial y última" y con una medición tiene que decir otra cosa (si no, afirma una comparación que no hubo). Horas.

14. En mod diagnóstico veo que aparece en resultado +4.4, pero el diagnóstico es concordante y el IAE es concordante, no debería aparecer 4,4 en el IAE??’, si es concordante, no deberia estar en verde?
// Santiago: Tu lo revisas. Según miré yo, le da a un paciente que tiene estos indicadores ANI-BIS-E: "IAE · Índice de Aceleración del Envejecimientoprovisional	4,4	−5 a +5 años	0,0	
Concordante
EB · Edad Bioeléctrica (EB-BIS)provisional	33,4	29.0	+4.4	
Concordante"

y el concordante le aparece en naranja:
## VEREDICTO SANTIAGO: PENDIENTE DE CLAUDE CODE.
## VEREDICTO CLAUDE:
**Verificado, y NO es el defecto del ICA-BIS. Es lo contrario: el ámbar es SUYO, portado fielmente.**

Su clasificador `cIAE`, en `engine.core.js` (congelado, byte por byte de su archivo):
```
v < -5  -> "Desacelerado"  #10b981  (verde)
v <= 5  -> "Concordante"   #f59e0b  (ÁMBAR)
else    -> "Acelerado"     #ef4444  (rojo)
```
Nuestra capa de color no escribe severidades a mano: las **lee** del hex que emite su clasificador (`veredictoSev`). `#f59e0b` cae en "alerta". **El ámbar sale de su archivo, no de nuestra interpretación.**

**Y su instinto es correcto.** El IAE es el **único clasificador de dos colas** del sistema: lo bueno está en el MEDIO. Sobre una rampa de tres pasos verde/ámbar/rojo, el verde se lo llevó "Desacelerado" y al centro le tocó el ámbar. **Es su archivo el que hay que corregir, y por la Regla 0 no lo tocamos nosotros: es una línea suya.**

**La segunda mitad de su pregunta ("¿no debería aparecer 4,4 en el IAE?"): sí aparece.** La fila IAE muestra 4,4 como valor; su Δ es 0,0 **porque él lo definió así** el 2026-09-01 §5: *"el IAE da la distancia al límite del rango que se cruzó, y cero mientras esté dentro de -5 a +5"*. El +4,4 que vio está en la fila **EB**, donde por diseño la referencia es la edad cronológica y el Δ **es** el IAE. Las dos filas dicen lo mismo con números distintos, y eso es lo que confunde. Vale la pena decírselo.

**Y un hallazgo de la misma familia que salió al barrer sus quince clasificadores, que hay que reportarle:** en su matriz `FYR_LABELS` la casilla `3_3`, **"Función normal con riesgo"**, lleva `#22d3ee` (cian). Nuestra regla lo lee como **ÓPTIMO**. Es la peor casilla de su fila superior pintada con el color de la mejor. **Hoy es inofensivo en Atlas** (el motor descarta ese color y sólo conserva la etiqueta), y por eso no es un defecto nuestro; pero es el mismo error que el ámbar del "Concordante", un paso peor. **El barrido de azules del 2026-08-24 no lo atrapó porque el cian no es azul.** Va en la misma consulta.

**Qué cuesta:** nada nuestro. Dos líneas suyas. Lo que cuesta es la consulta.

15. Si reportes/HC ya esta en lo que debe llamarse Profesional:Modelo ANI BIS E; para que reporte por fuera de el modelo, quiten esa pestaña, esta repetida, pilas debe qeudar en el marco de mod Profesional: Modelo ANI BIS E
// Santiago: No le entiendo a Gildardo, ustedes si?. Pero entendí algo del html. No tiene sidebar, entonces ellos utilizan un navbar principal que solo tiene las pestañas de Encuesta, Antrop y BIS, Diagnostico, Rutas de atención, Seguimiento, Reporte/HC. Nosotros tenemos un sidebar con mas cosas administrativas, quizá se enredó por eso y quiere eliminar el item del sidebar de Atlas web que dice "reportes" porque lo considera repetido. Esto ya es decisión de nosotros, luego lo revisamos.
## VEREDICTO SANTIAGO: LUEGO LO DECIDIMOS.
## VEREDICTO CLAUDE:
**NO va, y su premisa es falsa: no está repetida.** Verificado qué hace cada una:
- **La pestaña Reporte/HC** (dentro de la evaluación): el reporte de **ESA** evaluación, con su aprobación y sus tres modos.
- **`/reportes` del sidebar**: el **registro cruzado** de todos los reportes del profesional, en borrador, aprobados y enviados, con las acciones de aprobar y enviar. **Es el único sitio desde donde se ve un reporte enviado sin abrir su evaluación**, y los enviados son registro permanente.

**Quitarla no elimina una duplicación: elimina el registro.**

**Y de acuerdo con el diagnóstico de Santiago sobre por qué se confundió:** su html no tiene sidebar. Todo lo suyo cuelga del navbar clínico, así que ver "Reportes" fuera de las seis etapas se lee como una séptima etapa suelta. **No lo es: es la capa administrativa**, que en su archivo no existe.

**Qué cuesta:** cero código. **Se explica en la reunión**, con esa frase: el sidebar no es el navbar clínico.

16. No se si eso del consentimiento deba estar ahí ¿Qué función cumple? Los profesionales saben desde el entrenamiento que lo deben hacer, entonces me perdi, yo lo quitaria
// Santiago: Tal vez se refiere al item del consentimiento del sidebar. De momento se queda.
## VEREDICTO SANTIAGO: LUEGO LO DECIDIMOS.
## VEREDICTO CLAUDE:
**NO va, y por la misma razón que el 15: no es lo que él cree que es.**

`/consentimiento` es **solo lectura de la plantilla vigente**: qué versión del texto está en vigor y su contenido completo, con las dos ramas (mayor de edad y representante de menor). **No es "el consentimiento que hay que hacer"** (eso vive en el intake del paciente, antes de la encuesta, y es la regla dura 15).

Él objeta el **acto** ("los profesionales saben desde el entrenamiento que lo deben hacer") y la pantalla es sobre el **texto**. Y es de las que uno quiere tener el día que alguien pregunte qué firmó exactamente un paciente.

**Un hallazgo pequeño y real que sale de aquí, y que probablemente CAUSÓ su duda:** el sidebar dice **"Consentimiento vigente"** y la pantalla se titula **"Consentimiento informado"**. Dos nombres para lo mismo, y ninguno de los dos dice que es solo lectura de la plantilla. **Alinearlos quita exactamente la confusión que él tuvo.**

**Qué cuesta:** una cadena. Y de acuerdo con Santiago en que de momento se queda.

---

# ESTADO · qué quedó corregido el 2026-09-07

**Nueve puntos cerrados en código.** `pnpm verify` verde: 2139 pruebas unitarias, 189 contra base real,
fronteras RSC limpias, 100 server actions todas con pantalla.

| # | Qué se hizo | Commit |
| --- | --- | --- |
| **3** | Las dos preguntas fuera, en una **v2 del catálogo** (la v1 queda intacta: las evaluaciones emitidas la tienen sellada). La amputación se queda, declarada | `4dbcb92` |
| **10** | Las badges de salud celular retiradas: su archivo las calcula y no las pinta | `4dbcb92` |
| **9** | Los biomarcadores dejan de viajar al modelo, con candado por CONTENIDO (no por nombre de campo) | `fb46677` |
| **14** | **Nada que tocar**: el ámbar sale de su `cIAE`. Va a la consulta, con el cian de `FYR_LABELS` | (documento) |
| **4** | Peso meta y prensil **editables en Antropometría**. Cierra DIV-18 | `c3dfe1c` |
| **6** | La tabla de Wang nace **abierta** | `1c1b11c` |
| **7** y **11** | **Cuatro subpestañas en su orden**, y el criterio a la cuarta | `1c1b11c` |
| **13** | La Diana se dibuja **con una sola medición** | `470d845` |

**Queda el 8**, que es tanda propia: portar su prompt de cinco dominios. Ya tiene su respuesta
(*"todo lo del prompt completo que tiene el html... pero NO enviar el nombre"*), y el candado del punto 9
es lo que se pondrá rojo si ese porte vuelve a colar un marcador de laboratorio.

**Y esperan la reunión:** el **1** y el **5** (las seis pestañas), el **2** (el filtro de `/evaluaciones`,
que Santiago deja para después), el **12** (falta que diga qué elementos parametrizó), y el **15** y el
**16**, que no van y se explican.

**Una acción operativa antes de probar:** las dos preguntas salen de una versión nueva del catálogo, así
que hay que correr `pnpm db:seed:bis` para publicarla. Sin eso la pantalla sigue mostrando las catorce.
