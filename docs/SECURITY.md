# Seguridad y privacidad de Atlas (CNV)

**Versión:** 1.1
**Estado:** base técnica firmada. El marco legal y de gobernanza del dato fue desarrollado en el chat legal dedicado y vive en `DATA_GOVERNANCE.md` (Política de Gobernanza del Dato), documento hermano de este. Este archivo conserva los controles técnicos de seguridad; donde antes remitía a "pendiente jurídico", ahora remite a esa política y, cuando aplica, añade las tareas técnicas concretas que quedan pendientes de implementar.

> Atlas maneja datos de salud (PHI/PII). Esto eleva el listón frente a un sistema educativo: la seguridad y la trazabilidad clínica no son negociables.

## Filosofía: defensa en profundidad
La seguridad no descansa en una sola capa. Actúan en paralelo:
1. **Row Level Security (RLS) en Supabase.** Línea principal. Aunque alguien tenga la anon key (pública por diseño), no lee ni modifica lo que no le corresponde. Cada profesional ve solo sus pacientes.
2. **Policies de autorización en código.** Funciones explícitas tipo `canViewPatient(user, patient)` que las server actions consultan ANTES de cualquier mutación.
3. **Validación Zod.** Toda entrada externa pasa por un schema antes de tocar lógica.
4. **`clinical_audit_log`.** Todo evento clínico crítico queda registrado, inmutable, para forense.
5. **MFA (TOTP)** para admin e internos: segundo factor que sostiene el no-repudio.

El `proxy.ts` NO es capa de seguridad. Solo refresca el token de sesión y redirige al login. Toda decisión de "puede o no puede" vive en las capas anteriores.

## Modelo de autorización: RBAC contextual + multi-tenant
Roles vía `user_roles` (N:N) + helper `current_user_role()`. Roles del MVP: `admin`, `direccion`, `soporte`, `obbia` (research), `professional`.

Multi-tenant: `organization_id` en las tablas de dominio. Un profesional ve solo sus pacientes; un interno ve según su rol y organización.

Policies contextuales, no chequeos de rol regados. Prohibido `if (user.role === 'professional')`; obligatorio `if (canViewPatient(user, patient))`. Las policies viven en `modules/<dominio>/policies/`, firma `(user, resource, context?)`. Internamente verifican rol (vía helper), ownership y estado; la interfaz pública es contextual, así que migrar a ABAC en el futuro no cambia los call sites.

Catálogo inicial (cada una con su test): `auth/can-access-admin`, `patients/can-view-patient`, `evaluations/can-create-evaluation`, `diagnosis/can-diagnose`, `diagnosis/can-confirm-diagnosis`, `reports/can-approve-report`, `reports/can-send-report`, `comodato/can-manage-devices`, `payments/can-view-revenue`, `research/can-view-aggregate-data`, `admin/can-manage-users`.

`research/can-view-aggregate-data` tiene alcance limitado por decisión de gobernanza: solo datos clínicos y funcionales **estructurados** (mediciones, indicadores, respuestas de encuesta, tratamiento, seguimiento), **seudonimizados** (nunca identificables), y nunca el contenido narrativo en texto libre del profesional. La policy debe rechazar cualquier acceso que exceda ese alcance, incluso para `obbia`/`admin`.

## Service role: regla crítica
La `SUPABASE_SERVICE_ROLE_KEY` bypassa RLS. Es la llave maestra.
- Nunca se expone al cliente.
- Nunca se importa fuera de `src/lib/supabase/admin.ts` (archivo único).
- Cada uso se justifica en comentario.

Casos legítimos en Atlas: el trigger de creación de perfil (staff/profesionales), el **intake del paciente** (la encuesta pública crea o vincula al paciente sin sesión, vía service role), la verificación de webhooks de pago, y el audit logging desde rutas sin sesión. Caso NO legítimo: leer datos del usuario actual (ahí aplica RLS naturalmente).

## Audit trail clínico (`clinical_audit_log`)
- Append-only, inline en la transacción (regla dura 8). **Nunca por el bus** (el bus no es durable).
- Append-only reforzado: RLS sin políticas de UPDATE/DELETE, más un trigger que bloquea modificación o borrado incluso con service role.
- Campos: `actor_id`, `actor_email`, `event`, `entity_type`, `entity_id`, `payload` (jsonb), `model_version_id`, `ip_address`, `user_agent`, `created_at`.
- Eventos que SIEMPRE generan audit: `patient.created`, `consent.signed`, `evaluation.created`, `bis.imported`, `diagnosis.created`, `diagnosis.confirmed`, `report.approved`, `report.sent`, `treatment.created`, `followup.created`, `user.created`, `user.role_changed`, `user.deactivated`, `device.assigned`, `device.returned`, `payment.confirmed`, `model.version_activated`, `admin.login`, `admin.password_reset_forced`, `consent.revoked` (pendiente: requiere el campo `revoked_at` en `patient_consents`, ver sección de pendientes de esquema).
- Solo `admin` lee (RLS). UI con paginación obligatoria. Sin edición ni borrado.

## MFA
TOTP (Supabase Auth nativo) obligatorio para admin e internos en MVP; profesionales en Post-MVP. Es la pieza que sostiene el no-repudio: aunque CNV controle algún buzón, el segundo factor en el teléfono del interno bloquea la suplantación.

## Manejo de PHI y el LLM
- **Nunca se envía PII al LLM** (Groq/Gemini). Solo variables clínicas seudonimizadas.
- La clasificación de campos en 3 niveles (identificador directo, cuasi-identificador, clínico), guardada como metadato en `survey_questions`, decide automáticamente qué sale al LLM, qué se generaliza en investigación y qué se cifra.
- El provider de IA va con timeout; se loguea modelo y versión de prompt. La sugerencia nunca se auto-aplica: el profesional decide.

## Superficies públicas (sin sesión)
- **Encuesta QR:** URL con token opaco que mapea a (profesional, organización) en servidor. Rate limited. Crea o vincula al paciente vía service role (intake) y resuelve identidad por documento. **Pendiente:** validar la fecha de nacimiento en este flujo para activar el bloque de representante legal (menores de 18 años) en lugar de la declaración de mayoría de edad, y el bloque de asentimiento entre 14 y 17 años, conforme al Consentimiento de ATLAS vigente.
- **Link de seguimiento pre-llenado:** token de un solo uso, atado a paciente+evaluación, se vence al completar con colchón de 30 días, pre-fill mínimo. La red de seguridad real es la confirmación de identidad del profesional aguas abajo.
- **Checkout:** token, válido 24h, atado a orden y monto, con idempotencia.
- **Webhooks (Wompi/Alegra):** sin CORS abierto; validan firma HMAC con secret compartido más clave de idempotencia.

## Biody Manager (superficie externa de PHI)
Software de terceros (nube + escritorio) que aloja data cruda y PII del paciente. No diseñamos su seguridad, así que el peso lo cargan los controles operativos y el comodato:
- Credenciales controladas por CNV, aleatorias y únicas por equipo, en gestor de secretos. No derivadas de datos de la persona.
- La bandeja compartida (`biody+assetcode@cnvsystem.com`) se blinda con contraseña fuerte y MFA.
- El punto de control real del dato valioso es la **validación del CSV al importar a Atlas**, no el login de Biody.
- El comodato impone resguardo del equipo y las credenciales, y reporte de pérdida.

## Manejo de secretos
- Dev local: todo en `.env.local` (gitignored). `.env.local.example` con placeholders en el repo.
- Producción: variables en Vercel por entorno (Production, Preview, Development). Rotación periódica documentada en runbook.
- Jamás pegar secretos en chat (Slack, Telegram, IA, email). Se comparten vía gestor de secretos.
- Si un secreto se filtra: rotación inmediata y revisión de logs.
- Scanner de secretos en CI (gitleaks) + pre-commit. Cuidado con `NEXT_PUBLIC_`: nada sensitive lleva ese prefijo.
- Más críticos: service role, claves de Wompi/Alegra, API keys de IA, `DATABASE_URL`.

## Encriptación
- **En tránsito:** HTTPS obligatorio; TLS 1.2+ a Supabase, Resend, Groq/Gemini, Wompi, Alegra; HSTS por header; cookies de sesión `HttpOnly`, `Secure`, `SameSite=Lax` (Supabase Auth por defecto).
- **En reposo:** Supabase cifra DB, Storage y backups con AES-256 a nivel de disco. Contraseñas con bcrypt (Supabase Auth), nunca en plano ni en logs.
- **PDFs del paciente:** URLs firmadas con expiración para acceso interno desde Storage; adjunto al correo para el paciente.
- **A nivel de columna (PHI):** Atlas sí maneja dato de salud, así que el cifrado a nivel de campo con `pgcrypto` o KMS para los identificadores directos más sensibles se evalúa en serio (no se difiere a "futuro" como en el LMS). Decisión final pendiente del chat de gobernanza/legal.

## Headers de seguridad
En `next.config.ts` con `headers()`. Mínimo del MVP, no se difiere: HSTS (`max-age=63072000; includeSubDomains; preload`), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` restringido, y CSP con `default-src 'self'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`. El `connect-src` lista solo lo que la app llama desde el navegador: Supabase (datos + realtime), Sentry, y nada de PII hacia el LLM desde el cliente (la IA se llama server-side). YouTube y demás del LMS se eliminan. La CSP se valida en el bloque de layout y se afina en pulido.

## CORS
Atlas es app cerrada: front y back en `atlas.cnvsystem.com`, así que CORS no aplica a nuestras rutas. Las superficies públicas (encuesta, checkout) son páginas server-rendered, no APIs abiertas. Los webhooks validan HMAC, no CORS. Regla: ningún endpoint con `Access-Control-Allow-Origin: *`; cualquier excepción pasa por revisión documentada.

## Input sanitization
- **Markdown/HTML:** notas clínicas, observaciones y feedback se renderizan con `react-markdown` sin `allowDangerousHtml` y sin `rehype-raw`. Prohibido `dangerouslySetInnerHTML`. Para HTML enriquecido futuro, `DOMPurify` en servidor.
- **CSV de Biody Manager:** validación estricta de tipos y rangos con Zod, registrada en `bis_import_logs`. Es la frontera de confianza crítica.
- **Archivos:** MIME validado contra allowlist, tamaño máximo, renombrado a UUID en servidor; los PDFs se sirven como adjunto/visor, nunca como HTML.
- **SQL injection:** queries parametrizadas vía Drizzle/cliente Supabase; nunca concatenación de strings; nunca `rpc` con SQL del usuario. Protegido además por la regla dura 1 (todo acceso por repositorios).

## Rate limiting
Desde MVP, con Upstash Ratelimit. Un bot puede agotar créditos de IA, saturar Resend, o intentar fuerza bruta.

| Endpoint | Límite |
|---|---|
| `POST /login` | 5 intentos / 15 min por IP, bloqueo temporal + backoff |
| Encuesta pública (submit) | por IP y por token, agresivo |
| Checkout (crear sesión) | acotado por hora |
| IA (sugerencia de diagnóstico) | 20 / 1 h por usuario |
| Subir archivo / import CSV | acotado por hora por usuario |
| Cualquier otra mutación | 100 / 1 min por usuario |

Identificación: IP para endpoints sin sesión; `userId` para los autenticados. Webhooks no se rate-limitan por volumen, se protegen con HMAC + idempotencia. Defensa en capas: Cloudflare (Bot Fight si hace falta), Vercel Edge, y los límites nativos de Supabase Auth.

## Tests de seguridad mínimos
En `tests/policies.test.ts`: `canViewPatient` (solo su profesional y admin; nunca otro profesional), `canDiagnose`, `canConfirmDiagnosis`, `canApproveReport`, `canSendReport`, `canManageDevices`, `canAccessAdmin`, `canViewAggregateData` (solo obbia/admin, sin acceso a PII, sin acceso a contenido narrativo en texto libre, solo datos estructurados seudonimizados). Más tests de RLS por rol. **Pendiente:** test del pipeline de anonimización para exports externos (`research_datasets`): verificar k-anonimato con k ≥ 5 y l-diversidad para atributos sensibles antes de cualquier exportación. Los golden tests del motor también son seguridad clínica: si rompen, hay riesgo clínico.

## Respuesta a incidentes
1. **Aislar:** revocar el secreto comprometido o desactivar el usuario sospechoso.
2. **Auditar:** revisar `clinical_audit_log`, Sentry y logs de Vercel para el alcance.
3. **Notificar:** si hay datos personales o de salud comprometidos, notificar a la Superintendencia de Industria y Comercio dentro de los quince (15) días hábiles siguientes a la detección (posición de trabajo fijada en la Política de Gobernanza del Dato, sujeta a ratificación final del asesor jurídico), y a los titulares afectados sin dilación indebida.
4. **Documentar:** post-mortem en `docs/incidents/AAAA-MM-DD-titulo.md`.
5. **Mitigar:** correcciones y tests para que no se repita.

En MVP el equipo de respuesta es Santiago.

---

## Relación con la Política de Gobernanza del Dato

El marco legal y de gobernanza del dato de Atlas fue desarrollado en el chat legal dedicado de CNV y vive en `DATA_GOVERNANCE.md` (Política de Gobernanza del Dato). Ese documento es la fuente de verdad para: base legal y mapa de roles (Responsable/Encargado), texto y estructura del consentimiento (`CONSENT_ATLAS.md`), periodos de retención, estándar de anonimización, sub-encargados y transferencia internacional, derechos del titular, y custodia de la historia clínica. Este archivo (`SECURITY.md`) ya no repite ese contenido; se limita a los controles técnicos y a las tareas de implementación que se derivan de él.

Resueltos por la Política de Gobernanza del Dato (referencia, no repetir aquí): retención de historia clínica (15 años), texto del consentimiento informado, transferencia internacional (Estados Unidos y Francia, ambos de nivel adecuado; Biody Manager con certificación HDS), y la titularidad de la historia clínica (el Integrante es el Responsable y custodio legal; CNV aloja como Encargado mientras dura el contrato, con portabilidad garantizada a la terminación).

### Pendientes técnicos de esquema (derivados de la Política de Gobernanza del Dato)

- **`patient_consents.revoked_at`:** campo faltante para registrar la revocación de cada autorización. Bloqueante para implementar `consent.revoked` en el audit trail y para que el flujo clínico valide autorizaciones vigentes.
- **`patient_consents.consent_type`:** ampliar el enum a ocho valores: `servicio`, `datos_sensibles`, `internacional_ia`, `investigacion`, `comunicaciones_continuidad`, `comunicaciones_comerciales`, `representante_legal`, `asentimiento_menor`.
- **Campos del representante legal:** `legal_representative_name`, `legal_representative_document`, `legal_representative_relationship`, requeridos cuando `consent_type = representante_legal`. Definir si viven en `patient_consents` o en tabla relacionada.
- **Validación de edad en el flujo de encuesta:** ver nota en "Superficies públicas" arriba.
- **`devices`:** agregar columnas `brand` y `model` (el `asset_code` es agnóstico del fabricante; hoy solo existe `model` genérico).
- **Pipeline de anonimización para `research_datasets`:** implementar k-anonimato (k ≥ 5) y l-diversidad para atributos sensibles antes de cualquier exportación externa, conforme al estándar técnico de la Política de Gobernanza del Dato.
