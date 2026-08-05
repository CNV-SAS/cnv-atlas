# PLAN_GRANTS.md — Cerrar el acceso amplio del admin al contenido clínico

**Estado: PLAN, NO se arranca sin la respuesta del abogado de Santiago.** Es acceso a datos de salud; una decisión mal tomada aquí es cara de deshacer. Gate del Hito 2/3 (ver `LANZAMIENTO.md`, `BACKLOG.md` "Extender el mecanismo de grants", `DATA_GOVERNANCE.md:237`).

**Qué es.** Hoy el rol `admin` tiene `has_role('admin')` en el SELECT de casi toda la PHI: un "god-view" latente. El bloque de auditoría ya cerró 3 tablas (las notas narrativas) y las enrutó por el mecanismo de grants (Niveles a/b/c). El chat legal confirmó que el mismo control debe cubrir el RESTO del contenido clínico identificado. Este documento lo dimensiona.

---

## 1. Inventario: 22 tablas con acceso admin-amplio (categoría B)

Ya grant-gated (categoría A, hechas): `evaluation_notes`, `diagnosis_notes`, `treatment_notes`.

Por cerrar (SELECT con `has_role('admin')`), agrupadas:
- **Insumos + motor (8):** `evaluations`, `evaluation_bis_intake`, `bis_measurements`, `bis_raw_values`, `bis_import_logs`, `indicator_values`, `survey_responses`, `survey_answers`.
- **Salidas clínicas (9):** `diagnoses`, `treatments`, `treatment_nutraceuticals`, `treatment_diet_guidelines`, `nutraceutical_usage`, `ai_menu_suggestions`, `followups`, `followup_metrics`, `reports` (incl. `professional_notes`, texto libre equivalente a las notas ya cerradas), `clinical_corrections`.
- **Identidad del paciente (4):** `patients`, `patient_profiles` (nombres), `patient_contacts` (correo/tel), `patient_consents`.

Matices:
- `patients_select` también da a **soporte** (documento, no nombres) — ver decisión 3.
- `treatment_nutraceuticals` / `treatment_diet_guidelines` usan una policy `_admin_select` DEDICADA (cerrar = quitar la policy entera, no editar un OR).
- Borderline a revisar en el mismo cierre: `patient_professional_relationships` (`ppr_select` = admin OR soporte OR profesional dueño).
- **Fuera de alcance** (no PHI): catálogos/versiones, `research_datasets` (anonimizado), `clinical_audit_log` (su propia gobernanza), financieras (`transactions` etc., no unen PII del paciente en su fila).

## 2. Las cuatro superficies que se rompen al cerrar

**Ningún dashboard de admin agrega dato clínico** — el acceso amplio es god-view latente, no cableado a analítica (`/direccion` financiero, `/obbia` anonimizado, `/dashboard` y `/comercial` placeholders). Lo que sí se rompe/degrada, porque `nav-config.ts` fija `admin` ahí:

| Superficie | Tablas | Efecto |
|---|---|---|
| `/evaluaciones` + `/evaluaciones/[id]` + tabs `/clinica` | evaluación completa (evaluations, survey, bis, indicadores, diagnoses, treatments, reports, followups) | **Rompe** (god-view más rico: lista vacía, detalle 404) |
| `/reportes` + `/reportes/[id]` + PDF | reports (incl. professional_notes) | **Rompe** (admin no ve/aprueba/envía reportes) |
| `/pacientes` | patients, patient_profiles | **Degrada** (roster admin vacío; el nav sigue) |
| `/pagos` (selector de paciente del checkout) | patients | **Degrada** (dropdown vacío; la lista de transacciones sigue) |

El admin sigue pineado a esas rutas en `nav-config` y pasa sus policies (`canViewPatients`, `canManageReports`, `canCreateCheckout` incluyen admin). Dejarlo así = ítems de nav que renderizan vacío.

## 3. Las tres decisiones (LEGALES + NEGOCIO — las decide Santiago con su abogado)

> Lo de abajo es la **lectura del equipo Atlas como PROPUESTA**, no una decisión. La autoridad es el abogado de Santiago.

**Decisión 1 · Seudonimización de dato estructurado.** *Propuesta: NO hay nivel intermedio; el acceso a dato estructurado es SIEMPRE identificado y auditado (motivo + aprobación).* Para una nota, ocultar el nombre funciona (es texto sobre una persona). Para una fila de bioimpedancia, quitar el documento no seudonimiza gran cosa: peso, talla, edad y sexo identifican bastante en una red de pocos profesionales. Un nivel intermedio daría falsa sensación de protección. Esta decisión es la que MÁS pesa (define el tamaño del bloque): si se acepta la propuesta, no hace falta redacción campo por campo, solo el Nivel-c identificado sobre estructurado.

**Decisión 2 · Admin post-cierre.** *Propuesta: el admin pierde el acceso clínico del todo; si necesita ver, pide grant (como soporte).* Un rol operativo que lee la historia clínica de cualquier paciente es justo lo que este bloque cierra. Implica **quitar admin de esas rutas en el menú y de sus policies** (`canViewPatients`/`canManageReports`/`canCreateCheckout`), no dejar ítems que rendericen vacío.

**Decisión 3 · `patients_select` de soporte.** *Propuesta: se queda como está.* Un documento sin nombre ni contenido clínico es el mínimo para identificar de qué paciente habla un integrante. Estrecharlo más haría el soporte impracticable sin ganar mucho.

**Hallazgos que reducen el riesgo (verificados):** (a) **soporte NO depende del acceso amplio del admin** — ya está seudonimizado por diseño (ve documento, no nombres ni clínico); cerrar el god-view no rompe el soporte, solo destapa que nunca hubo vía sobre dato ESTRUCTURADO. (b) **ningún dashboard agrega dato clínico** — el acceso amplio es latente.

## 4. El mecanismo: se extiende, no se reemplaza

La forma se replica limpio: `has_active_grant(tipo, recurso)` + patrón RLS `prof OR (has_active_grant(...) AND anexo3)`, la matriz de aprobación (soporte→admin, admin→dirección), los topes de tiempo. Las páginas del profesional heredan la restricción por RLS, sin rediseño. Hace falta: **valores nuevos** en `access_grant_type` (p. ej. `structured_identified`) y la **categoría de motivo** que el chat legal nombró (`soporte técnico sobre dato estructurado`). Con la propuesta de Decisión 1 (solo identificado), NO hace falta un tipo "estructurado seudonimizado" ni redacción campo por campo.

## 5. Fases (con las 3 decisiones tomadas)

- **F1 · Enums + helper:** nuevo `access_grant_type` estructurado + categoría de motivo. `has_active_grant` ya sirve. Migración.
- **F2 · Cerrar RLS por familia** (una migración por familia, verificable): insumos/motor → salidas → identidad. Cada una: quitar el branch `admin`, dejar `prof` (+ grant identificado por la vía de servidor, no RLS).
- **F3 · Vía de servidor auditada** para lo identificado estructurado (espejo de `access-identified-notes.ts`): lee por owner/BYPASSRLS, escribe `access.used`.
- **F4 · Nav/policies:** quitar admin de las 4 rutas que quedan vacías (o cablear el acceso por grant).
- **F5 · Superficie de soporte** sobre dato estructurado (solicitar/ver, audited).

**Precondición dura:** F1-F5 NO se arrancan sin la respuesta del abogado a las 3 decisiones (en especial la 1). Registrado en `BACKLOG.md`.
