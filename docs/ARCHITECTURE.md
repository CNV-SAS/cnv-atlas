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
16. **La ciencia congelada no se edita.** Los archivos de `src/clinical-engine/frozen/` (`engine.core.js`, `engine.indices.js`, `engine.dfi.js`) no se editan, no se convierten a TypeScript, no se reformatean y no se corrigen, ni siquiera un bug conocido y confirmado (ver `GILDARDO_QUERIES.md` Q2, TDZ latente aceptado). Son extractos verbatim de la autoría de Gildardo y su fidelidad byte a byte es lo que hace demostrable la regla 6. Exponer funcionalidad que **ya existe** dentro de ellos se hace **únicamente** por el mecanismo de archivo derivado: copia byte a byte del original más una sola línea final aditiva `Object.assign(module.exports, { ... })`, con un test en CI que verifica que el diff contra el original es exactamente esa línea. Ese mecanismo admite **solo exports aditivos, nunca lógica ni fórmulas**. Cualquier cambio a la ciencia lo entrega Gildardo como `.js` nuevo y entra por swap limpio con golden actualizado (regla 6).
17. **Un archivo citado por un encabezado de custodia no se renombra, no se mueve, no se edita: solo se agrega al lado.** Los byte-sources de la ciencia congelada están anclados por procedencia y renombrarlos o moverlos la rompe: `reference/ATLAS_v7.html` (16.878 líneas, byte-source del motor B11, citado por los tres `.js` de `frozen/`) y `docs/entregas/gildardo-2026-07/ATLAS.html` (16.724 líneas, byte-source de `atlas-protocolo.js`). "Arreglar" un encabezado de custodia para compensar un renombre sería editar un archivo de `frozen/`, que viola la regla 16. **Trampa de nombres:** Gildardo llama `ATLAS_v7.html` a TODOS sus archivos ("v7" es la generación del modelo, no la versión del archivo); el nombre no carga versión y no la va a cargar. La desambiguación es por **ruta + conteo de líneas** (huella digital), nunca por el nombre. **Convención para entregas nuevas:** carpeta con la **fecha del día** (`docs/entregas/gildardo-YYYY-MM-DD/`, no del mes: la carpeta `gildardo-2026-07` es del 24 de julio y no admite un segundo archivo de julio), **conservando el nombre original que él le ponga** (la ruta desambigua, no se renombra; renombrar es lo que causó la confusión). La **tabla de resolución** que mapea archivo → ruta → conteo de líneas → qué encabezados lo citan → de qué documento de Gildardo son sus referencias de línea vive en `docs/entregas/gildardo-2026-07/INVENTARIO.md`.

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

**La fidelidad al HTML aplica a la FORMA, no a los permisos** (lección 2026-07-29): que el prototipo deje a un rol ver algo no obliga a Atlas a darle ese permiso. Ejemplo: el prototipo deja al admin ver las cuatro pestañas de tratamiento en solo-lectura; Atlas NO amplía por eso la visibilidad del admin sobre contenido clínico (va contra la separación operativo/clínico). La forma se porta; los permisos los decide el proyecto.

**Ningún documento de terceros se porta por NÚMERO DE LÍNEA sin el artefacto exacto que cita** (lección 2026-07-30, la más cara de esta familia). Un documento de Gildardo que cita "ATLAS_v7.html:14088" DEBE venir con ese archivo: portar contra otra revisión aterriza en contenido plausible pero distinto, sin error visible (familia del bug de cintura, a escala de trece cambios). Verificado en la segunda ronda: cinco líneas citadas caían todas sobre contenido distinto en nuestra entrega, con desfases inconsistentes. Prueba de identidad antes de portar: unas pocas líneas citadas deben caer sobre lo que el documento describe.

**Un documento de decisiones NO es evidencia de que el artefacto cambió** (lección 2026-07-30, corolario del anterior). Un doc de Gildardo titulado "Decisiones" anuncia lo que decidió, no lo que ya aplicó en su HTML; su redacción ("se corrige", "se parte en dos") es ambigua entre "queda hecho" y "hay que hacerlo". Antes de portar cualquier cambio suyo, se VERIFICA en el archivo que el cambio ESTÉ presente. Si no está, es una decisión pendiente de implementar, no un port. Verificado en la ronda 2026-07-30: la **cintura** (dijo que la corrigió) sigue leyendo el umbral `REFERENCEESTIMEE` en su archivo nuevo (línea 5600), no `"Waist Size cm"`; y el **cáncer en remisión** (dijo que no activa el hipercalórico) lo sigue disparando por substring (línea 14025). Consecuencia de gobernanza, seria: para las decisiones que cambian la CIENCIA CONGELADA, hay que definir QUIÉN las implementa (Gildardo en su archivo, o nosotros desde su especificación escrita), porque implementarlas nosotros editaría su modelo, que la regla 16 prohíbe. Se pregunta antes de portar los trece cambios C1-C13. Ver `GILDARDO_QUERIES.md`.

**SU PROSA ORIENTA, SU CÓDIGO ESPECIFICA (regla operativa, 2026-07-30).** Cuando la descripción en prosa de Gildardo y su código difieran, **manda el código**, y la discrepancia se registra como pregunta, no se resuelve eligiendo. Aplica incluso cuando el documento parece explícito. Tres casos en la misma entrega, todos donde la prosa parecía clara y aun así no coincidía: **cintura** (dice que la corrigió, el archivo no), **cáncer** (dice que lo partió, el cálculo sigue disparando el hipercalórico por substring), **delta** (describe "distancia al borde más cercano", su código elige un borde clínicamente relevante POR indicador: IMC contra el superior, FFMI contra el inferior). No son errores suyos: son SIMPLIFICACIONES; cuando describe su propio trabajo en prosa, redondea. Por eso se porta verbatim del código, no de la descripción, y la diferencia va a la ronda siguiente como confirmación (no como bloqueo). **Cuarto caso (2026-08-01, respuesta P0/EB-BIS):** dice que "el ICEC se deriva del **Diagnóstico Funcional Integrado (DFI)**". Su código dice lo contrario: `calcLE8` (`engine.dfi.js`) computa el ICEC/LE8 de la **ENCUESTA** (campos `d1_9`, `d1_10`, `d1_16` de Alimentación/Hidratación) y ese ICEC ALIMENTA al DFI (es el insumo del Dominio 5 en `computeDFI`), no al revés. La dirección de la dependencia en su prosa está invertida. Es imprecisión al describir, no un cambio: el motor no se toca.

**Trampa de nomenclatura R1-R9 (advertencia de Gildardo, 2026-07-30):** las etiquetas `R1`-`R9` se usan para DOS cosas sin relación: las **rutas de atención** del DFI (R1-R6) y los **anillos del mapa de estados funcionales** (líneas ~11302-11311 del HTML). El `R2` del mapa NO es la ruta `R2`. Al portar cualquiera de los dos, no cruzarlos.

---

## Stack tecnológico

**Decisión:** Next.js (App Router, TypeScript) + Supabase, con el motor clínico como módulo aislado y agnóstico del framework. **Repositorio independiente.**

| Capa | Herramienta | Notas para Atlas |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript | Motor clínico **solo server-side** |
| DB/Auth/Storage | Supabase (Postgres, RLS, Auth, Storage) | Residencia decidida (Estados Unidos); archivado de DPA en B15 |
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
| Secretos | Bitwarden (Free) | Credenciales de Biody Manager por equipo |

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

- **TypeScript puro, agnóstico del framework.** Cero imports de Next/React/Supabase. Frontera impuesta con ESLint (`no-restricted-imports`). Excepción nombrada abajo para la ciencia congelada.
- **Server-side exclusivo.** Consumido por los services; nunca al cliente.
- **Versionado.** Versión interna del motor; todo registro clínico persiste su constelación de versiones.
- **Extraíble.** Sin dependencias de la app, levantarlo a `packages/clinical-engine/` después cuesta casi nada.

### Excepción nombrada a la regla dura 12: ciencia congelada en JavaScript

> **No confundir 12 con 16.** La regla **12** es sobre pureza (`clinical-engine` es TypeScript sin imports de la app); esta sección es su excepción, porque la ciencia congelada es JavaScript CommonJS. La regla **16** es sobre inmutabilidad (los `.js` congelados no se editan). Son cosas distintas: 12 explica *por qué son `.js`*, 16 explica *por qué no se tocan*. Citar la 12 para justificar que no se editan es incorrecto.

**Qué.** Los tres archivos de ciencia del motor (`src/clinical-engine/frozen/engine.core.js`, `engine.indices.js`, `engine.dfi.js`) viven como **JavaScript CommonJS**, no como TypeScript. Es una excepción FORMAL y PERMANENTE a la regla dura 12 ("es TypeScript puro"), aprobada por Santiago (B11, 2026-07-06).

**Por qué.** Son extractos *verbatim* (byte a byte) del prototipo final de Gildardo (`ATLAS_v7.html`). La fidelidad matemática (regla dura 6) manda sobre el estilo: convertirlos a TS los editaría, rompería la paridad exacta con el HTML y complicaría el reemplazo limpio cuando Gildardo entregue una versión nueva. Nunca se convierten a TS ni se editan a mano; cualquier cambio a la ciencia lo entrega Gildardo como un `.js` nuevo.

**Alcance y salvaguardas.** La excepción cubre SOLO esos tres archivos, aislados en `frozen/`. Se auditó en B11 que son puros (sin imports de framework/app, sin I/O, sin red, sin secretos, deterministas: sin `Date`/`Math.random`). Están excluidos de ESLint (son verbatim, no se estilizan) y tipados con `.d.ts` hermanos. Todo lo demás del motor (el adaptador, el borde `edge/`, el contrato y los tipos) es TypeScript normal y envuelve a la ciencia congelada; la app nunca importa los `.js` directamente. Los golden tests prueban la paridad; el lint no aplica a la ciencia.

### Estrategia de migración (golden master)
1. **Inventario del HTML** (al recibir la entrega final): funciones de cálculo, qué consumen, dónde y cómo está la Diana.
2. **Capturar valores oro:** ejecutar las funciones del HTML *tal cual* contra cientos/miles de inputs. El código viejo decide la respuesta, no el agente.
3. **Portar** dentro de `clinical-engine`: la ciencia congelada entra verbatim como `.js` en `frozen/` (ver excepción a la regla 12); el adaptador y el borde son TS.
4. **Test:** `output_motor == valor_oro` hasta el decimal que defina Gildardo (tolerancia 1e-3).

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
- **Snapshot (evidencia):** se persiste como artefacto inmutable lo que el profesional vio/aprobó y el paciente recibió — `indicator_values`/clasificaciones/diagnóstico calculados **tal como fueron**, y el **reporte aprobado/enviado tal como fue**. Constelación + snapshot van juntos: la primera dice *con qué* se calculó, el segundo *qué* se decidió, sin depender de re-ejecutar motores viejos. El snapshot es **autosuficiente**: congela también el contenido clínico del estado EFR del registry (nombre, mecanismo, biomarcadores, riesgos), para que la vista de resultados no re-derive evidencia del registry vivo.
- **Una `model_version` es inmutable (invariante).** El contenido y la numeración del registry de una versión del modelo (`efr_states`, `indicator_definitions`, `phenotypes`, `fr_sectors`, mapas, cortes) NO se editan in-place una vez que existen diagnósticos que la referencian: cambiar contenido o numeración exige una **versión nueva del modelo**, nunca un reseed sobre la misma `model_version_id`. Si se mutara in-place, cualquier registro clínico que resuelva contra el registry vivo (por `model_version_id` + número) se re-etiquetaría con contenido que no existía cuando se decidió, reescribiendo evidencia sin rastro. El snapshot autosuficiente (arriba) es la defensa primaria; este invariante es la de proceso. **Salvedad:** el seed de desarrollo puede reseedear el registry local (BD sin pacientes reales); la regla aplica a producción y a cualquier entorno con diagnósticos legítimos.
- **Toda versión de catálogo sellada por registros clínicos es inmutable (mismo principio, regla 7).** Aplica también a `bis_condition_versions` (condiciones de la toma BIS): cada `evaluation_bis_intake` SELLA la versión bajo la que respondió. Reemplazar el contenido de una versión en sitio deja registros diciendo "respondí bajo v1" contra una v1 cuyo contenido cambió, justo la inconsistencia que el versionado evita. Después del lanzamiento: **NUNCA** se reemplaza contenido en sitio; se crea una **versión nueva**.
  - **Excepción PUNTUAL, fechada y acotada (2026-07-24):** el contenido de la **v1** del catálogo de condiciones BIS se reemplazó **en sitio** (no se creó v2) al integrar la tabla ampliada de contraindicaciones de Gildardo (tipo `validez`: amputación, edema/anasarca, febril/deshidratación; embarazo enriquecido). **Admisible SOLO porque** era **pre-producción y sin registros clínicos reales** sellados contra la v1. **Condición cumplida:** los intakes demo sellados contra la v1 se **limpiaron ANTES** de re-sembrar el contenido (sin registros huérfanos). **Límite:** esta excepción NO sienta precedente; después del lanzamiento, cualquier cambio de contenido del catálogo va por versión nueva, sin excepción.
- **El reporte aprobado es inmutable, protegido por un trigger de BD.** Un trigger sobre `reports` bloquea el `DELETE` y cualquier cambio del `snapshot` (los `UPDATE` de estado, aprobar/enviar, sí pasan). Es la defensa de BD del snapshot de evidencia (arriba): un reporte aprobado no se edita ni se borra.
  - **Vía de bypass, existe y queda acotada aquí:** dentro de una transacción, `SET LOCAL session_replication_role = replica` desactiva ese trigger (y las FK) y permite borrar un reporte para regenerarlo. **Para qué se usó (2026-07-24):** regenerar el diagnóstico y el reporte del caso **demo `a2`** (Demo GoldenPath) tras congelar contenido nuevo en el snapshot (las rutas de atención, Tratamiento T1), para que la demo reflejara el formato actual. Se borró SOLO la salida del pipeline de `a2` y se re-corrió `pnpm seed:golden`. **Límite (innegociable):** SOLO en **demo/pre-producción, sin registros clínicos reales**. En producción un reporte aprobado **NUNCA** se modifica ni se borra por esta vía; una corrección se hace por **versión nueva** (nuevo diagnóstico/reporte que supersede al anterior, dejando el original intacto y auditado). Que exista forma de saltar el trigger de inmutabilidad debe estar **escrito y acotado**, no depender de memoria de sesión.
- **El protocolo de tratamiento tiene su propio trigger de inmutabilidad (T2 A2, `treatments_immutability`, migración 0026).** Dos sellos (regla 7): `protocol_suggested` es **write-once** (salida del motor, sellada al crear el protocolo, congelada incluso en draft); al pasar a `status='approved'` se congelan `protocol_approved`, los `approved_*` y las columnas de la prescripción (`kcal_objetivo`, `proteina_g`, los `adj_*`, `micronutrientes_texto`). Quedan **editables tras aprobar** por diseño: `proxima_cita` (logística, no prescripción), `restricciones` (text[] del profesional, la lee `generate-menu.ts`, que corre después de aprobar) y `restrictions_ack_*` (el reconocimiento puede ocurrir al ir a generar el menú, después de aprobar; congelarlos rompería ese gate). Un protocolo aprobado no se re-aprueba: se corrige por versión nueva (bloque de corrección, sin construir). **La misma vía de bypass (`SET LOCAL session_replication_role = replica`) también desactiva este trigger, con el mismo límite** (solo demo/pre-producción, sin registros clínicos reales; en producción se corrige por versión nueva, nunca por esta vía). Quien lea que `protocol_approved` es inmutable encuentra aquí, en el mismo lugar, que existe esa vía y su acotación.
- **La confirmación del diagnóstico tiene su propio trigger de inmutabilidad (mini-bloque, `diagnoses_confirmation_immutability`, migración 0027).** Confirmar es la FIRMA CLÍNICA del diagnóstico (acto propio del profesional asignado, que habilita prescribir sobre él): una vez sellada (`confirmed_by`/`confirmed_at`), no se cambia ni se borra. El trigger permite `null -> valor` (confirmar una vez, incluida la vía de `approveReport` que confirma `WHERE confirmed_by IS NULL`) y bloquea cambiar/limpiar una confirmación sellada (UPDATE) y borrar un diagnóstico confirmado (DELETE). **La misma vía de bypass (`SET LOCAL session_replication_role = replica`) también desactiva este trigger, con el mismo límite** (solo demo/pre-producción, sin registros clínicos reales; en producción se corrige por versión nueva). Confirmar es PERMANENTE: sin deshacer, sin corrección, salvo el flujo de corrección (que no existe). Por eso el botón de confirmar (T2b B-0) es el más peligroso de la app; su superficie lo debe decir explícito (ver BACKLOG).
- **El copy de interfaz TAMBIÉN es documentación y se verifica igual (patrón recurrente, 6ª vez a 2026-07-30).** Un texto de pantalla que describe una capacidad del sistema (una salida, una alternativa, un mecanismo de corrección) es una afirmación sobre el código, y envejece o afirma de más igual que un comentario de schema o una regla dura. Se verifica contra el código antes de mostrarlo, con el agravante de que lo lee un profesional que toma una decisión clínica con esa información. Caso que lo motiva (T2b B-0): el panel de confirmación prometía "para cambiar el análisis se genera una versión nueva" y ofrecía "remitir al paciente", cuando NINGUNO de los dos existe (el flujo de corrección es un Hito futuro; remitir no es una acción, solo contenido que se lee). Es la misma familia del texto que afirma lo que el código no hace, ahora en pantalla. **Modo de falla propio de escribir UI para un flujo incompleto:** se describe el sistema que se quiere, no el que hay. Corolario (1c del mismo caso): **cuando una pantalla ofrece una salida, una alternativa o una capacidad, hay que verificar que exista Y que sea alcanzable DESDE DONDE SE OFRECE**, no solo que exista en alguna parte. La salida "remitir" mandaba a Tratamiento, que estaba bloqueado justo por no confirmar (resultó no ser circular, las remisiones sí se ven sin confirmar, pero eso se verifica, no se supone).
- **Qué se SELLA (prescripción) vs qué se COMPUTA en tiempo de vista (orientación) (criterio, 2026-07-30).** Regla para no decidir por analogía con lo último: en el snapshot inmutable se **sella** lo que es PRESCRIPCIÓN, lo que se le prescribió a ESE paciente ESE día y se le entrega (rutas, remisiones, objetivos, frecuencia de seguimiento); es acto clínico y no puede cambiar retroactivamente (por eso las rutas se congelan, T1). NO se sella lo que es **orientación para el profesional** sobre cómo abordar el estado y no se entrega al paciente: eso se **computa en tiempo de vista** desde datos ya sellados + quién mira. Caso que fija el criterio: el **abordaje por profesión** (`efrProf`, "del rol logueado") se computa desde la clave EFR sellada + la profesión del que mira, no se sella (dos profesionales ven textos distintos del mismo diagnóstico; sellar un único valor no tendría sentido, y sellar los cuatro no cubre los diagnósticos ya inmutables). **Consecuencia aceptada y escrita:** si Gildardo entrega un `efrProf` nuevo, los diagnósticos viejos mostrarán el texto NUEVO, no el que vio el profesional ese día; aceptable porque es orientación, no prescripción, pero dicho a propósito para no descubrirlo después. **Ejemplos vivos del criterio (2026-07-30):** la clasificación de AF/IR se SELLA (va en `classifications` del snapshot), así que arreglarla solo se ve en diagnósticos NUEVOS; en cambio Referencia/Δ y el color de severidad se COMPUTAN al mostrar (recomputados del snapshot), así que arreglarlos se ve en TODOS los diagnósticos, viejos y nuevos, de inmediato. El mismo paciente viejo puede terminar con el color de AF (computado) pero la etiqueta "N/D" (sellada): es la consecuencia directa del criterio, no un bug.
- **Un test puede pasar mientras la pantalla sigue mostrando el valor VIEJO (lección 2026-07-30).** El test corre el motor FRESCO; la pantalla lee lo que se SELLÓ en el snapshot (registro inmutable). Cuando un arreglo toca algo que se sella, "el fix funciona" (lo prueba el test con un diagnóstico nuevo) y "la pantalla lo muestra" (para un paciente ya diagnosticado) son DOS afirmaciones distintas, y solo un diagnóstico NUEVO verifica la segunda. Caso: el fix de la clasificación de AF/IR pasó su test pero el smoke seguía mostrando N/D, porque ese paciente se diagnosticó antes del arreglo y su snapshot es inmutable. **Al reportar un arreglo sobre datos sellados, decir explícitamente a qué diagnósticos aplica** (solo nuevos, si se sella; todos, si se computa al mostrar). Es la cara operativa del criterio sella-vs-computa de arriba.
- **La verificación "¿coincide con su fuente?" aplica también a lo que CABLEAMOS, no solo a lo que portamos verbatim (lección 2026-07-30).** De la familia de "documentación que envejece", pero peor: aquí era CÓDIGO. Al portar el motor (B11) hicimos el frozen byte-idéntico a su fuente (regla 16, golden), pero el CABLEADO alrededor (qué clasificadores llama el pipeline, qué filas muestra la vista) nunca se comparó contra lo que el HTML de Gildardo muestra. Resultado: `cAF`/`cIR` estaban exportados en el frozen y nunca se llamaban (la tabla mostraba N/D), y un conjunto de filas de la tabla de Wang/Niveles que el HTML muestra (ASMI, SMM/W, AEC/MCA, E/I…) quedaron sin cablear; se detectó por casualidad, revisando la tabla de indicadores, meses después. La misma pregunta que se hace sobre un artefacto portado ("¿coincide con su fuente?") se hace sobre el cableado que lo consume. Inventario en `BACKLOG.md`.
- **Los documentos que registran correspondencia (enviada o recibida) son INMUTABLES en su cuerpo (regla, 2026-08-01).** Si algo en ellos resulta incorrecto después, se anota una **corrección fechada al pie**; nunca se edita lo enviado. Un registro de correspondencia corregido a posteriori deja de servir para lo único que sirve: saber **qué leyó la otra parte**. Es el MISMO principio que gobierna el registro clínico (no se reescribe lo emitido, se deja constancia de lo que cambió), aplicado por primera vez a documentación en vez de a datos. Caso que lo fija: al barrer la justificación falsa "los profesionales se entrenan con el HTML" (2026-07-31), dos instancias vivían en cartas ya enviadas a Gildardo (`docs/entregas/GILDARDO_2026-07_PENDIENTES.md`, `GILDARDO_2026-07-30_SEGUNDA_RONDA.md`); se corrigieron los docs vivos (que describen el estado actual) pero NO el cuerpo de las cartas: llevan una nota de corrección fechada al pie. Distinción operativa: un doc que **describe el estado del sistema** se edita para mantenerlo verdadero; un doc que **registra un acto de comunicación** no, porque su valor es ser fiel a lo que se dijo, no a lo que ahora sabemos.
- **Arreglar un dato donde DUELE no lo arregla donde también VIVE (patrón recurrente, 5ª vez a 2026-07-29).** Cuando se corrige un mapeo o una decisión de dato, la corrección se verifica en TODOS los subsistemas que declaran ese dato, no solo en el que produjo el síntoma. Casos: el fix de `cintura` aterrizó en `modules/bis` + `buildComposition` pero `biody-columns` (contrato del motor) quedó con la columna equivocada; la confirmación del diagnóstico como efecto lateral de un solo camino; una regla 12 mal citada en varios sitios. Un fix de un solo sitio con la premisa "esto es todo" es la señal de alarma.
- **Todo artefacto VERBATIM se protege también del formateo automático.** Los archivos con contenido byte-idéntico a una fuente (frozen/, harness Vía C, tablas de contenido portado) llevan su DIFF byte a byte, pero además van en `.prettierignore`: Prettier reformateándolos rompería el DIFF por una razón cosmética, y "arreglar" el DIFF relajando la comparación es el camino por el que un candado se afloja. El DIFF verifica la fidelidad; el `.prettierignore` evita que se rompa sin querer. Es parte del patrón del mecanismo de archivo derivado (regla 16).
- **`clinical_audit_log`:** append-only (sin UPDATE/DELETE), inline, con `entity_id`, `payload` (jsonb), `model_version_id`, `ip_address`. Hash-chain → Post-MVP.
- **Consentimiento:** `consent_version` + hash del texto + timestamp inmutable.
- **Borrado:** soft-delete en dominio; log clínico/auditoría exento. "Derecho al olvido" → anonimización, no destrucción de evidencia.
- **Sistema de registro oficial:** Biody Manager es la fuente del escaneo crudo; **una vez el CSV se importa y valida, Atlas es el sistema de registro oficial** de la data clínica.
- **Migraciones Drizzle: `"nothing to migrate"` NO verifica la base real (lección T2 A1, 2026-07-27).** `drizzle-kit generate` compara `schema.ts` contra el **archivo snapshot**, nunca contra la BD. Un `"nothing to migrate"` en verde solo dice que `schema.ts` y el snapshot coinciden **entre sí**; la base puede haber quedado en otro estado. La consistencia con la BD real se verifica **introspeccionando `information_schema`** (p. ej. `SELECT data_type, udt_name FROM information_schema.columns WHERE ...`), no confiando en el diff de generate. Corolario del mismo caso: **`drizzle-kit` sub-genera para `text -> enum`**: emite el `CREATE TYPE` y el `RENAME`, pero **no** el `SET DATA TYPE` ni la migración de datos. Toda migración futura a enum sobre una columna con datos exige (1) endurecimiento manual del `.sql` (agregar el `UPDATE` de mapeo antes del cast y el `SET DATA TYPE ... USING`), (2) chequear antes DEFAULT/vistas/CHECK sobre la columna (los tres hacen fallar el `SET DATA TYPE` a mitad de migración, con los statements previos ya aplicados), y (3) verificar por introspección que la columna quedó del tipo esperado.
- **Las migraciones viven en `drizzle/`, NO en `supabase/migrations/` (trampa, 2026-07-27).** Las migraciones de este proyecto se aplican con `pnpm db:migrate` (drizzle-kit) sobre los `.sql` de `drizzle/`. La carpeta `supabase/migrations/` está **vacía pero PARECE autoritativa**: cualquier `.sql` puesto ahí **nunca se ejecuta** (`supabase db reset` la mira, no `drizzle/`; se verificó el 2026-07-27 que un reset deja la base vacía porque no encuentra las migraciones reales). Es una **falla silenciosa**: se creería que una migración quedó aplicada cuando no corrió. **Salvaguarda propuesta (no ejecutada):** un `README` dentro de `supabase/migrations/` que diga "NO usar, las migraciones viven en `drizzle/`", y/o una verificación en CI que **falle si aparece cualquier `.sql`** en `supabase/migrations/`. Se decide al construir el bloque de despliegue.
- **Operación destructiva del entorno local = avisar ANTES (norma 2026-07-27).** Cualquier comando que borre o reemplace datos del entorno local de quien opera (`supabase db reset`, seed destructivo, borrado de volúmenes de Docker) se **avisa antes de ejecutarlo, aunque esté autorizado**. Una línea basta: "voy a correr X, esto borra Y, lo restauro con Z". Un reset es más destructivo que una migración, y las migraciones ya van con gate; el reset deja la base **vacía** (no restaura), así que sin la secuencia de restauración el entorno queda inservible (ver `ENTORNO.md`).

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
- **Biody Manager (terceros, nube + escritorio):** aloja data cruda + PII. Superficie externa de PHI (ver `SECURITY.md`). Punto de control real: **validación del XLSX al importar** (`bis_import_logs`, Zod, rangos). Identificadores en `devices`: `manufacturer_serial` + `asset_code` + `system_email`.
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
- [ ] Texto y versión final del consentimiento informado: revisión jurídica.
- [ ] Marco legal y ético del dato (retención, comodato): chat dedicado + revisión jurídica.

Decididos (ya no abiertos): residencia del dato en Estados Unidos (`DATA_GOVERNANCE.md` decisión #3); gestor de secretos Bitwarden (plan Free).

## Documentos relacionados
`SCIENTIFIC_MODEL.md` (qué es ANI-BIS-E) · `CLINICAL_ENGINE.md` (cómo se implementa el motor) · `CLAUDE.md` · `BOUNDARIES.md` · `DATABASE.md` · `SECURITY.md` · `DATA_GOVERNANCE.md` · `CONSENT_ATLAS.md` · `TESTING.md` · `GLOSSARY.md` · `API_INTEGRATIONS.md` · `DEPLOY.md` · `BRAND.md` · `BACKLOG.md` · `README.md`

## Disciplina arquitectónica
1. Toda PR se revisa contra las reglas duras.
2. Toda migración SQL, policy RLS, fórmula clínica, evento de dominio y prompt IA se commitea explicando el **porqué**.
3. Este documento se pasa como contexto a Claude Code en el primer prompt de cada bloque.
4. Las desviaciones se documentan primero acá, con justificación, y luego se implementan.

---

## Cambios v1.1
Drizzle ORM decidido · snapshots + constelación de versiones (procedencia + evidencia) · `survey_version_id`/`rules_version`/`engine_version` cableados · `model-versioning`→`model-registry` (modelo como entidad + asignación de versión por profesional) · `research-export`→`research-datasets` · sistema de registro oficial explícito · `SCIENTIFIC_MODEL.md` separado de `CLINICAL_ENGINE.md` · estrategia de jobs · logger con `role`/`module` · Diana: port fiel ahora, declarativa Post-MVP.
