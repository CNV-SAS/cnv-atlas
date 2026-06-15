# BACKLOG.md — Post-MVP de Atlas (CNV)

**Versión:** 1.0
**Propósito:** registrar lo que deliberadamente NO va en el MVP, para que no se pierda ni se cuele. Cada vez que decimos "esto no va ahora", queda aquí.

## Clínico y modelo
- **Diana como reglas declarativas gobernadas.** En MVP se porta como datos (ya lo es en el v7). La evolución a un motor de reglas gobernado con flujo de aprobación es post-MVP, y solo si pasa por CI/tests/aprobación (mover lógica clínica a "configuración" sin ese control reubica el riesgo).
- **Modelado formal de PBI (9 estados) y EIEC** como catálogos del registry (se difirió para confirmarlos con Gildardo al portar).
- **Asignación de versión del modelo por profesional/organización** (ej. Doctor A con v1.1, Doctor B con v1.0). En MVP hay una sola versión activa.
- **Análisis epigenético de laboratorio** (en MVP solo se capturan respuestas de encuesta).

## Datos e investigación
- **Capa de interoperabilidad FHIR (HL7).** Export/import de recursos FHIR (Patient, Practitioner, Observation, Condition/DiagnosticReport, CarePlan, Consent) para interoperar con EHRs, labs o compartir data de investigación. En MVP el esquema se mantiene conceptualmente FHIR-friendly, pero no FHIR-nativo (sería sobre-ingeniería ahora).
- **Infraestructura de datasets de investigación** versionados y reproducibles para ObBIA (en MVP solo exports gobernados).
- **Capa científica en Python** para analítica avanzada (servicio aparte que lee del mismo Postgres).
- **Analítica predictiva avanzada** y **comercialización de data** como producto.

## Seguridad
- **MFA para profesionales** (en MVP solo admin/internos).
- **Hash-chain (tamper-evidence) en el `clinical_audit_log`.**
- **Decisión final de cifrado a nivel de columna (pgcrypto/KMS)** para los identificadores directos más sensibles.

## Infraestructura
- **Event bus durable** (Inngest/Trigger.dev) en vez del bus in-memory no durable.
- **Jobs en background** (Inngest) para procesos largos: PDFs masivos, sync con Alegra, exports, IA.
- **E2E con Playwright** en CI.
- **Pruebas de carga y estrés**, fuzzing.
- **Supabase Pro + PITR** y **backups externos automatizados** (antes de datos clínicos reales se sube a Pro).

## Producto
- **Edición/anotación del reporte** por el profesional antes de enviarlo (en MVP es aprobar y enviar tal cual).
- **Visualización longitudinal rica** del seguimiento (en MVP, comparación básica).
- **Guardado de progreso parcial** en la encuesta (en MVP, reabrir el link re-precarga).
- **Integración real con CNV Learning** (en MVP solo el gate de habilitación por API).
- **Feature flags genéricos** (el caso "distintos profesionales, distinta versión" se resuelve por el model-registry, no por flags).
- **Knowledge gate opcional** en el link de seguimiento, si se decide endurecer (no la cédula).

## Operación y cumplimiento
- **Proceso semi-automatizado de derechos del titular** (en MVP es manual).
- **Cierre de la parte legal de `SECURITY.md` y `DATA_GOVERNANCE.md`** (chat dedicado + jurídico): consentimiento, retención, residencia del dato, plazos de notificación a la SIC.
- **Verificación de residencia/DPA de Supabase** frente a la regulación colombiana de dato de salud.
