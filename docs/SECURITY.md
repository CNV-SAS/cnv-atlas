# Seguridad y privacidad de Atlas (CNV)

**Versión:** 1.2
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

Catálogo inicial (cada una con su test): `auth/can-access-admin`, `patients/can-view-patient`, `evaluations/can-create-evaluation`, `diagnosis/can-diagnose`, `diagnosis/can-confirm-diagnosis`, `reports/can-approve-report`, `reports/can-send-report`, `comodato/can-manage-devices`, `payments/can-view-revenue`, `research/can-view-aggregate-data`, `admin/can-manage-users`, `clinical-access/can-request-access`, `clinical-access/can-approve-access`, `clinical-access/can-audit-notes`.

`research/can-view-aggregate-data` tiene alcance limitado por decisión de gobernanza: solo datos clínicos y funcionales **estructurados** (mediciones, indicadores, respuestas de encuesta, tratamiento, seguimiento), **seudonimizados** (nunca identificables), y nunca el contenido narrativo en texto libre del profesional. La policy debe rechazar cualquier acceso que exceda ese alcance, incluso para `obbia`/`admin`.

## Service role: regla crítica
La `SUPABASE_SERVICE_ROLE_KEY` bypassa RLS. Es la llave maestra.
- Nunca se expone al cliente.
- Nunca se importa fuera de `src/lib/supabase/admin.ts` (archivo único).
- Cada uso se justifica en comentario.

Casos legítimos en Atlas: el trigger de creación de perfil (staff/profesionales), el **intake del paciente** (la encuesta pública crea o vincula al paciente sin sesión, vía service role), la verificación de webhooks de pago, y el audit logging desde rutas sin sesión. Caso NO legítimo: leer datos del usuario actual (ahí aplica RLS naturalmente).

### Acceso directo a la infraestructura (política interna)
La `SUPABASE_SERVICE_ROLE_KEY` y las credenciales de la base (`DATABASE_URL`) dan acceso directo a los datos, por fuera de las policies y del audit de la aplicación. Hoy solo Santiago (responsable técnico) las custodia. Compromiso de gobierno: cualquier acceso directo futuro a la infraestructura (nuevas personas con la llave, consultas manuales sobre datos de producción, herramientas de administración de base) debe justificarse por escrito y registrarse, con el mismo criterio de causa y minimización que aplica dentro de la aplicación. El acceso directo no es una vía para saltarse el mecanismo de grants; es una superficie de mayor privilegio que se restringe al mínimo de personas y se audita fuera de banda.

## Auditoría de contenido clínico: mecanismo de grants
El acceso al **contenido clínico narrativo** (notas de evaluación, diagnóstico y tratamiento) no es libre para ningún rol interno. Se gobierna por un mecanismo único de permisos temporales (grants), en la tabla mutable `clinical_access_grants`, en tres niveles (materializa la Cláusula 17 del Anexo 3: causa puntual, minimizado, registrado):

- **Nivel (a), metadatos y actividad:** el `clinical_audit_log`. No es contenido clínico; no requiere grant (solo `admin` lo lee).
- **Nivel (b), narrativa seudonimizada:** las notas sin identidad del paciente. Requiere un grant `notes_pseudonymous` activo **más** la precondición de que el profesional del paciente firmó la versión vigente del Anexo 3 (`professional_document_signatures`). Se gobierna por RLS (las policies de las notas). No es monitoreo continuo: expiración por defecto de 30 días, **tope duro de 90 días**; renovar es pedir un grant nuevo, no extender.
- **Nivel (c), narrativa identificada:** las notas de un paciente puntual, con su identidad. Excepcional (atención de una queja, verificación de una posible desviación grave). No pasa por RLS relajada: se resuelve por una acción de servidor auditada que exige un grant `notes_identified` con scope a ese paciente y registra el **uso efectivo** (`access.used`) antes de leer. Expiración por defecto de 48 horas, **tope duro de 7 días**.

**Quién solicita y quién aprueba (nunca la misma persona):** solo `admin` y `soporte` solicitan (roles internos operativos, sin relación clínica directa). `soporte` lo aprueba `admin`; `admin` lo aprueba `direccion` (el admin no puede autoaprobarse). `direccion` solo aprueba, nunca solicita ni ve contenido clínico. El rol aprobador se sella al solicitar desde el rol real del solicitante, no se puede forjar desde el cliente. `professional` y `obbia` no participan (el profesional ve a sus pacientes por la vía normal; obbia tiene su propio camino seudonimizado y separado).

**Ciclo de vida y trazabilidad:** cada grant emite eventos inmutables en el `clinical_audit_log`: `access.requested`, `access.approved` o `access.denied`, `access.used`, y `access.revoked`. Los topes duros (90 días Nivel b, 7 días Nivel c) son **controles de gobierno** que viven en el código (`grant-rules.ts`), no en el consentimiento; su base legal es el numeral 4 del Consentimiento de ATLAS v1.7 (autorización del titular) y las Cláusulas 3 y 17 del Anexo 3 v1.0 (instrucción del Responsable y alcance de la auditoría).

**Brecha conocida (fuera del alcance de este bloque):** el cierre cubre las tres tablas de notas narrativas. El resto de la historia clínica identificada (`evaluations`, `bis_measurements`, `diagnoses`, `treatments`, `reports`, `patients` y demás) todavía tiene acceso amplio del `admin` por RLS. Se cerrará extendiendo este mismo mecanismo a esas superficies (ver `BACKLOG.md`, prioridad alta).

## Audit trail clínico (`clinical_audit_log`)
- Append-only, inline en la transacción (regla dura 8). **Nunca por el bus** (el bus no es durable).
- Append-only reforzado: RLS sin políticas de UPDATE/DELETE, más un trigger que bloquea modificación o borrado incluso con service role.
- Campos: `actor_id`, `actor_email`, `event`, `entity_type`, `entity_id`, `payload` (jsonb), `model_version_id`, `ip_address`, `user_agent`, `created_at`.
- Eventos que SIEMPRE generan audit: `patient.created`, `consent.signed`, `evaluation.created`, `bis.imported`, `diagnosis.created`, `diagnosis.confirmed`, `report.approved`, `report.sent`, `treatment.created`, `followup.created`, `user.created`, `user.role_changed`, `user.deactivated`, `device.assigned`, `device.returned`, `payment.confirmed`, `model.version_activated`, `admin.login`, `admin.password_reset_forced`, `admin.mfa_reset`, `consent.revoked` (pendiente: requiere el campo `revoked_at` en `patient_consents`, ver sección de pendientes de esquema), `access.requested`, `access.approved`, `access.denied`, `access.used`, `access.revoked` (ciclo de vida de los grants de acceso a las notas, ver sección "Auditoría de contenido clínico").
- Solo `admin` lee (RLS). UI con paginación obligatoria. Sin edición ni borrado.

## MFA
TOTP (Supabase Auth nativo) obligatorio para admin, internos **y profesionales** (gate Hito 2). Es la pieza que sostiene el no-repudio: aunque CNV controle algún buzón, el segundo factor en el teléfono bloquea la suplantación. La MFA del profesional no es opcional porque su cuenta da acceso a las historias clínicas de todos sus pacientes, y una MFA opcional casi nadie la activa. El set de roles forzados es `MFA_REQUIRED_ROLES` (internos + `professional`); un usuario sin rol requerido no se fuerza. Enforcement en la policy pura `mfaRequirement` y en el gate de `(app)/layout.tsx`.

### Recuperación del segundo factor y reinicio de clave (procedimiento, no código)
`resetUserMfa` (reinicia el segundo factor de un profesional que perdió el teléfono) y `forcePasswordReset` (fuerza el cambio de clave) son la vía legítima de recuperación, pero también la vía por la que se toman cuentas: alguien escribe diciendo que perdió el acceso, y la cuenta da entrada a historias clínicas.

**Antes de reiniciar el segundo factor o forzar el cambio de clave de un profesional, hay que verificar su identidad por una vía distinta de la que usó para pedirlo. Un correo no verifica a nadie: quien pide el reinicio puede ser quien tomó la cuenta. Con la red pequeña basta una llamada a un número ya conocido; cuando crezca, hará falta un procedimiento.**

Soporte de esa verificación en el código: `resetUserMfa` exige un `reason` (motivo) obligatorio que el admin escribe y queda en el `payload` del audit `admin.mfa_reset`, junto al admin que lo ejecutó. Así el log no dice solo "el admin reinició el factor de Fulano", sino por qué y a pedido de quién (mismo patrón que la corrección de evaluaciones). El audit registra al ejecutor (el admin); el `reason` es lo único que registra al solicitante, por eso es obligatorio.

**No se cambia la contraseña sin el segundo factor (lección 2026-08-07, delatada por un bug).** Recuperar la clave con solo el enlace del correo NO basta si la cuenta tiene MFA: si bastara, quien controle el buzón (o un enlace filtrado) tomaría la cuenta entera y el MFA no protegería nada. Supabase lo impone (`updateUser` de contraseña con MFA exige sesión **AAL2**, error `insufficient_aal`), y Atlas lo hace explícito en el flujo: la sesión de recuperación entra en AAL1, así que `/set-password` pide primero el segundo factor (eleva a AAL2) y solo después deja fijar la clave nueva; un invitado sin MFA pasa directo. El bug que lo destapó (recuperación de un profesional fallaba con un genérico "No se pudo fijar la contraseña", que tragaba el `insufficient_aal`) NO era solo un fallo: delataba que el diseño permitiría cambiar la clave sin el segundo factor. Escotilla combinada: si el profesional perdió la clave Y el teléfono, el admin usa `resetUserMfa` (reinicia el factor) y ENTONCES la recuperación funciona sin MFA; el orden importa (primero reiniciar el factor, después recuperar la clave).

**Recuperar la clave cierra TODAS las sesiones del usuario (decisión 2026-08-07).** Al fijar la contraseña nueva, `setPasswordAction` hace `signOut({ scope: "global" })` ANTES de redirigir a `/login`. Nació arreglando un bug (la sesión seguía viva y el proxy rebotaba `/login` → `/dashboard`), pero es una mejora de seguridad por sí sola: si alguien recuperó la cuenta porque sospechaba acceso ajeno, la sesión del intruso también muere. Así la recuperación es lo que debe ser, recuperar el CONTROL de la cuenta, no solo cambiar una clave mientras la sesión vieja sigue abierta. `scope: "global"` invalida todas las sesiones del usuario (todos los dispositivos), no solo la del navegador actual.

## Manejo de PHI y el LLM
- **Nunca se envía PII al LLM** (Groq/Gemini). Solo variables clínicas seudonimizadas.
- **La barrera PHI→LLM es ESTRUCTURAL, no por clasificación** (corregido 2026-08-09 tras auditoría doc-vs-código): el contrato de entrada del prompt no tiene campos de PII, así que es imposible POR CONSTRUCCIÓN enviar PII al LLM (ver `src/modules/treatment/ai/prompts/menu.v1.ts`). Es más fuerte que un filtro por metadato, y es lo que de verdad protege.
- **La columna `survey_questions.data_class` (3 niveles) es HOY metadato INERTE: ningún código de aplicación la lee.** Se conserva como marca para controles FUTUROS (anonimización del export de investigación, cifrado de columna), que están **PENDIENTES, no implementados**. NO confiar en `data_class` para proteger un dato: hoy no hace nada; un control por clasificación habría que construirlo. (Pendiente de decidir si se implementa o se retira el campo; ver BACKLOG.)
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

### Por qué NO se embeben los PDF servidos por la app (RUT, reportes)
Decisión registrada (2026-08-11) para que no se reabra sin conocer el costo. Los documentos que la app sirve por ruta propia (el RUT del integrante en `/rut/[id]`, los reportes en `/reportes/[id]/pdf`) se abren en **pestaña nueva por enlace**, no embebidos al lado con `<object>`/`<embed>`/`<iframe>`. No es una limitación por resolver: las tres cabeceras que lo impiden son endurecimiento deliberado y **global**:

- `object-src 'none'` bloquea `<object>` y `<embed>`.
- `X-Frame-Options: DENY` y `frame-ancestors 'none'` bloquean un `<iframe>` del propio PDF, **aun del mismo origen**.

Embeber exigiría relajar esas cabeceras **para toda la aplicación** (o abrir un `frame-src blob:` y servir el PDF como blob), a cambio de ahorrar un clic al ver un documento. Para un documento de identidad tributaria (dato sensible), no compensa: el enlace gateado por sesión resuelve lo mismo. Si alguien vuelve a proponer el lado-a-lado, este es el costo que está proponiendo pagar.

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
| IA (sugerencia de diagnóstico) | 20 / 1 h por usuario |
| Subir archivo / import CSV | acotado por hora por usuario |
| Envío de reporte por correo | 10 / 1 h por usuario |
| Solicitud de acceso a las notas (grants) | 20 / 1 h por usuario |
| Checkout (crear sesión) | **PENDIENTE** (no implementado; ver BACKLOG) |
| Cualquier otra mutación (límite general) | **PENDIENTE** (no implementado; ver BACKLOG) |

> Corregido 2026-08-09 (auditoría doc-vs-código): los dos últimos NO estaban implementados en `src/core/rate-limit/`; se marcan PENDIENTE en vez de afirmarlos. Prometer una defensa que no existe es peor que no tenerla (nadie la echa de menos). El resto de la tabla sí existe.

Identificación: IP para endpoints sin sesión; `userId` para los autenticados. Webhooks no se rate-limitan por volumen, se protegen con HMAC + idempotencia. Defensa en capas: Cloudflare (Bot Fight si hace falta), Vercel Edge, y los límites nativos de Supabase Auth.

## Tests de seguridad mínimos
En `tests/policies.test.ts`: `canViewPatient` (solo su profesional y admin; nunca otro profesional), `canDiagnose`, `canConfirmDiagnosis`, `canApproveReport`, `canSendReport`, `canManageDevices`, `canAccessAdmin`, `canViewAggregateData` (solo obbia/admin, sin acceso a PII, sin acceso a contenido narrativo en texto libre, solo datos estructurados seudonimizados). Más tests de RLS por rol. **Pendiente:** test del pipeline de anonimización para exports externos (`research_datasets`): verificar k-anonimato con k ≥ 5 y l-diversidad para atributos sensibles antes de cualquier exportación. Los golden tests del motor también son seguridad clínica: si rompen, hay riesgo clínico.

## Checklist de seguridad de lanzamiento
Controles técnicos verificados en B15 (barrido manual + `/security-review` sobre el diff, sin hallazgos):

- [x] **RLS habilitada en TODAS las tablas** de `public` (verificado: cero tablas sin RLS, cero tablas con RLS y sin policy).
- [x] **Autorización por policies**, no por chequeos de rol sueltos. El acceso a contenido clínico narrativo pasa por el mecanismo de grants (Niveles a/b/c), nunca por `has_role('admin')` incondicional.
- [x] **`service_role`/owner** solo en superficies justificadas (intake público, storage de reportes, checkout, auth admin, y los writers/lectores owner del bloque de auditoría, todos gateados en app-layer o de menor sensibilidad).
- [x] **Headers de seguridad + CSP** en todas las rutas (`next.config.ts`): CSP con `connect-src` derivado de env, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`. Baseline con `'unsafe-inline'` (endurecimiento a nonces diferido a post-MVP, ver BACKLOG).
- [x] **Scrubbing de PHI en Sentry** cableado en los tres runtimes (server/edge/cliente), `sendDefaultPii: false`, Session Replay desactivado (no captura el DOM). Denylist incluye narrativa clínica (`nota`/`note`/`narrativa`) y el motivo de los grants.
- [x] **Rate limiting** en login, encuesta pública, import, envío de reportes, IA y solicitud de grants; con fallback en memoria.
- [x] **`clinical_audit_log` append-only** (RLS sin UPDATE/DELETE + trigger), inline en la transacción.
- [x] **MFA (TOTP)** obligatorio para admin e internos.
- [x] **Zod** en toda entrada externa; `Result<T, AppError>` sin throw para errores esperables.
- [x] **Webhooks** protegidos por HMAC + idempotencia (no por rate limit de volumen).

Pendientes de gobernanza/ops (no bloquean el control técnico, dependen de decisiones de Santiago): cifrado a nivel de columna PHI (diferido, DELTA), validación de edad en la encuesta, pipeline de anonimización para el primer export externo. Items operativos de lanzamiento en `DEPLOY.md`.

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

Resueltos (verificados contra el esquema en B15):

- **`patient_consents.revoked_at`:** implementado (B7/DELTA). Registra la revocación de cada autorización; habilita `consent.revoked` y el gate de autorizaciones vigentes.
- **`patient_consents.consent_type` a ocho valores:** implementado (DELTA2). `servicio`, `datos_sensibles`, `internacional_ia`, `investigacion`, `comunicaciones_continuidad`, `comunicaciones_comerciales`, `representante_legal`, `asentimiento_menor`.
- **Campos del representante legal:** implementados en `patient_consents` (DELTA2): `legal_representative_name`, `legal_representative_document`, `legal_representative_relationship`, `legal_representative_email`.
- **`devices.brand` y `devices.model`:** implementados (B8). El `asset_code` sigue siendo agnóstico del fabricante.

Pendientes reales:

- **Validación de edad en el flujo de encuesta:** ver nota en "Superficies públicas" arriba. Hoy la encuesta usa la declaración de mayoría de edad; falta validar la fecha de nacimiento para activar automáticamente el bloque de representante legal (menores de 18) y el asentimiento (14-17).
- **Pipeline de anonimización para `research_datasets`:** implementar k-anonimato (k ≥ 5) y l-diversidad antes de cualquier exportación externa. Diferido: `research_datasets` está vacío en el MVP (no hay exports todavía); es prerrequisito del primer export externo real, no del lanzamiento.
