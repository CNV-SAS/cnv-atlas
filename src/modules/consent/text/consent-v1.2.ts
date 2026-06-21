// Texto canonico del consentimiento informado de ATLAS, version 1.2.
//
// Que es: copia verbatim del TEXTO DE CARA AL PACIENTE de CONSENT_ATLAS.md,
// secciones 1 a 13 (regla C1 de DELTA.md). Es el artefacto sobre el que se calcula
// patient_consents.document_hash. CONSENT_ATLAS.md es la fuente de verdad humana;
// este archivo es su materializacion verificable para el hash.
//
// Regla de construccion (C1, DELTA.md):
//   - Secciones 1 a 13 del documento (de cara al paciente), contiguas y verbatim,
//     incluidos los encabezados "## N." y los separadores "---" entre secciones.
//   - Placeholders intactos como literales ({{professional_full_name}}, etc.), sin
//     rellenar: el profesional concreto se registra aparte (relacion paciente-
//     profesional), nunca en el hash.
//   - Se EXCLUYEN los bloques internos: "Aviso interno" (antes de la seccion 1),
//     "Registro tecnico" e "Historial de versiones" (despues de la seccion 13).
//   - Normalizacion antes de hashear: UTF-8, saltos de linea LF, sin espacios en
//     blanco al final de linea. El texto de abajo ya esta normalizado.
//
// Nota sobre el em-dash: este texto reproduce literalmente el documento legal y
// puede contener guiones largos. Es la unica excepcion a la regla de estilo del
// proyecto: alterar la puntuacion cambiaria el hash y romperia la trazabilidad
// legal del consentimiento. NO editar a mano; si cambia el texto legal, se sube la
// version (1.2 -> 1.3) y se regenera este archivo desde CONSENT_ATLAS.md.

export const CONSENT_VERSION = "1.2";

export const CONSENT_TEXT_V1_2 = `## 1. ¿Por qué este formulario?

Antes de iniciar su evaluación, necesitamos informarle cómo se tratarán sus datos personales y de salud, y obtener su autorización libre, voluntaria e informada. Lea con atención y marque las casillas correspondientes al final.

---

## 2. ¿Quién trata sus datos?

En esta evaluación intervienen dos responsables, con finalidades distintas:

**2.1. El profesional de salud que le atiende** es el Responsable del tratamiento de sus datos para su atención clínica y es el custodio de su historia clínica.

> **Profesional:** \`{{professional_full_name}}\` — \`{{professional_profession}}\` — Registro profesional No. \`{{professional_license}}\`
> *(Este bloque se rellena automáticamente por ATLAS con los datos del profesional asignado.)*

**2.2. Connected Nutrition Ventures S.A.S. (CNV)** actúa en dos capacidades: (i) como proveedor de la plataforma ATLAS, tratando sus datos por cuenta del profesional para hacer posible la evaluación; y (ii) como responsable autónomo del tratamiento de sus datos para investigación, mejora del modelo, control de calidad y analítica, en los términos que usted autorice más adelante.

| | |
|---|---|
| **Responsable (CNV)** | Connected Nutrition Ventures S.A.S. — NIT 902045562 — Medellín, Colombia |
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

---

## 5. Usos opcionales (usted elige)

Los siguientes usos son opcionales. Usted puede recibir su atención aunque no los autorice:

- Participar, con sus datos identificables o seudonimizados, en investigación científica del modelo, realizada por medio del Observatorio Latinoamericano de Bioimpedancia.
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

## 11. Declaración de mayoría de edad

Declaro que soy mayor de 18 años.

---

## 12. Autorizaciones

### Autorizaciones necesarias para el servicio
*Debe marcar las tres para continuar.*

- [ ] Autorizo el tratamiento de mis datos personales para las finalidades necesarias descritas en el numeral 4.
- [ ] Autorizo el tratamiento de mis datos sensibles de salud, de forma voluntaria, para mi evaluación y plan personalizados.
- [ ] He sido informado/a del tratamiento internacional (numeral 7) y del uso de sistemas automatizados (numeral 6), y conozco mis derechos (numeral 9).

### Autorizaciones opcionales
*No afectan su atención. Marque solo las que desee.*

- [ ] Autorizo el uso de mis datos identificables o seudonimizados para investigación científica del modelo (numeral 5).
- [ ] Autorizo recibir comunicaciones de continuidad de mi atención dentro de la red CNV (numeral 5).
- [ ] Autorizo recibir comunicaciones comerciales sobre novedades y otros servicios del ecosistema CNV (numeral 5).

---

## 13. Confirmación digital

Al marcar las casillas anteriores y confirmar con su nombre completo en el campo correspondiente, usted otorga su consentimiento de forma **digital**, con plena validez jurídica conforme a la Ley 527 de 1999.

**Nombre completo:** \`________________________________\`
**Número de documento:** \`____________________________\`
**Fecha:** \`_________________\` *(generada automáticamente por ATLAS)*`;
