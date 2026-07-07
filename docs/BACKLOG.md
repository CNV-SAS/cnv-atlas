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
- **Edición/anotación del reporte** por el profesional antes de enviarlo (en MVP es aprobar y enviar tal cual; B10.1 ya agregó las notas del profesional como capa aparte y el modo de envío, falta edición rica del contenido).
- **Traducción del reporte a lenguaje funcional para el paciente.** El documento que recibe el paciente traduce el contenido de Atlas a lenguaje funcional (sin nombrar enfermedades), distinto de la vista previa interna que sí asocia patrones a condiciones clínicas conocidas (con el rótulo "no constituye diagnóstico"). Pendiente de autorización y contenido de la Dirección Científica.
- **Visualización longitudinal rica** del seguimiento (en MVP, comparación básica).
- **Guardado de progreso parcial** en la encuesta (en MVP, reabrir el link re-precarga).
- **Integración real con CNV Learning** (en MVP solo el gate de habilitación por API).
- **Feature flags genéricos** (el caso "distintos profesionales, distinta versión" se resuelve por el model-registry, no por flags).
- **Knowledge gate opcional** en el link de seguimiento, si se decide endurecer (no la cédula).

## Admin
- **Modo sandbox para pagos (solo admin).** Toggle en el panel de admin que alterna entre credenciales de produccion y sandbox de Wompi/Alegra sin tocar `.env`. Muestra un banner visible en toda la app cuando el modo sandbox esta activo. Requiere dos sets de credenciales en variables de entorno (sufijo `_SANDBOX`). En el MVP el entorno se fija por las variables desplegadas, no se cambia en caliente.
- **Automatización de la verificación de correo dual (Learning vs Atlas).** Cuando un profesional indica en el onboarding que su correo de Atlas es distinto al de CNV Learning, hoy se registra manualmente (10 personas, viable). A futuro, automatizar la validación/vinculación entre ambos correos.

## Portal del paciente (v1.1)
Acceso directo del paciente, fuera del alcance del MVP (donde el paciente solo recibe el reporte por correo si el profesional lo aprueba y dispara el envío, con preview y audit).
- **Portal de informes:** el paciente consulta en línea sus reportes históricos, no solo el adjunto que recibe por correo.
- **Sección de noticias y educación:** contenido divulgativo y educativo para el paciente dentro del portal.
- **Cuenta de paciente con login propio:** autenticación propia del paciente, distinta de las cuentas clínicas de profesionales y staff, con su gobernanza de acceso y de consentimiento.

## Pagos
- **Reembolsos (`refunded`).** El enum `transaction_status` incluye `refunded`, pero en el MVP no hay flujo de reembolso: solo se manejan `paid` y `failed`. La reversa de un pago (notificarla, recalcular comision/ingreso, anular o abonar la factura en Alegra) es post-MVP.
- **Autocompletar datos del paciente en el checkout de Wompi.** Wompi soporta `customer-data` (nombre, correo, telefono, documento) para prellenar el checkout. En el MVP el checkout va sin esos datos. Cuando se integre, sale del paciente y nunca como PII en la URL si se puede evitar.
- **Boton de QR en la pagina de pagos.** Generar un QR del link de checkout para mostrarlo en consultorio, ademas del link copiable. En el MVP solo se comparte el link.
- **Alegra Producción (bloque propio, no un ajuste de B6).** Pasar la integración de Alegra de sandbox a producción real necesita: credenciales de producción; re-mapeo completo de IDs (productos/nutracéuticos con IVA 19% configurado en Alegra producción, impuesto IVA, numeración/resolución de factura electrónica, centro de costo "Vitacellebis", bodegas si aplica); captura de CUFE/número de factura/estado DIAN; idempotencia estricta (una venta, una factura); conciliación con Wompi (bruto facturado vs neto desembolsado; la comisión de Wompi es gasto aparte con su propia factura). Reglas de contenido de factura ya decididas: PVP completo con IVA, sin descontar la comisión de Wompi, sin retención en la fuente, medio de pago correcto, contacto real del paciente con documento y correo, código de identificación por producto tipo NUT-001 (evita la observación FAZ09 de la DIAN). Decisiones tomadas para cuando se construya: (a) numeración/prefijo de Atlas distinto al manual, para trazabilidad limpia; (b) el inventario operativo lo sigue manejando Atlas (ya construido en B5), Alegra solo factura, no se modela bodega por profesional en Alegra. Ver referencia en MVP.md.

## Operación y cumplimiento
- **Exportación de la historia clínica al offboarding de un Integrante** (alta prioridad post-primer-contrato). Al terminar la vinculación de un Integrante con CNV, Atlas genera y entrega una exportación completa de las historias clínicas de sus pacientes: un PDF por paciente más un estructurado JSON/CSV, dentro de los 10 días hábiles siguientes a la terminación (DATA_GOVERNANCE, custodia de la historia clínica). Es una función de panel admin ("generar exportación de HC para el Integrante X"). Tras la exportación, la retención se diferencia por paciente según la casilla 4 (investigación) de su consentimiento: con casilla 4 marcada, CNV retiene los datos seudonimizados en la capa de investigación; sin casilla 4, los datos identificables se conservan un periodo de gracia de 30 días por defecto (configurable por admin, no hardcodeado) como garantía de que la entrega fue completa, y vencido el plazo se anonimizan o eliminan. Requiere un job programado (candidato: Vercel Cron o Inngest, ya en el roadmap de background jobs de ARCHITECTURE.md), no una función síncrona.
- **Flujo de corrección del consentimiento tras una inconsistencia de edad/rama.** Cuando el profesional detecta una inconsistencia de edad/consentimiento al confirmar identidad (segundo muro de DELTA2 B3, que bloquea la confirmación), no existe hoy un flujo para que el paciente o su representante legal corrija el consentimiento. Evaluar si el link de seguimiento sirve para este caso o si se necesita un mecanismo dedicado (reabrir el paso de consentimiento con la rama correcta).
- **Proceso semi-automatizado de derechos del titular** (en MVP es manual).
- **Cierre de la parte legal de `SECURITY.md` y `DATA_GOVERNANCE.md`** (chat dedicado + jurídico): consentimiento, retención, residencia del dato, plazos de notificación a la SIC.
- **Verificación de residencia/DPA de Supabase** frente a la regulación colombiana de dato de salud.
