# DATA_GOVERNANCE.md — Gobernanza del dato en Atlas (CNV)

**Versión:** 1.1
**Estado:** Base operativa aprobada internamente. Los puntos marcados PENDIENTE JURÍDICO requieren validación final del asesor legal de CNV antes del lanzamiento en producción. El documento es la fuente de verdad de gobernanza; los cambios se registran en el Registro de Decisiones al final.
**Relación:** `SECURITY.md` cubre los controles técnicos de protección (RLS, cifrado, secretos, rate limiting). Este documento cubre el ciclo de vida y la gobernanza del dato (clasificación, base legal, consentimiento, seudonimización, retención, derechos del titular, sub-encargados). Donde se solapan, este remite a `SECURITY.md`.

> **Aviso.** Atlas maneja **dato sensible de salud** (Ley 1581 de 2012, art. 5). Las decisiones tomadas en este documento son posiciones de trabajo defendibles; antes del lanzamiento en producción deben ser validadas por el asesor jurídico de CNV. Las marcas PENDIENTE JURÍDICO identifican los puntos que requieren ratificación específica.

---

## Lenguaje estandarizado (transversal a todos los documentos y materiales)

Estas reglas aplican a Atlas, contratos, consentimientos, web, diplomado y marketing. Son tanto una exigencia legal como una decisión de diseño de producto.

- **ATLAS calcula, clasifica y estima.** No diagnostica enfermedades. Nunca usar "diagnóstico automático" o "diagnóstica" referido al software.
- **El profesional diagnostica y decide.** Atlas apoya la toma de decisiones; la decisión clínica es del profesional.
- **El equipo Biody BIS** opera bajo la finalidad declarada por el fabricante: **composición corporal / bienestar funcional**, no dispositivo médico. No atribuirle finalidad diagnóstica o terapéutica.
- **Nutracéuticos:** claims exclusivamente nutricionales/funcionales (apoyo a la recuperación de propiedades bioeléctricas). Prohibido: claims de prevención, tratamiento o cura de enfermedades.
- **"ANI-BIS-E"** siempre en mayúsculas con guiones. No: "ANI BIS-E", "ANV-BIS-e", minúsculas.
- **"Encuesta de determinantes y factores epigenéticos"** — no "prueba epigenética" ni "análisis genético" (el MVP solo recoge respuestas de encuesta, sin muestras ni laboratorio).
- **Integrante CNV** (no "Profesional Conectado", no "Profesional Certificado").

Reporte al paciente — vista interna vs. documento final. El motor puede asociar patrones a condiciones clínicas conocidas (ej. "síndrome metabólico", "DM2") como apoyo al criterio del profesional en la vista previa interna, con el rótulo obligatorio "patrones asociados a valorar clínicamente, no constituye diagnóstico". Antes de enviar, el profesional elige qué recibe el paciente: el reporte de Atlas tal cual (con el rótulo siempre visible), sus propias notas de interpretación, o ambos. El snapshot original de Atlas nunca se edita ni se pierde; las notas del profesional se almacenan por separado como una capa adicional, no como reemplazo del registro clínico. La traducción del contenido de Atlas a lenguaje funcional (sin nombrar enfermedades) para el documento del paciente es una mejora prevista en BACKLOG, pendiente de autorización y contenido de la Dirección Científica.

---

## Principios

1. **Minimización.** Solo se recolecta lo necesario para el propósito declarado.
2. **Propósito explícito.** Cada dato tiene un propósito declarado y un consentimiento o base legal que lo cubre.
3. **Seudonimización por defecto en la operación; anonimización real para investigación externa.**
4. **Nunca PII al LLM.** Solo variables clínicas seudonimizadas.
5. **Trazabilidad y evidencia.** Todo registro clínico lleva su constelación de versiones y su snapshot; el log clínico es inmutable.
6. **La propiedad del hardware no da propiedad del dato del paciente.** El derecho a procesar y conservar nace del consentimiento y de un propósito lícito.
7. **CNV no es propietaria de datos personales.** Solo es propietaria de datos efectivamente anonimizados y de derivados no personales (agregados, estadísticas, modelos, algoritmos). Los datos personales pertenecen a sus titulares.

---

## Mapa de roles de tratamiento (DECISIÓN CENTRAL)

Esta arquitectura fue definida deliberadamente para que CNV no quede configurada como prestador de servicios de salud ni como corresponsable de la atención clínica.

### Capa asistencial (atención del paciente)
- **Responsable del Tratamiento:** el profesional de salud (Integrante CNV). Controla la finalidad del tratamiento, obtiene el consentimiento y es custodio de la historia clínica.
- **Encargado del Tratamiento:** CNV, a través de ATLAS. Trata los datos por cuenta y bajo las instrucciones del profesional, materializadas en el Acuerdo de Tratamiento (Anexo 3 del contrato). CNV no usa estos datos para fines propios en esta capa.
- **Nota:** el hecho de que CNV haya diseñado el modelo y la plataforma no altera los roles. Lo que importa es la finalidad: en la capa asistencial, CNV trata datos del paciente exclusivamente para que el profesional preste el servicio.

### Capa secundaria (investigación, mejora del modelo, control de calidad, analítica)
- **Responsable del Tratamiento:** CNV, de forma autónoma, con base en la autorización que el paciente otorga directamente a CNV en el consentimiento de ATLAS (casilla opcional).
- Investigación con datos **seudonimizados** (nunca identificables): requiere la casilla opt-in del paciente.
- Estadística anonimizada: no requiere consentimiento adicional (ya no es dato personal); se informa como finalidad en las casillas necesarias.

### Datos del Integrante CNV (profesional)
- **Responsable del Tratamiento:** CNV.

### Validación jurídica pendiente
- PENDIENTE JURÍDICO: confirmar que la arquitectura Responsable (profesional) / Encargado (CNV) es sostenible y que CNV no queda configurada como corresponsable de la atención.

---

## Clasificación del dato (3 niveles)

Cada campo se clasifica en `survey_questions.data_class`. La clasificación maneja automáticamente qué sale al LLM, qué se anonimiza y qué se cifra.

| Nivel | Ejemplos | LLM | Export investigación | Cifrado |
|---|---|---|---|---|
| Identificador directo | Nombre, cédula, celular, correo | Nunca | Nunca | Candidato a cifrado de columna |
| Cuasi-identificador | Ciudad, fecha de nacimiento, sexo | Solo si tiene valor clínico | Generalizado (región, rango etario) | No |
| Clínico | Hábitos, BIS, indicadores, síntomas | Sí (seudonimizado) | Sí (seudonimizado) | No |

**Nota:** quitar el identificador directo no basta para anonimizar. Los cuasi-identificadores re-identifican en combinación. Ver estándar de anonimización abajo.

---

## Categorías de dato que Atlas almacena

- **Identificación:** nombre, documento, contacto. (Identificadores directos; PII separada de las tablas clínicas.)
- **Clínico/funcional:** mediciones BIS (Cole-Cole, composición corporal), indicadores (IFC, IRC, IEHH, ISCM-BIS, EB-BIS, IAE, PABU), clasificaciones, diagnóstico funcional (Diana), tratamiento, seguimiento.
- **Determinantes y factores de estilo de vida (encuesta):** respuestas sobre hábitos, antecedentes, alimentación, sueño, estrés. (En el MVP: solo respuestas de encuesta. No se realizan análisis genéticos de laboratorio ni se toman muestras; el análisis epigenético del MVP se basa en estas respuestas.)
- **Operativo/comercial:** comodato, inventario, transacciones, comisiones.
- **Técnico/auditoría:** logs, IP, user agent (en `clinical_audit_log`, acceso solo admin).
- **Datos del Integrante:** identificación, registro profesional, estado de habilitación, datos de desempeño operativo.

---

## Consentimiento (estructura y técnica)

**Consentimiento de ATLAS:** término estándar usado en toda la documentación de CNV (contractual y técnica) para referirse al texto de consentimiento informado vigente en cada momento, presentado al paciente dentro de la plataforma Atlas antes de cada evaluación, mediante el cual otorga las autorizaciones descritas en esta sección. La fuente de verdad de su texto es el archivo `CONSENT_ATLAS.md` del repositorio.

### Arquitectura del consentimiento de ATLAS
El consentimiento opera por capas y se presenta antes de la encuesta. El texto completo está disponible (expandible), con casillas que el usuario marca activamente (no pre-marcadas).

**Autorizaciones necesarias para el servicio** (sin ellas no se puede continuar):
1. Tratamiento de datos personales (identificación) para la evaluación.
2. Tratamiento de datos sensibles de salud para la evaluación y plan personalizados. (Nota: responder preguntas sobre datos sensibles es facultativo conforme al art. 6 de la Ley 1581.)
3. Informado sobre tratamiento internacional (EE. UU. y Francia) y uso de sistemas automatizados (IA).

**Autorizaciones opcionales** (la atención no depende de ellas):
4. Uso de datos **seudonimizados** (nunca identificables) para investigación científica del modelo (Observatorio Latinoamericano de Bioimpedancia).
5. Comunicaciones de continuidad de atención dentro de la red CNV.
6. Comunicaciones comerciales sobre servicios y novedades del ecosistema CNV.

### Técnica de registro
- Un registro en `patient_consents` por cada tipo de autorización otorgada.
- Campos: `consent_type`, `consent_version`, `document_hash` (hash del texto exacto), `signed_at` (timestamp inmutable).
- PENDIENTE DE IMPLEMENTACIÓN: agregar campo `revoked_at` (o equivalente) para registrar la revocación de cada autorización.
- Ningún paciente entra al flujo sin las autorizaciones necesarias (1–3) registradas.

### Versiones del consentimiento
- Versionado semántico: versión MAYOR cuando el cambio requiere nueva aceptación; versión menor para ajustes no sustantivos.
- El hash asegura que lo que firmó el titular coincide con el texto de esa versión exacta.
- Las versiones anteriores se conservan durante el periodo de retención (no se borran).

---

## Seudonimización vs. anonimización

**Operación día a día: seudonimización.** La data clínica cuelga de `patient_id` (UUID); la PII vive aparte con RLS estricto. Ninguna tabla clínica carga nombre ni documento. Sigue siendo dato personal bajo Ley 1581.

**Investigación interna (CNV Research / ObBIA):** trabajan sobre data seudonimizada bajo gobernanza y consentimiento (pueden usar un `research_id` estable para análisis longitudinal, sin ruta de vuelta a la persona).

**Alcance limitado a datos estructurados.** La capa de investigación accede únicamente a datos clínicos y funcionales **estructurados**: mediciones de bioimpedancia, indicadores calculados, respuestas de la encuesta, protocolo de tratamiento aplicado y resultados de seguimiento. **No incluye** el contenido narrativo u observaciones clínicas en texto libre registradas por el profesional, salvo que exista una autorización adicional, específica y expresa del titular para dicho fin. Nunca incluye identificadores directos.

**Investigación externa / publicación:** anonimización real:
- Quitar identificadores directos, **más**
- Tratar cuasi-identificadores: generalizar (región, no ciudad; rango etario, no fecha exacta), agregar, aplicar k-anonimato.
- **Estándar de anonimización (PENDIENTE JURÍDICO para ratificación):** k-anonimato con k ≥ 5 para compartición externa; l-diversidad para atributos sensibles. Documentado aquí; ratificación jurídica antes de primer export externo.

Los exports de investigación se gobiernan vía `research_datasets` y nunca incluyen identificadores directos.

---

## Custodia de la historia clínica

La obligación legal de conservar la historia clínica por el término de quince (15) años (Resoluciones 1995/1999 y 839/2017) corresponde al **Integrante** (profesional de salud), como Responsable y custodio de dicha información. **CNV no tiene esa obligación legal**; su rol es exclusivamente técnico: aloja y conserva la historia clínica en Atlas en su calidad de Encargado del tratamiento, mientras dure la vinculación contractual del Integrante con CNV, en apoyo del cumplimiento de esa obligación por parte del profesional.

Al terminar la relación contractual, la custodia se transfiere al Integrante mediante la exportación de las historias clínicas en formato interoperable (PDF + JSON/CSV estructurado), dentro de los diez (10) días hábiles siguientes a la terminación, conforme al Anexo 3 (Cláusula de conservación y supresión) y al Anexo de Licencia de ATLAS. CNV conserva, después de esa exportación, únicamente los datos anonimizados y los derivados no personales.

---

## Reasignación paciente-profesional y consentimiento dinámico (reglas legales confirmadas)

Reglas confirmadas por la revisión jurídica (2026-07). Cambian el diseño futuro del modelo de asignación paciente-profesional; se documentan aquí para no perderlas. La implementación es un bloque post primer-piloto (ver `BACKLOG.md`), NO del MVP inicial.

**(a) El checkbox de continuidad autoriza CONTACTO, no reasignación ni retención.** La casilla opcional de continuidad del consentimiento habilita únicamente que CNV/el profesional puedan **contactar** al paciente; NO autoriza por sí sola reasignar su historia a otro profesional ni retenerla automáticamente. La **reasignación** de un paciente a un profesional entrante exige: (1) **consentimiento fresco del paciente hacia ese profesional entrante específico** (no un consentimiento genérico ni el del profesional saliente), y (2) una **transferencia formal de custodia** entre profesionales. La continuidad no es reasignación.

**(b) Sin continuidad o sin aceptación: exportar al saliente + anonimizar en CNV.** Si el paciente no dio continuidad, o no acepta al profesional entrante, se aplica la ruta ya existente: **exportar la historia clínica al profesional saliente** (custodio legal por 15 años) y **anonimizar el dato en CNV**, conforme a la Cláusula 12 del Anexo 3 (ya vigente, no es nueva). Es el mismo mecanismo que el offboarding de un Integrante.

**(c) Consentimiento dinámico: revocación por finalidad, hacia adelante.** El consentimiento se revoca **por finalidad** (por autorización concreta), no con un interruptor general. La revocación opera **hacia adelante, no retroactiva**; una **nueva** autorización aplica **desde que se otorga**. Casos:
- Revocar una autorización **necesaria** (`servicio`, `datos_sensibles`, `internacional_ia`) **bloquea evaluaciones nuevas**, pero **no borra la historia ya capturada** (la obligación legal de conservar 15 años manda sobre la revocación; ver Custodia de la historia clínica).
- Una revocación **a media sesión** detiene la captura **desde ese instante**, pero **no descarta lo ya capturado** en la sesión.

**(d) Sellar cada dato con el consentimiento vigente al capturarlo.** Cada dato clínico (o cada sesión/lote) se **sella con el estado de consentimiento vigente en el momento de la captura**. Es la extensión del principio de **constelación de versiones** (`ARCHITECTURE.md` regla 7: `engine_version`, `survey_version_id`, `model_version_id`, `rules_version`) **al consentimiento**: un registro clínico sabe bajo qué autorizaciones se capturó, para que una revocación posterior (hacia adelante) no reescriba la base legal de lo ya capturado.

**Pendiente de Arley (no jurídico, ético):** la **notificación al paciente** en una reasignación es un deber ético del profesional que **varía por disciplina**; queda pendiente de definición de Arley, separado de estas reglas legales.

---

## Flujos del dato por propósito

| Propósito | Nivel de dato | Notas |
|---|---|---|
| Atención clínica (operativo) | Seudonimizado | Atlas es el sistema de registro oficial tras importar y validar el XLSX de Biody. |
| Investigación interna | Seudonimizado | Bajo gobernanza y consentimiento opt-in. |
| Investigación externa / publicación | Anonimizado real | Solo tras anonimización k ≥ 5 + tratamiento de cuasi-identificadores. |
| LLM (Groq/Gemini) | Clínico seudonimizado | Nunca PII. No se usa para entrenar modelos externos. Se loguea modelo y versión de prompt. |
| Comercial (pagos) | Mínimo necesario | Wompi (pasarela), Alegra (contabilidad). |
| Biody Manager / Connect | PII + BIS crudos | Alojamiento en Francia (Aminogram, certificación HDS). Dato en superficie externa; punto de control real es la validación del XLSX al importar a Atlas. |

---

## Sub-encargados del tratamiento

Lista completa de proveedores que tocan datos personales. CNV mantiene o gestiona DPA con cada uno. Lista actualizable con aviso previo al Integrante.

| Proveedor | Qué dato toca | Región / Nota |
|---|---|---|
| Supabase | DB, Auth, Storage (clínico + PII) | **Estados Unidos** (estándar CNV). DPA firmado. EE. UU. en lista de nivel adecuado (Circular SIC 005/2017). |
| Vercel | Hosting (datos en tránsito) | Estados Unidos. DPA. |
| Resend | Correos transaccionales (reportes, invitaciones) | Estados Unidos. DPA. |
| Groq / Gemini | Variables clínicas seudonimizadas para el menú | Estados Unidos. Sin uso para entrenamiento de modelos externos. |
| Wompi | Datos de pago | Colombia. Pasarela. |
| Alegra | Datos de facturación | Colombia. Contabilidad. |
| Aminogram / Biody Manager / Biody Connect | Mediciones BIS + PII en el equipo | **Francia**. Certificación HDS (hosting de datos de salud). Francia (UE) en lista de nivel adecuado. |
| Sentry | Metadatos de errores (IP, agente) | Estados Unidos. DPA. Scrubbing de PHI activo: no debe recibir dato de salud. |
| Cloudflare | DNS, CDN, protección de tráfico (IP) | Estados Unidos. DPA. |
| Upstash | Rate limiting (IP, ID de usuario) | Estados Unidos. DPA. |

**Transferencia vs. transmisión:** como todos actúan como encargados, lo que ocurre es una **transmisión** (no transferencia). Para transmisiones a encargados no se requiere autorización del titular; basta el contrato de transmisión/DPA. PENDIENTE JURÍDICO: verificar suficiencia de cada DPA.

**Estándar de región:** todos los proyectos nuevos de infraestructura en **Estados Unidos** (región US de Supabase, Vercel US, etc.). No mezclar regiones salvo por necesidad justificada documentada.

---

## Retención y borrado

| Categoría | Periodo de retención | Base |
|---|---|---|
| Historia clínica | **15 años** desde la última atención | Resoluciones 1995/1999 y 839/2017 |
| Información comercial y contable | **10 años** | Código de Comercio y normativa tributaria |
| Datos del Integrante | Durante la relación + término de prescripción de acciones derivadas | General |
| Logs técnicos y de seguridad | Según política interna de seguridad (`SECURITY.md`) | — |

PENDIENTE JURÍDICO: ratificación de periodos por categoría, en especial el comercial y los técnicos.

**Derecho al olvido / supresión:** se atiende por **anonimización o desvinculación de identidad**, no destruyendo evidencia clínica sujeta a retención legal. El `clinical_audit_log` es append-only e inmutable; no se borra por solicitud de supresión.

**Biody Manager:** el dato del paciente en el equipo se conserva bajo el consentimiento, no por la propiedad del hardware. El contrato con el Integrante obliga a no borrar ni conservar copias al devolver el equipo.

---

## Derechos del titular

El titular puede: conocer, actualizar, rectificar, suprimir y revocar la autorización, solicitar prueba de la autorización y presentar quejas ante la SIC.

- **Canal:** `protecciondatos@cnvsystem.com`
- **Plazos:** consultas, 10 días hábiles; reclamos, 15 días hábiles (Ley 1581).
- **En MVP:** atención manual (Santiago, con apoyo de la Dirección Científica para lo clínico).
- **Oficial de Protección de Datos:** Santiago Arroyo (CTO / Head de CNV Data). Designación formal en acta de junta directiva (PENDIENTE DE FORMALIZACIÓN).

---

## Incidentes de seguridad

Ver `SECURITY.md` para el procedimiento técnico completo.

- CNV notifica a la SIC dentro de los **15 días hábiles** siguientes a la detección. PENDIENTE JURÍDICO: confirmar plazo exacto.
- Notificación a los titulares afectados sin dilación indebida.
- Post-mortem documentado en `docs/incidents/AAAA-MM-DD-titulo.md`.

---

## Acceso a la historia clínica y auditoría operativa

CNV no es parte del equipo tratante del paciente. Como Encargado:

- **Acceso técnico/operativo** (mantener Atlas, QA, integridad): sobre datos seudonimizados siempre que sea posible; accesos logueados; bajo confidencialidad. Cuando ese acceso alcanza el contenido clínico narrativo (notas de evaluación, diagnóstico o tratamiento), deja de ser irrestricto: pasa por el mecanismo de grants (categoría "soporte técnico"), con causa, expiración y registro. Ya no existe acceso continuo e incondicional del admin a la narrativa.
- **Acceso sustantivo** (mejorar algoritmos, investigación, analítica): finalidad propia de CNV → requiere la autorización del paciente dada directamente a CNV (casillas 4–6 del consentimiento).
- **Auditoría de cumplimiento del modelo:** se realiza mediante el mecanismo de grants (detalle técnico en `SECURITY.md`), en tres niveles. (a) Metadatos y actividad: el `clinical_audit_log`, sin grant. (b) Contenido narrativo **seudonimizado** (sin identidad del paciente), por causa o muestreo basado en riesgo, gateado por un grant temporal y por la precondición de que el profesional del paciente firmó la versión vigente del Anexo 3; nunca monitoreo continuo (tope duro de 90 días). (c) Contenido **identificado**, excepcional (atención de una queja, verificación de una posible desviación grave), por paciente puntual, con motivo obligatorio, aprobación de un tercero, expiración corta (tope duro de 7 días) y registro de solicitud, decisión y uso efectivo. Las tres condiciones de la Cláusula 17 (causa puntual, minimizado, registrado) se materializan en este mecanismo.

**Alcance del cierre (a la fecha de este bloque):** el mecanismo cubre las tres tablas de notas narrativas (`evaluation_notes`, `diagnosis_notes`, `treatment_notes`). El resto de la historia clínica identificada (evaluaciones, mediciones BIS, diagnósticos, tratamientos, reportes, identidad del paciente) todavía tiene acceso amplio del `admin` por RLS. Es una **brecha conocida**, deliberadamente fuera del alcance de este bloque para no agrandarlo; se cerrará extendiendo el mismo mecanismo de grants a esas superficies (ver `BACKLOG.md`, prioridad alta).

---

## Anonimización real (estándar técnico)

Para que un dataset deje de ser dato personal y CNV pueda ser propietaria de los derivados:

1. Suprimir todos los identificadores directos (nombre, documento, celular, correo, `patient_id`).
2. Generalizar cuasi-identificadores: ciudad → región; fecha exacta → rango etario de 5 años; sexo puede conservarse si k ≥ 5.
3. Verificar k-anonimato: ningún registro debe ser único en la combinación de cuasi-identificadores. **k ≥ 5** para exports externos.
4. Para atributos sensibles (diagnóstico, indicadores de riesgo): verificar l-diversidad.
5. Documentar el proceso de anonimización y el dataset resultante en `research_datasets`.

PENDIENTE JURÍDICO: ratificación del umbral k ≥ 5 y del método.

---

## Menores de edad

El MVP **soporta pacientes menores de 18 años**. El consentimiento de ATLAS incluye el bloque de representante legal (identificación, parentesco o calidad) y, para pacientes entre 14 y 17 años, el asentimiento del propio menor (ver Consentimiento de ATLAS, sección 11). **Pendiente técnico:** Atlas debe validar la fecha de nacimiento en el flujo de la encuesta para activar automáticamente este bloque en lugar de la declaración de mayoría de edad, y registrar los campos adicionales (`legal_representative_name`, `legal_representative_document`, `legal_representative_relationship`) en `patient_consents` o tabla relacionada.

---

## Hallazgos de la tabla `patient_consents` (pendientes de implementación)

1. **Falta campo `revoked_at`** (o equivalente `status`) para registrar la revocación de cada autorización. Añadir en B1 (esquema y RLS).
2. **Convención de `consent_type`:** un registro por tipo de autorización (`servicio`, `datos_sensibles`, `internacional_ia`, `investigacion`, `comunicaciones_continuidad`, `comunicaciones_comerciales`).
3. **Tabla `devices`:** añadir columnas `brand` y `model` (el `asset_code` es agnóstico del fabricante; la marca y modelo van en campos separados).

---

## Formato y control documental

Los documentos de gobernanza y consentimiento de CNV tienen una **fuente de verdad única en formato Markdown** (`.md`), versionada en el repositorio de Atlas: `DATA_GOVERNANCE.md` (este documento) y `CONSENT_ATLAS.md`. Cualquier copia en Word o PDF de estos documentos (usada para revisión del asesor jurídico, presentación a la Junta, o auditorías) es una **copia de trabajo derivada**, no una versión independiente. Cuando el asesor jurídico aprueba cambios sobre una copia de trabajo, dichos cambios deben reflejarse de vuelta en el `.md` correspondiente antes de considerarse vigentes. Nunca deben coexistir dos versiones "oficiales" divergentes del mismo documento en distinto formato.

---

## Roles y gobernanza interna

- **Oficial de Protección de Datos / Responsable técnico:** Santiago (CTO / Head de CNV Data). Monitorea `protecciondatos@cnvsystem.com`. Designación por acta de junta (PENDIENTE).
- **Autoridad científica del dato clínico:** Dirección Científica (Gildardo).
- **Cambios de gobernanza:** se documentan primero en este archivo, con justificación, y luego se implementan. Los cambios sustantivos se registran en el Registro de Decisiones.
- **Incidentes:** Santiago coordina; ver procedimiento en `SECURITY.md`.

---

## Lo que la revisión jurídica debe confirmar (lista consolidada)

1. Solidez del mapa de roles (Responsable profesional / Encargado CNV en capa asistencial).
2. Suficiencia de los DPA de cada sub-encargado.
3. Ratificación del plazo de notificación de incidentes a la SIC (referencia: 15 días hábiles).
4. Ratificación de los periodos de retención por categoría.
5. Ratificación del estándar de anonimización (k ≥ 5).
6. Aplicabilidad o no del RNBD (umbral de activos: 100.000 UVT ≈ COP 5.200M para 2026).
7. Estatus INVIMA del equipo Biody BIS y sus implicaciones para el comodato (en pausa por revisión jurídica en curso).

---

## Registro de decisiones

| # | Fecha | Decisión | Razón |
|---|---|---|---|
| 1 | 2026-06 | **Mapa de roles:** Responsable (profesional) / Encargado (CNV) en capa asistencial; CNV Responsable autónomo en capa secundaria. | Protege a CNV de ser configurada como prestador de salud o corresponsable clínico. |
| 2 | 2026-06 | **Propiedad de datos:** CNV solo es propietaria de derivados anonimizados y datos no personales. No de datos personales. | Ley 1581; los datos personales pertenecen a sus titulares. |
| 3 | 2026-06 | **Región estándar de infraestructura:** Estados Unidos (Supabase US, Vercel US). | EE. UU. en lista de nivel adecuado SIC; ecosistema CNV ya alojado ahí; simplifica gestión. |
| 4 | 2026-06 | **Retención HC:** 15 años desde la última atención. | Resoluciones 1995/1999 y 839/2017. |
| 5 | 2026-06 | **Supresión por anonimización:** el derecho al olvido se atiende desvinculando identidad, no destruyendo evidencia clínica. | Obligación legal de retención de HC. |
| 6 | 2026-06 | **k-anonimato ≥ 5** como estándar para exports externos. Sujeto a ratificación jurídica. | Práctica internacional; equilibrio entre privacidad y utilidad investigativa. |
| 7 | 2026-06 | **MVP restringido a mayores de 18 años.** Flujo de menores en v1.1. | Reducir complejidad de arranque; menores requieren flujo de representante legal. |
| 8 | 2026-06 | **Lenguaje estandarizado:** Atlas "calcula, clasifica, estima"; el profesional "diagnostica"; Biody BIS es equipo de "composición corporal / bienestar funcional"; sin claims de enfermedad. | Protección regulatoria (INVIMA, ATLAS como no-dispositivo médico); autonomía profesional. |
| 9 | 2026-06 | **Biody Manager / Connect aloja en Francia (Aminogram, HDS).** Transmisión válida por DPA con encargado; Francia (UE) en lista de nivel adecuado. | Hallazgo al cruzar con API_INTEGRATIONS. Ajustado en Anexo 3 v1.1 y consentimiento v1.1. |
| 10 | 2026-06 | **Consentimiento por capas:** autorizaciones necesarias separadas de opcionales. Datos sensibles: facultativos (art. 6 Ley 1581). | Validez del consentimiento libre; exigencia legal expresa. |
| 11 | 2026-06 | **Comodato y contratos con profesionales: en pausa** hasta resolución jurídica del estatus de importación del Biody BIS. | Equipos sin declaración de importación; revisión con asesor jurídico en curso. |
| 12 | 2026-06 | **Speech CNV:** operar bajo finalidad no médica alineada con el fabricante (composición corporal / bienestar funcional), asumiendo riesgo residual del discurso de analítica/ciencia. Ajuste de web pendiente. | Decisión de junta/equipo CNV. |
| 13 | 2026-07 | **Investigación restringida a datos seudonimizados** (nunca identificables) y acotada a datos clínicos/funcionales estructurados, excluyendo notas en texto libre del profesional salvo autorización adicional. | Minimización (Ley 1581); coherencia con Anexo 3 v1.5 y Consentimiento v1.4. |
| 14 | 2026-07 | **Custodia de HC:** obligación legal es del Integrante; CNV solo aloja como Encargado mientras dura el contrato, con portabilidad garantizada a la terminación. | Evita que CNV fuerce al Integrante a incumplir su deber de custodia (Res. 1995/839). |
| 15 | 2026-07 | **MVP soporta pacientes menores de edad** mediante bloque de representante legal (con asentimiento 14-17 años) en el Consentimiento de ATLAS. Revierte la decisión anterior de diferir a v1.1 post-MVP. | Diferirlo generaba mayor riesgo acumulado que implementarlo desde el MVP. |
