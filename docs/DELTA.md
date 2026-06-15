# DELTA.md — Correcciones a aplicar a la documentación de Atlas

**Propósito.** Lista de ediciones a los documentos del proyecto, derivadas del cierre legal (DATA_GOVERNANCE.md v1.0, CONSENT_ATLAS.md v1.2 e Informe de Brechas). Aplicar de forma disciplinada, un commit por documento, mostrando `git diff` antes de comitear.

**Cuándo aplicarlo.** Después de colocar los docs en `docs/` (B0) y ANTES de empezar B1 (esquema y RLS). No bloquea B0.

**Ya hecho fuera de este DELTA (no re-aplicar):**
- `CLAUDE.md` ya viene actualizado (supply chain alineado a pnpm 11 + regla dura 15). No lo edites salvo lo indicado en la sección CLAUDE.md de abajo.
- La región de Supabase ya fue cambiada a Estados Unidos por Santiago en `DEPLOY.md`. Aquí solo se pide verificar consistencia en los demás docs.

**Prioridades:** `[BLOQUEANTE]` antes de tocar el esquema; `[IMPORTANTE]` antes de cerrar el bloque correspondiente; `[MENOR]` higiene de consistencia.

---

## DATABASE.md

### D1 [BLOQUEANTE] `patient_consents`: agregar `revoked_at`
En la tabla `public.patient_consents`, agregar:
```sql
revoked_at timestamptz   -- null = autorización vigente; con valor = revocada (no se borra el registro)
```
Motivo: el consentimiento y el Anexo 3 garantizan al titular el derecho a revocar cada autorización. Sin este campo no se puede registrar ni verificar la revocación. (Informe B1-A; DATA_GOVERNANCE; CONSENT_ATLAS nota técnica.)

### D2 [IMPORTANTE] `consent_type`: crear enum y migrar la columna
En el bloque de Enums, agregar:
```sql
create type consent_type_enum as enum (
  'servicio', 'datos_sensibles', 'internacional_ia',
  'investigacion', 'comunicaciones_continuidad', 'comunicaciones_comerciales'
);
```
Cambiar `patient_consents.consent_type` de `text` a `consent_type_enum`.
Recomendado (integridad): índice parcial único para impedir dos autorizaciones activas del mismo tipo por paciente:
```sql
create unique index patient_consents_one_active_idx
  on public.patient_consents (patient_id, consent_type)
  where revoked_at is null;
```
Implica que re-consentir revoca primero la anterior, dentro de una transacción. NO poner `unique(patient_id, consent_type)` a secas (rompería el re-consentimiento). (Informe B1-B; CONSENT_ATLAS.)

### D3 [MENOR] `devices`: agregar `brand`
En `public.devices`, agregar `brand text`. El `asset_code` es agnóstico del fabricante; la marca va explícita junto a `model` y `supplier`. (Informe B1-C; DATA_GOVERNANCE.)

### D4 [IMPORTANTE / contenido] Lenguaje funcional en `efr_states`
No renombrar tablas ni columnas (decisión de Santiago: el dominio se llama `diagnoses` porque el acto diagnóstico lo realiza el profesional). Pero el CONTENIDO de `efr_states.diagnosis_name` (los 81 estados) debe usar lenguaje funcional ("Estado funcional deteriorado"), no de enfermedad. Agregar un comentario en la tabla `efr_states` recordándolo; el contenido real se valida con Gildardo al poblar el `model-registry` en B11. (Informe B12-A; DATA_GOVERNANCE lenguaje estandarizado.)

---

## MVP.md

### M1 [IMPORTANTE] Flujo de consentimiento por capas (añadir a "Flujos transversales")
Antes de la encuesta (inicial y seguimiento) se presenta el consentimiento por capas: intro corta, 3 casillas necesarias (`servicio`, `datos_sensibles`, `internacional_ia`) que habilitan "continuar", 3 casillas opcionales que se registran de forma independiente, y "ver más" con el texto completo. Las casillas no vienen pre-marcadas. El `document_hash` cubre el texto de cara al paciente, no el resumen (ver regla de hash en CONSENT_ATLAS.md, sección C de este DELTA). (Informe B7-A; DATA_GOVERNANCE.)

### M2 [IMPORTANTE] Gate de autorización antes de crear evaluación
Atlas verifica que las 3 autorizaciones necesarias estén presentes y vigentes (`consent_type IN ('servicio','datos_sensibles','internacional_ia')` y `revoked_at IS NULL`) antes de crear una evaluación. Si falta una, bloquear y solicitar renovación. Aplica también al flujo de seguimiento; si la versión del consentimiento subió de número MAYOR, se requiere re-consentir. Implementarlo dentro de la policy `evaluations/can-create-evaluation` (no como chequeo suelto). Es la regla dura 15. (Informe B7-B.)

### M3 [IMPORTANTE] Validación de mayoría de edad (+18)
El MVP opera solo con mayores de 18. El flujo de la encuesta valida la declaración de mayoría de edad (CONSENT_ATLAS sección 11) antes de continuar. (DATA_GOVERNANCE; CONSENT_ATLAS.)

### M4 [MENOR] CSV → XLSX
En el módulo `bis` y en "Dependencias externas", reemplazar "CSV" por "XLSX" (el export de Biody Manager es XLSX, procesado con SheetJS). "Necesita un CSV de muestra real" → "Necesita un XLSX de muestra".

### M5 [MENOR] Cerrar items abiertos resueltos
En "Items abiertos": marcar como resueltos la región (Estados Unidos, ver DATA_GOVERNANCE decisión #3) y el gestor de secretos (Bitwarden, plan Free). Dejar abierto solo el texto/versión final del consentimiento pendiente de revisión jurídica.

### M6 [MENOR] Ajustar criterios de aceptación
- B1: agregar al criterio que el esquema incluye `revoked_at` y el enum `consent_type_enum`.
- B7: agregar que no se crea evaluación sin las 3 autorizaciones necesarias vigentes (gate M2) y que se valida +18.
- B15: agregar checklist documental de DPA de sub-encargados archivados (ver S-section). (Informe B15-A.)

---

## ARCHITECTURE.md

### A1 [IMPORTANTE] Regla dura 15
Agregar a "Las reglas duras del proyecto":
```
15. Ninguna evaluación sin las autorizaciones de consentimiento necesarias vigentes
    (servicio, datos_sensibles, internacional_ia; revoked_at IS NULL). Se verifica en la
    policy evaluations/can-create-evaluation, también en el flujo de seguimiento.
```
Actualizar toda referencia a "14 reglas" → "15 reglas" en este documento. (Nota: el `CLAUDE.md` entregado ya trae la regla 15; idealmente aplica esta edición ANTES de B0 para que ambos docs coincidan en el conteo. Si no, es cosmético y no rompe B0.)

### A2 [MENOR] Cerrar items abiertos resueltos
En "Items abiertos por verificar": región resuelta (Estados Unidos, DATA_GOVERNANCE #3); gestor de secretos resuelto (Bitwarden Free). En la tabla de stack, "Secretos: (por confirmar)" → "Bitwarden (Free)". La nota "Verificar residencia + DPA (Bloque 3)" → la residencia ya está decidida (US); el archivado de DPA queda en B15.

### A3 [MENOR] CSV → XLSX
En "Integraciones externas", "validación del CSV al importar" → "validación del XLSX al importar".

### A4 [MENOR] Documentos relacionados
Agregar `CONSENT_ATLAS.md` a la lista de "Documentos relacionados".

---

## SECURITY.md

### S1 [IMPORTANTE] Cifrado a nivel de columna: diferir a post-MVP
Cambiar la postura de "no se difiere a futuro como en el LMS" a: para el MVP, la protección de la PII descansa en RLS estricto + cifrado en reposo de Supabase + aislamiento de PII en `patient_profiles`. El cifrado a nivel de columna (pgcrypto/KMS) sobre identificadores directos se evalúa post-MVP, salvo que jurídico lo exija explícitamente. (Decisión de Santiago, F2.)

### S2 [IMPORTANTE] Gate de consentimiento en el modelo de autorización
En "Modelo de autorización", documentar que la policy `evaluations/can-create-evaluation` verifica las autorizaciones necesarias vigentes (regla dura 15). Agregar el test correspondiente en "Tests de seguridad mínimos".

### S3 [MENOR] DATA_GOVERNANCE como fuente de verdad de gobernanza
La sección "Tratamiento de datos personales y de salud" precede a DATA_GOVERNANCE.md y en parte lo duplica. Recortarla a un puntero ("ver DATA_GOVERNANCE.md como fuente de verdad de gobernanza del dato") y conservar aquí solo los controles técnicos. En particular, la región ya está decidida (US): quitar el "por verificar... región de Supabase".

### S4 [MENOR] CSV → XLSX
En "Input sanitization" y en la tabla de rate limiting, reemplazar "CSV de Biody Manager" / "import CSV" por XLSX.

---

## DEPLOY.md

### P1 [VERIFICAR] Región (Santiago ya la cambió a US)
Confirmar que §6 dice una región de Estados Unidos (ej. `us-east-1`) y que se quitó "sujeto a verificación". Confirmar también que ARCHITECTURE.md, MVP.md y SECURITY.md quedaron consistentes con US (ver A2, M5, S3).

### P2 [MENOR] pnpm-workspace.yaml: strict + exclude
Agregar al ejemplo de `pnpm-workspace.yaml`:
```yaml
minimumReleaseAgeStrict: false
minimumReleaseAgeExclude:
  - "@types/*"
```
Y confirmar que se usa `allowBuilds` (no `onlyBuiltDependencies`). Verificar la ubicación/sintaxis exacta contra pnpm.io/settings al aplicar.

### P3 [MENOR] Gestor de secretos
En "Cuentas y servicios" y en el runbook 11, fijar Bitwarden (plan Free, servidores .com) como el gestor confirmado.

---

## DATA_GOVERNANCE.md

### G1 [MENOR] Nombre del Oficial de Protección de Datos
Corregir "Santiago Arroyo" → "Santiago Arroyave" donde aparezca (secciones "Derechos del titular" y "Roles y gobernanza interna").

### G2 [MENOR] Referencia a CONSENT_ATLAS.md
En la sección "Consentimiento", referenciar `docs/CONSENT_ATLAS.md` como la fuente de verdad del texto y del `document_hash`.

---

## CONSENT_ATLAS.md

### C1 [IMPORTANTE] Definir con precisión sobre qué se calcula el `document_hash`
Hoy dice "hash del contenido exacto de este archivo", lo que es ambiguo y frágil. Reemplazar por una regla precisa y reproducible:

> El `document_hash` es el SHA-256 calculado sobre el **texto de cara al paciente (secciones 1 a 13)** con los placeholders intactos (`{{...}}` literales, sin rellenar), **excluyendo** los bloques internos ("Aviso interno", "Registro técnico", "Historial de versiones"). Normalización fija antes de hashear: codificación UTF-8, saltos de línea LF, sin espacios en blanco al final de línea.

Motivo: (a) si se hashea el archivo completo, editar el historial de versiones invalidaría consentimientos previos sin que el acuerdo cambie; (b) si se hashea el texto ya rellenado con el profesional, cada paciente tendría un hash distinto y se pierde el "hash = versión del consentimiento". El profesional concreto se registra aparte (relación paciente-profesional), no en el hash. Implementar este cálculo en B7 y dejar una función de verificación reproducible.

### C2 [INFORMATIVO] Confirmar con jurídico
La comercialización de derivados anonimizados está incluida como finalidad NECESARIA (sección 4). Es defendible (dato anonimizado no es dato personal), pero conviene que jurídico ratifique que va como necesaria y no como opcional. No es cambio de código.

---

## Resumen de prioridades

| ID | Documento | Prioridad | Tipo |
|----|-----------|-----------|------|
| D1 | DATABASE | BLOQUEANTE | Esquema |
| D2 | DATABASE | IMPORTANTE | Esquema |
| M1 | MVP | IMPORTANTE | Flujo/UX |
| M2 | MVP | IMPORTANTE | Lógica/policy |
| M3 | MVP | IMPORTANTE | Lógica |
| A1 | ARCHITECTURE | IMPORTANTE | Regla dura |
| S1 | SECURITY | IMPORTANTE | Decisión |
| S2 | SECURITY | IMPORTANTE | Policy/test |
| C1 | CONSENT_ATLAS | IMPORTANTE | Implementación hash |
| D3 | DATABASE | MENOR | Esquema |
| D4 | DATABASE | MENOR (contenido) | Lenguaje |
| M4,M5,M6 | MVP | MENOR | Consistencia |
| A2,A3,A4 | ARCHITECTURE | MENOR | Consistencia |
| S3,S4 | SECURITY | MENOR | Consistencia |
| P1,P2,P3 | DEPLOY | MENOR/VERIFICAR | Consistencia |
| G1,G2 | DATA_GOVERNANCE | MENOR | Consistencia |
| C2 | CONSENT_ATLAS | INFORMATIVO | Revisión jurídica |
