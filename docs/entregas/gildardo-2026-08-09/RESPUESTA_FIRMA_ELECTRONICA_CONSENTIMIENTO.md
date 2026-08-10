# Respuesta: validez de la firma electrónica en el Consentimiento de ATLAS

**Para:** el equipo de Atlas.
**Asunto:** suficiencia probatoria del mecanismo actual de aceptación del consentimiento informado.
**Marco verificado:** Ley 527 de 1999 (art. 7), Decreto 2364 de 2012 (compilado en el Decreto 1074 de 2015, arts. 2.2.2.47.1 y siguientes), Ley 1581 de 2012 (arts. 6, 8 y 9).
**Estado:** propuesta para ratificación del asesor jurídico externo.

---

## Veredicto en dos líneas

El mecanismo actual **cumple sólidamente el requisito de integridad y falla el de identidad del firmante**. No es inválido, pero hoy la prueba descansa enteramente en que nadie la discuta: si un paciente niega haber autorizado, CNV no tiene con qué demostrar que fue él. La corrección es una sola y es barata: un código de verificación de un solo uso antes de aceptar.

---

## Pregunta 1 · ¿Lo que registran hoy es firma electrónica válida?

**Parcialmente.** El Decreto 2364 de 2012 no exige una tecnología concreta: adopta el principio de neutralidad tecnológica y establece un criterio funcional. Su artículo 3 dice que el requisito de firma se cumple si se usa una firma electrónica que, *"a la luz de todas las circunstancias del caso, incluido cualquier acuerdo aplicable, sea tan confiable como apropiada para los fines con los cuales se generó o comunicó ese mensaje"*.

El artículo 4 concreta cuándo se considera confiable, con **dos condiciones acumulativas**:

| Condición del art. 4 | Estado hoy |
|---|---|
| 1. Los datos de creación de la firma **corresponden exclusivamente al firmante** | **No se cumple** |
| 2. Es posible **detectar cualquier alteración** no autorizada del mensaje después de la firma | **Se cumple bien** |

**La condición 2 está bien resuelta.** El hash del texto exacto mostrado, la versión, y la marca de tiempo inmutable permiten demostrar que el documento no se modificó después de la aceptación. Esta parte del diseño es correcta y no requiere cambios.

**La condición 1 es donde está el problema.** Escribir un nombre y un número de documento en un campo de texto no constituye un dato de creación que corresponda *exclusivamente* al firmante: cualquiera que reciba el enlace puede escribir cualquier nombre y cualquier número. No hay nada en el flujo que solo el titular pueda aportar. La dirección IP tampoco resuelve esto: identifica una conexión, no una persona, y en redes móviles o compartidas ni siquiera identifica un hogar.

**Esto no vuelve la firma automáticamente nula.** El parágrafo del artículo 4 permite que cualquier persona *"demuestre de otra manera que la firma electrónica es confiable"*. Pero eso invierte la carga: en lugar de tener una presunción a favor, CNV tendría que construir la prueba caso por caso, con elementos indirectos y ante un titular que niega. Es una posición defensiva débil y evitable.

**Falta además un elemento formal:** el Decreto 2364 contempla que el uso de la firma electrónica descanse en un **acuerdo entre las partes** sobre el mecanismo empleado. Hoy el consentimiento se acepta electrónicamente sin que el paciente haya aceptado expresamente, en ninguna parte del flujo, que su aceptación se dará por ese medio y con esos efectos. Es una línea de texto que hoy no existe y que conviene agregar.

---

## Pregunta 2 · ¿Cambia algo por tratarse de datos sensibles de salud?

**No exige una firma más solemne, pero sí eleva la exigencia probatoria, que es donde ya están débiles.**

La Ley 1581 de 2012 no impone una tecnología de firma para datos sensibles. Lo que impone es distinto y más exigente en la práctica:

- **Autorización explícita** (art. 6): no puede ser tácita ni deducirse del silencio. El diseño actual ya cumple esto correctamente, al pedir casilla por casilla y separar las autorizaciones necesarias de las opcionales. Esa granularidad es un acierto y hay que conservarla.
- **Advertencia de facultatividad** (art. 6, lit. a): debe informarse al titular que no está obligado a autorizar el tratamiento de datos sensibles. El texto v1.6 ya lo hace.
- **Prueba de la autorización** (art. 9): el Responsable debe conservar prueba de que la autorización fue otorgada, y debe poder exhibirla cuando el titular la solicite (art. 8, lit. c).

El punto crítico es el tercero. **La ley no pregunta si CNV tiene un registro; pregunta si CNV puede probar que ese titular específico autorizó.** Con datos ordinarios, un registro imperfecto genera un riesgo moderado. Con datos sensibles de salud, un reclamo ante la Superintendencia de Industria y Comercio por tratamiento no autorizado se resuelve mirando exactamente esa prueba, y la sanción es considerablemente mayor.

Dicho de otro modo: la naturaleza sensible del dato no cambia *qué firma* se necesita, pero sí cambia *cuánto duele* no poder probarla.

---

## Pregunta 3 · ¿Hace falta verificación de identidad?

**Sí, y es la corrección prioritaria.** Un código de un solo uso (OTP) enviado al teléfono o al correo del paciente, exigido antes de completar la aceptación, resuelve directamente la condición 1 del artículo 4: el código es un dato que, en el contexto de uso, corresponde exclusivamente a quien controla ese teléfono o ese correo.

**Recomendación concreta:**

- **Canal:** SMS al celular como opción principal, correo electrónico como alternativa. El celular es más fuerte probatoriamente (menos compartido que un correo familiar) y en Colombia es el dato de contacto más confiable de un paciente.
- **Momento:** antes de habilitar el botón de aceptación, no después. El código valida la sesión de firma completa.
- **Qué registrar:** el canal usado, los últimos cuatro dígitos del número o el correo enmascarado, la marca de tiempo del envío y la de la validación exitosa. **Nunca el código en sí**, ni siquiera cifrado: es un secreto de un solo uso y su valor probatorio está en el hecho de haberse validado, no en su contenido.
- **Vigencia del código:** corta, del orden de cinco a diez minutos, con número limitado de intentos.

**Un factor que juega a favor y conviene registrar:** a diferencia de una transacción anónima en internet, aquí existe un profesional de salud que conoce al paciente y que está prestándole un servicio. Si el sistema deja constancia de que la sesión de consentimiento fue iniciada por un profesional identificado, para un paciente vinculado a su práctica, eso refuerza la confiabilidad del conjunto bajo el criterio de "todas las circunstancias del caso" del artículo 3. El OTP más ese contexto dan una posición sólida.

**Lo que no recomiendo:** firma con certificado digital. Es desproporcionada para un consentimiento clínico, prácticamente ningún paciente colombiano tiene uno, y su exigencia haría inviable la operación sin aportar protección adicional relevante frente al OTP.

---

## Pregunta 4 · El caso de los menores

**El diseño actual es aceptable en sustancia pero débil en prueba, y conviene separarlo.**

Hay que tener claro cuál de los dos actos importa jurídicamente: **la autorización válida la otorga el representante legal.** El asentimiento del menor entre 14 y 17 años es un requisito ético y de respeto a su autonomía progresiva, pero no sustituye ni complementa la capacidad legal del representante.

El problema del flujo actual no es que ambos actos ocurran en el mismo formulario, sino que **al final no se puede distinguir quién hizo qué**. Si todo se completa en un dispositivo sin autenticación diferenciada, no hay forma de demostrar que el representante efectivamente participó, ni de descartar que el menor lo haya diligenciado todo.

**Recomendación:**

- **El OTP debe ir al contacto del representante legal**, no al del menor. Ese es el acto que necesita respaldo probatorio.
- **Registrar los dos actos como eventos separados**, cada uno con su propia marca de tiempo, aunque ocurran en la misma sesión: el asentimiento del menor y la autorización del representante.
- **Conservar los datos del representante que el formulario ya recoge** (nombre, documento, parentesco o calidad), más la declaración de que cuenta con la facultad legal para autorizar.
- **No intentar verificar el vínculo de representación de forma remota.** No es viable ni proporcionado: la declaración del representante, con su autenticación por OTP, es el estándar razonable. Si en algún caso concreto surge una controversia sobre la representación, se resuelve por los medios ordinarios.

---

## Pregunta 5 · ¿Qué debe poder reconstruirse?

Ante un reclamo de "yo nunca autoricé eso", CNV debería poder exhibir un paquete probatorio que responda cinco preguntas. Este es el inventario completo:

| Debe poder probarse | Cómo | Estado |
|---|---|---|
| **Qué texto exacto se mostró** | Versión + hash del contenido | Resuelto |
| **Que el texto no se alteró después** | Hash verificable y reproducible | Resuelto |
| **Cuándo ocurrió** | Marca de tiempo inmutable | Resuelto |
| **Qué autorizó exactamente** | Registro por tipo de autorización, una a una | Resuelto |
| **Que fue esa persona quien aceptó** | Validación OTP registrada | **Falta** |
| **Que aceptó usar medios electrónicos** | Aceptación expresa del mecanismo | **Falta** |
| **Desde dónde** | Dirección IP y agente de usuario | Resuelto |

Dos observaciones adicionales sobre este paquete:

**La reproducibilidad del hash debe estar documentada y probada.** No basta con almacenar un hash: hay que poder demostrar, años después, cómo se calculó y que recalcularlo sobre el texto archivado da el mismo resultado. Esto implica conservar también el texto íntegro de cada versión publicada, no solo su huella, y la regla exacta de normalización empleada. Un hash sin el texto original y sin el procedimiento de cálculo es una cadena de caracteres sin valor probatorio.

**El registro debe ser inalterable, no solo inmutable por convención.** Que el sistema no ofrezca un botón de edición no es lo mismo que garantizar que el registro no fue modificado. Conviene que los eventos de consentimiento queden en una estructura donde una modificación posterior sea detectable, con la misma lógica que ya aplican al contenido del documento.

---

## Pregunta 6 · ¿Hay obligación de entregar copia?

**No hay una obligación expresa de entrega automática, pero sí un derecho del titular a solicitarla, y entregarla de oficio es claramente lo más conveniente.**

La Ley 1581 (art. 8, lit. c) reconoce al titular el derecho a *solicitar prueba de la autorización otorgada*, salvo cuando la ley exceptúe ese requisito. Es decir, la obligación se activa cuando el titular pregunta. Adicionalmente, el consentimiento informado forma parte de los anexos de la historia clínica y sigue su régimen de conservación.

**Recomendación: enviarlo automáticamente al aceptar.** Tres razones prácticas:

- **Cierra el círculo probatorio.** Un correo enviado a la dirección del paciente inmediatamente después de la aceptación, con el texto firmado, es evidencia adicional de que el proceso ocurrió y de que el titular tuvo la oportunidad de objetar en su momento. Si alguien reclama tres años después, el hecho de no haber objetado un correo recibido el mismo día pesa.
- **Elimina la fricción de atender solicitudes posteriores.** Si ya lo tiene, no lo pide.
- **Refuerza la transparencia**, que es un principio del régimen de protección de datos y no solo una cortesía.

**Qué enviar y cuándo:** al momento de la aceptación, un correo con el texto íntegro de la versión aceptada, la lista de autorizaciones marcadas y las no marcadas, la fecha y hora, y el canal de derechos (`protecciondatos@cnvsystem.com`). Conviene registrar el envío como un evento más de la traza.

---

## Plan de implementación, por prioridad

**Antes de atender pacientes reales (bloqueante):**

1. **OTP de verificación** al celular o correo del paciente, exigido antes de completar la aceptación. Registrar canal, destino enmascarado, y marcas de tiempo de envío y validación. Nunca almacenar el código.
2. **Cláusula de aceptación del medio electrónico** en el flujo: una línea, antes de las casillas de autorización, donde el paciente acepte que su consentimiento se otorga por medios electrónicos con plena validez conforme a la Ley 527 de 1999. El numeral 13 del texto v1.6 ya afirma esa validez, pero lo afirma CNV; hace falta que el paciente lo acepte, no solo que se le informe.
3. **Para menores: el OTP va al representante legal**, y los dos actos (asentimiento del menor, autorización del representante) se registran como eventos separados.

**Antes de escalar más allá del piloto:**

4. **Envío automático de copia** al paciente tras la aceptación, registrado como evento.
5. **Documentar y probar el procedimiento de verificación del hash**, conservando el texto íntegro de cada versión publicada y la regla de normalización.
6. **Registrar el contexto de la sesión**: qué profesional la originó y para qué paciente de su práctica.

**Mejora continua:**

7. **Registrar evidencia de exposición al texto**, por ejemplo que el contenido fue efectivamente desplegado antes de habilitar las casillas. Refuerza el carácter informado del consentimiento, aunque no es exigencia expresa.

---

## Lo que hoy registran y no aporta

Poco, y conviene decirlo: el diseño actual está bien pensado y no hay campos claramente inútiles. Dos matices:

- **La dirección IP se conserva, pero no debe presentarse como prueba de identidad.** Sirve como elemento de contexto y para detectar patrones anómalos; no identifica a una persona. Consérvenla, pero que en la documentación interna quede claro qué prueba y qué no, para que nadie la invoque como sustituto del OTP.
- **El nombre y documento escritos en campos de texto siguen siendo útiles** como declaración del firmante y para cotejar contra el registro del paciente, pero por sí solos no autentican. Con el OTP encima, el conjunto sí funciona.