// Texto canonico del consentimiento informado de ATLAS, version 1.1 (VIGENTE desde 2026-11-03).
//
// Que es: el TEXTO DE CARA AL PACIENTE, artefacto sobre el que se calcula patient_consents.document_hash.
//
// ═══ QUE CAMBIA RESPECTO DE LA v1.0, Y POR QUE ES UNA SOLA LINEA ═══
//
// Decision legal del 2026-10-20 (docs/DECISION_CONSENTIMIENTO_ANONIMIZACION_Y_LLAVE.md, D1 a D5):
// el CUARTO punto del numeral 4 deja de declarar como finalidad necesaria "generar y comercializar
// informacion estadistica anonimizada" y pasa a declarar el acto de ANONIMIZAR, informando que lo
// anonimizado puede comercializarse.
//
// EL MOTIVO JURIDICO: el dato verdaderamente anonimizado NO es dato personal, asi que venderlo no
// requiere autorizacion de nadie; el unico tratamiento del dato personal es el acto de anonimizar, y ese
// si necesita cobertura. Declarar la VENTA como finalidad necesaria dejaba la casilla atacable (art. 6
// par. de la Ley 1581: no se puede condicionar un servicio a la entrega de datos sensibles), y por estar
// en la misma casilla que la evaluacion, el ataque habria alcanzado a la casilla completa.
//
// ES UN CAMBIO NO SUSTANTIVO (D4): aclara una finalidad que ya estaba informada, no agrega ninguna
// finalidad, categoria de dato ni destinatario. De ahi que `versions.ts` la registre con
// substantive: false, y que quien firmo la v1.0 CONSERVE su consentimiento vigente (D5): nadie re-firma.
// El candado `consent-hash.test.ts` prueba que la DIFERENCIA con la v1.0 es exactamente este punto y
// nada mas, que es el hecho sobre el que descansa el "no sustantivo".
//
// NINGUNA CASILLA CAMBIA. No se agrega ninguna (D2) y el control de calidad sobre datos seudonimizados
// se queda entre las necesarias (D3).
//
// LA v1.1 NO ES LA "v1.1" DE JUNIO. Las iteraciones internas que nadie firmo fueron v1.2 a v1.7,
// consolidadas en la v1.0 de lanzamiento; el registro de `versions.ts` es CRONOLOGICO, no numerico.
//
// Generado desde consent-v1.0.ts reemplazando UN punto (no transcrito a mano), para que no pueda
// colarse otra diferencia.
//
// Los marcadores NUNCA se muestran: la instancia (consent-instance.ts) los reemplaza todos y VERIFICA que
// no quede ninguno. El raw de esta plantilla no se muestra a nadie: solo el hash se calcula sobre el.
export const CONSENT_VERSION = "1.1";

export const CONSENT_TEXT_V1_1 = `## 1. ¿Por qué este formulario?

Antes de iniciar su evaluación, necesitamos informarle cómo se tratarán sus datos personales y de salud, y obtener su autorización libre, voluntaria e informada. Lea con atención y marque las casillas correspondientes al final.

Su participación es voluntaria y puede retirarse en cualquier momento sin consecuencias sobre su atención. La información se trata conforme a los principios de beneficencia, no maleficencia, autonomía y justicia que rigen la práctica en salud.

---

## 2. ¿Quién trata sus datos?

En esta evaluación intervienen dos responsables, con finalidades distintas:

**2.1. El profesional de salud que le atiende** es el Responsable del tratamiento de sus datos para su atención clínica y es el custodio de su historia clínica.

> {{bloque_profesional}}

> **Nota.** Cuando el paciente sea menor de edad, las referencias a "usted" en este documento se entienden hechas a su representante legal, quien otorga la autorización en su nombre, sin perjuicio del asentimiento del menor cuando aplique (numeral 11).

**2.2. Connected Nutrition Ventures S.A.S. (CNV)** actúa en dos capacidades: (i) como proveedor de la plataforma ATLAS, tratando sus datos por cuenta del profesional para hacer posible la evaluación; y (ii) como responsable autónomo del tratamiento de sus datos para investigación, mejora del modelo, control de calidad y analítica, en los términos que usted autorice más adelante.

| | |
|---|---|
| **Responsable (CNV)** | Connected Nutrition Ventures S.A.S., NIT 902045562-3, Medellín, Colombia |
| **Canal de derechos** | protecciondatos@cnvsystem.com |

---

## 3. ¿Qué datos se recolectan?

- **Datos de identificación:** nombre, documento, fecha de nacimiento, teléfono, correo.
- **Datos sociodemográficos:** según la encuesta.
- **Pertenencia étnica (opcional):** dato sensible que usted puede informar voluntariamente, o no.
- **Datos sensibles de salud:** antecedentes personales y familiares, diagnósticos y medicamentos, hábitos de alimentación, actividad física y sueño, composición corporal, mediciones de bioimpedancia espectroscópica, síntomas, y señales relacionadas con la conducta alimentaria, entre otros.
- **Determinantes y factores de estilo de vida (enfoque epigenético):** respuestas de la encuesta. No se realizan análisis genéticos de laboratorio ni se toman muestras biológicas.

> **Sus datos sensibles son facultativos.**
> Conforme al artículo 6 de la Ley 1581 de 2012, usted no está obligado a responder las preguntas sobre datos sensibles de salud. Responderlas es voluntario y nos permite personalizar su evaluación.

---

## 4. ¿Para qué se usan? (finalidades necesarias para el servicio)

Los siguientes usos son necesarios para prestarle el servicio que solicitó; sin ellos no es posible realizar la evaluación:

- Realizar su evaluación funcional y elaborar su plan personalizado en el modelo ANI-BIS-E.
- Calcular indicadores y clasificaciones del estado funcional y de riesgo. El profesional interpreta y decide; ATLAS no diagnostica enfermedades.
- Generar su reporte y dar continuidad y seguimiento a su atención.
- Anonimizar sus datos, es decir, disociarlos de forma irreversible de su identidad, para proteger su información y construir y actualizar las referencias poblacionales con las que se interpretan sus propios resultados en el modelo ANI-BIS-E. La información resultante deja de ser un dato personal y no permite identificarle directa ni indirectamente; CNV podrá utilizarla para cualquier fin lícito, incluida su comercialización, que contribuye a sostener el desarrollo del modelo. Sus datos personales nunca se venden.
- Verificar, sobre datos seudonimizados y sin conocer su identidad, que el modelo ANI-BIS-E se aplica correctamente por el profesional que le atiende, como parte del control de calidad del servicio.
- En circunstancias excepcionales (como la atención de una queja o la verificación de una posible desviación grave del protocolo), acceder de forma minimizada y registrada a su historia clínica identificada, con fines de control de calidad y cumplimiento del modelo.

---

## 5. Usos opcionales (usted elige)

Los siguientes usos son opcionales. Usted puede recibir su atención aunque no los autorice:

- Participar, con sus datos seudonimizados (nunca con sus datos de identificación), en investigación científica del modelo ANI-BIS-E y de la medicina bioeléctrica, realizada directamente por el Observatorio Latinoamericano de Bioimpedancia (ObBIA-Latam) o en colaboración con instituciones académicas y profesionales de investigación que trabajen bajo la dirección científica de ObBIA-Latam. Esta investigación utiliza únicamente sus datos clínicos y funcionales estructurados (mediciones, indicadores, respuestas de la encuesta, tratamiento y seguimiento), sin incluir observaciones o notas en texto libre de su profesional. **Si usted decide informar su pertenencia étnica, este dato se utiliza dentro de esta misma finalidad, para que los análisis puedan considerar las diferencias de composición corporal entre poblaciones; informarlo es completamente voluntario y no responder no tiene ninguna consecuencia sobre su evaluación ni su tratamiento.** Cuando un estudio específico requiera identificar el resultado de un paciente en una publicación con fines académicos, se le solicitará un consentimiento de investigación adicional y separado, propio de ese estudio.
- **Continuidad de su atención.** Que CNV pueda contactarle para asegurar la continuidad de su proceso en salud dentro de la red de profesionales. Esta autorización es relevante si el profesional que le atiende deja de operar el modelo ANI-BIS-E: en ese caso, CNV podrá informarle sobre las opciones disponibles para continuar su tratamiento con otro profesional de la red, sin que ello implique el traslado automático de su historia clínica, que siempre requiere su autorización específica.
- **Comunicaciones comerciales.** Recibir información promocional sobre novedades, productos, descuentos y otros servicios del ecosistema CNV. Esta autorización tiene una finalidad exclusivamente comercial y es completamente independiente de su atención en salud.

---

## 6. Uso de sistemas automatizados (IA)

ATLAS utiliza sistemas automatizados, incluida inteligencia artificial, para apoyar su evaluación y la elaboración de su plan, a partir de variables clínicas seudonimizadas (sin sus datos de identificación). Estos sistemas no toman decisiones clínicas ni diagnósticas y nunca se aplican de forma automática: el profesional de salud revisa, ajusta y valida.

---

## 7. Tratamiento internacional

Para operar técnicamente, sus datos se alojan en proveedores ubicados en Estados Unidos y, en el caso de las mediciones de bioimpedancia (Biody Manager / Biody Connect), en Francia. Estos proveedores actúan como encargados bajo acuerdos de tratamiento y confidencialidad con estándares adecuados de protección reconocidos por la autoridad colombiana competente. Al aceptar, usted queda informado de esta operación internacional.

---

## 8. ¿Por cuánto tiempo se conservan?

Su historia clínica se conserva por el término legal mínimo de **quince (15) años** desde su última atención (Resoluciones 1995 de 1999 y 839 de 2017). Si usted solicita la supresión de sus datos, atenderemos su solicitud anonimizando o desvinculando su identidad de la información que no esté sujeta a conservación legal obligatoria.

---

## 9. Sus derechos

Usted puede conocer, actualizar, rectificar y suprimir sus datos; solicitar prueba de su autorización; revocar la autorización (sin que ello afecte la atención ya prestada ni la licitud del tratamiento previo); y presentar quejas ante la Superintendencia de Industria y Comercio (SIC). Para ejercer cualquiera de estos derechos, escriba a **protecciondatos@cnvsystem.com**.

---

## 10. Revocación

Puede revocar esta autorización en cualquier momento ante el profesional de salud o escribiendo a protecciondatos@cnvsystem.com. La revocación no afecta la licitud del tratamiento realizado con anterioridad. La información sujeta a conservación legal (historia clínica) se mantendrá conforme a la ley; en lo demás, se suprimirá o anonimizará en un plazo razonable.

---

## 11. Mayoría de edad y representante legal

<!--RAMA_MAYOR-->**Si el paciente es mayor de 18 años**, declara: "Declaro que soy mayor de 18 años y actúo en nombre propio."<!--/RAMA_MAYOR-->

<!--RAMA_MENOR-->**Si el paciente es menor de 18 años**, este consentimiento debe ser otorgado por su representante legal, quien declara:

> "Declaro que actúo como representante legal de la persona menor de edad evaluada, en calidad de (marque una): {{box_padre}} padre  {{box_madre}} madre  {{box_tutor}} tutor legal  {{box_curador}} curador. Manifiesto que cuento con la facultad legal para autorizar este tratamiento de datos en su nombre, en el mejor interés del menor."

**Datos del representante legal** (solo si el paciente es menor de edad; se completa antes de continuar):

- Nombre completo: {{rep_nombre}}
- Tipo y número de documento: {{rep_documento}}
- Parentesco o calidad: {{rep_parentesco}}
- Correo electrónico: {{rep_correo}}

> **Nota.** Cuando el paciente es menor de edad, el código de verificación con el que se firma este consentimiento (numeral 13) se envía al medio de contacto del representante legal, no al del menor. La copia del consentimiento se envía al representante y, si el menor registra un correo propio, también al menor.

<!--ASENTIMIENTO-->**Asentimiento del menor** (obligatorio cuando el paciente tiene entre 14 y 17 años):

> "Yo, {{asentimiento_menor_nombre}}, he sido informado/a de forma adecuada a mi edad sobre esta evaluación y estoy de acuerdo en participar."

- {{casilla_asentimiento}} El menor (14 a 17 años) otorga su asentimiento en los términos anteriores.<!--/ASENTIMIENTO--><!--/RAMA_MENOR-->

ATLAS determina automáticamente, a partir de la fecha de nacimiento registrada, si aplica la declaración de mayoría de edad o el bloque de representante legal, y activa el bloque de asentimiento cuando corresponda.

---

## 12. Autorizaciones

### Autorizaciones necesarias para el servicio
*Debe marcar las tres para continuar.*

- {{casilla_servicio}} Autorizo el tratamiento de mis datos personales para las finalidades necesarias descritas en el numeral 4, y declaro conocer el tratamiento internacional (numeral 7), el uso de sistemas automatizados (numeral 6) y mis derechos como titular (numeral 9).
- {{casilla_datos_sensibles}} Autorizo el tratamiento de mis datos sensibles de salud, de forma voluntaria, para mi evaluación y plan personalizados.
- {{casilla_medio_electronico}} Acepto que este consentimiento se otorga por medios electrónicos, con plena validez conforme a la Ley 527 de 1999, y que para confirmarlo Atlas enviará un código de verificación al medio de contacto que registro (propio o de una persona de confianza que yo designe).

### Autorizaciones opcionales
*No afectan su atención. Marque solo las que desee.*

- {{casilla_investigacion}} Autorizo el uso de mis datos seudonimizados para investigación científica del modelo, incluida la realizada en colaboración con terceros bajo la dirección científica de ObBIA-Latam, y el uso de mi pertenencia étnica para el análisis de diferencias entre poblaciones, cuando decida informarla (numeral 5).
- {{casilla_continuidad}} **Continuidad asistencial.** Autorizo que CNV me contacte para asegurar la continuidad de mi proceso en salud dentro de la red, especialmente si el profesional que me atiende deja de operar el modelo (numeral 5).
- {{casilla_comerciales}} **Publicidad.** Autorizo recibir comunicaciones comerciales y promocionales del ecosistema CNV (numeral 5).

---

## 13. Confirmación por medios electrónicos

Al marcar las casillas anteriores e ingresar el código de verificación que Atlas envía a su medio de contacto registrado, usted otorga este consentimiento por **medios electrónicos**, con plena validez jurídica conforme a la Ley 527 de 1999. Su nombre y número de documento, registrados en el paso de identificación, junto con la validación del código, constituyen su firma electrónica. Al finalizar, Atlas enviará una copia de este consentimiento a su medio de contacto.

<!--RAMA_MAYOR-->**Si el paciente es mayor de edad**, firma el propio paciente, con el nombre y documento registrados en el paso de identificación:

- Nombre completo: {{firma_nombre}}
- Número de documento: {{firma_documento}}<!--/RAMA_MAYOR-->

<!--RAMA_MENOR-->**Si el paciente es menor de edad**, firma su representante legal (datos ya registrados en el numeral 11) y el código de verificación se envía al contacto del representante:

- Nombre completo del representante: {{firma_rep_nombre}}
- Número de documento del representante: {{firma_rep_documento}}<!--/RAMA_MENOR-->

**Fecha:** {{fecha}}`;
