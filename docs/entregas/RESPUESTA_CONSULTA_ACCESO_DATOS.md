# Respuesta a la consulta legal: acceso del personal de CNV a historias clínicas

**Para:** el equipo de Atlas.
**Asunto:** decisión sobre los bordes del mecanismo de grants de acceso a contenido clínico.
**Estado:** propuesta para ratificación del asesor jurídico externo antes de ejecutar `PLAN_GRANTS.md`.
**Base:** Anexo 3 (Acuerdo de Tratamiento de Datos) v1.0, Consentimiento de ATLAS v1.6, y el mecanismo ya implementado según `SECURITY.md`.

---

## Resumen ejecutivo

| Pregunta | Lectura del equipo | Respuesta |
|---|---|---|
| 1. Nivel "sin identificar" | Eliminarlo | **No eliminarlo.** El diagnóstico técnico es correcto, pero la conclusión dejaría sin base consentida al control de calidad rutinario. Se conserva, con ajustes. |
| 2. Personal administrativo | Pierde acceso permanente | **De acuerdo, sin reservas.** Debe extenderse a la brecha ya identificada. |
| 3. Soporte ve el documento | Conservarlo | **De acuerdo, con un matiz.** Es defendible, pero un identificador interno protege más de lo que el equipo estima. |

Además, dos observaciones sobre el diseño ya implementado que conviene atender: una referencia normativa equivocada en `SECURITY.md`, y una tensión entre la duración de los grants de Nivel (b) y lo que el Anexo 3 permite. Ambas al final del documento.

---

## Pregunta 1 · Datos clínicos "sin nombre"

**El argumento técnico del equipo es correcto.** Con peso, talla, edad y sexo en la misma ficha, y pocos pacientes por profesional, la reidentificación es trivial. No es una opinión discutible: es el problema clásico de los cuasi-identificadores, y el propio Anexo 3 lo reconoce cuando exige, para que la anonimización sea real, tratar los cuasi-identificadores y no solo suprimir el nombre (Cláusula 5).

**Pero la conclusión que se extrae de ahí crea un problema mayor del que resuelve.** Hay una confusión conceptual que conviene deshacer: el nivel "sin identificar" **nunca fue una promesa de anonimato**. El Anexo 3 lo dice literalmente en sus definiciones: los datos seudonimizados *"siguen siendo datos personales"*. El Nivel (b) no existe para garantizar que nadie pueda deducir quién es el paciente; existe por **minimización**: si quien audita no necesita el nombre para verificar que el protocolo se aplicó bien, no se le muestra. Ese principio sigue siendo válido aunque la reidentificación sea posible, igual que sigue siendo válido cerrar una puerta aunque la ventana exista.

**La razón decisiva para no eliminarlo: el consentimiento del paciente ya distingue los dos niveles, y les da alcances distintos.** El Consentimiento de ATLAS, en su numeral 4 (finalidades necesarias), contiene dos autorizaciones separadas:

- Verificar, **sobre datos seudonimizados y sin conocer su identidad**, que el modelo ANI-BIS-E se aplica correctamente, *como parte del control de calidad del servicio*. Esto es control de calidad **rutinario**.
- **En circunstancias excepcionales** (la atención de una queja, la verificación de una posible desviación grave del protocolo), acceder de forma minimizada y registrada a la historia clínica **identificada**.

Si se elimina el nivel intermedio y todo acceso pasa a ser identificado, **toda auditoría de cumplimiento cae bajo el segundo supuesto, que el paciente autorizó únicamente para circunstancias excepcionales.** La auditoría rutinaria de calidad quedaría sin base consentida. Paradójicamente, la medida pensada para proteger más dejaría a CNV sin fundamento para ejercer su función de garante del modelo, que es contractualmente exigible frente a los Integrantes y es el núcleo de su propuesta de valor.

Dicho de otro modo: el Nivel (b) no es una concesión de privacidad que se pueda retirar sin costo. Es el único carril por el que puede circular el control de calidad ordinario.

### Decisión

**Se conserva el Nivel (b), con tres correcciones que atienden la preocupación legítima del equipo.**

1. **Todo acceso de Nivel (b) se registra igual que el Nivel (c).** Si el dato es reidentificable en la práctica, merece la misma trazabilidad. El mecanismo ya emite `access.requested`, `access.approved` y `access.revoked` para ambos niveles; conviene verificar que **`access.used` también se emita en Nivel (b)** y no solo en Nivel (c), donde hoy está explícitamente cableado. Sin el evento de uso efectivo, se sabe quién obtuvo permiso pero no quién efectivamente leyó.

2. **En ninguna interfaz ni documento interno se describe este nivel como "anónimo" o "anonimizado".** El término correcto es *seudonimizado* o *sin identificación directa*, y el personal debe saber que sigue siendo dato personal sujeto a deber de reserva. La falsa sensación de anonimato que el equipo señala se corrige con lenguaje preciso y capacitación, no eliminando el nivel.

3. **Se ajusta el alcance temporal y objetivo del grant** (ver la observación B al final de este documento).

---

## Pregunta 2 · El personal administrativo

**De acuerdo con la lectura del equipo, sin reservas.** El rol administrativo no conserva acceso permanente a contenido clínico. Cuando lo necesite para un caso concreto, lo solicita con motivo y aprobación, como cualquier otro rol.

El fundamento: un acceso continuo, sin causa y sin registro, sobre la historia clínica de cualquier paciente, no está cubierto por la finalidad de *"dar soporte técnico y garantizar la integridad, disponibilidad y seguridad de la plataforma"* (Anexo 3, Cláusula 3). Esa finalidad contempla intervenciones **puntuales ante un incidente**, no una capacidad permanente de lectura general.

**El esquema de aprobación ya implementado es correcto y cierra el punto crítico.** Que `soporte` solicite y `admin` apruebe, y que las solicitudes de `admin` las apruebe `direccion` —sin que `direccion` pueda solicitar ni ver contenido clínico— resuelve el riesgo clásico de que la misma persona pida y autorice. Que el rol aprobador se selle en el servidor desde el rol real del solicitante, y no pueda forjarse desde el cliente, es la pieza que hace que el control sea efectivo y no declarativo. No tenemos objeciones a este diseño.

**La brecha reconocida en `SECURITY.md` debe cerrarse con el mismo criterio.** El propio documento admite que el mecanismo hoy cubre solo las tres tablas de notas narrativas, y que `evaluations`, `bis_measurements`, `diagnoses`, `treatments`, `reports` y `patients` conservan acceso amplio de `admin` por RLS.

Conviene ser explícito sobre esto: **el criterio de la Cláusula 17 no distingue por formato del dato, sino por si es contenido clínico ligado a la identidad.** La cláusula dice *"sobre el contenido clínico de la historia clínica, **incluidas** las notas del profesional"*: las notas son un ejemplo dentro de una categoría más amplia, no el límite de la categoría. Una medición de bioimpedancia, un diagnóstico y un plan de tratamiento, asociados al nombre del paciente, son contenido clínico de la historia clínica tanto como una nota en texto libre. Que estén en campos estructurados no los hace menos sensibles.

Hay además un argumento de coherencia interna: el propio Anexo 3 (Cláusula 4) somete los *datos clínicos y funcionales estructurados* a un régimen estricto en la capa de investigación (solo seudonimizados, solo con autorización específica). Sería inconsistente que ese mismo tipo de dato, con identidad incluida, estuviera completamente abierto en la capa asistencial.

**Conclusión: la brecha debe cerrarse extendiendo el mismo mecanismo de grants, con la misma prioridad alta que ya tiene asignada.** No requiere un mecanismo nuevo ni un régimen distinto.

---

## Pregunta 3 · Lo que ve soporte técnico

**De acuerdo con conservar un identificador mínimo, pero no coincidimos en que estrecharlo más no gane protección real.**

El número de documento es un identificador **directo y fuerte**: permite vincular al paciente con cualquier otra base de datos, dentro o fuera de CNV. Un identificador interno opaco (un consecutivo de paciente) cumple la misma función operativa —saber de qué caso se habla— sin exponer un dato que conecta a la persona con el resto de su vida civil. La diferencia de protección es real, no cosmética: un consecutivo interno no sirve para nada fuera de Atlas; una cédula sirve para todo.

**Recomendación, en orden de preferencia:**

1. **Óptimo:** soporte trabaja con un identificador interno, y puede *buscar* por número de documento sin que este se muestre en pantalla. El profesional aporta el documento por el canal de soporte, el sistema resuelve el caso, y soporte opera sobre el identificador interno.
2. **Aceptable:** soporte ve el número de documento, sin nombre y sin contenido clínico, **con registro de la consulta**. Es defendible bajo la finalidad de soporte técnico del Anexo 3, siempre que quede trazado y limitado a lo necesario.

La opción 2 es viable para el arranque si la 1 implica un rediseño que retrase la operación. Lo que no debería quedar es la opción 2 **sin registro**: si se expone un identificador directo, su consulta debe ser trazable.

---

## Sobre la pregunta abierta: qué exige la normativa colombiana

Tres marcos concurren, y el más restrictivo manda.

**1. Reserva de la historia clínica (Resolución 1995 de 1999).** La historia clínica está sometida a reserva. El acceso legítimo corresponde al usuario, al equipo de salud tratante, a las autoridades judiciales y sanitarias en los casos previstos, y a quienes la ley determine.

Aquí hay un punto que debe atravesar todo el diseño: **CNV no es parte del equipo de salud tratante.** El propio Anexo 3 lo declara de forma expresa: *"CNV no es prestador del servicio asistencial ni integrante del equipo tratante; su intervención en la capa asistencial es exclusivamente la de un Encargado que provee la plataforma."* En consecuencia, el acceso del personal de CNV a contenido clínico **no se justifica nunca por necesidad asistencial**, sino solo por las finalidades acotadas que el Responsable (el profesional) instruyó y que el paciente conoció al consentir. Ese es el piso de todo lo demás, y explica por qué el acceso debe ser estrecho, con causa, temporal y registrado: no hay una vía "de oficio" para que CNV mire una historia clínica.

**2. Protección de datos (Ley 1581 de 2012 y Decreto 1074 de 2015).** Los datos de salud son sensibles y su tratamiento es restringido. Rigen los principios de **finalidad** (solo para lo informado), **necesidad** (solo lo indispensable), **acceso restringido** y **responsabilidad demostrada**. Este último es el más relevante aquí: CNV no solo debe cumplir, debe **poder probar** que cumple. Un mecanismo de solicitud, aprobación, expiración y registro inmutable es precisamente esa prueba. Sin registro no hay evidencia, y sin evidencia la posición de CNV ante la Superintendencia de Industria y Comercio es débil aunque la conducta haya sido impecable.

**3. Conservación (Resoluciones 1995 de 1999 y 839 de 2017).** La historia clínica se conserva **quince (15) años** desde la última atención, con independencia del consentimiento: un paciente que revoca autorizaciones no borra su historia clínica.

*Verificación normativa (realizada para esta consulta).* Este plazo fue confirmado contra la fuente. Conviene tenerlo presente porque circula desinformación: numerosas fuentes actuales, incluso recientes, siguen citando **veinte (20) años**, repitiendo el artículo 15 original de la Resolución 1995 de 1999. Ese texto fue modificado: la Resolución 839 de 2017 redujo el plazo a quince años, distribuidos en cinco años de archivo de gestión y diez de archivo central. El plazo que usan los documentos de CNV es el correcto.

*Excepción no reflejada hoy en los documentos.* La misma Resolución 839 de 2017 establece dos supuestos en que el plazo cambia: para historias clínicas de víctimas de violaciones de derechos humanos o infracciones graves al Derecho Internacional Humanitario, los términos **se duplican**; y si la historia llega a formar parte de un proceso por delitos de lesa humanidad, la conservación es **permanente**. Ni el Anexo 3 (Cláusula 11.1) ni el Consentimiento de ATLAS (numeral 8) mencionan estas excepciones: ambos afirman quince años sin matiz. La probabilidad de que se materialicen en la práctica de CNV es baja, pero la afirmación actual es incompleta. Decisión sugerida: agregar en el Anexo 3 una frase de salvedad ("sin perjuicio de los plazos ampliados que la ley establece para supuestos especiales") y dejar el Consentimiento como está, para no introducir en un documento dirigido al paciente una complejidad que no le aporta.

*Conservación de los registros de auditoría de acceso.* No existe en la normativa colombiana un plazo específico exigible para las bitácoras de acceso a sistemas de información en salud. La orientación del sector es conservarlas por un tiempo prolongado con fines de defensa jurídica, pero se trata de criterio, no de obligación legal con plazo fijo. **Es, por tanto, una decisión de CNV**, que debe quedar en la Política de Seguridad. Recomendación: alinear la conservación del `clinical_audit_log` con el plazo de la historia clínica a la que se refiere (quince años), de modo que ante cualquier controversia sobre una atención se pueda reconstruir también quién accedió a esa historia. Conservar el log menos tiempo que la historia deja un período en el que la historia es exigible pero su trazabilidad de acceso ya se perdió.

**Conclusión sobre el piso normativo:** la norma no fija un número exacto de horas de vigencia ni una lista cerrada de roles, pero sí exige que todo acceso a datos de salud por parte de quien no integra el equipo tratante sea **necesario, limitado a la finalidad informada y demostrable**. Las tres decisiones propuestas cumplen ese piso; ninguna queda por debajo.

---

## Dos observaciones sobre el diseño ya implementado

### A. Referencia normativa equivocada en `SECURITY.md`

El documento afirma: *"su base legal es el numeral 4 del Anexo 3 v1.6"*. Hay dos errores encadenados:

- **El Anexo 3 está en versión 1.0, no 1.6.** La versión 1.6 corresponde al **Consentimiento de ATLAS**, que es un documento distinto con su propio historial de versiones. Los documentos contractuales (Marco y Anexos) arrancan en 1.0 y solo suben cuando hay un cambio de fondo posterior a que existan firmas reales; el Consentimiento se iteró varias veces antes de tener usuarios.
- **La base legal invocada está en el documento equivocado.** Las dos autorizaciones que sustentan los Niveles (b) y (c) viven en el **numeral 4 del Consentimiento de ATLAS v1.6** (finalidades necesarias). El Anexo 3 no tiene "numerales": tiene Cláusulas, y su Cláusula 4 trata de la capa secundaria de investigación, que es otra cosa.

La referencia correcta, y conviene que quede así en `SECURITY.md`, es: *"su base legal es el numeral 4 del Consentimiento de ATLAS v1.6 (autorización del titular) y las Cláusulas 3 y 17 del Anexo 3 v1.0 (instrucción del Responsable y alcance de la auditoría)"*. La distinción no es formal: son dos fuentes de legitimación distintas, una del paciente y otra del profesional, y ante una auditoría conviene poder señalar cada una.

### B. Duración de los grants de Nivel (b) frente al Anexo 3

`SECURITY.md` fija para el Nivel (b) una expiración por defecto de **30 días y un tope duro de 90 días**, sin scope a un paciente determinado (a diferencia del Nivel (c), que sí está limitado a un paciente puntual).

Esto genera una tensión con el texto de la Cláusula 17, que exige que la auditoría de los Niveles (b) y (c) *"se active preferentemente por causa o por muestreo basado en riesgo, y no como monitoreo continuo y general de todos los pacientes"*. Un permiso de hasta noventa días sobre la totalidad de las notas seudonimizadas se parece bastante a monitoreo continuo y general, que es justamente lo que la cláusula quiso evitar.

**Recomendación:** conservar la duración generosa (la auditoría de calidad es un trabajo que toma tiempo y renovar cada 48 horas sería impracticable), pero **acotar el objeto del grant**. Dos formas, no excluyentes:

- **Scope por muestra o por cohorte:** que el grant se otorgue sobre un conjunto definido al momento de la solicitud (los pacientes de tal profesional, una muestra aleatoria de tal tamaño, los casos de tal período), no sobre "todo lo seudonimizado".
- **Motivo con alcance declarado:** que el campo de motivo obligue a declarar qué se va a auditar y sobre qué universo, de modo que el registro permita después verificar que el uso se ajustó a lo pedido.

Con cualquiera de las dos, un tope de 90 días deja de ser problemático, porque el permiso ya no es general aunque sea largo. Sin ninguna de las dos, el plazo largo es difícil de defender frente al texto de la cláusula que la propia plataforma dice materializar.

---

## Reglas accionables consolidadas

1. Ningún rol de CNV conserva acceso continuo a contenido clínico, ni identificado ni seudonimizado, por el solo hecho de su rol.
2. Se conservan los tres niveles del Anexo 3 (Cláusula 17). El Nivel (b) no se elimina.
3. Todo acceso a contenido clínico (Niveles b y c) se solicita con motivo, lo aprueba una persona distinta del solicitante, tiene vigencia limitada y queda registrado.
4. Se registran cuatro eventos por grant: solicitado, aprobado o negado, **usado efectivamente**, y revocado. El evento de uso debe existir también en Nivel (b), no solo en Nivel (c).
5. El Nivel (c) se otorga por paciente específico y por causa concreta. El Nivel (b) debe acotarse por muestra, cohorte o universo declarado, nunca como permiso general sobre todas las notas.
6. En ninguna interfaz ni documento interno se describe el Nivel (b) como "anónimo".
7. Soporte técnico conserva un identificador mínimo del paciente, preferiblemente interno; si se conserva el número de documento, su consulta se registra.
8. El procesamiento automático de la plataforma (cálculo de indicadores, generación de reportes para el profesional tratante) no requiere grant. La consulta humana de contenido clínico sí.
9. La brecha sobre historia clínica identificada estructurada (`evaluations`, `bis_measurements`, `diagnoses`, `treatments`, `reports`, `patients`) se cierra extendiendo este mismo mecanismo, con prioridad alta.
10. Los parámetros numéricos (vigencias por defecto y topes duros) viven en el código y en la Política de Seguridad, no en los contratos ni en el consentimiento, para poder ajustarlos sin re-firmar con Integrantes ni pacientes.

---

## Qué debe ratificar el asesor jurídico externo

Estas conclusiones son consistentes con los documentos suscritos y con el marco normativo, pero conviene que Arley confirme de forma específica:

- **La conclusión de la Pregunta 1**, que es la única donde esta respuesta se aparta de la propuesta del equipo técnico, y que descansa en la lectura del alcance de las dos autorizaciones del numeral 4 del Consentimiento de ATLAS (rutinario seudonimizado frente a excepcional identificado).
- **Si comparte el criterio sobre la conservación del `clinical_audit_log`** (quince años, alineado con la historia clínica), dado que la norma no fija plazo y la decisión queda en cabeza de CNV.
- **Si conservar el número de documento en soporte técnico** (opción 2 de la Pregunta 3) le resulta suficiente, o prefiere exigir el identificador interno desde el inicio.
- **Si el plazo de 90 días del Nivel (b)**, una vez acotado su objeto conforme a la observación B, le resulta defendible frente al texto de la Cláusula 17.

---

## Registro de ratificación

*Esta sección se completa una vez el asesor jurídico externo revise el documento. No debe eliminarse: su propósito es dejar constancia de que las decisiones sobre acceso a datos de salud pasaron por revisión jurídica, lo que constituye evidencia bajo el principio de responsabilidad demostrada de la Ley 1581 de 2012.*

- **Revisado por:** `Asesor 2`
- **Fecha:** `6 agosto 2026`
- **Concepto:** X Ratificado sin observaciones  ☐ Ratificado con las observaciones que se anexan
- **Observaciones:** `__________`
