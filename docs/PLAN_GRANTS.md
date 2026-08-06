# PLAN_GRANTS.md — Cerrar el acceso amplio del admin al contenido clínico

**Estado: PLAN. El dictamen legal LLEGÓ (2026-08-06, `docs/entregas/RESPUESTA_CONSULTA_ACCESO_DATOS.md`); las tres decisiones están TOMADAS y las fases quedan desbloqueadas.** La ratificación del asesor externo sobre la Decisión 1 la gestiona Santiago; no bloquea el diseño ni la construcción. Es acceso a datos de salud; una decisión mal tomada aquí es cara de deshacer. Gate del Hito 2/3 (ver `LANZAMIENTO.md`, `BACKLOG.md` "Extender el mecanismo de grants", `DATA_GOVERNANCE.md:237`).

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

## 3. Las decisiones (RATIFICADAS por el dictamen legal, 2026-08-06)

> Ya NO es propuesta del equipo: el dictamen (`RESPUESTA_CONSULTA_ACCESO_DATOS.md`) resolvió las tres. La ratificación del asesor externo sobre la Decisión 1 la gestiona Santiago; no bloquea construir.

**Decisión 1 · Seudonimización de dato estructurado. RESUELTA: el Nivel (b) seudonimizado SE CONSERVA. Invierte la propuesta del equipo.** El argumento técnico (quitar el documento no anonimiza: peso/talla/edad/sexo reidentifican) es correcto y el dictamen lo concede, pero la conclusión era errónea. El Consentimiento de ATLAS (numeral 4) distingue el control de calidad RUTINARIO sobre dato seudonimizado del acceso IDENTIFICADO excepcional, y les da alcances distintos; eliminar el nivel seudonimizado dejaría toda auditoría de calidad bajo el supuesto excepcional, que el paciente NO autorizó para lo rutinario, y CNV quedaría sin base consentida para auditar. **Consecuencia de peso: la redacción campo por campo VUELVE** (hay que exponer el dato estructurado SIN identidad, no solo el identificado), justo lo que la propuesta original evitaba. Con tres correcciones:
  1. Todo acceso de Nivel (b) se registra igual que el (c). **Ya cumplido:** `access.used` se emite para `notes_pseudonymous` en `/auditoria/notas` (verificado 2026-08-06); al extender a estructurado, la vía seudonimizada estructurada debe emitirlo igual.
  2. En NINGUNA interfaz ni documento se describe el Nivel (b) como "anónimo". **Ya cumplido en UI:** `labels.ts` y el formulario dicen "Seudonimizado (sin identidad del paciente)". Mantenerlo al extender.
  3. Se acota el ALCANCE del grant de Nivel (b): ver Decisión 1-bis.

**Decisión 1-bis · Alcance del grant Nivel (b) (observación B del dictamen).** Hoy el Nivel (b) da hasta 90 días SIN scope a paciente, lo que se parece a monitoreo continuo y general, que la Cláusula 17 del Anexo 3 prohíbe. **RESUELTA: se conserva la duración generosa (auditar toma tiempo) pero se ACOTA EL OBJETO:** el grant se otorga sobre un conjunto declarado al solicitarlo (muestra, cohorte o universo: los pacientes de tal profesional, una muestra de tal tamaño, tal período), no sobre "todo lo seudonimizado". Cambia el modelo del grant estructurado (un campo de alcance en la solicitud + su verificación). Con el objeto acotado, el tope de 90 días deja de ser problemático.

**Decisión 2 · Admin post-cierre. RESUELTA (de acuerdo sin reservas):** el admin pierde el acceso clínico permanente; si necesita ver, pide grant como soporte. Y el criterio se EXTIENDE a TODO el contenido clínico identificado estructurado (evaluaciones, BIS, diagnósticos, tratamientos, reportes, pacientes), no solo a las notas: la Cláusula 17 no distingue por formato del dato, sino por si es contenido clínico ligado a identidad. Implica quitar admin de las 4 rutas del menú y de sus policies (`canViewPatients`/`canManageReports`/`canCreateCheckout`).

**Decisión 3 · `patients_select` de soporte. RESUELTA (de acuerdo, con matiz):** soporte conserva el número de documento (sin nombre ni clínico) MÁS registro de la consulta. El identificador interno opaco (preferencia del jurídico: protege más) queda como MEJORA PENDIENTE, para cuando la red crezca (exige que soporte busque por documento sin verlo = rediseño). Lo que NO se acepta es el documento SIN registro.

**Decisión 4 · Conservación del `clinical_audit_log`. RESUELTA (Santiago, alineado con el dictamen): QUINCE AÑOS**, el mismo plazo que la historia clínica (Resolución 839 de 2017). La norma no fija plazo para bitácoras de acceso; queda en cabeza de CNV. Razón: si en diez años hay controversia sobre una atención, la historia existe pero sin el registro de accesos no se puede demostrar quién la vio. Va a la Política de Seguridad. Barato: escribir la política y no borrar.

**Hallazgos que reducen el riesgo (verificados, siguen vigentes):** (a) **soporte NO depende del acceso amplio del admin** — ya está seudonimizado por diseño; (b) **ningún dashboard agrega dato clínico** — el acceso amplio es latente.

## 4. El mecanismo: se extiende, y ahora con DOS niveles sobre estructurado

La forma se replica: `has_active_grant(tipo, recurso)` + patrón RLS `prof OR (has_active_grant(...) AND anexo3)`, la matriz de aprobación (soporte→admin, admin→dirección), los topes de tiempo; las páginas del profesional heredan por RLS, sin rediseño. **Cambio grande respecto de la versión anterior de este plan (el Nivel b se conserva):** el dato estructurado necesita DOS niveles, espejo de las notas, no uno solo:
- `structured_pseudonymous` (Nivel b): dato clínico estructurado SIN identidad, para calidad rutinaria. Gobernado por RLS + firma del Anexo 3, acotado por muestra/cohorte (Decisión 1-bis), tope 90 días. **Exige la redacción campo por campo:** decidir, por tabla/familia, qué columnas son clínicas (se muestran) y cuáles identifican (se redactan: nombre, documento, contactos). Es el trabajo que la propuesta original evitaba y que ahora vuelve.
- `structured_identified` (Nivel c): dato estructurado CON identidad, excepcional, por vía de servidor auditada (espejo de `access-identified-notes.ts`), por paciente puntual, tope 7 días.

Hace falta: dos valores nuevos en `access_grant_type` (`structured_pseudonymous`, `structured_identified`) + las categorías de motivo + el CAMPO DE ALCANCE (muestra/cohorte) del Nivel b.

## 5. Fases (RE-DIMENSIONADAS: el Nivel b se conserva, la redacción campo por campo vuelve)

La versión anterior asumía "solo identificado" (5 fases livianas). Con el Nivel (b) conservado, crece: aparece toda la capa seudonimizada estructurada (la más costosa) y el alcance acotado del grant.

- **F1 · Enums + helper + alcance:** DOS `access_grant_type` nuevos + categorías de motivo + el CAMPO DE ALCANCE del Nivel b (muestra/cohorte/universo) en la solicitud y su verificación. `has_active_grant` sirve; el alcance es nuevo. Migración. **(Más grande que antes: antes era un solo tipo sin alcance.)**
- **F2 · Cerrar RLS por familia** (insumos/motor → salidas → identidad): quitar el branch `admin`, dejar `prof`. Igual que antes.
- **F3 · Redacción campo por campo (NUEVA, la más pesada):** por cada familia estructurada, la vista/lector seudonimizado que muestra lo clínico y redacta la identidad (nombre, documento, contactos). Es el trabajo que la propuesta "solo identificado" eliminaba. Gobernada por RLS + Anexo 3 como las notas Nivel b, con `access.used` y el alcance de la Decisión 1-bis.
- **F4 · Vía de servidor auditada** para lo identificado estructurado (espejo de `access-identified-notes.ts`): lee por owner/BYPASSRLS, escribe `access.used`, por paciente puntual. (Era la F3 vieja.)
- **F5 · Nav/policies:** quitar admin de las 4 rutas vacías. (Era la F4 vieja.)
- **F6 · Superficie de soporte y de auditoría de calidad:** solicitar/ver sobre estructurado, seudonimizado (con alcance) e identificado, auditado. Crece: ahora hay una superficie de auditoría de calidad seudonimizada, no solo soporte.

**Resumen del reajuste:** de 5 fases "solo identificado" a 6, con F1 más grande (dos tipos + alcance) y una fase NUEVA y pesada (F3, redacción campo por campo). El costo que se evitaba eliminando el Nivel (b) es exactamente lo que se recupera al conservarlo; el dictamen lo acepta como el precio de tener base consentida para la auditoría rutinaria.

**Precondición:** el dictamen llegó; F1-F6 quedan desbloqueadas. La ratificación externa de la Decisión 1 (Arley) la gestiona Santiago; no bloquea el diseño ni la construcción. Falta cerrar dos parámetros operativos: la conservación quedó en 15 años (Decisión 4); el identificador interno de soporte queda pendiente (Decisión 3).
