# MVP de Atlas (CNV)

**Versión:** 1.0
**Estado:** alcance congelado
**Deadline objetivo:** martes 30 de junio de 2026 (MVP que haya pasado smoke + tests). Se planea por bloques, no por fechas.
**Acompaña a:** `ARCHITECTURE.md` (el cómo técnico). Este documento define el qué y el mínimo funcional por módulo.

## Principio rector
MVP robusto pero mínimo: el núcleo clínico, los datos, la seguridad y la trazabilidad van blindados; todo lo demás, lo mínimo viable. Calidad sobre velocidad: si hay que pasarse del deadline, se pasa, antes que enviar algo frágil, sobre todo en el motor clínico.

## Roles
Internos CNV: Admin, Dirección, Soporte, Obbia/Research.
Externo: Profesional de salud aliado.
Paciente: no inicia sesión. Solo llena la encuesta pública (inicial y de seguimiento) y recibe reportes, guía alimentaria y checkout por correo.

## Ruta de atención ANI-BIS-E
Evaluación, Diagnóstico, Tratamiento, Seguimiento.

## Tabla de mínimo funcional por módulo
Prioridad: Núcleo (pulido), Importante (funcional), Ligero (mínimo viable).
Espera HTML: Sí (congelado hasta Gildardo), Parcial (la infra avanza ya), No (libre).

| Módulo | Prioridad | Espera HTML | Mínimo funcional MVP |
|---|---|---|---|
| clinical-engine | Núcleo | Sí | Port fiel de indicadores, clasificaciones, mapas y Diana, con golden tests en verde; versión interna; server-side. |
| auth | Núcleo | No | Login con correo propio del profesional; admin crea cuentas y asigna rol; set-password por invitación; recuperación forzada por admin; MFA para admin/internos; RLS por rol; sin auto-registro. |
| model-registry | Núcleo | Parcial | Una versión activa del modelo y sus entidades (variables, indicadores, clasificaciones, reglas, mapas); sella la versión en cada registro. Asignación de versión por profesional, post-MVP. Contenido depende de Gildardo. |
| patients | Núcleo | No | `patients` (identidad mínima) y `patient_profiles` (PII); resolución de identidad en el intake; consentimiento versionado; relación paciente-profesional. |
| professionals | Núcleo | No | Registro por admin; perfil; estado de habilitación (gate de certificación); `commission_rate` editable (default 20%); vínculo a `auth.user`. |
| evaluations (encuesta) | Núcleo | Parcial | Infra libre: flujo QR público con token opaco, auto-fill del profesional, recolección pura, `survey_version` sellada, dos modos (inicial/seguimiento), orquestación encuesta+BIS+cálculo. Contenido de la encuesta congelado. |
| bis | Núcleo | Parcial | Import del XLSX de Biody Manager (Zod, rangos, `bis_import_logs`) e ingreso manual; persistir valores crudos; vincular a evaluación. Necesita un XLSX de muestra real. |
| indicators | Núcleo | Sí | Llama al clinical-engine con crudos y respuestas; persiste `indicator_values` con la constelación de versiones. |
| diagnosis | Núcleo | Sí | Ubica en la salida de la Diana; registra diagnóstico con versión; visualiza indicadores, mapas y guías; el profesional confirma y registra; snapshot; IA de apoyo mínima. |
| treatment | Núcleo | No (depende de diagnosis) | Registrar ruta de intervención, nutracéuticos sugeridos/usados, guías alimentarias, observaciones, derivaciones; vinculado al diagnóstico. |
| reports | Núcleo | Parcial | Reporte clínico del paciente (PDF, snapshot inmutable, enviado tras aprobación con preview y audit). Reportes de profesional y agregado del modelo, más ligeros. |
| audit | Núcleo | No | `clinical_audit_log` append-only inline; engancha ciclo de vida y acciones sensibles; vista de auditoría para admin. |
| comodato | Importante | No | `devices` (asset_code, manufacturer_serial, system_email, status) y `device_assignments` (fechas, `ON DELETE RESTRICT`, estado de contrato); historial; query de comodatos por vencer. |
| nutraceuticals | Importante | No | Catálogo, inventario (stock), registro de uso/recomendación, vínculo a tratamiento. |
| payments | Importante | Parcial | Checkout (link/QR 24h, token, orden+monto, idempotencia), webhook Wompi (HMAC), registrar transacción, factura Alegra. Necesita sandbox de Wompi y Alegra. Comisiones, ligero. |
| followup | Importante | Sí (reusa el ciclo) | Marcar evaluación como seguimiento (repite encuesta+BIS) y comparación básica. Visualización longitudinal rica, ligera. |
| research-datasets | Ligero | No | Export anonimizado/agregado gobernado para ObBIA. Mínimo en MVP. |

## Flujos transversales (decisiones congeladas)

### Consentimiento, gate de autorización y mayoría de edad
- **Consentimiento por capas:** antes de la encuesta (inicial y seguimiento) se presenta el consentimiento por capas: intro corta, tres casillas necesarias (`servicio`, `datos_sensibles`, `internacional_ia`) que habilitan "continuar", tres casillas opcionales que se registran de forma independiente, y "ver más" con el texto completo. Las casillas no vienen pre-marcadas. El `document_hash` cubre el texto de cara al paciente, no el resumen (ver `CONSENT_ATLAS.md`).
- **Gate de autorización (regla dura 15):** Atlas verifica que las tres autorizaciones necesarias estén presentes y vigentes (`consent_type IN ('servicio','datos_sensibles','internacional_ia')` y `revoked_at IS NULL`) antes de crear cualquier evaluación. Si falta una, bloquea y solicita renovación. Aplica también al seguimiento; si la versión del consentimiento subió de número MAYOR, se requiere re-consentir. Vive en la policy `evaluations/can-create-evaluation`, no como chequeo suelto.
- **Mayoría de edad:** el MVP opera solo con mayores de 18. El flujo de la encuesta valida la declaración de mayoría de edad (`CONSENT_ATLAS.md`, sección 11) antes de continuar.

### Encuesta y resolución de identidad
- Dos modos: inicial (paciente nuevo) y seguimiento (paciente conocido).
- QR público con token opaco; auto-fill del profesional; recolección pura (sin scoring ni lógica condicional en la encuesta).
- No se le pregunta al paciente "inicial o seguimiento". Atlas resuelve la identidad por documento exacto: si coincide con un paciente existente, es seguimiento; si no coincide, es inicial. El label es derivado.
- Posible duplicado (sin match exacto pero alta similitud de nombre/fecha de nacimiento): Atlas levanta alerta, el profesional resuelve, nunca fusión automática.
- El profesional confirma la identidad antes de finalizar la evaluación (red de seguridad ante typos del paciente).

### Link de seguimiento pre-llenado
- Lo emite el profesional para un paciente específico; pre-carga campos estables (ciudad, celular), editables.
- No expira por tiempo; se vence al completar la encuesta; colchón por defecto de 30 días.
- Donde el profesional genera el enlace, advertencia visible del colchón de 30 días.
- Sin contraseña; la red de seguridad real es la confirmación de identidad aguas abajo.
- Token de seguimiento: un solo uso, atado a paciente+evaluación, pre-fill mínimo. Distinto del link genérico inicial (que no carga PII de nadie).

### Clasificación de campos (3 niveles)
- Identificador directo (nombre, cédula, celular): nunca al LLM ni al export de investigación; cifrado/aislado.
- Cuasi-identificador (ciudad, fecha de nacimiento, sexo): puede ir al LLM si tiene valor clínico; se generaliza en el export de investigación.
- Clínico (estilo de vida, hábitos, síntomas): necesario en todas partes.
- Se guarda como metadato por pregunta en `survey_questions` y maneja automáticamente LLM, anonimización y cifrado.

### IA de apoyo
- Al nivel del HTML actual: resume los indicadores en una explicación profesional con recomendaciones sencillas; el profesional decide seguirla o no.
- Sin PII al LLM (solo variables clínicas seudonimizadas). Esto endurece el manejo de datos, no cambia la lógica clínica.
- Registra modelo y versión de prompt; nunca auto-aplicada.

### Reportes al paciente
- PDF con snapshot inmutable, enviado solo tras aprobación del profesional (con preview), envío auditado, adjunto por correo.

### Comisiones
- `commission_rate` por profesional, default 20%, editable por admin. Se sella la tasa aplicada en cada registro de ingreso/comisión (snapshot); cambiar la tasa no recalcula comisiones pasadas.

### Trazabilidad y evidencia
- Cada registro clínico guarda la constelación de versiones (engine, survey, model, rules) y su snapshot.
- `clinical_audit_log` append-only e inline.

### Autenticación
- Sin auto-registro; correo propio del profesional; set-password por invitación; MFA admin/internos en MVP, profesionales post-MVP; offboarding por desactivación y reasignación (no se recicla la cuenta).

## Recortes de alcance (deliberados)
- IA mínima (nivel HTML).
- Comisiones simples (cálculo ligero; el checkout es el núcleo de payments).
- No hay portal ni login de paciente.
- Visualización longitudinal de seguimiento, ligera.
- research-datasets, ligero (solo export gobernado).

## Dependencias externas (no son Gildardo, destrabar ya)
- XLSX de muestra real de Biody Manager (cierra el esquema de import de `bis`).
- Credenciales/sandbox de Wompi y Alegra (tienen tiempo de aprobación; empezar el registro ya).

## Plan de bloques
Se avanza por bloques con dependencias, no por calendario. Cada bloque tiene criterio de aceptación verificable; no se pasa al siguiente sin cumplirlo. Los bloques B0 a B10 no dependen del HTML final de Gildardo; B11 en adelante sí (excepto que B9 ya construye el motor con un stub para no esperar).

### B0, Setup técnico
Scaffold Next.js + TS + Tailwind, config de supply-chain (pnpm), Drizzle, Sentry (con scrubbing de PHI), proyecto Supabase (dev), Vercel, DNS Cloudflare, env vars.
**Criterio:** `atlas.cnvsystem.com` responde; Sentry captura un error provocado (sin PHI); el cliente Supabase consulta una tabla de prueba.

### B1, Datos y RLS
Esquema completo (Drizzle para DDL, SQL crudo para RLS/triggers/funciones/enums), helpers con hardening, el trigger append-only del audit, seed determinístico.
**Criterio:** el seed carga; queries sin sesión fallan por RLS; con sesión, cada rol ve solo lo suyo; UPDATE/DELETE sobre `clinical_audit_log` falla incluso con service role; el esquema incluye `revoked_at` en `patient_consents` y el enum `consent_type_enum`.

### B2, Auth y roles
Login con correo propio del profesional, invitación para fijar contraseña, MFA para admin/internos, recuperación forzada por admin, RLS por rol, sin auto-registro.
**Criterio:** admin crea usuario y asigna rol; el profesional fija su contraseña por invitación; MFA admin funciona; sin sesión redirige a login; un rol sin permiso ve "no autorizado".

### B3, Layout y marca
Shell adaptativo por rol, `BRAND.md` aplicado (ink + azul, Inter), error boundary, 404.
**Criterio:** la navegación renderiza con la marca; una URL inexistente muestra 404 con marca; un error provocado queda en Sentry.

### B4, Comodato e inventario de equipos
`devices` (asset_code, manufacturer_serial, system_email, status), `device_assignments` (con `ON DELETE RESTRICT`, estado de contrato), historial, query de comodatos por vencer.
**Criterio:** admin crea un equipo, asigna comodato, ve historial y los que vencen en 30 días; estado del equipo y del contrato se manejan por separado.

### B5, Nutracéuticos e inventario
Catálogo, inventario (stock), registro de uso/recomendación.
**Criterio:** se crea un nutracéutico, se ajusta stock y se registra un uso vinculado a un tratamiento.

### B6, Pagos (Wompi y Alegra)
Checkout (token, 24h, orden + monto, idempotencia), webhook Wompi (HMAC), transacción, factura Alegra, comisión con tasa sellada.
**Criterio (sandbox):** checkout end-to-end (pago, webhook, transacción, factura); un webhook duplicado produce un solo efecto; la comisión queda sellada con la tasa del momento.

### B7, Encuesta e identidad
QR público con token opaco, recolección pura, `survey_version`, dos modos (inicial/seguimiento), resolución de identidad por documento, alerta de posible duplicado, link de seguimiento pre-llenado (un uso, colchón 30 días). El contenido de la encuesta es placeholder hasta Gildardo; la infra se construye ya.
**Criterio:** el paciente llena la encuesta vía QR; Atlas resuelve inicial vs seguimiento por documento; un parecido sin match exacto genera alerta; el profesional confirma la identidad; no se crea evaluación sin las tres autorizaciones necesarias vigentes (gate, regla dura 15) y se valida la mayoría de edad (+18).

### B8, Import BIS (XLSX)
Import del export de Biody Manager con SheetJS, validación Zod + rangos, `bis_import_logs`, persistencia de crudos.
**Criterio:** un XLSX de muestra se valida, persiste los crudos y registra el log; un archivo malformado se rechaza con detalle.

### B9, Motor stub, contrato y propagación
Definir el contrato (`EngineInput` → `EngineOutput`), implementar un stub que lo honra, cablear la ruta encuesta → BIS → indicadores → diagnóstico → tratamiento → reporte contra el stub, tests de propagación. No espera a Gildardo.
**Criterio:** la ruta completa fluye con el stub sin perder ni mezclar datos; los tests de propagación pasan.

### B10, Reportes
Reporte clínico del paciente (PDF, snapshot inmutable, aprobación con preview + envío auditado + adjunto por correo); reportes de profesional y agregado, ligeros.
**Criterio:** el profesional aprueba y envía; el PDF llega por correo; el snapshot queda inmutable; el envío se audita.

### Frontera: entrega del HTML final por Gildardo

### B11, Port del motor real y golden tests
Inventario fino, captura de valores oro, port a TS en `clinical-engine`, golden tests en verde, firma de muestra por Gildardo, poblar el `model-registry` (cortes, mapas, 81 estados EFR), cambiar stub por motor real.
**Criterio:** golden tests en verde (paridad con el HTML); Gildardo firma la muestra; el `model-registry` queda poblado; la propagación del B9 sigue pasando con el motor real.

### B12, Indicadores y diagnóstico reales
`indicator_values` con constelación de versiones, `diagnoses` con fenotipo/sector/estado EFR, visualización (incluida la Diana), IA del menú (sin PII), confirmación del profesional.
**Criterio:** una evaluación real produce indicadores, Diana y diagnóstico correctos (contra golden), con su constelación de versiones; el profesional confirma.

### B13, Tratamiento y seguimiento
Generador de protocolo, `treatment_*`, `followups` con comparación básica (el seguimiento repite el ciclo).
**Criterio:** el profesional registra un tratamiento; un seguimiento repite el ciclo y compara contra la evaluación previa.

### B14, Paneles
Admin (usuarios/roles, comodato, auditoría, **config de IA: cambiar proveedor/modelo y ver/editar el prompt versionado**), dirección (dashboards consolidados), obbia (data agregada, sin PII).
**Criterio:** cada rol opera lo suyo; admin cambia el proveedor de IA y ve/edita el prompt creando una versión nueva auditada; obbia no accede a PII.

### B15, Pulido y seguridad final
Headers/CSP, rate limiting, scrubbing de PHI, revisión de seguridad, smoke E2E completo.
**Criterio:** el smoke end-to-end pasa; sin errores recurrentes en Sentry en 24h; checklist de seguridad cumplido; checklist documental de DPA de sub-encargados archivados.

## Criterio de aceptación del MVP
- Ruta ANI-BIS-E completa funcionando con un caso real.
- Golden tests del motor en verde (paridad con el HTML, muestra firmada por Gildardo).
- RLS verificada por rol; tests de policies en verde.
- Seguridad baseline v1 cumplida.
- Checkout end-to-end (pago, webhook, transacción, factura Alegra).
- Smoke, `tsc --noEmit`, lint y tests en verde.

## Items abiertos
- Texto y versión final del consentimiento informado (pendiente de revisión jurídica).
- Marco legal y ético del dato (retención, comodato): chat dedicado y revisión jurídica.

Decididos (ya no abiertos): residencia del dato en Estados Unidos (`DATA_GOVERNANCE.md` decisión #3); gestor de secretos Bitwarden (plan Free).
