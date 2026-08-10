// Texto canonico del consentimiento informado de ATLAS, version 1.7.
//
// Que es: copia verbatim del TEXTO DE CARA AL PACIENTE de CONSENT_ATLAS.md, secciones 1 a 13
// (regla C1 de DELTA.md). Es el artefacto sobre el que se calcula patient_consents.document_hash.
// CONSENT_ATLAS.md es la fuente de verdad humana; este archivo es su materializacion verificable
// para el hash. Generado desde el doc con un script de extraccion (uso unico), no transcrito a mano.
//
// v1.7 (B7, dictamen firma electronica 2026-08-09) consolida v1.6 (que se documento pero NUNCA se
// vendorizo: el codigo efectivo quedo en v1.5) y agrega la firma electronica:
//   - Numeral 4: las dos finalidades necesarias de v1.6 (auditoria seudonimizada + acceso excepcional
//     identificado), ahora si en el texto efectivo.
//   - Numeral 12: nueva casilla necesaria de aceptacion del medio electronico.
//   - Numeral 13: reescrito para el flujo real (casillas + codigo + datos de identificacion) + copia.
//   - Numeral 11: el codigo de menores va al contacto del representante.
//
// Regla de construccion (C1, DELTA.md): secciones 1 a 13 contiguas y verbatim (encabezados "## N." y
// separadores "---" incluidos), placeholders intactos, bloques internos excluidos, normalizacion
// UTF-8 + LF + sin espacios al final de linea. El texto de abajo ya esta normalizado.
//
// Nota sobre el em-dash: este texto reproduce literalmente el documento legal y puede contener guiones
// largos. Es la unica excepcion a la regla de estilo del proyecto: alterar la puntuacion cambiaria el
// hash y romperia la trazabilidad legal. NO editar a mano; si cambia el texto legal, se sube la version
// y se regenera este archivo desde CONSENT_ATLAS.md.

export const CONSENT_VERSION = "1.7";

export const CONSENT_TEXT_V1_7 = `## 1. ¿Por qué este formulario?

Antes de iniciar su evaluación, necesitamos informarle cómo se tratarán sus datos personales y de salud, y obtener su autorización libre, voluntaria e informada. Lea con atención y marque las casillas correspondientes al final.

---

## 2. ¿Quién trata sus datos?

En esta evaluación intervienen dos responsables, con finalidades distintas:

**2.1. El profesional de salud que le atiende** es el Responsable del tratamiento de sus datos para su atención clínica y es el custodio de su historia clínica.

> **Profesional:** \`{{professional_full_name}}\` — \`{{professional_profession}}\` — Registro profesional No. \`{{professional_license}}\`
> *(Este bloque se rellena automáticamente por ATLAS con los datos del profesional asignado.)*

> **Nota.** Cuando el paciente sea menor de edad, las referencias a "usted" en este documento se entienden hechas a su representante legal, quien otorga la autorización en su nombre, sin perjuicio del asentimiento del menor cuando aplique (numeral 11).

**2.2. Connected Nutrition Ventures S.A.S. (CNV)** actúa en dos capacidades: (i) como proveedor de la plataforma ATLAS, tratando sus datos por cuenta del profesional para hacer posible la evaluación; y (ii) como responsable autónomo del tratamiento de sus datos para investigación, mejora del modelo, control de calidad y analítica, en los términos que usted autorice más adelante.

| | |
|---|---|
| **Responsable (CNV)** | Connected Nutrition Ventures S.A.S. — NIT 902045562-3 — Medellín, Colombia |
| **Canal de derechos** | protecciondatos@cnvsystem.com |

---

## 3. ¿Qué datos se recolectan?

- **Datos de identificación:** nombre, documento, fecha de nacimiento, teléfono, correo.
- **Datos sociodemográficos:** según la encuesta.
- **Datos sensibles de salud:** hábitos, composición corporal, mediciones de bioimpedancia espectroscópica, antecedentes, conductas y síntomas, entre otros.
- **Determinantes y factores de estilo de vida (enfoque epigenético):** respuestas de la encuesta. No se realizan análisis genéticos de laboratorio ni se toman muestras biológicas.

> **Sus datos sensibles son facultativos.**
> Conforme al artículo 6 de la Ley 1581 de 2012, usted no está obligado a responder las preguntas sobre datos sensibles de salud. Responderlas es voluntario y nos permite personalizar su evaluación.

---

## 4. ¿Para qué se usan? (finalidades necesarias para el servicio)

Los siguientes usos son necesarios para prestarle el servicio que solicitó; sin ellos no es posible realizar la evaluación:

- Realizar su evaluación funcional y elaborar su plan personalizado en el modelo ANI-BIS-E.
- Calcular indicadores y clasificaciones del estado funcional y de riesgo. El profesional interpreta y decide; ATLAS no diagnostica enfermedades.
- Generar su reporte y dar continuidad y seguimiento a su atención.
- **Generar y comercializar información estadística anonimizada que no permite identificarle.** Los datos personales no serán vendidos; solo se comercializan derivados que son irreversiblemente disociados de su identidad.
- Verificar, sobre datos seudonimizados y sin conocer su identidad, que el modelo ANI-BIS-E se aplica correctamente por el profesional que le atiende, como parte del control de calidad del servicio.
- En circunstancias excepcionales (como la atención de una queja o la verificación de una posible desviación grave del protocolo), acceder de forma minimizada y registrada a su historia clínica identificada, con fines de control de calidad y cumplimiento del modelo.

---

## 5. Usos opcionales (usted elige)

Los siguientes usos son opcionales. Usted puede recibir su atención aunque no los autorice:

- Participar, con sus datos **seudonimizados** (nunca con sus datos de identificación), en investigación científica del modelo ANI-BIS-E y de la medicina bioeléctrica, realizada directamente por el Observatorio Latinoamericano de Bioimpedancia (ObBIA-Latam) o en colaboración con instituciones académicas y profesionales de investigación que trabajen bajo la dirección científica de ObBIA-Latam. Esta investigación utiliza únicamente sus datos clínicos y funcionales estructurados (mediciones, indicadores, respuestas de la encuesta, tratamiento y seguimiento), sin incluir observaciones o notas en texto libre de su profesional. Cuando un estudio específico requiera identificar el resultado de un paciente en una publicación con fines académicos, se le solicitará un consentimiento de investigación adicional y separado, propio de ese estudio.
- Recibir comunicaciones de continuidad de su atención dentro de la red de profesionales de CNV.
- Recibir información sobre novedades, productos y otros servicios del ecosistema CNV (comunicaciones comerciales).

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

**Si el paciente es mayor de 18 años**, declara: "Declaro que soy mayor de 18 años y actúo en nombre propio."

**Si el paciente es menor de 18 años**, este consentimiento debe ser otorgado por su representante legal, quien declara:

> "Declaro que actúo como representante legal de la persona menor de edad evaluada, en calidad de (marque una): ☐ padre  ☐ madre  ☐ tutor legal  ☐ curador. Manifiesto que cuento con la facultad legal para autorizar este tratamiento de datos en su nombre, en el mejor interés del menor."

**Datos del representante legal** *(solo si el paciente es menor de edad; se completa antes de continuar)*:

- Nombre completo: \`________________________________\`
- Tipo y número de documento: \`____________________________\`
- Parentesco o calidad: \`____________________________\`
- Correo electrónico: \`____________________________\`

> **Nota.** Cuando el paciente es menor de edad, el código de verificación con el que se firma este consentimiento (numeral 13) se envía al medio de contacto del representante legal, no al del menor. La copia del consentimiento se envía al representante y, si el menor registra un correo propio, también al menor.

**Asentimiento del menor** *(obligatorio cuando el paciente tiene entre 14 y 17 años)*:

> "Yo, \`________________________________\`, he sido informado/a de forma adecuada a mi edad sobre esta evaluación y estoy de acuerdo en participar."

- [ ] El menor (14 a 17 años) otorga su asentimiento en los términos anteriores.

ATLAS determina automáticamente, a partir de la fecha de nacimiento registrada, si aplica la declaración de mayoría de edad o el bloque de representante legal, y activa el bloque de asentimiento cuando corresponda.

---

## 12. Autorizaciones

### Autorizaciones necesarias para el servicio
*Debe marcar las cuatro para continuar.*

- [ ] Autorizo el tratamiento de mis datos personales para las finalidades necesarias descritas en el numeral 4.
- [ ] Autorizo el tratamiento de mis datos sensibles de salud, de forma voluntaria, para mi evaluación y plan personalizados.
- [ ] He sido informado/a del tratamiento internacional (numeral 7) y del uso de sistemas automatizados (numeral 6), y conozco mis derechos (numeral 9).
- [ ] Acepto que este consentimiento se otorga por medios electrónicos, con plena validez conforme a la Ley 527 de 1999, y que para confirmarlo Atlas enviará un código de verificación al medio de contacto que registro (propio o de una persona de confianza que yo designe).

### Autorizaciones opcionales
*No afectan su atención. Marque solo las que desee.*

- [ ] Autorizo el uso de mis datos seudonimizados para investigación científica del modelo, incluida la realizada en colaboración con terceros bajo la dirección científica de ObBIA-Latam (numeral 5).
- [ ] Autorizo recibir comunicaciones de continuidad de mi atención dentro de la red CNV (numeral 5).
- [ ] Autorizo recibir comunicaciones comerciales sobre novedades y otros servicios del ecosistema CNV (numeral 5).

---

## 13. Confirmación por medios electrónicos

Al marcar las casillas anteriores e ingresar el código de verificación que Atlas envía a su medio de contacto registrado, usted otorga este consentimiento por **medios electrónicos**, con plena validez jurídica conforme a la Ley 527 de 1999. Su nombre y número de documento, registrados en el paso de identificación, junto con la validación del código, constituyen su firma electrónica. Al finalizar, Atlas enviará una copia de este consentimiento a su medio de contacto.

**Si el paciente es mayor de edad**, firma el propio paciente, con el nombre y documento registrados en el paso de identificación:

- Nombre completo: \`________________________________\`
- Número de documento: \`____________________________\`

**Si el paciente es menor de edad**, firma su representante legal (datos ya registrados en el numeral 11) y el código de verificación se envía al contacto del representante:

- Nombre completo del representante: \`________________________________\`
- Número de documento del representante: \`____________________________\`

**Fecha:** \`_________________\` *(generada automáticamente por ATLAS)*`;
