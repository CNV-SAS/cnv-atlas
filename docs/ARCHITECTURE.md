# Arquitectura de Atlas (CNV)

**Versión:** 1.1
**Estado:** firmado para MVP (documento vivo)
**Dominio:** `atlas.cnvsystem.com`

> Este documento es la fuente de verdad arquitectónica de Atlas. Si el código contradice este documento, el código está equivocado. Si una decisión nueva contradice este documento, este documento se actualiza primero y luego el código. Se carga como contexto en el primer prompt de Claude Code de cada bloque.

---

## Las reglas duras del proyecto

No negociables durante el MVP. Cambiarlas requiere revisión formal documentada en un PR aparte.

1. **Ningún acceso directo a Supabase fuera de `data/`.** Toda lectura/escritura pasa por el repositorio del módulo.
2. **Ninguna lógica de negocio en pages, server actions ni route handlers.** Son thin: validan, autorizan, llaman a un service, retornan. La lógica vive en services.
3. **Ninguna decisión de autorización fuera de policies.** Nunca por `user.role === ...` suelto ni por el dominio del email (`email LIKE '%@cnvsystem.com'`). Va por rol vía `user_roles` + función helper.
4. **Server Components por defecto.** `"use client"` solo cuando hay estado local, efectos, event handlers o APIs del navegador.
5. **Ningún cálculo clínico fuera de `clinical-engine`.**
6. **Ninguna versión del motor sin golden tests** que prueben paridad exacta con el HTML de referencia de Gildardo.
7. **Ningún registro clínico sin su constelación de versiones.** `indicator_values`, `diagnoses` y derivados guardan `engine_version` + `survey_version_id` + `model_version_id` + `rules_version`.
8. **Ningún evento clínico crítico sin `clinical_audit_log`, inline en la transacción.** Incluye el ciclo de vida (`evaluation.created`, `diagnosis.created`, `treatment.created`, `followup.created`). El audit clínico **nunca** viaja por el bus.
9. **Ningún prompt IA inline.** Los prompts se versionan en el registry de datos (`ai_prompts`), editables por admin creando versiones nuevas auditadas; el proveedor/modelo activo en `ai_config`. **Nunca PII al LLM**, solo variables clínicas seudonimizadas.
10. **Ninguna llamada externa sin timeout explícito** (`AbortSignal.timeout()`).
11. **Ningún import cruzado con CNV Learning.** La integración va por API/eventos.
12. **El `clinical-engine` no importa nada de la app** (ni Next, ni React, ni Supabase). Es TypeScript puro.
13. **Ningún tipo global monstruoso.** Los tipos viven en su módulo; los generados de la DB en `src/types/database.generated.ts`.
14. **Ninguna cuenta clínica se recicla.** Offboarding = desactivar la cuenta + reasignar pacientes. Nunca se cambia el correo/clave de una cuenta para dársela a otra persona.
15. **Ninguna evaluación sin las autorizaciones de consentimiento necesarias vigentes.** Las tres autorizaciones necesarias (`servicio`, `datos_sensibles`, `internacional_ia`) deben existir en `patient_consents` con `revoked_at IS NULL` para el paciente antes de crear cualquier evaluación, inicial o de seguimiento. Si la versión del consentimiento subió de número MAYOR, se requiere re-consentir. Esta verificación vive en la policy `evaluations/can-create-evaluation`, no como chequeo suelto.

---

## Filosofía

Atlas es la plataforma que operacionaliza CNV Data y opera principalmente para CNV Care, alimentando con datos gobernados a Research y Learning. En una frase: **Atlas es el sistema donde el modelo ANI-BIS-E se aplica, se mide, se gobierna y se audita.**

El código se organiza por **dominio de negocio**, no por tipo técnico. Principios rectores:

- **Server-first.** Renderizado en servidor por defecto; el motor clínico se ejecuta **solo en servidor**.
- **Separación por capa.** Pages componen; actions/handlers validan y orquestan thin; services contienen lógica; repositorios acceden a datos; policies autorizan.
- **Fidelidad clínica antes que velocidad.** El motor no cambia ni un decimal al migrar; se demuestra con golden tests. Primero equivalencia, después optimización — nunca al revés.
- **Defensa en profundidad.** RLS + policies + validación + audit.
- **Trazabilidad y evidencia.** Cada decisión clínica deja constelación de versiones (procedencia) + snapshot (evidencia).
- **Extensibilidad sin reescritura.**

### Qué hace el MVP
Ejecuta la ruta ANI-BIS-E (Evaluación → Diagnóstico → Tratamiento → Seguimiento) estandarizada y trazable; calcula indicadores con un motor versionado; captura, valida y gobierna la data clínica; gestiona usuarios/roles/permisos con RLS; genera reportes esenciales; soporta comodato y venta de nutracéuticos (Wompi + Alegra).

### Qué NO hace el MVP
No reemplaza el juicio clínico. La IA es **apoyo a la decisión**, nunca diagnóstico autónomo. No entrega al paciente interpretaciones automáticas pesadas: recibe el reporte **solo si el profesional aprueba y dispara el envío** (con preview + audit). No es un LMS. No hace analítica científica avanzada ni comercializa data como producto *(en el MVP; ver `BACKLOG.md`)*.

### Regla frente al HTML de Gildardo
El HTML es un prototipo de laboratorio. **Su superficie clínico-científica (matemática, indicadores, clasificaciones, lógica de encuesta, mapas EFyR, Diana de 81 escenarios) es obligatoria y se preserva al 100%.** Su superficie no-clínica es **referencia, no especificación**. Primer trabajo del bloque clínico: inventario/auditoría del HTML.

---

## Stack tecnológico

**Decisión:** Next.js (App Router, TypeScript) + Supabase, con el motor clínico como módulo aislado y agnóstico del framework. **Repositorio independiente.**

| Capa | Herramienta | Notas para Atlas |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript | Motor clínico **solo server-side** |
| DB/Auth/Storage | Supabase (Postgres, RLS, Auth, Storage) | Verificar residencia + DPA (Bloque 3) |
| ORM/migraciones | **Drizzle ORM** | Migraciones forward-only, SQL visible, amigable con RLS |
| UI | shadcn/ui + Tailwind | — |
| DNS/CDN/WAF | Cloudflare | Rate limiting de borde para superficies públicas |
| Hosting | Vercel | Región cercana a Supabase |
| Email | Resend | Invitaciones + envío de reportes (adjunto) |
| IA | Groq / Gemini | **Nunca PII**; aprobado por profesional; loguear modelo + versión de prompt |
| Errores | Sentry | **Scrubbing de PHI obligatorio** |
| Validación | Zod | En toda frontera + límite de tamaño de payload |
| PDF | @react-pdf/renderer | Render server-side |
| Iconos | Lucide-React | — |
| Testing | Vitest | Golden tests del motor, clasificaciones, RLS, propagación |
| MFA | Supabase Auth (TOTP) | Admin/internos en MVP; profesionales Post-MVP |
| Secretos | Gestor (Bitwarden/1Password) *(por confirmar)* | Credenciales de Biody Manager por equipo |

**Justificación:** TS es el lenguaje más cercano al origen → menor riesgo de port. Supabase entrega RLS, Auth, cifrado en reposo y Storage con URLs firmadas. La familiaridad del equipo reduce el riesgo bajo deadline. Postgres escala años por delante del volumen real; el motor aislado es portable si el resto cambia.

---

## Estructura de carpetas

```
atlas/
├── src/
│   ├── app/                              App Router, thin
│   │   ├── (auth)/                       login, reset (admin-forzado)
│   │   ├── (app)/                        Protegido por proxy
│   │   │   ├── dashboard/
│   │   │   ├── clinica/[patientId]/{evaluacion,diagnostico,tratamiento,seguimiento}/
│   │   │   ├── pacientes/ · comodato/ · comercial/ · reportes/ · admin/
│   │   │   └── layout.tsx                Sidebar adaptativo por rol
│   │   ├── (public)/                     Sin auth, con tokens opacos
│   │   │   ├── encuesta/[token]/         QR de encuesta (auto-fill profesional)
│   │   │   ├── checkout/[token]/         QR/link de checkout (24h)
│   │   │   └── {privacy,terms}/
│   │   ├── api/
│   │   │   ├── webhooks/{wompi,alegra}/route.ts   Firma HMAC + idempotencia
│   │   │   └── reportes/[id]/pdf/route.ts         PDF on-demand (acceso interno)
│   │   └── layout.tsx · error.tsx · globals.css
│   │
│   ├── clinical-engine/                  TS PURO. Cero imports de app.
│   │   ├── indicators/                   Cole-Cole, IFC, IRC, IEHH, ISCM_BIS, EB_BIS, IAE, FFMI...
│   │   ├── classifications/              cIFC, cIRC, cAF, cIR, cFFMI, cPABU, cICABIS...
│   │   ├── maps/                         E_BIS, RyF_BIS, EFR_BIS
│   │   ├── diagnosis/                    Diana de 81 escenarios (port fiel; ver §motor)
│   │   ├── version.ts                    Versión interna del motor
│   │   └── __tests__/golden/             Golden tests (paridad con HTML)
│   │
│   ├── modules/                          Dominio de negocio
│   │   ├── auth/                         {components, server, services, policies, data, validations, types}
│   │   ├── patients/ · professionals/
│   │   ├── evaluations/                  Encuesta + orquestación de la evaluación
│   │   ├── bis/                          Import CSV + valores crudos
│   │   ├── indicators/                   Persistencia de valores calculados (usa clinical-engine)
│   │   ├── diagnosis/ · treatment/ · followup/
│   │   ├── comodato/                     devices, assignments
│   │   ├── nutraceuticals/ · payments/   Wompi + Alegra
│   │   ├── reports/                      Genera y persiste el snapshot del reporte
│   │   ├── model-registry/               Modelo como entidad: variables, indicadores, clasificaciones, reglas, mapas, versiones + asignación de versión por profesional/org
│   │   ├── research-datasets/            Exports anonimizados (ligero en MVP)
│   │   └── audit/                        clinical_audit_log
│   │
│   ├── components/{ui, layout, shared}/
│   ├── lib/{supabase, ai, pdf, email, utils, constants}/
│   ├── core/{events, logger, errors, http}/
│   ├── hooks/ · types/database.generated.ts · proxy.ts
│   ├── tests/
├── supabase/{migrations, seed.sql, config.toml}
├── public/{brand, images}
└── docs/  ARCHITECTURE · SCIENTIFIC_MODEL · CLINICAL_ENGINE · DATABASE · SECURITY ·
          DATA_GOVERNANCE · BOUNDARIES · TESTING · GLOSSARY · API_INTEGRATIONS · DEPLOY · BRAND · BACKLOG · README
```

---

## El motor clínico (`src/clinical-engine/`)

Joya de la corona, con el límite más estricto del proyecto.

- **TypeScript puro, agnóstico del framework.** Cero imports de Next/React/Supabase. Frontera impuesta con ESLint (`no-restricted-imports`).
- **Server-side exclusivo.** Consumido por los services; nunca al cliente.
- **Versionado.** Versión interna del motor; todo registro clínico persiste su constelación de versiones.
- **Extraíble.** Sin dependencias de la app, levantarlo a `packages/clinical-engine/` después cuesta casi nada.

### Estrategia de migración (golden master)
1. **Inventario del HTML** (al recibir la entrega final): funciones de cálculo, qué consumen, dónde y cómo está la Diana.
2. **Capturar valores oro:** ejecutar las funciones del HTML *tal cual* contra cientos/miles de inputs. El código viejo decide la respuesta, no el agente.
3. **Portar a TS** dentro de `clinical-engine`.
4. **Test:** `output_TS == valor_oro` hasta el decimal que defina Gildardo.

**Guardarraíles:** los golden tests prueban *port == HTML*, no *HTML == clínicamente correcto* (esto lo firma Gildardo sobre una muestra). **Motor y encuesta congelados** hasta la entrega final.

**Sobre la Diana:** "81 = 3⁴" sugiere una matriz combinatoria; es probable que en el HTML ya sea tabular. Se porta **preservando la estructura del HTML**, no se re-arquitectura. Convertirla en un motor de reglas declarativo gobernado es dirección **Post-MVP** (ver `BACKLOG.md`): en un sistema clínico, mover lógica diagnóstica a "configuración" sin pasar por CI/tests/aprobación reubica el riesgo, no lo elimina.

---

## Patrones por capa
- **Pages/layouts:** Server Components, solo composición.
- **Server actions:** thin; validan (Zod), autorizan (policy), llaman service, retornan `Result<T, AppError>`.
- **Route handlers:** solo webhooks, PDFs on-demand, IA bajo demanda, endpoints públicos.
- **Services:** aquí vive la lógica; funciones puras cuando se puede; dependencias inyectadas.
- **Repositorios:** único lugar que llama a Supabase; queries tipadas, sin lógica.
- **Policies:** funciones puras `(user, resource, ctx?) => boolean`; verifican rol (vía `user_roles`), ownership, estado.
- **Capabilities IA:** `prompts/<task>.<version>.ts` + `schema.ts` (Zod) + `<task>.ts`. Nunca PII.

---

## Autenticación y autorización
- **Sin auto-registro.** El admin crea la cuenta y asigna rol.
- **Atlas:** el profesional usa **su propio correo**; configura su propia contraseña por invitación (el admin nunca la conoce). El admin puede forzar recuperación (llega al buzón propio del profesional).
- **Biody Manager (terceros):** credenciales controladas por CNV, aleatorias y únicas por equipo, en gestor de secretos. No derivadas de datos de la persona.
- **MFA (TOTP):** admin/internos → **MVP**; profesionales → Post-MVP.
- **RLS a nivel de DB:** cada profesional ve solo *sus* pacientes; convención de `organization_id`. Autorización por rol, **nunca por dominio de email**.
- **Offboarding:** desactivar (status inactivo, conserva atribución) + reasignar pacientes. Las cuentas clínicas no se reciclan.

---

## Datos, gobernanza y evidencia
- **Seudonimización operativa:** data clínica por `patient_id` (UUID); PII en `patient_profiles` con RLS estricto.
- **Anonimización (publicación/externo):** quitar el ID **más** tratar cuasi-identificadores. Quitar el ID no basta.
- **Constelación de versiones (procedencia):** cada registro clínico guarda `engine_version` + `survey_version_id` + `model_version_id` + `rules_version`.
- **Snapshot (evidencia):** se persiste como artefacto inmutable lo que el profesional vio/aprobó y el paciente recibió — `indicator_values`/clasificaciones/diagnóstico calculados **tal como fueron**, y el **reporte aprobado/enviado tal como fue**. Constelación + snapshot van juntos: la primera dice *con qué* se calculó, el segundo *qué* se decidió, sin depender de re-ejecutar motores viejos.
- **`clinical_audit_log`:** append-only (sin UPDATE/DELETE), inline, con `entity_id`, `payload` (jsonb), `model_version_id`, `ip_address`. Hash-chain → Post-MVP.
- **Consentimiento:** `consent_version` + hash del texto + timestamp inmutable.
- **Borrado:** soft-delete en dominio; log clínico/auditoría exento. "Derecho al olvido" → anonimización, no destrucción de evidencia.
- **Sistema de registro oficial:** Biody Manager es la fuente del escaneo crudo; **una vez el CSV se importa y valida, Atlas es el sistema de registro oficial** de la data clínica.

---

## Seguridad baseline (v1)
- Security headers (incl. CSP), CORS estricto.
- Rate limiting: 5 intentos/15 min en auth (bloqueo temporal + backoff); agresivo en superficies públicas.
- Validación Zod + límite de tamaño de payload.
- Cifrado en reposo y en tránsito.
- Sin API keys hardcodeadas; cuidado con `NEXT_PUBLIC_`; scanner de secretos en CI (gitleaks) + pre-commit.
- Queries parametrizadas (anti-SQLi); prohibido `dangerouslySetInnerHTML` (anti-XSS).
- PDFs del paciente: **adjuntos al correo**; URLs firmadas con expiración solo para acceso interno desde Storage.
- Sentry con scrubbing de PHI.
- Webhooks (Wompi/Alegra): verificación HMAC + idempotencia.
- Tokens opacos, firmados y con expiración para entradas públicas.
- Backups con restauración probada; escaneo de dependencias; revisión de seguridad antes de lanzar.

---

## Superficies públicas (no autenticadas)
- **QR de encuesta:** **token opaco** que mapea a (profesional, organización) en servidor — nunca el `professional_id` crudo.
- **QR/link de checkout:** válido **24h**, atado a orden + monto, con idempotencia.

---

## Integraciones externas
- **Biody Manager (terceros, nube + escritorio):** aloja data cruda + PII. Superficie externa de PHI (ver `SECURITY.md`). Punto de control real: **validación del CSV al importar** (`bis_import_logs`, Zod, rangos). Identificadores en `devices`: `manufacturer_serial` + `asset_code` + `system_email`.
- **Wompi:** checkout; webhooks verificados + idempotencia.
- **Alegra:** contabilidad; sincronización de transacciones/facturas.
- **Groq / Gemini:** apoyo a la decisión; sin PII; aprobado por profesional; modelo + versión de prompt logueados.

---

## Bus de eventos
`core/events/bus.ts`: emisor in-memory **no durable**. No usarlo para flujos críticos no-idempotentes ni procesos largos. **El audit clínico nunca va por el bus** — va inline. El bus queda para notificaciones/emails tolerantes a pérdida.

## Background jobs (estrategia)
MVP: inline + **Vercel Cron** para lo agendado (ej. recordatorios de comodato que expira). Post-MVP: **Inngest** (candidato líder) para durabilidad y procesos largos (PDFs masivos, sync Alegra, exports, IA).

## Errores
Jerarquía `AppError` (`ValidationError`, `Authentication/AuthorizationError`, `NotFoundError`, `DomainError`, `InfrastructureError`) + catálogo de códigos en `core/errors/`. Server actions retornan `Result<T, AppError>`.

## Observabilidad
Sentry (con scrubbing de PHI) + `core/logger` con contexto por request vía AsyncLocalStorage: `requestId`, `userId`, `role`, `module`.

## Caché e invalidación
Next es dinámico por defecto. **Entidades clínicas/de paciente: dinámico, sin caché.** Solo se cachea lo estable (catálogo de nutracéuticos, definiciones de indicadores) con tags + invalidación por evento.

## Runtime
Node.js para todo. Excepción acotada: `proxy.ts` en Edge para refresco de sesión y redirects de auth.

---

## Decisiones diferidas (ver `BACKLOG.md`)
Diana como reglas declarativas gobernadas; infraestructura de datasets de investigación versionados/reproducibles; capa científica en Python; analítica avanzada y comercialización de data; MFA de profesionales; hash-chain en el log clínico; event bus durable + jobs (Inngest); feature flags genéricos; LMS integrado real; scoring avanzado; E2E con Playwright; backups externos automatizados.

## Items abiertos por verificar
- [ ] Marco legal y ético del dato (consentimiento, retención, comodato): chat dedicado + revisión jurídica.
- [ ] Texto y versión del consentimiento informado.

## Documentos relacionados
`SCIENTIFIC_MODEL.md` (qué es ANI-BIS-E) · `CLINICAL_ENGINE.md` (cómo se implementa el motor) · `CLAUDE.md` · `BOUNDARIES.md` · `DATABASE.md` · `SECURITY.md` · `DATA_GOVERNANCE.md` · `TESTING.md` · `GLOSSARY.md` · `API_INTEGRATIONS.md` · `DEPLOY.md` · `BRAND.md` · `BACKLOG.md` · `README.md`

## Disciplina arquitectónica
1. Toda PR se revisa contra las reglas duras.
2. Toda migración SQL, policy RLS, fórmula clínica, evento de dominio y prompt IA se commitea explicando el **porqué**.
3. Este documento se pasa como contexto a Claude Code en el primer prompt de cada bloque.
4. Las desviaciones se documentan primero acá, con justificación, y luego se implementan.

---

## Cambios v1.1
Drizzle ORM decidido · snapshots + constelación de versiones (procedencia + evidencia) · `survey_version_id`/`rules_version`/`engine_version` cableados · `model-versioning`→`model-registry` (modelo como entidad + asignación de versión por profesional) · `research-export`→`research-datasets` · sistema de registro oficial explícito · `SCIENTIFIC_MODEL.md` separado de `CLINICAL_ENGINE.md` · estrategia de jobs · logger con `role`/`module` · Diana: port fiel ahora, declarativa Post-MVP.
