# CONSENT_ATLAS.md — Consentimiento Informado y Autorización de Tratamiento de Datos

**Documento:** Consentimiento informado de pacientes — ATLAS  
**Versión:** 1.1 (vigente en producción desde 2026-11-03)  
**Estado:** En producción. La v1.1 lleva la decisión legal del 2026-10-20 (numeral 4); pendiente solo la ratificación escrita del asesor, que no bloquea la publicación  
**Aplicación:** ATLAS — se presenta antes de la encuesta, en consulta inicial y de seguimiento  
**Marco aplicable:** Ley 1581 de 2012 (arts. 6 y 26); Decreto 1074 de 2015; Resoluciones 1995/1999 y 839/2017; Ley 527 de 1999  

> **Aviso interno — no se muestra al paciente.**  
> Este archivo es la fuente de verdad del texto del consentimiento. El hash que se almacena en `patient_consents.document_hash` se calcula según la regla precisa del bloque "Registro técnico" al final (texto de cara al paciente, secciones 1 a 13, con los placeholders intactos, excluyendo los bloques internos; normalización UTF-8 y LF). Antes de cualquier cambio sustantivo, crear una nueva versión (bump de versión + nueva entrada en el historial de cambios al final). El MVP **soporta pacientes menores de edad** mediante el bloque de representante legal del numeral 11, con la validación de fecha de nacimiento ya implementada en el flujo de encuesta. Desde v1.7, la aceptación se otorga por **medios electrónicos con verificación por código** (firma electrónica, Ley 527): Atlas envía un código al medio de contacto registrado, lo valida de forma atómica antes de crear nada, y envía una copia del consentimiento tras aceptar (ver `PLAN_B7_FIRMA.md`).
>
> **La numeración de este archivo estuvo desfasada y aquí se cierra (2026-11-03).** El documento decía "1.7" cuando en producción corría la **v1.0**: al lanzar (2026-08-12) las iteraciones internas v1.2 a v1.7, que ningún paciente firmó, se consolidaron y renumeraron a v1.0, y ese bump quedó registrado en el código (`consent-v1.0.ts`) pero no aquí. El historial del final recoge ahora las dos entradas que faltaban, la v1.0 de lanzamiento y la v1.1. **Y el registro de versiones que decide si un seguimiento fuerza re-firma vive en `src/modules/consent/versions.ts`, no en esta tabla:** esa tabla es la historia humana, el registro es el que el sistema lee.

---

## 1. ¿Por qué este formulario?

Antes de iniciar su evaluación, necesitamos informarle cómo se tratarán sus datos personales y de salud, y obtener su autorización libre, voluntaria e informada. Lea con atención y marque las casillas correspondientes al final.

---

## 2. ¿Quién trata sus datos?

En esta evaluación intervienen dos responsables, con finalidades distintas:

**2.1. El profesional de salud que le atiende** es el Responsable del tratamiento de sus datos para su atención clínica y es el custodio de su historia clínica.

> **Profesional:** `{{professional_full_name}}` — `{{professional_profession}}` — Registro profesional No. `{{professional_license}}`  
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
- Anonimizar sus datos, es decir, disociarlos de forma irreversible de su identidad, para proteger su información y construir y actualizar las referencias poblacionales con las que se interpretan sus propios resultados en el modelo ANI-BIS-E. La información resultante deja de ser un dato personal y no permite identificarle directa ni indirectamente; CNV podrá utilizarla para cualquier fin lícito, incluida su comercialización, que contribuye a sostener el desarrollo del modelo. Sus datos personales nunca se venden.
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

- Nombre completo: `________________________________`
- Tipo y número de documento: `____________________________`
- Parentesco o calidad: `____________________________`
- Correo electrónico: `____________________________`

> **Nota.** Cuando el paciente es menor de edad, el código de verificación con el que se firma este consentimiento (numeral 13) se envía al medio de contacto del representante legal, no al del menor. La copia del consentimiento se envía al representante y, si el menor registra un correo propio, también al menor.

**Asentimiento del menor** *(obligatorio cuando el paciente tiene entre 14 y 17 años)*:

> "Yo, `________________________________`, he sido informado/a de forma adecuada a mi edad sobre esta evaluación y estoy de acuerdo en participar."

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

- Nombre completo: `________________________________`
- Número de documento: `____________________________`

**Si el paciente es menor de edad**, firma su representante legal (datos ya registrados en el numeral 11) y el código de verificación se envía al contacto del representante:

- Nombre completo del representante: `________________________________`
- Número de documento del representante: `____________________________`

**Fecha:** `_________________` *(generada automáticamente por ATLAS)*

---

> **Registro técnico (ATLAS).**  
> Cada autorización otorgada se almacena como un registro independiente en `patient_consents`, con los siguientes campos:  
> - `consent_type`: tipo de autorización (`servicio` | `datos_sensibles` | `internacional_ia` | `investigacion` | `comunicaciones_continuidad` | `comunicaciones_comerciales` | `representante_legal` | `asentimiento_menor` | `aceptacion_medio_electronico`)  
> - `consent_version`: versión de este documento (`1.7`)  
> - `document_hash`: SHA-256 sobre el **texto de cara al paciente (secciones 1 a 13)** con los placeholders intactos (`{{...}}` literales, sin rellenar), **excluyendo** los bloques internos ("Aviso interno", "Registro técnico", "Historial de versiones"). Normalización antes de hashear: UTF-8, saltos de línea LF, sin espacios en blanco al final de línea. El cálculo y su verificación reproducible se implementan en B7  
> - `signed_at`: marca de tiempo inmutable del momento de aceptación  
> - `revoked_at`: marca de tiempo de revocación (null si vigente) — **campo requerido en el esquema**  
> - Cuando `consent_type = representante_legal`: se almacenan además `legal_representative_name`, `legal_representative_document`, `legal_representative_relationship` (parentesco/calidad). Campos requeridos en el esquema — **pendiente de agregar a `patient_consents` o tabla relacionada**.  
> - ATLAS valida la fecha de nacimiento del paciente en el flujo de encuesta: si indica minoría de edad, activa el bloque de representante legal (numeral 11) en lugar de la declaración de mayoría de edad, y activa adicionalmente el bloque de asentimiento si la edad está entre 14 y 17 años. **Brecha técnica pendiente de implementación.**
>
> Solo se crean registros para las autorizaciones que el titular marcó activamente. Las autorizaciones necesarias (1–3) deben estar vigentes (revoked_at IS NULL) para que el flujo clínico proceda.

---

## Historial de versiones

| Versión | Fecha | Cambios |
|---|---|---|
| 1.0 | 2026-06 | Versión inicial. Estructura por capas, seis tipos de autorización, IA a nivel de principio, Francia en tratamiento internacional. |
| 1.1 | 2026-06 | Correcciones: Sentry/Cloudflare/Upstash añadidos a sub-encargados en Anexo 3; IA amplíada a resumen de indicadores + menú; nota técnica alineada con esquema real de patient_consents. |
| 1.2 | 2026-06 | Añadido: identificación del profesional (campos dinámicos); comercialización de derivados anonimizados integrada en las finalidades necesarias; sección 13 adaptada a firma digital con referencia a Ley 527/1999; seis consent_type documentados explícitamente en la nota técnica. |
| 1.3 | 2026-07 | La autorización de investigación (numeral 5) se limita a datos seudonimizados; se elimina la opción de datos identificables. Se acota el alcance a datos clínicos y funcionales estructurados, excluyendo el contenido narrativo u observaciones en texto libre del profesional. |
| 1.4 | 2026-07 | Incorporado el bloque condicional de representante legal para pacientes menores de 18 años (numeral 11), con asentimiento del menor entre 14 y 17 años. Ajustada la sección 2 y la sección 13 (firma) para reflejar la firma del representante cuando aplica. Nuevos consent_type: representante_legal y asentimiento_menor. El MVP soporta pacientes menores de edad. |
| 1.5 | 2026-07 | Ampliada la autorización de investigación (numeral 5 y numeral 12) para cubrir colaboraciones de investigación de terceros bajo la dirección científica de ObBIA-Latam, sin necesidad de modificar el consentimiento cada vez que se sume un nuevo colaborador. Aclarado que estudios con fines de identificación/publicación requieren un consentimiento de investigación adicional y separado (ver Consentimiento Informado de Investigación — Plantilla). |
| 1.6 | 2026-07 | **DOCUMENTADA, NUNCA EFECTIVA (detectado 2026-08-09).** Incorporó dos finalidades necesarias adicionales en el numeral 4 (auditoría del cumplimiento del modelo sobre datos seudonimizados, y acceso excepcional a historia clínica identificada, minimizado y registrado), base legal de los grants de acceso, PERO nunca se portó al texto vendorizado del código (`consent-v1.5.ts` quedó como versión efectiva). El consentimiento que los pacientes habrían firmado no contenía esas finalidades. Se consolida en v1.7. Ver `DECISIONES_LEGALES.md` item 13. |
| 1.7 | 2026-08 | **Firma electrónica (B7, dictamen 2026-08-09) + consolidación de v1.6.** (a) Consolida las dos finalidades necesarias de v1.6 en el numeral 4 (ahora sí en el texto efectivo). (b) Numeral 12: nueva casilla necesaria de aceptación del medio electrónico (`aceptacion_medio_electronico`): el paciente ACEPTA firmar por medios electrónicos y recibir un código de verificación al medio de contacto que registre (propio o de un tercero de confianza), no solo se le informa la validez. (c) Numeral 13 reescrito para describir el flujo real (casillas + código + datos de identificación = firma electrónica) y anunciar la copia automática. (d) Numeral 11: el código de menores se envía al contacto del representante. Hash nuevo (regla C1). 
| 1.0 | 2026-08-12 | **BUMP DE LANZAMIENTO (renumeración), registrado aquí el 2026-11-03.** Consolida las iteraciones internas v1.2 a v1.7, que ningún paciente firmó, y suma la revisión legal del 11 de agosto: de ocho casillas a seis (tres necesarias, tres opcionales), `internacional_ia` absorbido en `servicio`, la pertenencia étnica fundida en la casilla de investigación, marcadores explícitos de relleno y delimitadores de rama, y sin em-dash en el texto de cara al paciente. **Primera versión que un paciente firma, y la que tiene firmada casi toda la base.** SUSTANTIVA respecto de v1.7. Texto en `consent-v1.0.ts`. |
| 1.1 | 2026-11-03 | **Numeral 4, cuarto punto: la finalidad necesaria pasa de "generar y comercializar información estadística anonimizada" al acto de ANONIMIZAR**, informando que lo anonimizado puede comercializarse y que los datos personales nunca se venden. Decisión legal del 2026-10-20 (`DECISION_CONSENTIMIENTO_ANONIMIZACION_Y_LLAVE.md`, D1 a D5). **Motivo:** declarar la VENTA como finalidad necesaria dejaba la casilla atacable (art. 6 par. de la Ley 1581, que prohíbe condicionar un servicio a la entrega de datos sensibles), y por compartir casilla con la evaluación el ataque alcanzaba a la casilla completa; el dato verdaderamente anonimizado no es dato personal, así que el único tratamiento que necesita cobertura es el acto de anonimizar. **NO SUSTANTIVA:** ninguna finalidad, categoría de dato ni destinatario nuevo, ninguna casilla nueva; quien firmó la v1.0 conserva su consentimiento vigente y no re-firma (D5). Ningún otro punto cambia, y el candado `consent-hash.test.ts` prueba que la diferencia con la v1.0 es exactamente esa línea. Texto en `consent-v1.1.ts`, hash nuevo (regla C1). ||