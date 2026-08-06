# DECISIONES_LEGALES.md — Qué decidió CNV sobre los datos de sus pacientes

**Para quién es.** Para el área jurídica (interna y el asesor externo). Reúne, en lenguaje de personas, las decisiones de CNV que afectan datos de pacientes u obligaciones legales de la empresa. Es el índice legal: cada decisión se enuncia en una o dos frases y apunta a dónde vive el detalle. No reemplaza a los documentos técnicos ni al consentimiento; los ordena.

**Relación con lo que ya existe (qué gobierna qué).**
- `DECISIONES_ANIBISE.md` gobierna las decisiones **clínicas** (el modelo de Gildardo, numeración `D-NNN`). Este documento es su **paralelo legal**. Donde una decisión es a la vez clínica y legal (por ejemplo, qué se le comunica al paciente), la entrada legal apunta a la clínica y agrega la lente jurídica.
- `DATA_GOVERNANCE.md` tiene el **detalle técnico** de la gobernanza (leyes citadas, tablas, estándares). Este documento no lo repite: apunta a él.
- `CONSENT_ATLAS.md` es el **consentimiento que firma el paciente**; `PLAN_GRANTS.md` la implementación del **acceso del personal**; `SECURITY.md` los **controles**. Son anexos de este índice.

**Cómo leer el estado.** *Decidida* (CNV la tomó) · *Implementada* (además está en el sistema) · *Ratificada* (además la confirmó el asesor jurídico externo). Fecha = cuándo se tomó.

**Regla de no duplicación.** Si una entrada aquí y su fuente dicen lo mismo con palabras distintas, en seis meses divergen. Cada entrada apunta al detalle; no lo copia.

---

## AL FRENTE: lo que falta ratificar (esto es lo que el asesor externo debe leer)

Todo lo demás es contexto ya decidido. Esto es lo abierto.

**A. Preguntas que esperaban revisión desde antes (lista consolidada de `DATA_GOVERNANCE.md`, pendientes desde ~2026-06/07).** El dictamen de acceso (2026-08-06) resolvió dos de las siete; siguen abiertas cinco:
1. **Suficiencia de los acuerdos con cada sub-encargado** (los terceros que procesan datos por cuenta de CNV: Supabase, Vercel, el fabricante del equipo, el servicio de correo). El dictamen de acceso no las tocó.
2. **Plazo para notificar un incidente de seguridad a la autoridad** (referencia usada: 15 días hábiles a la SIC). Sin ratificar.
3. **Estándar de anonimización** para lo que sale a investigación (referencia usada: que ningún dato pueda aislar a menos de 5 personas). El dictamen concedió que quitar el nombre no basta, pero no ratificó este umbral concreto.
4. **Si CNV debe inscribirse en el Registro Nacional de Bases de Datos** (depende de un umbral de tamaño de la empresa). Sin evaluar por el jurídico.
5. **Estatus del equipo Biody ante el INVIMA.** La pausa sobre el comodato se RESOLVIÓ (comodato y contratos firmados, 2026-08; los integrantes ya firman); queda, si aplica, la confirmación del estatus regulatorio del equipo en sí.

**B. Lo que el dictamen de acceso deja para el asesor externo (2026-08-06):**
6. **La conclusión de la Pregunta 1:** conservar el nivel de acceso seudonimizado (ver dato clínico sin identidad) en lugar de eliminarlo, porque el consentimiento del paciente le da un alcance propio. Es el punto donde el dictamen se apartó de la propuesta del equipo.
7. **Si el permiso de auditoría de calidad de hasta 90 días es defendible** una vez acotado su objeto a una muestra o cohorte declarada.
8. **Confirmación de dos decisiones que CNV ya tomó:** conservar el registro de accesos quince años, y que soporte técnico opere con el número de documento más registro de la consulta (en vez de un identificador interno). Ver categorías Retención y Acceso.

**C. Lo que el jurídico debería mirar y hoy solo está del lado clínico:**
9. **Qué se le comunica al paciente sobre su salud y cómo** (categoría Comunicación al paciente). Está decidido como asunto clínico; el jurídico tiene algo que decir sobre comunicar, o retener, información de salud a su titular.

**Naturaleza y momento de lo pendiente (importa para el orden de construcción).** Las cinco confirmaciones abiertas de (A) son de CUMPLIMIENTO REGULATORIO (registro de bases de datos, notificación de incidentes, estándar de anonimización, acuerdos con proveedores, estatus del equipo ante el INVIMA), no de diseño del sistema. **Ninguna bloquea construir, y ninguna bloquea el Hito 2:** bloquean OPERAR CON PACIENTES REALES, que es el Hito 3. Se revisó si alguna tocaba antes: la del comodato parecía condicionar el Hito 2 (el comodato es cómo se vinculan los integrantes), pero está RESUELTA (comodato y contratos firmados, 2026-08; ver `DATA_GOVERNANCE.md` registro #11). Así que las cinco son gate del Hito 3.

---

## 1. Roles de tratamiento (quién es responsable de qué)

- **CNV no es el prestador de salud; es quien provee la plataforma.** El profesional que atiende es el responsable de la historia clínica; CNV la aloja por encargo suyo mientras dura el contrato. En investigación, CNV sí decide por su cuenta, sobre datos ya sin identidad. *Ratificada por el dictamen de acceso (2026-08-06), que confirma que CNV no integra el equipo tratante.* Detalle: `DATA_GOVERNANCE.md` (mapa de roles), decisión de registro #1.
- **Los datos personales del paciente son suyos, no de CNV.** CNV solo es dueña de lo anonimizado y de lo no personal. *Decidida 2026-06.* Detalle: `DATA_GOVERNANCE.md` registro #2.
- **CNV no dice "diagnostica" ni habla de enfermedad.** El sistema calcula, clasifica y estima; el profesional diagnostica; el equipo mide composición corporal y bienestar, no enfermedad. *Decidida 2026-06.* Detalle: `DATA_GOVERNANCE.md` registro #8, `ARCHITECTURE.md`.

## 2. Consentimiento

- **El paciente autoriza por capas: lo necesario para el servicio, separado de lo opcional.** Los datos sensibles y los usos opcionales (como investigación) se piden aparte y son facultativos. *Implementada (Consentimiento v1.6).* Detalle: `CONSENT_ATLAS.md`, `DATA_GOVERNANCE.md` registro #10.
- **El consentimiento se guarda con su versión, su texto sellado y la fecha, sin poder alterarlo después.** Si el paciente revoca, se respeta hacia adelante sin borrar la historia clínica. *Implementada.* Detalle: `CONSENT_ATLAS.md` (revocación), `ARCHITECTURE.md`.
- **Sin las autorizaciones vigentes necesarias no se hace una evaluación.** Es una barrera del sistema, no una política de papel. *Implementada (regla dura 15).* Detalle: `ARCHITECTURE.md`, `CONSENT_ATLAS.md` numeral 4.

## 3. Acceso del personal de CNV a la historia clínica

- **Ningún empleado de CNV ve contenido clínico por el solo hecho de su cargo.** Para verlo pide un permiso puntual, con motivo, que aprueba otra persona, por tiempo limitado y con registro. *Decidida (dictamen 2026-08-06); implementada solo para las notas de texto libre; el resto en construcción.* Detalle: `PLAN_GRANTS.md`, `SECURITY.md`, dictamen.
- **Hay dos niveles de acceso, según lo que autorizó el paciente.** Uno sin identidad, para control de calidad rutinario; otro con identidad, solo para casos excepcionales. El nivel sin identidad se conserva (no se eliminó), y se acota a una muestra o cohorte declarada, no a "todos los pacientes". *Decidida (dictamen); pendiente de ratificar la conservación y el alcance (ver AL FRENTE 6 y 7).* Detalle: `PLAN_GRANTS.md`, dictamen Pregunta 1 y observación B.
- **El rol administrativo pierde el acceso amplio que tenía.** Si necesita ver algo, lo pide como cualquiera. *Decidida (dictamen Pregunta 2).* Detalle: `PLAN_GRANTS.md`.
- **Soporte técnico ve solo el número de documento del paciente, sin nombre ni contenido clínico, y esa consulta queda registrada.** Un identificador interno protegería más y queda como mejora para cuando la red crezca. *Decidida (dictamen Pregunta 3); ratificación pendiente (AL FRENTE 8).* Detalle: `PLAN_GRANTS.md` decisión 3.

## 4. Retención y borrado

- **La historia clínica se conserva quince años desde la última atención**, aunque el paciente revoque autorizaciones. *Decidida 2026-06, confirmada contra la norma por el dictamen (que corrigió el mito de los 20 años).* Detalle: `DATA_GOVERNANCE.md` registro #4, dictamen.
- **El registro de quién accedió a la historia clínica se conserva también quince años.** Si años después hay una controversia, se puede reconstruir quién vio qué. *Decidida 2026-08-06; ratificación pendiente (AL FRENTE 8).* Detalle: `PLAN_GRANTS.md` decisión 4, `SECURITY.md`.
- **El derecho al olvido se atiende quitando la identidad, no destruyendo la evidencia clínica.** La ley obliga a conservar la historia; se desvincula al titular, no se borra el registro. *Decidida 2026-06.* Detalle: `DATA_GOVERNANCE.md` registro #5, `ARCHITECTURE.md`.

## 5. Anonimización y seudonimización

- **Quitar el nombre no anonimiza; hay que tratar también los datos que, combinados, identifican** (peso, talla, edad, sexo). Lo que se usa a diario lleva la identidad separada por diseño; lo que sale a investigación se anonimiza de verdad. *Decidida; el umbral concreto de anonimización sigue sin ratificar (AL FRENTE 3).* Detalle: `DATA_GOVERNANCE.md` (anonimización real), `ARCHITECTURE.md`.

## 6. Comunicación al paciente (qué se le dice sobre su salud, y cómo)

- **La "edad" que estima el sistema nunca se le muestra al paciente.** Va solo al profesional, marcada como no comunicable mientras la calibración sea provisional. *Decidida como asunto clínico (D-011); su dimensión legal no está revisada (AL FRENTE 9).* Detalle: `DECISIONES_ANIBISE.md` D-011.
- **El cambio entre una medición y la siguiente se le comunica en tres mensajes cerrados (mejoró / sin cambio / empeoró), sin cifras.** Un empeoramiento solo se comunica si el profesional lo confirma y agenda una próxima cita. *Decidida como asunto clínico (D-010), sin implementar.* Detalle: `DECISIONES_ANIBISE.md` D-010.
- **El reporte lleva siempre el rótulo de que no constituye un diagnóstico.** El diagnóstico lo hace el profesional. *Implementada.* Detalle: `DECISIONES_ANIBISE.md` (lenguaje), reporte del paciente.

## 7. Menores de edad

- **La plataforma admite pacientes menores desde el arranque, con bloque de representante legal y asentimiento del propio menor entre 14 y 17 años.** *Implementada (revierte la decisión previa de diferirlo).* Detalle: `DATA_GOVERNANCE.md` registro #15, `DELTA2.md`, `CONSENT_ATLAS.md` numeral 11.

## 8. Investigación (uso secundario de los datos)

- **La investigación solo usa datos sin identidad y acotados a lo estructurado; no toca las notas de texto libre del profesional salvo autorización adicional.** *Decidida 2026-07.* Detalle: `DATA_GOVERNANCE.md` registro #13.

## 9. Transferencia internacional de datos

- **La infraestructura está en Estados Unidos y el equipo de medición transmite desde Francia; ambos países están en la lista de nivel adecuado y cubiertos por acuerdos de encargo.** *Decidida 2026-06.* Detalle: `DATA_GOVERNANCE.md` registros #3 y #9, `API_INTEGRATIONS.md`.
- **El uso de sistemas automatizados (IA) nunca recibe datos que identifiquen al paciente.** Solo variables clínicas seudonimizadas. *Implementada (regla dura).* Detalle: `CONSENT_ATLAS.md` numerales 6 y 7, `ARCHITECTURE.md`.

## 10. Sub-encargados del tratamiento

- **Cada tercero que procesa datos por cuenta de CNV debe tener su acuerdo de tratamiento.** *Decidida; la suficiencia de cada acuerdo sigue sin ratificar (AL FRENTE 1).* Detalle: `DATA_GOVERNANCE.md` (sub-encargados).

## 11. Incidentes de seguridad

- **Un incidente que afecte datos personales se notifica a la autoridad y a los afectados.** *Decidida; el plazo exacto de notificación sigue sin ratificar (AL FRENTE 2).* Detalle: `DATA_GOVERNANCE.md` (incidentes).

## 12. Verificación de identidad antes de intervenir una cuenta

- **Antes de reiniciarle el segundo factor o forzarle el cambio de clave a un profesional, se verifica su identidad por una vía distinta de la que usó para pedirlo.** Un correo no verifica a nadie. *Decidida (línea de proceso, 2026-08-05).* Detalle: `SECURITY.md`.

---

## Registro de ratificación

*Esta sección se completa cuando el asesor jurídico externo revise el documento. No se elimina: deja constancia de que las decisiones sobre datos de salud pasaron por revisión jurídica, lo que es evidencia bajo el principio de responsabilidad demostrada de la Ley 1581 de 2012. Los documentos que registran un acto de comunicación no se editan en su cuerpo; una corrección posterior se anota fechada al pie.*

- **Revisado por:** `__________`
- **Fecha:** `__________`
- **Concepto:** ☐ Ratificado sin observaciones  ☐ Ratificado con las observaciones anexas
- **Observaciones:** `__________`
